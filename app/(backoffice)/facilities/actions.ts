'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { facilitySchema, type FacilityInput } from '@/lib/validation/facilities';
import { uploadBuildingFile, fileFromFormData, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import type { TablesUpdate } from '@/lib/supabase/database.types';
import { toFriendlyMessage } from '@/lib/errors';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('No autorizado.');
  }
  return { supabase, ctx };
}

export async function createFacility(
  buildingId: string,
  input: FacilityInput,
  imageFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = facilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };
  }

  const { supabase, ctx } = await requireBuildingAdmin();

  let image_url: string | null = null;
  const imageFile = fileFromFormData(imageFormData);
  if (imageFile && imageFile.size > 0) {
    try {
      image_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['facilities'],
        file: imageFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: toFriendlyMessage(e, 'No se pudo subir la imagen.') };
    }
  }

  const { data, error } = await supabase
    .from('facilities')
    .insert({ building_id: buildingId, image_url, ...parsed.data })
    .select('id')
    .single();

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo crear la instalación.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'facility.create',
    entityType: 'facility',
    entityId: data.id,
    metadata: parsed.data,
  });

  revalidatePath('/facilities');
  return { ok: true };
}

export async function updateFacility(
  facilityId: string,
  buildingId: string,
  input: FacilityInput,
  imageFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = facilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };
  }

  const { supabase, ctx } = await requireBuildingAdmin();

  const update: TablesUpdate<'facilities'> = { ...parsed.data };
  const imageFile = fileFromFormData(imageFormData);
  if (imageFile && imageFile.size > 0) {
    try {
      update.image_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['facilities'],
        file: imageFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: toFriendlyMessage(e, 'No se pudo subir la imagen.') };
    }
  }

  const { error } = await supabase.from('facilities').update(update).eq('id', facilityId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar la instalación.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'facility.update',
    entityType: 'facility',
    entityId: facilityId,
    metadata: parsed.data,
  });

  revalidatePath('/facilities');
  return { ok: true };
}

/**
 * FR-009: soft-deletes the facility (`deleted_at`), which triggers
 * `facilities_decline_pending_on_soft_delete()` to decline its still-"requested"
 * reservations (see the facilities_soft_delete_cascade migration).
 */
export async function deleteFacility(
  facilityId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('facilities')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', facilityId);

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo eliminar la instalación.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'facility.delete',
    entityType: 'facility',
    entityId: facilityId,
  });

  revalidatePath('/facilities');
  revalidatePath('/reservations');
  return { ok: true };
}
