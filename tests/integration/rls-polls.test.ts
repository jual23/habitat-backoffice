import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestPoll,
  createTestPollOption,
  createTestPollVote,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/** T041: RLS allow/deny for `polls`, `poll_options`, and `poll_votes`. */
describe('RLS: polls', () => {
  let buildingA: string;
  let buildingB: string;
  let apartmentA: string;
  let apartmentA2: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let renterA: Awaited<ReturnType<typeof createTestUser>>;
  let pollInA: string;
  let optionInA: string;
  let closedPollInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    apartmentA = await createTestApartment(buildingA);
    apartmentA2 = await createTestApartment(buildingA);
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA, apartmentId: apartmentA });
    renterA = await createTestUser({ role: 'renter', buildingId: buildingA, apartmentId: apartmentA2 });
    pollInA = await createTestPoll(buildingA, adminA.userId);
    optionInA = await createTestPollOption(pollInA);
    closedPollInA = await createTestPoll(buildingA, adminA.userId, {
      closes_at: new Date(Date.now() - 60_000).toISOString(),
    });
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(adminB.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(renterA.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows any building member (including Renter) to view polls and options; denies other buildings', async () => {
    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data: pollData } = await residentClient.from('polls').select('id').eq('id', pollInA);
    expect(pollData).toHaveLength(1);

    const renterClient = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
    const { data: renterPollData } = await renterClient.from('polls').select('id').eq('id', pollInA);
    expect(renterPollData).toHaveLength(1);
    const { data: renterOptionData } = await renterClient.from('poll_options').select('id').eq('id', optionInA);
    expect(renterOptionData).toHaveLength(1);

    const adminBClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data: otherBuildingData } = await adminBClient.from('polls').select('id').eq('id', pollInA);
    expect(otherBuildingData ?? []).toHaveLength(0);
  });

  it('allows admin to manage polls/options; denies resident', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error: pollError } = await adminClient
      .from('polls')
      .insert({ building_id: buildingA, title: 'Admin poll', closes_at: new Date(Date.now() + 86400000).toISOString(), created_by: adminA.userId });
    expect(pollError).toBeNull();

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error: residentError } = await residentClient
      .from('polls')
      .insert({ building_id: buildingA, title: 'Resident poll', closes_at: new Date(Date.now() + 86400000).toISOString(), created_by: residentA.userId });
    expect(residentError).not.toBeNull();
  });

  it('allows admin full attribution on poll_votes; allows own-apartment resident to see their own vote; denies other apartments', async () => {
    const vote = await createTestPollVote(pollInA, apartmentA, optionInA, residentA.userId);

    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data: adminData } = await adminClient.from('poll_votes').select('id').eq('id', vote);
    expect(adminData).toHaveLength(1);

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data: ownData } = await residentClient.from('poll_votes').select('id').eq('id', vote);
    expect(ownData).toHaveLength(1);

    const renterClient = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
    const { data: otherApartmentData } = await renterClient.from('poll_votes').select('id').eq('id', vote);
    expect(otherApartmentData ?? []).toHaveLength(0);
  });

  it('allows the Resident of the apartment to vote on an open poll; denies once closed', async () => {
    // A dedicated poll+option -- `pollInA`/`optionInA` already received a vote
    // for this (poll, apartment, option) combo in an earlier test, which
    // would otherwise trip the UNIQUE (poll_id, apartment_id, option_id) constraint.
    const openPoll = await createTestPoll(buildingA, adminA.userId);
    const openOption = await createTestPollOption(openPoll);

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error: openError } = await residentClient
      .from('poll_votes')
      .insert({ poll_id: openPoll, apartment_id: apartmentA, option_id: openOption, voter_id: residentA.userId });
    expect(openError).toBeNull();

    const closedOption = await createTestPollOption(closedPollInA);
    const { error: closedError } = await residentClient
      .from('poll_votes')
      .insert({ poll_id: closedPollInA, apartment_id: apartmentA, option_id: closedOption, voter_id: residentA.userId });
    expect(closedError).not.toBeNull();
  });

  it('enforces the UNIQUE (poll_id, apartment_id, option_id) constraint', async () => {
    const poll = await createTestPoll(buildingA, adminA.userId);
    const option = await createTestPollOption(poll);
    await createTestPollVote(poll, apartmentA, option, residentA.userId);
    const svc = getServiceClient();
    const { error } = await svc
      .from('poll_votes')
      .insert({ poll_id: poll, apartment_id: apartmentA, option_id: option, voter_id: residentA.userId });
    expect(error).not.toBeNull();
  });
});
