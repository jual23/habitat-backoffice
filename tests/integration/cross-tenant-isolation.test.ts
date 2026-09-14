import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestFacility,
  createTestTicket,
  createTestPackage,
  createTestVisitor,
  createTestSuggestionComplaint,
  createTestReservation,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T086 (Polish): cross-tenant isolation sweep (SC-008) — as building_admin and
 * staff of Building A, attempt reads against every Building B table and
 * confirm all are denied by RLS (empty results), not merely hidden in the UI.
 */
describe('cross-tenant isolation sweep', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  // A building_admin *of Building B*, used as the reporter/registrant/
  // requester for Building B's fixture rows in the T007/T018 tests below —
  // several `select` policies also grant read access to the row's own
  // reporting/requesting user regardless of building, so reusing adminA in
  // that role would let those tests pass for the wrong reason.
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let apartmentB: string;
  let facilityB: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    apartmentB = await createTestApartment(buildingB, { unit_number: 'B-1' });
    facilityB = await createTestFacility(buildingB, { name: 'Building B Gym' });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(adminA.userId), deleteTestUser(staffA.userId), deleteTestUser(adminB.userId)]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it("building_admin A cannot read building B's apartments, facilities, or the building row itself", async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);

    const [apartments, facilities, building] = await Promise.all([
      client.from('apartments').select('id').eq('id', apartmentB),
      client.from('facilities').select('id').eq('id', facilityB),
      client.from('buildings').select('id').eq('id', buildingB),
    ]);

    expect(apartments.data ?? []).toHaveLength(0);
    expect(facilities.data ?? []).toHaveLength(0);
    expect(building.data ?? []).toHaveLength(0);
  });

  it("staff A cannot read building B's visitors", async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data } = await client.from('visitors').select('id').eq('building_id', buildingB);
    expect(data ?? []).toHaveLength(0);
  });

  it("building_admin A cannot write to building B's apartments or facilities", async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);

    const [apartmentWrite, facilityWrite] = await Promise.all([
      client.from('apartments').update({ floor: 99 }, { count: 'exact' }).eq('id', apartmentB),
      client.from('facilities').update({ name: 'Hijacked' }, { count: 'exact' }).eq('id', facilityB),
    ]);

    expect(apartmentWrite.count).toBe(0);
    expect(facilityWrite.count).toBe(0);
  });

  /**
   * 016-panel-dashboard-overview (T007, US1): the Panel's "today" counts
   * (tickets/packages/visitors) are plain `select` queries filtered by
   * `building_id` in application code — this confirms RLS is the real
   * backstop, per Principle I, by querying *without* that filter and
   * expecting Building B's rows to be invisible to Building A regardless.
   */
  it("building_admin A's ticket/package/visitor reads never include building B's rows, even without an explicit building_id filter", async () => {
    const apartmentA = await createTestApartment(buildingA, { unit_number: 'A-Panel' });
    const [ticketA, ticketB, packageA, packageB, visitorA, visitorB] = await Promise.all([
      createTestTicket(buildingA, adminA.userId),
      createTestTicket(buildingB, adminB.userId),
      createTestPackage(buildingA, apartmentA, adminA.userId),
      createTestPackage(buildingB, apartmentB, adminB.userId),
      createTestVisitor(buildingA, adminA.userId),
      createTestVisitor(buildingB, adminB.userId),
    ]);

    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const [tickets, packages, visitors] = await Promise.all([
      client.from('tickets').select('id, building_id').in('id', [ticketA, ticketB]),
      client.from('packages').select('id, building_id').in('id', [packageA, packageB]),
      client.from('visitors').select('id, building_id').in('id', [visitorA, visitorB]),
    ]);

    expect((tickets.data ?? []).map((t) => t.building_id)).toEqual([buildingA]);
    expect((packages.data ?? []).map((p) => p.building_id)).toEqual([buildingA]);
    expect((visitors.data ?? []).map((v) => v.building_id)).toEqual([buildingA]);
  });

  /**
   * 016-panel-dashboard-overview (T018, US3): the Panel's pending-items
   * summary (open incidencias, undelivered packages, unread feedback,
   * in-progress reservations) is likewise a plain `select` filtered by
   * `building_id` in application code — confirm RLS backs it up regardless.
   */
  it("building_admin A's open-incidencia/pending-package/unread-feedback/in-progress-reservation reads never include building B's rows", async () => {
    const [ticketA, ticketB, packageA, packageB, feedbackA, feedbackB, reservationB] = await Promise.all([
      createTestTicket(buildingA, adminA.userId, { status: 'pending' }),
      createTestTicket(buildingB, adminB.userId, { status: 'pending' }),
      createTestPackage(buildingA, await createTestApartment(buildingA, { unit_number: 'A-Pending' }), adminA.userId),
      createTestPackage(buildingB, apartmentB, adminB.userId),
      createTestSuggestionComplaint(buildingA, adminB.userId), // reporter irrelevant for feedback's admin-read branch
      createTestSuggestionComplaint(buildingB, adminB.userId),
      createTestReservation(buildingB, facilityB, adminB.userId),
    ]);

    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const [tickets, packages, feedback, reservations] = await Promise.all([
      client.from('tickets').select('id, building_id').eq('status', 'pending').in('id', [ticketA, ticketB]),
      client.from('packages').select('id, building_id').eq('status', 'pending').in('id', [packageA, packageB]),
      client.from('feedback').select('id, building_id').is('viewed_at', null).in('id', [feedbackA, feedbackB]),
      client.from('reservations').select('id, building_id').eq('status', 'requested').eq('id', reservationB),
    ]);

    expect((tickets.data ?? []).map((t) => t.building_id)).toEqual([buildingA]);
    expect((packages.data ?? []).map((p) => p.building_id)).toEqual([buildingA]);
    expect((feedback.data ?? []).map((f) => f.building_id)).toEqual([buildingA]);
    expect(reservations.data ?? []).toHaveLength(0);
  });
});
