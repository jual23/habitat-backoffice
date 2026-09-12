import { createClient as createAnonClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signIn, signInAs } from '../setup';
import {
  createTestApartment,
  createTestBuilding,
  cleanupTestBuilding,
  createTestUser,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';
import { getUserContext } from '@/lib/session';
import type { Database } from '@/lib/supabase/database.types';

/**
 * 011-module-navigation-performance (T002, Constitution Principle III gate):
 * getUserContext() is being wrapped in React's `cache()` (research.md §2) so
 * it's computed once per request instead of once per caller. That's a
 * behavior-preserving change — the function's *output* for each of the 5
 * UserContext shapes MUST be byte-for-byte identical before and after. These
 * tests exercise the real function directly (it deliberately still takes a
 * plain `supabase` client as a parameter, exactly like `createBuildingUser()`
 * in lib/user-provisioning.ts, specifically so it's callable here without a
 * Next.js request context) against the live project's RLS, the same way
 * tests/integration/user-provisioning.test.ts does.
 */
describe('getUserContext()', () => {
  let buildingId: string;
  let apartmentId: string;
  let anAlreadySignedInClient: Awaited<ReturnType<typeof signIn>> | undefined;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    apartmentId = await createTestApartment(buildingId);
  });

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
    await cleanupTestBuilding(buildingId);
  });

  it('returns { role: "app_admin", buildingId: null } for an App Administrator', async () => {
    const admin = await createTestUser({ role: 'app_admin' });
    createdUserIds.push(admin.userId);
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    anAlreadySignedInClient = client; // reused by the idempotency test below, to avoid an extra sign-in

    const ctx = await getUserContext(client);

    expect(ctx.role).toBe('app_admin');
    expect(ctx.buildingId).toBeNull();
    expect(ctx.user?.id).toBe(admin.userId);
  });

  it('returns { role: "building_admin", buildingId } for a Building Administrator', async () => {
    const admin = await createTestUser({ role: 'building_admin', buildingId });
    createdUserIds.push(admin.userId);
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);

    const ctx = await getUserContext(client);

    expect(ctx.role).toBe('building_admin');
    expect(ctx.buildingId).toBe(buildingId);
  });

  it('returns { role: "staff", buildingId } for a Staff account', async () => {
    const staff = await createTestUser({ role: 'staff', buildingId });
    createdUserIds.push(staff.userId);
    const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);

    const ctx = await getUserContext(client);

    expect(ctx.role).toBe('staff');
    expect(ctx.buildingId).toBe(buildingId);
  });

  it('returns { role: "resident", buildingId, apartmentId } for a Resident', async () => {
    const resident = await createTestUser({ role: 'resident', buildingId, apartmentId });
    createdUserIds.push(resident.userId);
    const client = await signIn(signInAs(resident.email, resident.password), resident.email, resident.password);

    const ctx = await getUserContext(client);

    expect(ctx.role).toBe('resident');
    expect(ctx.buildingId).toBe(buildingId);
    if (ctx.role === 'resident' || ctx.role === 'renter') {
      expect(ctx.apartmentId).toBe(apartmentId);
    }
  });

  it('returns { role: "renter", buildingId, apartmentId } for a Renter', async () => {
    const renter = await createTestUser({ role: 'renter', buildingId, apartmentId });
    createdUserIds.push(renter.userId);
    const client = await signIn(signInAs(renter.email, renter.password), renter.email, renter.password);

    const ctx = await getUserContext(client);

    expect(ctx.role).toBe('renter');
    expect(ctx.buildingId).toBe(buildingId);
    if (ctx.role === 'resident' || ctx.role === 'renter') {
      expect(ctx.apartmentId).toBe(apartmentId);
    }
  });

  it('returns { role: null, buildingId: null } for a signed-in user with no role and no profile building', async () => {
    const svc = getServiceClient();
    const email = `norole+${crypto.randomUUID()}@test.habitat.invalid`;
    const password = `Test-${crypto.randomUUID()}`;
    const { data: created, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`createUser: ${error?.message}`);
    createdUserIds.push(created.user.id);

    const client = await signIn(signInAs(email, password), email, password);

    const ctx = await getUserContext(client);

    expect(ctx.role).toBeNull();
    expect(ctx.buildingId).toBeNull();
  });

  it('returns { user: null, role: null, buildingId: null } when signed out', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createAnonClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ctx = await getUserContext(client);

    expect(ctx.user).toBeNull();
    expect(ctx.role).toBeNull();
    expect(ctx.buildingId).toBeNull();
  });

  it('is idempotent: calling it twice with the same client returns an equal result', async () => {
    // cache() dedup is only observable inside one Next.js request (a single
    // render pass); outside that context React does not memoize across
    // separate calls, so this only asserts the function remains callable
    // and produces an equal result when invoked twice with the same client
    // — the actual per-request dedup is exercised by the app itself (see
    // quickstart.md). Reuses the App Administrator client from the first
    // test above (`anAlreadySignedInClient`) rather than signing in again,
    // to avoid Supabase Auth's sign-in rate limit when this suite runs
    // alongside the rest of `npm run test`.
    if (!anAlreadySignedInClient) throw new Error('expected the app_admin test to have run first');

    const first = await getUserContext(anAlreadySignedInClient);
    const second = await getUserContext(anAlreadySignedInClient);

    expect(second).toEqual(first);
  });
});
