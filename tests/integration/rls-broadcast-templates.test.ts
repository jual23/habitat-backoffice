import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestBroadcastTemplate,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/** T005: RLS allow/deny for `broadcast_templates`. */
describe('RLS: broadcast_templates', () => {
  let buildingA: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let templateInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    const buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    templateInA = await createTestBroadcastTemplate(buildingA, adminA.userId);
    // Enable the staff-broadcast toggle for buildingA to prove template
    // management stays admin-only even then (contracts/rls-policies.md).
    await getServiceClient().from('buildings').update({ staff_broadcast_enabled: true }).eq('id', buildingA);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(adminB.userId),
    ]);
    await cleanupTestBuilding(buildingA);
  });

  it('allows staff and admin to view; denies resident and other buildings', async () => {
    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data: staffData } = await staffClient.from('broadcast_templates').select('id').eq('id', templateInA);
    expect(staffData).toHaveLength(1);

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data: residentData } = await residentClient.from('broadcast_templates').select('id').eq('id', templateInA);
    expect(residentData ?? []).toHaveLength(0);

    const adminBClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data: otherBuildingData } = await adminBClient.from('broadcast_templates').select('id').eq('id', templateInA);
    expect(otherBuildingData ?? []).toHaveLength(0);
  });

  it('allows admin to manage templates; denies staff even with the broadcast toggle on', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error: adminError } = await adminClient
      .from('broadcast_templates')
      .insert({ building_id: buildingA, message: 'Admin template', created_by: adminA.userId });
    expect(adminError).toBeNull();

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error: staffInsertError } = await staffClient
      .from('broadcast_templates')
      .insert({ building_id: buildingA, message: 'Staff template', created_by: staffA.userId });
    expect(staffInsertError).not.toBeNull();

    const { error: staffUpdateError, count } = await staffClient
      .from('broadcast_templates')
      .update({ message: 'Changed' }, { count: 'exact' })
      .eq('id', templateInA);
    expect(staffUpdateError).toBeNull();
    expect(count ?? 0).toBe(0);

    const { error: staffDeleteError, count: deleteCount } = await staffClient
      .from('broadcast_templates')
      .delete({ count: 'exact' })
      .eq('id', templateInA);
    expect(staffDeleteError).toBeNull();
    expect(deleteCount ?? 0).toBe(0);
  });
});
