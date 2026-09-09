import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestFacility,
  createTestReservation,
  createTestApartment,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/** T030: RLS allow/deny for `reservations` — view own vs. others', approve/decline. */
describe('RLS: reservations', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let facilityId: string;
  let apartmentId: string;
  let residentOwner: Awaited<ReturnType<typeof createTestUser>>;
  let residentOther: Awaited<ReturnType<typeof createTestUser>>;
  let reservationId: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    facilityId = await createTestFacility(buildingId);
    apartmentId = await createTestApartment(buildingId);
    residentOwner = await createTestUser({ role: 'resident', buildingId, apartmentId });
    residentOther = await createTestUser({ role: 'resident', buildingId, apartmentId });
    reservationId = await createTestReservation(buildingId, facilityId, residentOwner.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(admin.userId),
      deleteTestUser(residentOwner.userId),
      deleteTestUser(residentOther.userId),
    ]);
    await cleanupTestBuilding(buildingId);
  });

  it('allows the building_admin to see the reservation', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { data, error } = await client.from('reservations').select('id').eq('id', reservationId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('allows the requesting resident to see their own reservation', async () => {
    const client = await signIn(
      signInAs(residentOwner.email, residentOwner.password),
      residentOwner.email,
      residentOwner.password,
    );
    const { data, error } = await client.from('reservations').select('id').eq('id', reservationId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("denies a different resident from seeing another resident's reservation", async () => {
    const client = await signIn(
      signInAs(residentOther.email, residentOther.password),
      residentOther.email,
      residentOther.password,
    );
    const { data, error } = await client.from('reservations').select('id').eq('id', reservationId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('allows the building_admin to approve the reservation', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client
      .from('reservations')
      .update({ status: 'approved' })
      .eq('id', reservationId);
    expect(error).toBeNull();
  });
});
