import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestPackage,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T019: RLS allow/deny for `packages` — SELECT for staff/admin/apartment
 * residents, INSERT scoped to building+matching apartment, UPDATE
 * `pending -> picked_up` only, denied cross-building, and the
 * content-immutability trigger (data-model.md's Triggers section).
 */
describe('RLS: packages', () => {
  let buildingA: string;
  let buildingB: string;
  let apartmentA: string;
  let apartmentB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let otherResidentA: Awaited<ReturnType<typeof createTestUser>>;
  let packageInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    apartmentA = await createTestApartment(buildingA);
    apartmentB = await createTestApartment(buildingB);
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA, apartmentId: apartmentA });
    otherResidentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    packageInA = await createTestPackage(buildingA, apartmentA, staffA.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(otherResidentA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows staff of the same building to view the package', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data, error } = await client.from('packages').select('id').eq('id', packageInA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('allows a resident of the target apartment to view the package', async () => {
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data, error } = await client.from('packages').select('id').eq('id', packageInA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('denies a resident of a different apartment in the same building', async () => {
    const client = await signIn(
      signInAs(otherResidentA.email, otherResidentA.password),
      otherResidentA.email,
      otherResidentA.password,
    );
    const { data, error } = await client.from('packages').select('id').eq('id', packageInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('denies a different-building admin from viewing the package', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('packages').select('id').eq('id', packageInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('allows staff to insert a package for an apartment in their own building', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('packages')
      .insert({ building_id: buildingA, apartment_id: apartmentA, description: 'A box', registered_by: staffA.userId });
    expect(error).toBeNull();
  });

  it('denies inserting a package with an apartment_id from a different building', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('packages')
      .insert({ building_id: buildingA, apartment_id: apartmentB, description: 'Mismatched', registered_by: staffA.userId });
    expect(error).not.toBeNull();
  });

  it('denies a resident from registering a package', async () => {
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error } = await client
      .from('packages')
      .insert({ building_id: buildingA, apartment_id: apartmentA, description: 'From resident', registered_by: residentA.userId });
    expect(error).not.toBeNull();
  });

  it('allows staff to mark a pending package picked_up', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('packages')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', packageInA);
    expect(error).toBeNull();
  });

  it('denies updating a package that is already picked_up', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error, count } = await client
      .from('packages')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', packageInA);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('denies a staff/admin UPDATE that changes description/photo_url/apartment_id (content immutability)', async () => {
    const pkg = await createTestPackage(buildingA, apartmentA, staffA.userId, { description: 'Original' });
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client.from('packages').update({ description: 'Changed' }).eq('id', pkg);
    expect(error).not.toBeNull();

    // The same role's status update on the same row still succeeds.
    const { error: statusError } = await client
      .from('packages')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', pkg);
    expect(statusError).toBeNull();
  });
});
