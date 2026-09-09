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

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireStaffOrAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
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

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: 'This ticket is no longer pending.' };

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
  if (fetchError || !ticket) return { ok: false, error: fetchError?.message ?? 'Ticket not found' };
  if (!canResolveFromStatus(ticket.status)) {
    return { ok: false, error: 'Only a ticket that is In Progress can be resolved.' };
  }

  const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', ticketId);
  if (error) return { ok: false, error: error.message };

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
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'rejected', rejection_reason: parsed.data.rejection_reason })
    .eq('id', parsed.data.ticket_id);
  if (error) return { ok: false, error: error.message };

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
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { data: target, error: fetchError } = await supabase
    .from('tickets')
    .select('status')
    .eq('id', parsed.data.duplicate_of_ticket_id)
    .single();
  if (fetchError || !target) return { ok: false, error: fetchError?.message ?? 'Target ticket not found' };
  if (!canMarkDuplicateTarget(target.status)) {
    return { ok: false, error: 'A ticket can only be marked duplicate of a Pending or In Progress ticket.' };
  }

  const { error } = await supabase
    .from('tickets')
    .update({ status: 'duplicate', duplicate_of_ticket_id: parsed.data.duplicate_of_ticket_id })
    .eq('id', parsed.data.ticket_id);
  if (error) return { ok: false, error: error.message };

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
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('status')
    .eq('id', parsed.data.ticket_id)
    .single();
  if (fetchError || !ticket) return { ok: false, error: fetchError?.message ?? 'Ticket not found' };
  if (!canAddComment(ticket.status)) {
    return { ok: false, error: 'Comments can only be added while the ticket is In Progress.' };
  }

  const { error } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: parsed.data.ticket_id, author_id: ctx.user!.id, body: parsed.data.body });
  if (error) return { ok: false, error: error.message };

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
