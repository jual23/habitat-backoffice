import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import { createTestBuilding, createTestUser, cleanupTestBuilding, deleteTestUser } from '../fixtures';

/** T049: FR-020 — max_participants rejects zero/negative and accepts null. */
describe('activities: max_participants constraint', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
  });

  afterAll(async () => {
    await deleteTestUser(admin.userId);
    await cleanupTestBuilding(buildingId);
  });

  it('rejects zero', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('activities').insert({
      building_id: buildingId,
      title: 'Zero cap',
      starts_at: new Date().toISOString(),
      max_participants: 0,
    });
    expect(error).not.toBeNull();
  });

  it('rejects negative numbers', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('activities').insert({
      building_id: buildingId,
      title: 'Negative cap',
      starts_at: new Date().toISOString(),
      max_participants: -1,
    });
    expect(error).not.toBeNull();
  });

  it('accepts null (unlimited)', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('activities').insert({
      building_id: buildingId,
      title: 'Unlimited',
      starts_at: new Date().toISOString(),
      max_participants: null,
    });
    expect(error).toBeNull();
  });
});
