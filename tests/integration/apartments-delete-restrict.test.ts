import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T020: Edge Case — deleting an apartment that still has residents assigned is
 * rejected (profiles.apartment_id FK is ON DELETE RESTRICT, see the
 * apartments_restrict_delete_with_residents migration).
 */
describe('apartments: delete is restricted while residents remain', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentId: string;
  let resident: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    apartmentId = await createTestApartment(buildingId, { unit_number: '9C' });
    resident = await createTestUser({ role: 'resident', buildingId, apartmentId });
  });

  afterAll(async () => {
    await deleteTestUser(resident.userId);
    await deleteTestUser(admin.userId);
    await cleanupTestBuilding(buildingId);
  });

  it('rejects deleting the apartment while a resident is still assigned', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('apartments').delete().eq('id', apartmentId);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23503'); // foreign_key_violation
  });

  it('allows deleting the apartment once the resident is removed', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    await client.from('profiles').delete().eq('id', resident.userId);

    const { error } = await client.from('apartments').delete().eq('id', apartmentId);
    expect(error).toBeNull();
  });
});
