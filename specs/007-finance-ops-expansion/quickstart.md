# Quickstart: Validating Building Operations Expansion (US1-US5, US7)

Broadcast (US6) is validated separately via `specs/008-broadcast-message-persistence/quickstart.md`.

## Prerequisites

- `.env.local` populated (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` for tests).
- The schema in [data-model.md](data-model.md) applied to the live Habitat project — **before
  writing that migration**, confirm this plan's assumptions against the live schema (research.md's
  Summary; this plan was authored without live DB access this session). Regenerate
  `lib/supabase/database.types.ts` immediately after.
- A test building with a Building Administrator, a Staff account, at least two apartments, a
  Resident account on one, and (once User Story 1 lands) a Renter account on another.
- `pg_cron` confirmed enabled (already true per feature 001) for the two new sweeps.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run test        # vitest run — includes rls-payments, rls-maintenance, rls-polls,
                     # rls-emergencies, finance-late-fee-sweep, and renter-exclusion
```

Per Constitution Principle III, the new RLS tests should exist and fail before the corresponding
policy exists, then pass after.

## Manual validation — User Story 1: Renter role

1. From Usuarios y roles, create a new account choosing "Renter" for a test apartment.
   - **Expect**: same form as Resident creation (feature 006); account works immediately.
2. Sign in as that Renter (or query directly as them).
   - **Expect**: Finance is inaccessible; Polls are visible.
3. Attempt to cast a poll vote as the Renter.
   - **Expect**: rejected.
4. Cast a vote as an actual Resident of a different apartment.
   - **Expect**: succeeds normally — unaffected by Renter's existence.

## Manual validation — User Story 2: Finance module

1. As Building Administrator, set a monthly fee for one apartment individually.
2. Download the fee CSV template.
   - **Expect**: every apartment listed in column A, existing fees pre-filled in column B.
3. Edit and upload that CSV, changing a subset of apartments' fees.
   - **Expect**: only the edited apartments' fees change; everyone else's stays as before (merge
     semantics, FR-013).
4. Configure the payment-available day and due day, and a late fee (flat or percent).
5. Trigger (or wait for) `generate_monthly_payments()`.
   - **Expect**: one `payments` row per fee-having apartment, correct `due_date`.
6. As the apartment's Resident, attach a confirmation photo to a pending payment (direct
   query/service-role, simulating the mobile app).
7. As Building Administrator, approve it from the Finance module.
   - **Expect**: status → `received`; every resident of that apartment gets a notification.
8. Let a different payment's `due_date` pass unattended, then run `evaluate_payment_due_dates()`.
   - **Expect**: the late fee is applied once; status → `overdue`.
9. Filter the payments table by apartment/date/status and export the current view.
10. Open a specific apartment's payment history.
    - **Expect**: every past payment for that apartment, in order.

## Manual validation — User Story 3: Visitor apartment column

1. Open Visitas with at least one visitor entry tied to an apartment.
   - **Expect**: the apartment is shown directly in the table.

## Manual validation — User Story 4: Maintenance module

1. As Building Administrator, create a monthly-recurring task ("Elevator inspection").
2. Reschedule its date.
   - **Expect**: updates.
3. As Staff, mark it done with a photo (device storage or camera).
   - **Expect**: completion recorded; `next_due_date` advances roughly a month out.
4. Create a one-time task, mark it done.
   - **Expect**: no further due date — it drops off the due list.

## Manual validation — User Story 5: Community Polls

1. As Building Administrator, create a poll (description, no attachment, single-answer,
   non-anonymous, a near-future closing date).
2. Cast votes from two different apartments (simulating the mobile app).
3. Change one apartment's vote before closing.
   - **Expect**: that apartment's vote updates, not duplicates.
4. View results as admin.
   - **Expect**: per-apartment attribution visible (non-anonymous).
5. Repeat with `anonymous = true`.
   - **Expect**: only aggregate tallies visible, no apartment attribution.
6. Let the poll's `closes_at` pass, attempt another vote.
   - **Expect**: rejected.
7. Open the poll list.
   - **Expect**: active polls expanded with live results; closed polls collapsed to name + result.

## Manual validation — User Story 7: Emergency module

1. Insert a test emergency report (service-role, simulating the mobile app).
2. Sign in as Staff or Building Administrator, view any backoffice page.
   - **Expect**: the top-right indicator appears and the Emergency nav link blinks.
3. Open the Emergency view.
   - **Expect**: the report's details (reporter, apartment, time, description).
4. Acknowledge/resolve it.
   - **Expect**: indicator and blink both clear (assuming no other unhandled emergency exists).

## Cross-cutting checks

- Sign in as Staff and confirm Finance and Polls are both inaccessible (route + RLS).
- Sign in as a Renter and confirm Finance is entirely absent and poll voting is blocked, while
  everything else a Resident sees remains visible.
- Attempt to change an immutable field (`payments.amount`, `maintenance_tasks.name`,
  `emergencies.description`) directly via the Supabase client after creation — expect rejection by
  each table's content-immutability trigger, even though the same caller's legitimate status update
  on the same row succeeds.
- Sign in as staff/admin from a different building and attempt to read/act on the first building's
  payments, maintenance tasks, polls, or emergencies — expect denial by RLS.
