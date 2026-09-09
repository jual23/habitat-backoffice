'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { apartmentSchema, type ApartmentInput } from '@/lib/validation/apartments';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

export async function createApartment(
  buildingId: string,
  input: ApartmentInput,
): Promise<ActionResult> {
  const parsed = apartmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireBuildingAdmin();

  const { data, error } = await supabase
    .from('apartments')
    .insert({ building_id: buildingId, ...parsed.data })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'This unit already exists in this building.' };
    }
    return { ok: false, error: error.message };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'apartment.create',
    entityType: 'apartment',
    entityId: data.id,
    metadata: parsed.data,
  });

  revalidatePath('/apartments');
  return { ok: true };
}

export async function updateApartment(
  apartmentId: string,
  buildingId: string,
  input: ApartmentInput,
): Promise<ActionResult> {
  const parsed = apartmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('apartments')
    .update(parsed.data)
    .eq('id', apartmentId);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'This unit already exists in this building.' };
    }
    return { ok: false, error: error.message };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'apartment.update',
    entityType: 'apartment',
    entityId: apartmentId,
    metadata: parsed.data,
  });

  revalidatePath('/apartments');
  return { ok: true };
}

/**
 * Edge Cases: deleting an apartment that still has residents is rejected. The
 * `profiles.apartment_id` FK is `ON DELETE RESTRICT` (see the
 * apartments_restrict_delete_with_residents migration), so Postgres itself
 * refuses this with a 23503 foreign_key_violation, which we translate here.
 */
export async function deleteApartment(
  apartmentId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('apartments').delete().eq('id', apartmentId);

  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        error: 'Cannot delete an apartment that still has residents assigned to it.',
      };
    }
    return { ok: false, error: error.message };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'apartment.delete',
    entityType: 'apartment',
    entityId: apartmentId,
  });

  revalidatePath('/apartments');
  return { ok: true };
}
