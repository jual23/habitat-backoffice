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

/** T032: FR-011/012 — approve/decline transitions on a "Requested" reservation. */
describe('reservations: approve/decline workflow', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let facilityId: string;
  let apartmentId: string;
  let resident: Awaited<ReturnType<typeof createTestUser>>;
  let toApprove: string;
  let toDecline: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    facilityId = await createTestFacility(buildingId, { name: 'Pool' });
    apartmentId = await createTestApartment(buildingId);
    resident = await createTestUser({ role: 'resident', buildingId, apartmentId });
    toApprove = await createTestReservation(buildingId, facilityId, resident.userId, {
      start_time: '10:00',
      end_time: '11:00',
    });
    toDecline = await createTestReservation(buildingId, facilityId, resident.userId, {
      start_time: '14:00',
      end_time: '15:00',
    });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(admin.userId), deleteTestUser(resident.userId)]);
    await cleanupTestBuilding(buildingId);
  });

  it('approves one reservation', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client
      .from('reservations')
      .update({ status: 'approved', decided_by: admin.userId, decided_at: new Date().toISOString() })
      .eq('id', toApprove)
      .eq('status', 'requested');
    expect(error).toBeNull();

    const { data } = await client.from('reservations').select('status').eq('id', toApprove).single();
    expect(data?.status).toBe('approved');
  });

  it('declines another reservation', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client
      .from('reservations')
      .update({ status: 'declined', decided_by: admin.userId, decided_at: new Date().toISOString() })
      .eq('id', toDecline)
      .eq('status', 'requested');
    expect(error).toBeNull();

    const { data } = await client.from('reservations').select('status').eq('id', toDecline).single();
    expect(data?.status).toBe('declined');
  });
});
