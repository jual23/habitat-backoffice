import { z } from 'zod';
import type { Enums } from '@/lib/supabase/database.types';

export type TicketStatus = Enums<'ticket_status'>;

/** FR-008: rejecting a ticket requires a reason. */
export const rejectTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  rejection_reason: z.string().trim().min(1, 'A rejection reason is required'),
});
export type RejectTicketInput = z.infer<typeof rejectTicketSchema>;

/**
 * FR-009: marking a ticket duplicate requires a target ticket, and a ticket
 * cannot duplicate itself (spec.md Edge Cases). The target's own status
 * (must be pending/in_progress) is checked against live data at the
 * Server Action/RLS layer via canMarkDuplicateTarget()/the DB `WITH CHECK`
 * below — a Zod schema alone can't see other rows.
 */
export const markDuplicateSchema = z
  .object({
    ticket_id: z.string().uuid(),
    duplicate_of_ticket_id: z.string().uuid(),
  })
  .refine((v) => v.ticket_id !== v.duplicate_of_ticket_id, {
    message: 'A ticket cannot be marked as a duplicate of itself',
    path: ['duplicate_of_ticket_id'],
  });
export type MarkDuplicateInput = z.infer<typeof markDuplicateSchema>;

/** FR-007: a resident-visible comment left while a ticket is in_progress. */
export const addCommentSchema = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty'),
});
export type AddCommentInput = z.infer<typeof addCommentSchema>;

/**
 * FR-010: a ticket can only become `resolved` from `in_progress`. This is the
 * friendly-error check the Server Action runs before writing, ahead of the
 * `tickets_status_transition_guard` DB trigger's own rejection (data-model.md).
 */
export function canResolveFromStatus(status: TicketStatus): boolean {
  return status === 'in_progress';
}

/**
 * FR-009: a ticket may only be linked as a duplicate target while it is
 * `pending` or `in_progress`. Friendly-error check ahead of the RLS
 * `WITH CHECK` (contracts/rls-policies.md).
 */
export function canMarkDuplicateTarget(status: TicketStatus): boolean {
  return status === 'pending' || status === 'in_progress';
}

/** FR-007: comments are only accepted while the ticket is in_progress. */
export function canAddComment(status: TicketStatus): boolean {
  return status === 'in_progress';
}
