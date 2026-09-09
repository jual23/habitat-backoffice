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
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let resident: Awaited<ReturnType<typeof createTestUser>>;
  let entryId: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    resident = await createTestUser({ role: 'resident', buildingId });
    entryId = await createTestSuggestionComplaint(buildingId, resident.userId, { subject: 'Original subject' });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(admin.userId), deleteTestUser(resident.userId)]);
    await cleanupTestBuilding(buildingId);
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
});
