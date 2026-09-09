import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';
import { createBuildingUser } from '@/lib/user-provisioning';

/**
 * T006: allow/deny + duplicate-email + weak-password + building-scoping tests
 * for createBuildingUser(), per contracts/provisioning.md's behavior table.
 *
 * Constitution Principle III (NON-NEGOTIABLE): this is genuinely new
 * authorization-relevant logic even though it adds no new RLS policy — the
 * Admin API call deliberately bypasses RLS for the auth.users insert, so this
 * function (and, one layer up, always deriving `buildingId` from the caller's
 * own session — research.md item 4) *is* the enforcement point for
 * "this building only," the same way an RLS policy would be for a normal
 * write. Uses the real service-role client (tests/fixtures.ts) and a real
 * signed-in admin client (tests/setup.ts) — this function takes clients as
 * plain arguments rather than resolving them from cookies(), specifically so
 * it's directly callable here without a Next.js request context.
 */
describe('createBuildingUser()', () => {
  let buildingA: string;
  let buildingB: string;
  let apartmentA: string;
  let apartmentB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    apartmentA = await createTestApartment(buildingA);
    apartmentB = await createTestApartment(buildingB);
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(adminA.userId), deleteTestUser(adminB.userId)]);
    await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows a building_admin to create a resident account scoped to their own building', async () => {
    const adminClient = getServiceClient();
    const requestClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const email = `resident+${crypto.randomUUID()}@test.habitat.invalid`;

    const result = await createBuildingUser({
      adminClient,
      requestClient,
      actorId: adminA.userId,
      buildingId: buildingA,
      role: 'resident',
      email,
      password: 'a-fine-password',
      firstName: 'Ana',
      lastName: 'Gómez',
      documentId: '8-123-4567',
      apartmentId: apartmentA,
    });

    expect('userId' in result).toBe(true);
    if (!('userId' in result)) return;
    createdUserIds.push(result.userId);

    const svc = getServiceClient();
    const { data: profile } = await svc
      .from('profiles')
      .select('building_id, apartment_id, first_name, last_name, document_id, full_name')
      .eq('id', result.userId)
      .single();
    expect(profile?.building_id).toBe(buildingA);
    expect(profile?.apartment_id).toBe(apartmentA);
    expect(profile?.first_name).toBe('Ana');
    expect(profile?.last_name).toBe('Gómez');
    expect(profile?.document_id).toBe('8-123-4567');

    // FR-005: immediately sign-in-capable, no accept step.
    const signedIn = await signIn(signInAs(email, 'a-fine-password'), email, 'a-fine-password');
    const { data: who } = await signedIn.auth.getUser();
    expect(who.user?.id).toBe(result.userId);
  });

  it('allows a building_admin to create a staff account (no apartment) with a user_roles row', async () => {
    const adminClient = getServiceClient();
    const requestClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const email = `staff+${crypto.randomUUID()}@test.habitat.invalid`;

    const result = await createBuildingUser({
      adminClient,
      requestClient,
      actorId: adminA.userId,
      buildingId: buildingA,
      role: 'staff',
      email,
      password: 'a-fine-password',
      firstName: 'Beto',
      lastName: 'Ruiz',
      documentId: '8-765-4321',
    });

    expect('userId' in result).toBe(true);
    if (!('userId' in result)) return;
    createdUserIds.push(result.userId);

    const svc = getServiceClient();
    const { data: roleRow } = await svc
      .from('user_roles')
      .select('role, building_id')
      .eq('user_id', result.userId)
      .eq('role', 'staff')
      .maybeSingle();
    expect(roleRow?.building_id).toBe(buildingA);
  });

  it('rejects creation when the email already has an account (FR-007)', async () => {
    const adminClient = getServiceClient();
    const requestClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const email = `dup+${crypto.randomUUID()}@test.habitat.invalid`;

    const first = await createBuildingUser({
      adminClient,
      requestClient,
      actorId: adminA.userId,
      buildingId: buildingA,
      role: 'staff',
      email,
      password: 'a-fine-password',
      firstName: 'Carlos',
      lastName: 'Diaz',
      documentId: '8-111-2222',
    });
    expect('userId' in first).toBe(true);
    if ('userId' in first) createdUserIds.push(first.userId);

    const second = await createBuildingUser({
      adminClient,
      requestClient,
      actorId: adminA.userId,
      buildingId: buildingA,
      role: 'staff',
      email,
      password: 'another-fine-password',
      firstName: 'Carlos',
      lastName: 'Otro',
      documentId: '8-333-4444',
    });
    expect('error' in second).toBe(true);
  });

  it('rejects creation when the apartment belongs to a different building than buildingId', async () => {
    const adminClient = getServiceClient();
    const requestClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);

    const result = await createBuildingUser({
      adminClient,
      requestClient,
      actorId: adminA.userId,
      buildingId: buildingA,
      role: 'resident',
      email: `mismatched+${crypto.randomUUID()}@test.habitat.invalid`,
      password: 'a-fine-password',
      firstName: 'Dana',
      lastName: 'Lopez',
      documentId: '8-555-6666',
      apartmentId: apartmentB, // belongs to buildingB, not buildingA
    });

    expect('error' in result).toBe(true);
  });

  it("rejects a password too weak for Supabase Auth's own floor, even bypassing this app's Zod check", async () => {
    const adminClient = getServiceClient();
    const requestClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);

    const result = await createBuildingUser({
      adminClient,
      requestClient,
      actorId: adminA.userId,
      buildingId: buildingA,
      role: 'staff',
      email: `weakpw+${crypto.randomUUID()}@test.habitat.invalid`,
      password: 'ab', // far below any reasonable floor, including Supabase Auth's own
      firstName: 'Eva',
      lastName: 'Marin',
      documentId: '8-777-8888',
    });

    expect('error' in result).toBe(true);
  });

  it(
    "demonstrates why buildingId must come from the caller's own session, not a parameter: " +
      'a mismatched requestClient cannot grant the staff role even if buildingId claims a building it does not admin',
    async () => {
      const adminClient = getServiceClient();
      // Signed in as adminB, but buildingId below claims buildingA (adminB does not admin buildingA).
      const requestClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);

      const result = await createBuildingUser({
        adminClient,
        requestClient,
        actorId: adminB.userId,
        buildingId: buildingA,
        role: 'staff',
        email: `crossbuild+${crypto.randomUUID()}@test.habitat.invalid`,
        password: 'a-fine-password',
        firstName: 'Fabio',
        lastName: 'Cruz',
        documentId: '8-999-0000',
      });

      // The elevated Admin API call itself has no RLS to stop it (that's exactly
      // why the real Server Action callers must never let a client influence
      // buildingId — research.md item 4). The user_roles insert, however, still
      // goes through the normal RLS-enforced requestClient, so it is denied.
      if ('userId' in result) createdUserIds.push(result.userId);
      expect('error' in result).toBe(true);
    },
  );
});
