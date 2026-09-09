import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import { createTestBuilding, createTestUser, cleanupTestBuilding, deleteTestUser } from '../fixtures';

/** T066: RLS allow/deny for `document_folders` and `documents`. */
describe('RLS: documentation', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(adminA.userId), deleteTestUser(adminB.userId)]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows the same-building admin to create a folder', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client.from('document_folders').insert({ building_id: buildingA, name: 'Bylaws' });
    expect(error).toBeNull();
  });

  it('denies a different-building admin from creating a folder in building A', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error } = await client.from('document_folders').insert({ building_id: buildingA, name: 'Hijack' });
    expect(error).not.toBeNull();
  });
});
