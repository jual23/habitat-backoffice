/**
 * 007-finance-ops-expansion (T035, research.md item 7): pure next-due-date
 * math for a completed maintenance task, extracted from
 * `app/(backoffice)/maintenance/actions.ts`'s `completeTask()` so it's
 * directly unit-testable from Vitest -- Server Actions in this codebase read
 * `cookies()` and can't be invoked outside a real Next.js request (see
 * tests/integration/tickets-workflow.test.ts's precedent).
 *
 * FR-037: advances from the task's PRE-completion `next_due_date` (not
 * "today") -- a monthly task completed early or late still advances a fixed
 * month from its own scheduled date. `once` always returns null (Edge Cases:
 * a one-time task marked done generates no further occurrence).
 */
export function advanceDueDate(
  currentDueDate: string | null,
  frequency: 'once' | 'weekly' | 'monthly' | 'every_n_months',
  intervalMonths: number | null,
): string | null {
  if (frequency === 'once') return null;
  const base = currentDueDate ? new Date(`${currentDueDate}T00:00:00Z`) : new Date();
  if (frequency === 'weekly') {
    base.setUTCDate(base.getUTCDate() + 7);
  } else if (frequency === 'monthly') {
    base.setUTCMonth(base.getUTCMonth() + 1);
  } else {
    base.setUTCMonth(base.getUTCMonth() + (intervalMonths ?? 1));
  }
  return base.toISOString().slice(0, 10);
}
