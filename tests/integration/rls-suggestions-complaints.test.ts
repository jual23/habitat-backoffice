import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestSuggestionComplaint,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T073: RLS allow/deny for `feedback` (suggestions_complaints), including that
 * `content`/`type` cannot be edited by a Building Administrator
 * (feedback_content_immutable_trigger).
 */
describe('RLS: suggestions & complaints (feedback)', () => {
  let buildingId: string;
  let otherBuildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let resident: Awaited<ReturnType<typeof createTestUser>>;
  let staff: Awaited<ReturnType<typeof createTestUser>>;
  let otherAdmin: Awaited<ReturnType<typeof createTestUser>>;
  let entryId: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    otherBuildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    resident = await createTestUser({ role: 'resident', buildingId });
    staff = await createTestUser({ role: 'staff', buildingId });
    otherAdmin = await createTestUser({ role: 'building_admin', buildingId: otherBuildingId });
    entryId = await createTestSuggestionComplaint(buildingId, resident.userId, { subject: 'Original subject' });
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(admin.userId),
      deleteTestUser(resident.userId),
      deleteTestUser(staff.userId),
      deleteTestUser(otherAdmin.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingId), cleanupTestBuilding(otherBuildingId)]);
  });

  it('allows the building_admin to favorite the entry', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('feedback').update({ starred: true }).eq('id', entryId);
    expect(error).toBeNull();
  });

  it('denies the building_admin from changing the subject (content is immutable)', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client
      .from('feedback')
      .update({ subject: 'Edited by admin' })
      .eq('id', entryId);
    expect(error).not.toBeNull();
  });

  it('denies the building_admin from changing the type', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('feedback').update({ type: 'complaint' }).eq('id', entryId);
    expect(error).not.toBeNull();
  });

  /**
   * 016-panel-dashboard-overview (T012, US3): `feedback.viewed_at` "unread"
   * tracking (data-model.md). No new policy was added for this column — the
   * existing "feedback managed by admins" FOR ALL policy already covers it —
   * so these cases confirm that policy actually behaves as expected for the
   * new column, per Constitution Principle III.
   */
  it('allows the building_admin to mark the entry viewed (viewed_at)', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error, count } = await client
      .from('feedback')
      .update({ viewed_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', entryId);
    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  it('denies staff from marking the entry viewed (no feedback access at all)', async () => {
    const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);
    const { count } = await client
      .from('feedback')
      .update({ viewed_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', entryId);
    expect(count).toBe(0);
  });

  it('denies the reporting resident from marking their own entry viewed', async () => {
    const client = await signIn(signInAs(resident.email, resident.password), resident.email, resident.password);
    const { count } = await client
      .from('feedback')
      .update({ viewed_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', entryId);
    expect(count).toBe(0);
  });

  it("denies a different building's building_admin from marking the entry viewed (cross-building)", async () => {
    const client = await signIn(
      signInAs(otherAdmin.email, otherAdmin.password),
      otherAdmin.email,
      otherAdmin.password,
    );
    const { count } = await client
      .from('feedback')
      .update({ viewed_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', entryId);
    expect(count).toBe(0);
  });
});
