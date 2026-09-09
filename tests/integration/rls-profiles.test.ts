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
 * T019: RLS allow/deny for `profiles` resident rows, per contracts/rls-policies.md —
 * a resident's own building_admin may UPDATE/DELETE them (FR-004/005/006);
 * another building's admin, and staff, are denied.
 */
describe('RLS: profiles (resident rows)', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentA: string;
  let resident: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    apartmentA = await createTestApartment(buildingA, { unit_number: '1A' });
    resident = await createTestUser({
      role: 'resident',
      buildingId: buildingA,
      apartmentId: apartmentA,
    });
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(resident.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it("allows the resident's own building_admin to update their email", async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('profiles')
      .update({ email: 'updated@test.habitat.invalid' })
      .eq('id', resident.userId);
    expect(error).toBeNull();
  });

  it('denies a different building_admin from updating the resident', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error, count } = await client
      .from('profiles')
      .update({ email: 'hijack@test.habitat.invalid' }, { count: 'exact' })
      .eq('id', resident.userId);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('allows the same-building admin to select the resident', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data, error } = await client.from('profiles').select('id').eq('id', resident.userId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('denies a different-building admin from selecting the resident', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('profiles').select('id').eq('id', resident.userId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("allows the resident's own building_admin to delete them", async () => {
    const extra = await createTestUser({
      role: 'resident',
      buildingId: buildingA,
      apartmentId: apartmentA,
    });
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client.from('profiles').delete().eq('id', extra.userId);
    expect(error).toBeNull();
    await deleteTestUser(extra.userId);
  });
});
