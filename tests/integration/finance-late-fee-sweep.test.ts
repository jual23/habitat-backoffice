import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestBuilding,
  createTestApartment,
  createTestPayment,
  createTestUser,
  deleteTestUser,
  cleanupTestBuilding,
  getServiceClient,
} from '../fixtures';

/**
 * T013: `generate_monthly_payments()` creates exactly one row per fee-having
 * apartment with the correct `due_date` (including the month-rollover rule),
 * and is idempotent across repeated runs on the same day; `evaluate_payment_
 * due_dates()` applies the configured late fee exactly once and inserts a
 * reminder for a payment due tomorrow.
 *
 * Every date here is anchored to "today in America/Panama" (this fixture
 * building's default `timezone`), matching exactly what the SQL functions
 * themselves compute (`now() at time zone b.timezone`) -- not the test
 * runner machine's local time or the database's UTC `current_date`, which
 * can legitimately differ by a day depending on time of day (the bug this
 * suite caught pre-fix: 0027c_payment_sweeps_timezone_fix.sql).
 */

/** America/Panama has no DST (fixed UTC-5) -- safe to do calendar-day math in UTC once anchored. */
function panamaTodayParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === 'year')!.value),
    month: Number(parts.find((p) => p.type === 'month')!.value),
    day: Number(parts.find((p) => p.type === 'day')!.value),
  };
}

function dateStr(year: number, monthIndex0: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex0, day)).toISOString().slice(0, 10);
}

describe('Finance scheduled sweeps', () => {
  let buildingId: string;
  let apartmentId: string;
  const { year, month, day: todayDay } = panamaTodayParts();
  // A due day guaranteed <= today's day-of-month, forcing the "roll to next
  // month" branch (a payment can't be due before it's available).
  const dueDay = todayDay === 1 ? 1 : todayDay - 1;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    apartmentId = await createTestApartment(buildingId, {});
    const svc = getServiceClient();
    await svc
      .from('buildings')
      .update({
        payment_available_day: todayDay,
        payment_due_day: dueDay,
        late_fee_type: 'flat',
        late_fee_amount: 10,
      })
      .eq('id', buildingId);
    await svc.from('apartments').update({ monthly_fee: 150 }).eq('id', apartmentId);
  });

  afterAll(async () => {
    await cleanupTestBuilding(buildingId);
  });

  it('generates exactly one payment per fee-having apartment, with the rolled-over due date, and is idempotent', async () => {
    const svc = getServiceClient();
    const { error } = await svc.rpc('generate_monthly_payments');
    expect(error).toBeNull();

    const { data: firstRun } = await svc.from('payments').select('id, amount, due_date').eq('apartment_id', apartmentId);
    expect(firstRun).toHaveLength(1);
    expect(firstRun?.[0]?.amount).toBe(150);
    // `month` is Intl's 1-indexed current month; passed as dateStr's 0-indexed
    // arg, it lands one month ahead -- exactly the roll-to-next-month this
    // asserts (dueDay <= availableDay).
    expect(firstRun?.[0]?.due_date).toBe(dateStr(year, month, dueDay));

    // Running it again the same day must not create a second payment.
    const { error: secondError } = await svc.rpc('generate_monthly_payments');
    expect(secondError).toBeNull();
    const { data: secondRun } = await svc.from('payments').select('id').eq('apartment_id', apartmentId);
    expect(secondRun).toHaveLength(1);
  });

  it('applies the configured late fee exactly once for an overdue payment', async () => {
    const yesterday = dateStr(year, month - 1, todayDay - 1);
    const payment = await createTestPayment(buildingId, apartmentId, {
      amount: 100,
      status: 'pending',
      due_date: yesterday,
    });

    const svc = getServiceClient();
    const { error } = await svc.rpc('evaluate_payment_due_dates');
    expect(error).toBeNull();

    const { data: afterFirst } = await svc.from('payments').select('status, late_fee_amount').eq('id', payment).single();
    expect(afterFirst?.status).toBe('overdue');
    expect(afterFirst?.late_fee_amount).toBe(10);

    // Running the sweep again must not re-apply the fee (it only matches
    // rows still pending/submitted -- this row is now 'overdue').
    const { error: secondError } = await svc.rpc('evaluate_payment_due_dates');
    expect(secondError).toBeNull();
    const { data: afterSecond } = await svc.from('payments').select('late_fee_amount').eq('id', payment).single();
    expect(afterSecond?.late_fee_amount).toBe(10);
  });

  it('inserts a reminder notification for every resident of an apartment whose payment is due tomorrow (FR-021)', async () => {
    const resident = await createTestUser({ role: 'resident', buildingId, apartmentId });
    try {
      const tomorrow = dateStr(year, month - 1, todayDay + 1);
      await createTestPayment(buildingId, apartmentId, { status: 'pending', due_date: tomorrow });

      const svc = getServiceClient();
      const { error } = await svc.rpc('evaluate_payment_due_dates');
      expect(error).toBeNull();

      const { data: notifs } = await svc
        .from('notifications')
        .select('id')
        .eq('user_id', resident.userId)
        .eq('link', '/payments');
      expect((notifs ?? []).length).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteTestUser(resident.userId);
    }
  });
});
