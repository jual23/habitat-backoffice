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
  getServiceClient,
} from '../fixtures';

/** T031: FR-009 — soft-deleting a facility auto-declines its "Requested" reservations. */
describe('facilities: soft-delete cascades to decline pending reservations', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let facilityId: string;
  let apartmentId: string;
  let resident: Awaited<ReturnType<typeof createTestUser>>;
  let pendingReservationId: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    facilityId = await createTestFacility(buildingId, { name: 'Pool' });
    apartmentId = await createTestApartment(buildingId);
    resident = await createTestUser({ role: 'resident', buildingId, apartmentId });
    pendingReservationId = await createTestReservation(buildingId, facilityId, resident.userId);
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(admin.userId), deleteTestUser(resident.userId)]);
    await cleanupTestBuilding(buildingId);
  });

  it('declines the pending reservation when the facility is soft-deleted', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client
      .from('facilities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', facilityId);
    expect(error).toBeNull();

    const svc = getServiceClient();
    const { data } = await svc
      .from('reservations')
      .select('status')
      .eq('id', pendingReservationId)
      .single();
    expect(data?.status).toBe('declined');
  });
});
