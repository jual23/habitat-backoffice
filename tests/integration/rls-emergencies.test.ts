import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestEmergency,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/** T053: RLS allow/deny for `emergencies`. */
describe('RLS: emergencies', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let otherResidentA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let emergencyInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    otherResidentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    emergencyInA = await createTestEmergency(buildingA, residentA.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(otherResidentA.userId),
      deleteTestUser(adminB.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows admin and staff to view; denies resident and other buildings', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data: adminData } = await adminClient.from('emergencies').select('id').eq('id', emergencyInA);
    expect(adminData).toHaveLength(1);

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data: staffData } = await staffClient.from('emergencies').select('id').eq('id', emergencyInA);
    expect(staffData).toHaveLength(1);

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data: residentData } = await residentClient.from('emergencies').select('id').eq('id', emergencyInA);
    expect(residentData ?? []).toHaveLength(0);

    const adminBClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data: otherBuildingData } = await adminBClient.from('emergencies').select('id').eq('id', emergencyInA);
    expect(otherBuildingData ?? []).toHaveLength(0);
  });

  it('allows a resident to report their own emergency; denies reporting on someone else behalf', async () => {
    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error: ownError } = await residentClient
      .from('emergencies')
      .insert({ building_id: buildingA, reported_by: residentA.userId, description: 'Fire' });
    expect(ownError).toBeNull();

    const { error: onBehalfError } = await residentClient
      .from('emergencies')
      .insert({ building_id: buildingA, reported_by: otherResidentA.userId, description: 'Fire' });
    expect(onBehalfError).not.toBeNull();
  });

  it('allows staff/admin to resolve an unhandled emergency; denies resident', async () => {
    const emergency = await createTestEmergency(buildingA, residentA.userId);
    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    // `emergencies` has exactly one UPDATE policy (staff/admin resolve) --
    // a resident's USING never matches this row at all, so this is a silent
    // 0-row update (no error), unlike `payments`' two-policy case where an
    // actor's row IS selected under a different policy's USING first.
    const { error, count } = await residentClient
      .from('emergencies')
      .update({ status: 'resolved', resolved_by: residentA.userId, resolved_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', emergency);
    expect(error).toBeNull();
    expect(count ?? 0).toBe(0);

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error: staffError } = await staffClient
      .from('emergencies')
      .update({ status: 'resolved', resolved_by: staffA.userId, resolved_at: new Date().toISOString() })
      .eq('id', emergency);
    expect(staffError).toBeNull();
  });

  it('denies changing immutable fields (description, apartment_id, reported_by, building_id)', async () => {
    const emergency = await createTestEmergency(buildingA, residentA.userId, { description: 'Original' });
    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await staffClient.from('emergencies').update({ description: 'Changed' }).eq('id', emergency);
    expect(error).not.toBeNull();

    // The same staff's legitimate resolve transition on the same row still succeeds.
    const { error: resolveError } = await staffClient
      .from('emergencies')
      .update({ status: 'resolved', resolved_by: staffA.userId, resolved_at: new Date().toISOString() })
      .eq('id', emergency);
    expect(resolveError).toBeNull();
  });
});
