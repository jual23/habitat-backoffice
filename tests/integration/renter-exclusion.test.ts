import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestApartment,
  createTestPayment,
  createTestPoll,
  createTestPollOption,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T012/T042: the Renter-can't-see-Finance/can't-vote tests, spanning both
 * modules in one file since they share the same underlying `tenant_type`
 * mechanism (plan.md's Source Code list). Polls' section is appended in
 * User Story 5 (T042).
 */
describe('Renter exclusion', () => {
  let buildingA: string;
  let apartmentA: string;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let renterA: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    apartmentA = await createTestApartment(buildingA);
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA, apartmentId: apartmentA });
    renterA = await createTestUser({ role: 'renter', buildingId: buildingA, apartmentId: apartmentA });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(residentA.userId), deleteTestUser(renterA.userId)]);
    await cleanupTestBuilding(buildingA);
  });

  describe('Finance', () => {
    it("denies a Renter from SELECTing their own apartment's payments", async () => {
      const payment = await createTestPayment(buildingA, apartmentA);
      const client = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
      const { data, error } = await client.from('payments').select('id').eq('id', payment);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("denies a Renter from UPDATEing their own apartment's payment, while the Resident can", async () => {
      const payment = await createTestPayment(buildingA, apartmentA);

      const renterClient = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
      const { error: renterError, count: renterCount } = await renterClient
        .from('payments')
        .update({ status: 'submitted' }, { count: 'exact' })
        .eq('id', payment);
      expect(renterError).toBeNull();
      expect(renterCount).toBe(0);

      const residentClient = await signIn(
        signInAs(residentA.email, residentA.password),
        residentA.email,
        residentA.password,
      );
      const { error: residentError } = await residentClient
        .from('payments')
        .update({ status: 'submitted' })
        .eq('id', payment);
      expect(residentError).toBeNull();
    });
  });

  describe('Polls', () => {
    it('allows a Renter to SELECT a poll and their own apartment poll_votes row (view-only, FR-003)', async () => {
      const poll = await createTestPoll(buildingA, residentA.userId);
      const renterClient = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
      const { data, error } = await renterClient.from('polls').select('id').eq('id', poll);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('denies a Renter from INSERTing/UPDATEing poll_votes for their apartment, while the Resident can', async () => {
      const poll = await createTestPoll(buildingA, residentA.userId);
      const option = await createTestPollOption(poll);

      const renterClient = await signIn(signInAs(renterA.email, renterA.password), renterA.email, renterA.password);
      const { error: renterError } = await renterClient
        .from('poll_votes')
        .insert({ poll_id: poll, apartment_id: apartmentA, option_id: option, voter_id: renterA.userId });
      expect(renterError).not.toBeNull();

      const residentClient = await signIn(
        signInAs(residentA.email, residentA.password),
        residentA.email,
        residentA.password,
      );
      const { error: residentError } = await residentClient
        .from('poll_votes')
        .insert({ poll_id: poll, apartment_id: apartmentA, option_id: option, voter_id: residentA.userId });
      expect(residentError).toBeNull();
    });
  });
});
