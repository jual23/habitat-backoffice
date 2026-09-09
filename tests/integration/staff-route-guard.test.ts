import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import { createTestBuilding, createTestUser, cleanupTestBuilding, deleteTestUser } from '../fixtures';

/**
 * T057: a `staff` session is denied every non-Visitors route (FR-037).
 *
 * The route guard itself lives in middleware.ts (lib/supabase/middleware.ts),
 * which needs a real HTTP request/response cycle to exercise — not reachable
 * from a Vitest unit/integration test running outside `next dev`/`next start`.
 * This test instead verifies the underlying data condition the guard's redirect
 * decision is based on: a `staff`-only session (no building_admin/app_admin
 * role) is identified as staff-only by the same query middleware.ts runs.
 * True route-guard coverage requires an E2E/browser test, out of scope per
 * plan.md's Testing section (no E2E framework in this version).
 */
describe('staff route guard: underlying role check', () => {
  let buildingId: string;
  let staff: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    staff = await createTestUser({ role: 'staff', buildingId });
    admin = await createTestUser({ role: 'building_admin', buildingId });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(staff.userId), deleteTestUser(admin.userId)]);
    await cleanupTestBuilding(buildingId);
  });

  it('identifies a staff-only session as staff-only (no admin role rows)', async () => {
    const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);
    const { data } = await client.from('user_roles').select('role').eq('user_id', staff.userId);
    const roles = (data ?? []).map((r) => r.role);
    expect(roles).toContain('staff');
    expect(roles).not.toContain('building_admin');
    expect(roles).not.toContain('app_admin');
  });

  it('a building_admin session is not staff-only', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { data } = await client.from('user_roles').select('role').eq('user_id', admin.userId);
    const roles = (data ?? []).map((r) => r.role);
    expect(roles).toContain('building_admin');
  });
});
