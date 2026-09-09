import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/** T021: FR-003 — multiple residents can be associated with one apartment. */
describe('apartments: multiple residents per apartment', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentId: string;
  let residentOne: Awaited<ReturnType<typeof createTestUser>>;
  let residentTwo: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });
    apartmentId = await createTestApartment(buildingId, { unit_number: '9C' });
    residentOne = await createTestUser({ role: 'resident', buildingId, apartmentId });
    residentTwo = await createTestUser({ role: 'resident', buildingId, apartmentId });
  });

  afterAll(async () => {
    await deleteTestUser(residentOne.userId);
    await deleteTestUser(residentTwo.userId);
    await deleteTestUser(admin.userId);
    await cleanupTestBuilding(buildingId);
  });

  it('lists both residents against the same apartment', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('apartment_id', apartmentId);

    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(residentOne.userId);
    expect(ids).toContain(residentTwo.userId);
  });
});
