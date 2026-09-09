import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestVisitor,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T055: RLS allow/deny for `visitors` — only staff/building_admin of the same
 * building can view/update.
 */
describe('RLS: visitors', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let visitorInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    visitorInA = await createTestVisitor(buildingA, adminA.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(adminB.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows staff of the same building to view the visitor', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data, error } = await client.from('visitors').select('id').eq('id', visitorInA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('allows staff to mark the visitor arrived', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('visitors')
      .update({ status: 'arrived', arrived_at: new Date().toISOString() })
      .eq('id', visitorInA);
    expect(error).toBeNull();
  });

  it('denies a different-building admin from viewing the visitor', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('visitors').select('id').eq('id', visitorInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
