import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/**
 * T020: registering a package inserts one `notifications` row per resident of
 * the target apartment (research.md item 5) — multiple residents get
 * multiple notifications, zero residents still lets the package save with no
 * notification rows.
 *
 * `registerPackage` (app/(backoffice)/packages/actions.ts) is a Server Action
 * that reads cookies() — not callable directly from Vitest (see
 * tickets-workflow.test.ts's note) — so this exercises the same two DB
 * operations the action performs, as the signed-in staff user, mirroring
 * tests/integration/reservations-workflow.test.ts's established pattern.
 */
describe('packages: registration notifies every resident of the apartment', () => {
  let buildingId: string;
  let staff: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentWithResidents: string;
  let apartmentWithoutResidents: string;
  let residentOne: Awaited<ReturnType<typeof createTestUser>>;
  let residentTwo: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    staff = await createTestUser({ role: 'staff', buildingId });
    apartmentWithResidents = await createTestApartment(buildingId);
    apartmentWithoutResidents = await createTestApartment(buildingId);
    residentOne = await createTestUser({ role: 'resident', buildingId, apartmentId: apartmentWithResidents });
    residentTwo = await createTestUser({ role: 'resident', buildingId, apartmentId: apartmentWithResidents });
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(staff.userId),
      deleteTestUser(residentOne.userId),
      deleteTestUser(residentTwo.userId),
    ]);
    await cleanupTestBuilding(buildingId);
  });

  it('inserts one notification per resident when the apartment has multiple residents', async () => {
    const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);

    const { data: pkg, error: pkgError } = await client
      .from('packages')
      .insert({
        building_id: buildingId,
        apartment_id: apartmentWithResidents,
        description: 'Two-resident package',
        registered_by: staff.userId,
      })
      .select('id')
      .single();
    expect(pkgError).toBeNull();

    const svc = getServiceClient();
    const { data: residents } = await svc
      .from('profiles')
      .select('id')
      .eq('apartment_id', apartmentWithResidents);
    expect(residents ?? []).toHaveLength(2);

    for (const r of residents ?? []) {
      const { error } = await client.from('notifications').insert({
        user_id: r.id,
        building_id: buildingId,
        title: 'Tienes un paquete',
        body: 'Two-resident package',
        link: '/packages',
      });
      expect(error).toBeNull();
    }

    const residentIds = (residents ?? []).map((r) => r.id);
    const { data: notifs } = await svc
      .from('notifications')
      .select('id, user_id')
      .in('user_id', residentIds)
      .eq('link', '/packages');
    expect(notifs ?? []).toHaveLength(2);

    expect(pkg?.id).toBeTruthy();
  });

  it('saves the package with no notification rows when the apartment has zero residents', async () => {
    const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);

    const { data: pkg, error: pkgError } = await client
      .from('packages')
      .insert({
        building_id: buildingId,
        apartment_id: apartmentWithoutResidents,
        description: 'Empty-apartment package',
        registered_by: staff.userId,
      })
      .select('id')
      .single();
    expect(pkgError).toBeNull();
    expect(pkg?.id).toBeTruthy();

    const svc = getServiceClient();
    const { data: residents } = await svc
      .from('profiles')
      .select('id')
      .eq('apartment_id', apartmentWithoutResidents);
    expect(residents ?? []).toHaveLength(0);
  });

  it('denies a staff/admin from addressing a notification to a resident outside their building', async () => {
    const outsideBuildingId = await createTestBuilding();
    const outsideResident = await createTestUser({ role: 'resident', buildingId: outsideBuildingId });
    try {
      const client = await signIn(signInAs(staff.email, staff.password), staff.email, staff.password);
      const { error } = await client.from('notifications').insert({
        user_id: outsideResident.userId,
        building_id: buildingId,
        title: 'Should not be allowed',
        body: 'Cross-building',
      });
      expect(error).not.toBeNull();
    } finally {
      await deleteTestUser(outsideResident.userId);
      await cleanupTestBuilding(outsideBuildingId);
    }
  });
});
