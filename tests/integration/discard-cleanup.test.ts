import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestSuggestionComplaint,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/**
 * T074: the `purge_discarded_feedback()` sweep (contracts/edge-functions.md's
 * `discard-cleanup`) deletes rows discarded >24h ago, and re-discarding an
 * already-discarded row is a no-op (FR-032/033, Edge Cases).
 */
describe('discard-cleanup sweep', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let resident: Awaited<ReturnType<typeof createTestUser>>;
  let oldDiscarded: string;
  let recentlyDiscarded: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    resident = await createTestUser({ role: 'resident', buildingId });

    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    oldDiscarded = await createTestSuggestionComplaint(buildingId, resident.userId, {
      discardedAt: twentyFiveHoursAgo,
    });
    recentlyDiscarded = await createTestSuggestionComplaint(buildingId, resident.userId, {
      discardedAt: new Date(),
    });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(admin.userId), deleteTestUser(resident.userId)]);
    await cleanupTestBuilding(buildingId);
  });

  it('deletes only the entry discarded more than 24h ago', async () => {
    const svc = getServiceClient();
    const { error } = await svc.rpc('purge_discarded_feedback');
    expect(error).toBeNull();

    const { data } = await svc.from('feedback').select('id').in('id', [oldDiscarded, recentlyDiscarded]);
    const remaining = (data ?? []).map((r) => r.id);
    expect(remaining).not.toContain(oldDiscarded);
    expect(remaining).toContain(recentlyDiscarded);
  });

  it('re-discarding an already-discarded row is a no-op', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error, count } = await client
      .from('feedback')
      .update({ discarded_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', recentlyDiscarded)
      .is('discarded_at', null);
    expect(error).toBeNull();
    expect(count).toBe(0); // already discarded — the .is('discarded_at', null) guard matches nothing
  });
});
