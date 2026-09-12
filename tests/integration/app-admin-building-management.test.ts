import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signIn, signInAs } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';
import { createBuildingUser } from '@/lib/user-provisioning';
import { getUserContext } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * 012-app-admin-building-management (T002, Constitution Principle III gate):
 * this feature adds new authorization-sensitive capabilities — creating
 * buildings and assigning/reassigning their Building Administrator — so
 * both the allowed and denied cases must be proven, before/alongside the
 * `buildings-actions.ts` Server Actions that will wrap these same operations.
 *
 * Server Actions in this app call `createClient()` (which depends on
 * `next/headers`'s `cookies()`), so — exactly like every other action in
 * this codebase (see tests/integration/user-provisioning.test.ts,
 * tests/integration/staff-route-guard.test.ts) — the real, RLS-enforced
 * authorization boundary is tested directly: signed-in role clients
 * attempting the same `buildings`/`user_roles` operations the Server Actions
 * will perform, plus `createBuildingUser()` (the reusable provisioning
 * function `buildings-actions.ts` will call) exercised directly.
 *
 * The "App Administrator can" cases require migration
 * `supabase/migrations/0041_app_admin_building_admin_assignment_rls.sql` to
 * be applied — until then, they fail the same way the corresponding
 * production code path would (research.md §6/T001).
 */
describe('App Administrator building management', () => {
  let appAdmin: Awaited<ReturnType<typeof createTestUser>>;
  let buildingAdminA: Awaited<ReturnType<typeof createTestUser>>;
  let buildingA: string;
  const createdUserIds: string[] = [];
  const createdBuildingIds: string[] = [];

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    createdBuildingIds.push(buildingA);

    appAdmin = await createTestUser({ role: 'app_admin' });
    createdUserIds.push(appAdmin.userId);

    buildingAdminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    createdUserIds.push(buildingAdminA.userId);
  });

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
    await Promise.all(createdBuildingIds.map((id) => cleanupTestBuilding(id)));
  });

  describe('creating a building (FR-005)', () => {
    it('allows App Administrator to insert a building', async () => {
      const client = await signIn(signInAs(appAdmin.email, appAdmin.password), appAdmin.email, appAdmin.password);

      const { data, error } = await client.from('buildings').insert({ name: 'Test Tower (app_admin)' }).select('id').single();

      expect(error).toBeNull();
      if (data) createdBuildingIds.push(data.id);
    });

    it('denies Building Administrator from inserting a building', async () => {
      const client = await signIn(
        signInAs(buildingAdminA.email, buildingAdminA.password),
        buildingAdminA.email,
        buildingAdminA.password,
      );

      const { error } = await client.from('buildings').insert({ name: 'Should not be created' });

      expect(error).not.toBeNull();
    });

    it('denies Staff from inserting a building', async () => {
      const staff = await createTestUser({ role: 'staff', buildingId: buildingA });
      createdUserIds.push(staff.userId);
      const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);

      const { error } = await client.from('buildings').insert({ name: 'Should not be created' });

      expect(error).not.toBeNull();
    });
  });

  describe('assigning a Building Administrator (FR-006, FR-009)', () => {
    it("createBuildingUser() with role 'building_admin' creates a working account scoped to exactly one building — using the real App Administrator client, exactly as buildings-actions.ts's createBuilding() will", async () => {
      const password = `Test-${crypto.randomUUID()}`;
      const email = `ba-assign+${crypto.randomUUID()}@test.habitat.invalid`;
      const appAdminClient = await signIn(signInAs(appAdmin.email, appAdmin.password), appAdmin.email, appAdmin.password);

      const result = await createBuildingUser({
        adminClient: getAdminClient(),
        requestClient: appAdminClient,
        actorId: appAdmin.userId,
        buildingId: buildingA,
        role: 'building_admin',
        email,
        password,
        firstName: 'New',
        lastName: 'Admin',
        documentId: 'DOC-1',
      });

      expect('userId' in result).toBe(true);
      if (!('userId' in result)) return;
      createdUserIds.push(result.userId);

      const newAdminClient = await signIn(signInAs(email, password), email, password);
      const newAdminCtx = await getUserContext(newAdminClient);
      expect(newAdminCtx.role).toBe('building_admin');
      expect(newAdminCtx.buildingId).toBe(buildingA);
    });

    it('App Administrator can insert a user_roles row with role building_admin', async () => {
      const client = await signIn(signInAs(appAdmin.email, appAdmin.password), appAdmin.email, appAdmin.password);
      const svc = getServiceClient();
      const probeUser = await createTestUser({ role: 'app_admin' }); // any real auth user works as the target
      createdUserIds.push(probeUser.userId);
      // Remove the app_admin role row this fixture gave it, so it starts role-less for this probe
      await svc.from('user_roles').delete().eq('user_id', probeUser.userId).eq('role', 'app_admin');

      const { error } = await client
        .from('user_roles')
        .insert({ user_id: probeUser.userId, role: 'building_admin', building_id: buildingA });

      expect(error).toBeNull();
    });

    it('denies Building Administrator from inserting a user_roles row with role building_admin', async () => {
      const client = await signIn(
        signInAs(buildingAdminA.email, buildingAdminA.password),
        buildingAdminA.email,
        buildingAdminA.password,
      );
      const probeUser = await createTestUser({ role: 'staff', buildingId: buildingA });
      createdUserIds.push(probeUser.userId);

      const { error } = await client
        .from('user_roles')
        .insert({ user_id: probeUser.userId, role: 'building_admin', building_id: buildingA });

      expect(error).not.toBeNull();
    });

    it('denies Staff from inserting a user_roles row with role building_admin', async () => {
      const staff = await createTestUser({ role: 'staff', buildingId: buildingA });
      createdUserIds.push(staff.userId);
      const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);
      const probeUser = await createTestUser({ role: 'staff', buildingId: buildingA });
      createdUserIds.push(probeUser.userId);

      const { error } = await client
        .from('user_roles')
        .insert({ user_id: probeUser.userId, role: 'building_admin', building_id: buildingA });

      expect(error).not.toBeNull();
    });
  });

  describe('reassignment immediately revokes the previous administrator (FR-010)', () => {
    it("the previous administrator's getUserContext() no longer resolves as building_admin for that building after their user_roles row is removed", async () => {
      const buildingB = await createTestBuilding();
      createdBuildingIds.push(buildingB);
      const outgoing = await createTestUser({ role: 'building_admin', buildingId: buildingB });
      createdUserIds.push(outgoing.userId);
      const incoming = await createTestUser({ role: 'staff', buildingId: buildingB }); // starts as staff; will be "reassigned" to building_admin below
      createdUserIds.push(incoming.userId);

      const svc = getServiceClient();

      // Reassignment ordering per research.md §8: insert the new row first...
      const { error: insertErr } = await svc
        .from('user_roles')
        .insert({ user_id: incoming.userId, role: 'building_admin', building_id: buildingB });
      expect(insertErr).toBeNull();
      // ...then delete the outgoing administrator's row.
      const { error: deleteErr } = await svc
        .from('user_roles')
        .delete()
        .eq('user_id', outgoing.userId)
        .eq('role', 'building_admin')
        .eq('building_id', buildingB);
      expect(deleteErr).toBeNull();

      const outgoingClient = await signIn(signInAs(outgoing.email, outgoing.password), outgoing.email, outgoing.password);
      const outgoingCtx = await getUserContext(outgoingClient);
      expect(outgoingCtx.role).not.toBe('building_admin');

      const incomingClient = await signIn(signInAs(incoming.email, incoming.password), incoming.email, incoming.password);
      const incomingCtx = await getUserContext(incomingClient);
      expect(incomingCtx.role).toBe('building_admin');
      expect(incomingCtx.buildingId).toBe(buildingB);
    });
  });
});
