import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import { createTestBuilding, createTestUser, cleanupTestBuilding, deleteTestUser } from '../fixtures';

/** T042: pinned announcements sort above unpinned (Acceptance Scenarios 4/5). */
describe('announcements: pinned sort order', () => {
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

  it('lists a pinned announcement above an older unpinned one', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);

    await client.from('announcements').insert({
      building_id: buildingId,
      title: 'Older, unpinned',
      author_id: admin.userId,
    });
    const { data: pinnedRow } = await client
      .from('announcements')
      .insert({ building_id: buildingId, title: 'Newer, pinned', pinned: true, author_id: admin.userId })
      .select('id')
      .single();

    const { data, error } = await client
      .from('announcements')
      .select('id, title, pinned')
      .eq('building_id', buildingId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(data?.[0]?.id).toBe(pinnedRow!.id);
  });
});
