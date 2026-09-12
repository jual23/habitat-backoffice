'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import {
  rejectTicketSchema,
  markDuplicateSchema,
  addCommentSchema,
  canResolveFromStatus,
  canMarkDuplicateTarget,
  canAddComment,
  type RejectTicketInput,
  type MarkDuplicateInput,
  type AddCommentInput,
} from '@/lib/validation/tickets';
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

/** FR-006: move a Pending ticket to In Progress. */
export async function startProgress(ticketId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaffOrAdmin();

  const { error, count } = await supabase
    .from('tickets')
    .update({ status: 'in_progress' }, { count: 'exact' })
    .eq('id', ticketId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar el ticket.') };
  if (count === 0) return { ok: false, error: 'Este ticket ya no está pendiente.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'ticket.status_change',
    entityType: 'ticket',
    entityId: ticketId,
    metadata: { to: 'in_progress' },
  });

  revalidatePath('/incidencias');
  return { ok: true };
}

/**
 * FR-010: a ticket can only be resolved from In Progress. Checked here first
 * (friendly error) ahead of the `tickets_status_transition_guard` trigger's
 * own DB-level rejection (data-model.md).
 */
export async function resolveTicket(ticketId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaffOrAdmin();

  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .single();
  if (fetchError) return { ok: false, error: toFriendlyMessage(fetchError, 'No se pudo cargar el ticket.') };
  if (!ticket) return { ok: false, error: 'Ticket no encontrado.' };
  if (!canResolveFromStatus(ticket.status)) {
    return { ok: false, error: 'Solo un ticket En Progreso puede resolverse.' };
  }

  const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', ticketId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo resolver el ticket.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'ticket.status_change',
    entityType: 'ticket',
    entityId: ticketId,
    metadata: { to: 'resolved' },
  });

  revalidatePath('/incidencias');
  return { ok: true };
}

/** FR-008: reject a ticket with a required reason. */
export async function rejectTicket(input: RejectTicketInput, buildingId: string): Promise<ActionResult> {
  const parsed = rejectTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'rejected', rejection_reason: parsed.data.rejection_reason })
    .eq('id', parsed.data.ticket_id);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo rechazar el ticket.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'ticket.status_change',
    entityType: 'ticket',
    entityId: parsed.data.ticket_id,
    metadata: { to: 'rejected', rejection_reason: parsed.data.rejection_reason },
  });

  revalidatePath('/incidencias');
  return { ok: true };
}

/**
 * FR-009: mark a ticket as a duplicate of another. The target's status
 * (pending/in_progress only) is checked here first (friendly error) ahead of
 * the RLS `WITH CHECK` (contracts/rls-policies.md).
 */
export async function markDuplicate(input: MarkDuplicateInput, buildingId: string): Promise<ActionResult> {
  const parsed = markDuplicateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { data: target, error: fetchError } = await supabase
    .from('tickets')
    .select('status')
    .eq('id', parsed.data.duplicate_of_ticket_id)
    .single();
  if (fetchError) return { ok: false, error: toFriendlyMessage(fetchError, 'No se pudo cargar el ticket destino.') };
  if (!target) return { ok: false, error: 'Ticket destino no encontrado.' };
  if (!canMarkDuplicateTarget(target.status)) {
    return { ok: false, error: 'Un ticket solo puede marcarse como duplicado de uno Pendiente o En Progreso.' };
  }

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'duplicate', duplicate_of_ticket_id: parsed.data.duplicate_of_ticket_id })
    .eq('id', parsed.data.ticket_id);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo marcar el ticket como duplicado.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'ticket.status_change',
    entityType: 'ticket',
    entityId: parsed.data.ticket_id,
    metadata: { to: 'duplicate', duplicate_of_ticket_id: parsed.data.duplicate_of_ticket_id },
  });

  revalidatePath('/incidencias');
  return { ok: true };
}

/** FR-007: a resident-visible comment, only while the ticket is In Progress. */
export async function addComment(input: AddCommentInput, buildingId: string): Promise<ActionResult> {
  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('status')
    .eq('id', parsed.data.ticket_id)
    .single();
  if (fetchError) return { ok: false, error: toFriendlyMessage(fetchError, 'No se pudo cargar el ticket.') };
  if (!ticket) return { ok: false, error: 'Ticket no encontrado.' };
  if (!canAddComment(ticket.status)) {
    return { ok: false, error: 'Solo se pueden agregar comentarios mientras el ticket está En Progreso.' };
  }

  const { error } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: parsed.data.ticket_id, author_id: ctx.user!.id, body: parsed.data.body });
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo agregar el comentario.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'ticket.comment',
    entityType: 'ticket',
    entityId: parsed.data.ticket_id,
  });

  revalidatePath('/incidencias');
  return { ok: true };
}
