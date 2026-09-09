import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestTicket,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T004: RLS allow/deny for `tickets` per contracts/rls-policies.md — cross-building
 * isolation, the duplicate-link `WITH CHECK` (FR-009), the
 * `tickets_status_transition_guard` trigger (FR-010), and the content-immutability
 * trigger (data-model.md's Triggers section).
 */
describe('RLS: tickets', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let ticketInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    ticketInA = await createTestTicket(buildingA, residentA.userId);
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(residentA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows staff of the same building to view the ticket', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data, error } = await client.from('tickets').select('id').eq('id', ticketInA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('denies a different-building admin from viewing the ticket', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('tickets').select('id').eq('id', ticketInA);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('denies a different-building admin from updating the ticket', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error, count } = await client
      .from('tickets')
      .update({ status: 'in_progress' }, { count: 'exact' })
      .eq('id', ticketInA);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('allows staff to move a pending ticket to in_progress', async () => {
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client.from('tickets').update({ status: 'in_progress' }).eq('id', ticketInA);
    expect(error).toBeNull();
  });

  it('denies resolving a ticket directly from pending (tickets_status_transition_guard)', async () => {
    const pendingTicket = await createTestTicket(buildingA, residentA.userId);
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client.from('tickets').update({ status: 'resolved' }).eq('id', pendingTicket);
    expect(error).not.toBeNull();
  });

  it('allows resolving a ticket that is currently in_progress', async () => {
    // ticketInA was moved to in_progress above.
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client.from('tickets').update({ status: 'resolved' }).eq('id', ticketInA);
    expect(error).toBeNull();
  });

  it('allows marking a ticket duplicate of another pending/in_progress ticket in the same building', async () => {
    const target = await createTestTicket(buildingA, residentA.userId, { status: 'pending' });
    const source = await createTestTicket(buildingA, residentA.userId, { status: 'pending' });
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('tickets')
      .update({ status: 'duplicate', duplicate_of_ticket_id: target })
      .eq('id', source);
    expect(error).toBeNull();
  });

  it('denies marking a ticket duplicate of an already-resolved ticket', async () => {
    const resolvedTarget = await createTestTicket(buildingA, residentA.userId, { status: 'pending' });
    const svcClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    await svcClient.from('tickets').update({ status: 'in_progress' }).eq('id', resolvedTarget);
    await svcClient.from('tickets').update({ status: 'resolved' }).eq('id', resolvedTarget);

    const source = await createTestTicket(buildingA, residentA.userId, { status: 'pending' });
    const { error } = await svcClient
      .from('tickets')
      .update({ status: 'duplicate', duplicate_of_ticket_id: resolvedTarget })
      .eq('id', source);
    expect(error).not.toBeNull();
  });

  it('denies marking a ticket duplicate of a ticket in a different building', async () => {
    const targetInB = await createTestTicket(buildingB, adminB.userId);
    const source = await createTestTicket(buildingA, residentA.userId, { status: 'pending' });
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client
      .from('tickets')
      .update({ status: 'duplicate', duplicate_of_ticket_id: targetInB })
      .eq('id', source);
    expect(error).not.toBeNull();
  });

  it('denies a staff/admin UPDATE that changes title/description/apartment_id/reported_by (content immutability)', async () => {
    const ticket = await createTestTicket(buildingA, residentA.userId, { title: 'Original title' });
    const client = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error } = await client.from('tickets').update({ title: 'Changed title' }).eq('id', ticket);
    expect(error).not.toBeNull();

    // The same role's status update on the same row still succeeds.
    const { error: statusError } = await client
      .from('tickets')
      .update({ status: 'in_progress' })
      .eq('id', ticket);
    expect(statusError).toBeNull();
  });
});
