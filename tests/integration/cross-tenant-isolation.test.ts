import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestFacility,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T086 (Polish): cross-tenant isolation sweep (SC-008) — as building_admin and
 * staff of Building A, attempt reads against every Building B table and
 * confirm all are denied by RLS (empty results), not merely hidden in the UI.
 */
describe('cross-tenant isolation sweep', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentB: string;
  let facilityB: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    apartmentB = await createTestApartment(buildingB, { unit_number: 'B-1' });
    facilityB = await createTestFacility(buildingB, { name: 'Building B Gym' });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(adminA.userId), deleteTestUser(staffA.userId)]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it("building_admin A cannot read building B's apartments, facilities, or the building row itself", async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);

    const [apartments, facilities, building] = await Promise.all([
      client.from('apartments').select('id').eq('id', apartmentB),
      client.from('facilities').select('id').eq('id', facilityB),
      client.from('buildings').select('id').eq('id', buildingB),
    ]);

    expect(apartments.data ?? []).toHaveLength(0);
    expect(facilities.data ?? []).toHaveLength(0);
    expect(building.data ?? []).toHaveLength(0);
  });

  it("staff A cannot read building B's visitors", async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data } = await client.from('visitors').select('id').eq('building_id', buildingB);
    expect(data ?? []).toHaveLength(0);
  });

  it("building_admin A cannot write to building B's apartments or facilities", async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);

    const [apartmentWrite, facilityWrite] = await Promise.all([
      client.from('apartments').update({ floor: 99 }, { count: 'exact' }).eq('id', apartmentB),
      client.from('facilities').update({ name: 'Hijacked' }, { count: 'exact' }).eq('id', facilityB),
    ]);

    expect(apartmentWrite.count).toBe(0);
    expect(facilityWrite.count).toBe(0);
  });
});
