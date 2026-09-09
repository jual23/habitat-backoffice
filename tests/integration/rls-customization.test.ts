import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import { createTestBuilding, createTestUser, cleanupTestBuilding, deleteTestUser } from '../fixtures';

/**
 * T080: RLS allow/deny for building customization. This schema keeps
 * accent_color/logo_url directly on `buildings` (see SCHEMA-ADAPTATION.md), so
 * this targets `buildings` rather than a separate `building_customization` table.
 */
describe('RLS: building customization (buildings.accent_color/logo_url)', () => {
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

  it('allows the same-building admin to update accent_color', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await client.from('buildings').update({ accent_color: '#112233' }).eq('id', buildingA);
    expect(error).toBeNull();
  });

  it('denies a different-building admin from updating building A', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error, count } = await client
      .from('buildings')
      .update({ accent_color: '#ffffff' }, { count: 'exact' })
      .eq('id', buildingA);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });
});
