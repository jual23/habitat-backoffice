'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
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

/** FR-011: requested -> approved. Only valid from 'requested' (terminal otherwise). */
export async function approveReservation(
  reservationId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error, count } = await supabase
    .from('reservations')
    .update({ status: 'approved', decided_by: ctx.user!.id, decided_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', reservationId)
    .eq('status', 'requested');

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo aprobar la reserva.') };
  if (count === 0) return { ok: false, error: 'Esta reserva ya no está pendiente.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'reservation.approve',
    entityType: 'reservation',
    entityId: reservationId,
  });

  revalidatePath('/reservations');
  return { ok: true };
}

/** FR-012: requested -> declined. Only valid from 'requested'. */
export async function declineReservation(
  reservationId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error, count } = await supabase
    .from('reservations')
    .update({ status: 'declined', decided_by: ctx.user!.id, decided_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', reservationId)
    .eq('status', 'requested');

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo rechazar la reserva.') };
  if (count === 0) return { ok: false, error: 'Esta reserva ya no está pendiente.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'reservation.decline',
    entityType: 'reservation',
    entityId: reservationId,
  });

  revalidatePath('/reservations');
  return { ok: true };
}
