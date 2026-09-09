import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestBuilding,
  createTestUser,
  createTestVisitor,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/**
 * T056: the `expire_visitors()` sweep (contracts/edge-functions.md's
 * `visitor-expiry`, implemented here as a SQL function on a pg_cron schedule
 * rather than a separate Edge Function — see SCHEMA-ADAPTATION.md) moves
 * "Expected" -> "Expired" past 8h and never touches "Arrived" (FR-024/025).
 */
describe('visitor-expiry sweep', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let expiredCandidate: string;
  let stillPending: string;
  let arrivedLongAgo: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });

    const ninehoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000);
    expiredCandidate = await createTestVisitor(buildingId, admin.userId, {
      status: 'pending',
      expiresAt: ninehoursAgo,
    });
    stillPending = await createTestVisitor(buildingId, admin.userId); // default: expires in 8h
    arrivedLongAgo = await createTestVisitor(buildingId, admin.userId, {
      status: 'arrived',
      expiresAt: ninehoursAgo,
    });
  });

  afterAll(async () => {
    await deleteTestUser(admin.userId);
    await cleanupTestBuilding(buildingId);
  });

  it('expires the past-deadline pending visitor, leaves the others alone', async () => {
    const svc = getServiceClient();
    const { error } = await svc.rpc('expire_visitors');
    expect(error).toBeNull();

    const { data } = await svc
      .from('visitors')
      .select('id, status')
      .in('id', [expiredCandidate, stillPending, arrivedLongAgo]);

    const byId = Object.fromEntries((data ?? []).map((v) => [v.id, v.status]));
    expect(byId[expiredCandidate]).toBe('expired');
    expect(byId[stillPending]).toBe('pending');
    expect(byId[arrivedLongAgo]).toBe('arrived'); // never overwritten, even though its expires_at is old
  });

  it('writes an audit_log row for the expired visitor', async () => {
    const svc = getServiceClient();
    const { data } = await svc
      .from('audit_log')
      .select('id')
      .eq('entity_type', 'visitor')
      .eq('entity_id', expiredCandidate)
      .eq('action', 'visitor.auto_expire');
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
