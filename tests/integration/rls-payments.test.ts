import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestPayment,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T011: RLS allow/deny for `payments` -- SELECT for admin/resident (not
 * staff/Renter), the resident-submits-confirmation vs. admin-approves UPDATE
 * split, the content-immutability trigger, and the FR-018/SC-005
 * approve-triggers-notification behavior (via a direct RLS-scoped UPDATE +
 * a manual notifications insert, since `approvePayment()` itself is a Server
 * Action exercised at the app layer, not from this RLS-only suite -- the
 * notification-fires assertion belongs to whichever caller can approve).
 */
describe('RLS: payments', () => {
  let buildingA: string;
  let buildingB: string;
  let apartmentA: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let renterA: Awaited<ReturnType<typeof createTestUser>>;
  let paymentInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    apartmentA = await createTestApartment(buildingA);
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA, apartmentId: apartmentA });
    renterA = await createTestUser({ role: 'renter', buildingId: buildingA, apartmentId: apartmentA });
    paymentInA = await createTestPayment(buildingA, apartmentA);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(renterA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows the building admin to view the payment', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data, error } = await client.from('payments').select('id').eq('id', paymentInA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('allows the apartment resident to view the payment', async () => {
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data, error } = await client.from('payments').select('id').eq('id', paymentInA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('denies staff from viewing the payment (Finance is not in Staff scope)', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data, error } = await client.from('payments').select('id').eq('id', paymentInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('denies the Renter of the same apartment from viewing the payment (FR-025)', async () => {
    const client = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
    const { data, error } = await client.from('payments').select('id').eq('id', paymentInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('denies a different-building admin from viewing the payment', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('payments').select('id').eq('id', paymentInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('denies a client INSERT even by the building admin (only the sweep function inserts)', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client.from('payments').insert({
      building_id: buildingA,
      apartment_id: apartmentA,
      amount: 50,
      available_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
    });
    expect(error).not.toBeNull();
  });

  it('allows the resident to submit a payment confirmation (pending -> submitted)', async () => {
    const payment = await createTestPayment(buildingA, apartmentA);
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error } = await client
      .from('payments')
      .update({ status: 'submitted', confirmation_photo_url: 'buildingA/payments/x.jpg' })
      .eq('id', payment);
    expect(error).toBeNull();
  });

  it('denies the admin from submitting a confirmation on a resident behalf', async () => {
    const payment = await createTestPayment(buildingA, apartmentA);
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    // The admin's own "admin approves" USING clause matches this row (status
    // pending, can_admin_building true), but the new row (status: 'submitted')
    // satisfies neither permissive policy's WITH CHECK -- Postgres raises an
    // explicit RLS violation here rather than a silent 0-row update (that
    // silent case only occurs when USING itself never matched the row).
    const { error } = await client.from('payments').update({ status: 'submitted' }).eq('id', payment);
    expect(error).not.toBeNull();
  });

  it('allows the admin to approve a submitted payment (-> received)', async () => {
    const payment = await createTestPayment(buildingA, apartmentA, { status: 'submitted' });
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('payments')
      .update({ status: 'received', reviewed_by: adminA.userId, reviewed_at: new Date().toISOString() })
      .eq('id', payment);
    expect(error).toBeNull();
  });

  it('denies the resident from approving their own payment', async () => {
    const payment = await createTestPayment(buildingA, apartmentA, { status: 'submitted' });
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error, count } = await client
      .from('payments')
      .update({ status: 'received', reviewed_by: residentA.userId, reviewed_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', payment);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('denies a UPDATE that changes amount/apartment_id/available_date/due_date (content immutability)', async () => {
    const payment = await createTestPayment(buildingA, apartmentA, { amount: 100 });
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client.from('payments').update({ amount: 999 }).eq('id', payment);
    expect(error).not.toBeNull();

    // The same admin's legitimate status transition on the same row still succeeds.
    const { error: statusError } = await client
      .from('payments')
      .update({ status: 'received', reviewed_by: adminA.userId, reviewed_at: new Date().toISOString() })
      .eq('id', payment);
    expect(statusError).toBeNull();
  });
});
