'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { registerPackageSchema, type RegisterPackageInput } from '@/lib/validation/packages';
import { uploadBuildingFile, fileFromFormData, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { toFriendlyMessage } from '@/lib/errors';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireStaffOrAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('No autorizado.');
  }
  return { supabase, ctx };
}

/**
 * FR-014/FR-016: register an arrived package and notify every resident of the
 * selected apartment (research.md item 5).
 */
export async function registerPackage(
  buildingId: string,
  input: RegisterPackageInput,
  photoFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = registerPackageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  let photo_url: string | null = null;
  const photoFile = fileFromFormData(photoFormData);
  if (photoFile && photoFile.size > 0) {
    try {
      photo_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['packages'],
        file: photoFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: toFriendlyMessage(e, 'No se pudo subir la foto.') };
    }
  }

  const { data: pkg, error } = await supabase
    .from('packages')
    .insert({
      building_id: buildingId,
      apartment_id: parsed.data.apartment_id,
      description: parsed.data.description,
      photo_url,
      registered_by: ctx.user!.id,
    })
    .select('id')
    .single();

  if (error || !pkg) return { ok: false, error: toFriendlyMessage(error, 'No se pudo registrar el paquete.') };

  const { data: residents } = await supabase
    .from('profiles')
    .select('id')
    .eq('apartment_id', parsed.data.apartment_id);

  for (const resident of residents ?? []) {
    await supabase.from('notifications').insert({
      user_id: resident.id,
      building_id: buildingId,
      title: 'Tienes un paquete',
      body: parsed.data.description,
      link: '/packages',
    });
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'package.register',
    entityType: 'package',
    entityId: pkg.id,
    metadata: { apartment_id: parsed.data.apartment_id, notified: (residents ?? []).length },
  });

  revalidatePath('/packages');
  return { ok: true };
}

/** FR-018: mark a pending package "Recogido". */
export async function markPickedUp(packageId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaffOrAdmin();

  const { error, count } = await supabase
    .from('packages')
    .update({ status: 'picked_up', picked_up_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', packageId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar el paquete.') };
  if (count === 0) return { ok: false, error: 'Este paquete ya no está pendiente.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'package.pickup',
    entityType: 'package',
    entityId: packageId,
  });

  revalidatePath('/packages');
  return { ok: true };
}
