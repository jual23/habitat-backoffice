import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestFacility,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/** T029: RLS allow/deny for `facilities`. */
describe('RLS: facilities', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let facilityInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    facilityInA = await createTestFacility(buildingA, { name: 'Pool' });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(adminA.userId), deleteTestUser(adminB.userId)]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows the same-building admin to create a facility', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client.from('facilities').insert({ building_id: buildingA, name: 'Gym' });
    expect(error).toBeNull();
  });

  it('denies a different-building admin from creating a facility in building A', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error } = await client.from('facilities').insert({ building_id: buildingA, name: 'Hijack' });
    expect(error).not.toBeNull();
  });

  it('denies a different-building admin from updating building A facilities', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error, count } = await client
      .from('facilities')
      .update({ name: 'Hijacked' }, { count: 'exact' })
      .eq('id', facilityInA);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });
});
