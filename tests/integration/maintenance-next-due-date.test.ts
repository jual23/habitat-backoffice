import { describe, expect, it } from 'vitest';
import { advanceDueDate } from '@/lib/maintenance';

/**
 * T029: `advanceDueDate()`'s next-due-date math (FR-037, SC-009) -- extracted
 * to lib/maintenance.ts so it's directly unit-testable (Server Actions can't
 * be invoked from Vitest, per tests/integration/tickets-workflow.test.ts's
 * precedent). The DB-level authorization for who may advance this column is
 * covered separately by rls-maintenance.test.ts.
 */
describe('advanceDueDate()', () => {
  it('advances a weekly task by 7 days from its own due date, not from today', () => {
    expect(advanceDueDate('2026-01-01', 'weekly', null)).toBe('2026-01-08');
  });

  it('advances a monthly task by one calendar month', () => {
    expect(advanceDueDate('2026-01-15', 'monthly', null)).toBe('2026-02-15');
  });

  it('advances a monthly task across a year boundary', () => {
    expect(advanceDueDate('2026-12-20', 'monthly', null)).toBe('2027-01-20');
  });

  it('advances an every_n_months task by its configured interval', () => {
    expect(advanceDueDate('2026-01-01', 'every_n_months', 3)).toBe('2026-04-01');
  });

  it('returns null for a one-time task (no further occurrence, Edge Cases)', () => {
    expect(advanceDueDate('2026-01-01', 'once', null)).toBeNull();
  });

  it('falls back to today when there is no prior due date, for a recurring task', () => {
    const result = advanceDueDate(null, 'weekly', null);
    expect(result).not.toBeNull();
    // Sanity check: it's a valid ISO date string in the future relative to "now".
    expect(new Date(result!).getTime()).toBeGreaterThan(Date.now());
  });
});
