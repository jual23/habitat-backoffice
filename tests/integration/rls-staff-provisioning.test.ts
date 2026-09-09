import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import { createTestBuilding, createTestUser, cleanupTestBuilding, deleteTestUser } from '../fixtures';

/**
 * T058: a building_admin can create/delete `user_roles` staff rows scoped to
 * their own building only (FR-039/040), cannot touch another building's, and
 * cannot insert any role other than 'staff' through this path.
 *
 * (This schema keeps roles in `user_roles`, not `profiles.role` — see
 * SCHEMA-ADAPTATION.md — so this test targets `user_roles` directly, plus the
 * `invitations` table used by createStaff()/staff-actions.ts for provisioning
 * a not-yet-signed-up account.)
 */
describe('RLS: staff provisioning', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let staffAUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    staffAUser = await createTestUser({ role: 'resident', buildingId: buildingA }); // plain auth user, no role row yet
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(staffAUser.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows building_admin to insert a staff row scoped to their own building', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: staffAUser.userId, role: 'staff', building_id: buildingA });
    expect(error).toBeNull();
  });

  it("denies a different building's admin from creating staff in building A", async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: staffAUser.userId, role: 'staff', building_id: buildingA });
    expect(error).not.toBeNull();
  });

  it('denies inserting any role other than staff through this path', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: staffAUser.userId, role: 'building_admin', building_id: buildingA });
    expect(error).not.toBeNull();
  });

  it('denies inviting a building_admin via the invitations table', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('invitations')
      .insert({ building_id: buildingA, email: 'escalate@test.habitat.invalid', role: 'building_admin' });
    expect(error).not.toBeNull();
  });

  it('allows building_admin to delete a staff row in their own building', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client
      .from('user_roles')
      .delete()
      .eq('user_id', staffAUser.userId)
      .eq('role', 'staff');
    expect(error).toBeNull();
  });
});
