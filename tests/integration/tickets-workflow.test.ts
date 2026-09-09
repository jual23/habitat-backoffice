import { describe, expect, it } from 'vitest';
import {
  rejectTicketSchema,
  markDuplicateSchema,
  addCommentSchema,
  canResolveFromStatus,
  canMarkDuplicateTarget,
  canAddComment,
} from '@/lib/validation/tickets';

/**
 * T006: ticket status-transition rules at the app-validation layer — the
 * friendly-error path `incidencias/actions.ts` runs ahead of T004's DB-level
 * backstop (RLS `WITH CHECK` / `tickets_status_transition_guard` trigger).
 *
 * Server Actions in this codebase read cookies() (lib/supabase/server.ts),
 * which only works inside a real Next.js request — Vitest can't invoke them
 * directly (see tests/integration/reservations-workflow.test.ts, which tests
 * the underlying operation rather than the 'use server' function itself).
 * Here the transition rules are pure functions/schemas in
 * lib/validation/tickets.ts that the Server Action calls before touching the
 * DB, so they're unit-testable directly; the DB-level backstop is covered by
 * rls-tickets.test.ts and rls-ticket-comments.test.ts.
 */
describe('tickets workflow validation', () => {
  it('blocks rejecting without a rejection_reason', () => {
    const result = rejectTicketSchema.safeParse({ ticket_id: crypto.randomUUID(), rejection_reason: '' });
    expect(result.success).toBe(false);
  });

  it('allows rejecting with a rejection_reason', () => {
    const result = rejectTicketSchema.safeParse({
      ticket_id: crypto.randomUUID(),
      rejection_reason: 'Not a real issue',
    });
    expect(result.success).toBe(true);
  });

  it('blocks marking duplicate without a duplicate_of_ticket_id', () => {
    const result = markDuplicateSchema.safeParse({ ticket_id: crypto.randomUUID(), duplicate_of_ticket_id: '' });
    expect(result.success).toBe(false);
  });

  it('blocks a ticket from duplicating itself', () => {
    const id = crypto.randomUUID();
    const result = markDuplicateSchema.safeParse({ ticket_id: id, duplicate_of_ticket_id: id });
    expect(result.success).toBe(false);
  });

  it('allows marking duplicate against a different ticket id', () => {
    const result = markDuplicateSchema.safeParse({
      ticket_id: crypto.randomUUID(),
      duplicate_of_ticket_id: crypto.randomUUID(),
    });
    expect(result.success).toBe(true);
  });

  it('blocks an empty comment body', () => {
    const result = addCommentSchema.safeParse({ ticket_id: crypto.randomUUID(), body: '   ' });
    expect(result.success).toBe(false);
  });

  it('blocks resolving a pending ticket directly (FR-010)', () => {
    expect(canResolveFromStatus('pending')).toBe(false);
  });

  it('allows resolving a ticket that is in_progress (FR-010)', () => {
    expect(canResolveFromStatus('in_progress')).toBe(true);
  });

  it('blocks marking duplicate against a resolved/rejected/duplicate ticket (FR-009)', () => {
    expect(canMarkDuplicateTarget('resolved')).toBe(false);
    expect(canMarkDuplicateTarget('rejected')).toBe(false);
    expect(canMarkDuplicateTarget('duplicate')).toBe(false);
  });

  it('allows marking duplicate against a pending or in_progress ticket (FR-009)', () => {
    expect(canMarkDuplicateTarget('pending')).toBe(true);
    expect(canMarkDuplicateTarget('in_progress')).toBe(true);
  });

  it('blocks a comment insert when the ticket is not in_progress (Edge Cases)', () => {
    expect(canAddComment('pending')).toBe(false);
    expect(canAddComment('resolved')).toBe(false);
  });

  it('allows a comment insert while the ticket is in_progress', () => {
    expect(canAddComment('in_progress')).toBe(true);
  });
});
