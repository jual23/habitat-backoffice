import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T018: RLS allow/deny for `apartments`, per contracts/rls-policies.md —
 * building_admin of the same building may SELECT/INSERT/UPDATE/DELETE;
 * building_admin of another building, and staff, are denied writes.
 */
describe('RLS: apartments', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    apartmentInA = await createTestApartment(buildingA, { unit_number: '1A' });
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(staffA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows the building_admin of the same building to insert an apartment', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('apartments')
      .insert({ building_id: buildingA, unit_number: '2B' });
    expect(error).toBeNull();
  });

  it('denies a building_admin of a different building from inserting into building A', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error } = await client
      .from('apartments')
      .insert({ building_id: buildingA, unit_number: '3C' });
    expect(error).not.toBeNull();
  });

  it('denies staff from inserting an apartment', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('apartments')
      .insert({ building_id: buildingA, unit_number: '4D' });
    expect(error).not.toBeNull();
  });

  it('denies a building_admin of a different building from deleting building A apartments', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error, count } = await client
      .from('apartments')
      .delete({ count: 'exact' })
      .eq('id', apartmentInA);
    // RLS denial on a DELETE with no matching visible row shows up as zero rows
    // affected rather than a thrown error — assert nothing was removed.
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('allows the same-building admin to select apartments', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data, error } = await client.from('apartments').select('id').eq('building_id', buildingA);
    expect(error).toBeNull();
    expect(data?.some((a) => a.id === apartmentInA)).toBe(true);
  });

  it('denies a different-building admin from selecting building A apartments', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('apartments').select('id').eq('id', apartmentInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
