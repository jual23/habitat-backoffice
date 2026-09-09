import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestBroadcast,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/**
 * T006: the Staff-broadcast-toggle authorization gate -- a building-level,
 * admin-controlled runtime permission (this feature's one genuinely new
 * authorization shape, not a fixed constitutional grant).
 */
describe('Staff broadcast permission toggle', () => {
  let buildingA: string; // toggle starts off (default)
  let buildingC: string; // toggle stays off, for the cross-building deny case
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let staffC: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingC = await createTestBuilding();
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    staffC = await createTestUser({ role: 'staff', buildingId: buildingC });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(staffA.userId), deleteTestUser(staffC.userId)]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingC)]);
  });

  it('denies staff INSERT/UPDATE(deactivate) while the toggle is off (default)', async () => {
    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error: insertError } = await staffClient
      .from('broadcasts')
      .insert({ building_id: buildingA, message: 'Blocked', sent_by: staffA.userId });
    expect(insertError).not.toBeNull();

    const broadcast = await createTestBroadcast(buildingA, staffA.userId);
    const { error: updateError, count } = await staffClient
      .from('broadcasts')
      .update({ status: 'deactivated', deactivated_by: staffA.userId, deactivated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', broadcast);
    expect(updateError).toBeNull();
    expect(count ?? 0).toBe(0);
  });

  it('allows staff INSERT/UPDATE(deactivate) once the building admin enables the toggle', async () => {
    await getServiceClient().from('buildings').update({ staff_broadcast_enabled: true }).eq('id', buildingA);

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data: sent, error: insertError } = await staffClient
      .from('broadcasts')
      .insert({ building_id: buildingA, message: 'Now allowed', sent_by: staffA.userId })
      .select('id')
      .single();
    expect(insertError).toBeNull();

    const { error: updateError } = await staffClient
      .from('broadcasts')
      .update({ status: 'deactivated', deactivated_by: staffA.userId, deactivated_at: new Date().toISOString() })
      .eq('id', sent!.id);
    expect(updateError).toBeNull();
  });

  it("remains denied for staff of a different building whose toggle is still off", async () => {
    const staffCClient = await signIn(signInAs(staffC.email, staffC.password), staffC.email, staffC.password);
    const { error } = await staffCClient
      .from('broadcasts')
      .insert({ building_id: buildingC, message: 'Still blocked', sent_by: staffC.userId });
    expect(error).not.toBeNull();
  });
});
