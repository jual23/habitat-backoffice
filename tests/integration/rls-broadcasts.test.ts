import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestBroadcast,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/** T004: RLS allow/deny for `broadcasts`. */
describe('RLS: broadcasts', () => {
  let buildingA: string;
  let buildingB: string;
  let apartmentA: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let broadcastInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    apartmentA = await createTestApartment(buildingA);
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA, apartmentId: apartmentA });
    broadcastInA = await createTestBroadcast(buildingA, adminA.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(residentA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows every building member (including a resident) to view; denies other buildings', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data: adminData } = await adminClient.from('broadcasts').select('id').eq('id', broadcastInA);
    expect(adminData).toHaveLength(1);

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data: residentData } = await residentClient.from('broadcasts').select('id').eq('id', broadcastInA);
    expect(residentData).toHaveLength(1);

    const adminBClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data: otherBuildingData } = await adminBClient.from('broadcasts').select('id').eq('id', broadcastInA);
    expect(otherBuildingData ?? []).toHaveLength(0);
  });

  it('allows admin to send (INSERT) regardless of the staff toggle; denies resident', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error: adminError } = await adminClient
      .from('broadcasts')
      .insert({ building_id: buildingA, message: 'Admin broadcast', sent_by: adminA.userId });
    expect(adminError).toBeNull();

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error: residentError } = await residentClient
      .from('broadcasts')
      .insert({ building_id: buildingA, message: 'Resident broadcast', sent_by: residentA.userId });
    expect(residentError).not.toBeNull();
  });

  it('allows two broadcasts in the same building to both be active at once (FR-006, no uniqueness conflict)', async () => {
    const first = await createTestBroadcast(buildingA, adminA.userId);
    const second = await createTestBroadcast(buildingA, adminA.userId);
    const svc = getServiceClient();
    const { data } = await svc.from('broadcasts').select('status').in('id', [first, second]);
    expect(data?.every((b) => b.status === 'active')).toBe(true);
  });

  it('allows admin to deactivate an active broadcast; denies resident', async () => {
    const broadcast = await createTestBroadcast(buildingA, adminA.userId);
    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error: residentError, count } = await residentClient
      .from('broadcasts')
      .update({ status: 'deactivated', deactivated_by: residentA.userId, deactivated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', broadcast);
    expect(residentError).toBeNull();
    expect(count ?? 0).toBe(0);

    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error: adminError } = await adminClient
      .from('broadcasts')
      .update({ status: 'deactivated', deactivated_by: adminA.userId, deactivated_at: new Date().toISOString() })
      .eq('id', broadcast);
    expect(adminError).toBeNull();
  });

  it('denies a UPDATE that changes message/icon/building_id/template_id (content immutability)', async () => {
    const broadcast = await createTestBroadcast(buildingA, adminA.userId, { message: 'Original' });
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await adminClient.from('broadcasts').update({ message: 'Changed' }).eq('id', broadcast);
    expect(error).not.toBeNull();

    // The same admin's legitimate deactivate transition on the same row still succeeds.
    const { error: statusError } = await adminClient
      .from('broadcasts')
      .update({ status: 'deactivated', deactivated_by: adminA.userId, deactivated_at: new Date().toISOString() })
      .eq('id', broadcast);
    expect(statusError).toBeNull();
  });
});
