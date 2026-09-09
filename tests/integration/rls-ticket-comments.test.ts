import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestTicket,
  createTestTicketComment,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T005: RLS allow/deny for `ticket_comments` — SELECT for staff/admin/reporting
 * resident, INSERT only while the parent ticket is `in_progress`, denied to
 * other buildings/residents.
 */
describe('RLS: ticket_comments', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let otherResidentA: Awaited<ReturnType<typeof createTestUser>>;
  let pendingTicket: string;
  let inProgressTicket: string;
  let commentOnInProgress: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    otherResidentA = await createTestUser({ role: 'resident', buildingId: buildingA });

    pendingTicket = await createTestTicket(buildingA, residentA.userId, { status: 'pending' });
    inProgressTicket = await createTestTicket(buildingA, residentA.userId, { status: 'in_progress' });
    commentOnInProgress = await createTestTicketComment(inProgressTicket, staffA.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(otherResidentA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows staff of the same building to view the comment', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data, error } = await client.from('ticket_comments').select('id').eq('id', commentOnInProgress);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('allows the reporting resident to view the comment (FR-007)', async () => {
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data, error } = await client.from('ticket_comments').select('id').eq('id', commentOnInProgress);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('denies a different resident of the same building from viewing the comment', async () => {
    const client = await signIn(
      signInAs(otherResidentA.email, otherResidentA.password),
      otherResidentA.email,
      otherResidentA.password,
    );
    const { data, error } = await client.from('ticket_comments').select('id').eq('id', commentOnInProgress);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('denies a different-building admin from viewing the comment', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('ticket_comments').select('id').eq('id', commentOnInProgress);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('allows staff to insert a comment while the ticket is in_progress', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('ticket_comments')
      .insert({ ticket_id: inProgressTicket, author_id: staffA.userId, body: 'Working on it' });
    expect(error).toBeNull();
  });

  it('denies inserting a comment while the ticket is pending', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('ticket_comments')
      .insert({ ticket_id: pendingTicket, author_id: staffA.userId, body: 'Too early' });
    expect(error).not.toBeNull();
  });

  it('denies a resident from inserting a comment', async () => {
    const client = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error } = await client
      .from('ticket_comments')
      .insert({ ticket_id: inProgressTicket, author_id: residentA.userId, body: 'From a resident' });
    expect(error).not.toBeNull();
  });
});
