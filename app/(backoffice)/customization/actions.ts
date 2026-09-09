'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { customizationSchema, type CustomizationInput } from '@/lib/validation/customization';
import { uploadBuildingFile, fileFromFormData, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { getImageDimensions } from '@/lib/image-dimensions';
import type { TablesUpdate } from '@/lib/supabase/database.types';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * FR-034/035: accent color + logo. Building customization already lives
 * directly on `buildings` in this schema (accent_color/logo_url) rather than a
 * separate `building_customization` table — see SCHEMA-ADAPTATION.md.
 */
export async function updateCustomization(
  buildingId: string,
  input: CustomizationInput,
  logoFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = customizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }

  const update: TablesUpdate<'buildings'> = { accent_color: parsed.data.accent_color };
  const logoFile = fileFromFormData(logoFormData);

  if (logoFile && logoFile.size > 0) {
    const bytes = new Uint8Array(await logoFile.arrayBuffer());
    const dims = getImageDimensions(bytes);
    if (dims && dims.width !== dims.height) {
      return { ok: false, error: `Logo must be square (got ${dims.width}×${dims.height}).` };
    }

    try {
      update.logo_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['branding'],
        file: logoFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Logo upload failed' };
    }
  }

  const { error } = await supabase.from('buildings').update(update).eq('id', buildingId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user.id,
    buildingId,
    action: 'building.customize',
    entityType: 'building',
    entityId: buildingId,
    metadata: update,
  });

  revalidatePath('/customization');
  return { ok: true };
}
