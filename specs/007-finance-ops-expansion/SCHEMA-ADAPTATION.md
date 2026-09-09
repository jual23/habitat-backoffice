# Schema Adaptation Note

**Read this before comparing the implementation against `data-model.md`/`contracts/rls-policies.md`/`tasks.md`.**

Following the precedent set in `specs/001-building-backoffice/SCHEMA-ADAPTATION.md` and
`specs/004-facilities-incidencias-packages/SCHEMA-ADAPTATION.md`, this file records where the live
Habitat Supabase project's actual state diverged from what this feature's design docs assumed, and
how the implementation adapted.

## `supabase/migrations/` already existed, and migration numbering was correct

tasks.md's Path Conventions section (inherited from spec 008's, written in the same planning
session) claimed "this repo has no local `supabase/migrations/` directory." That was wrong for the
current repo state: `supabase/migrations/0010`–`0016` already existed on disk (features 004/006's
additive migrations). T002's live-schema check confirmed the true next-available number was `0022`
— exactly what tasks.md had assumed (spec 008 claims `0017`–`0021`, not yet applied) — so no
renumbering was needed. This feature's migrations are `0022`–`0027c`, `0028`–`0035`.

## Payment sweeps needed the building's own timezone, not the database's UTC `current_date`

Neither research.md item 4 nor the original `0027_payment_sweeps.sql` accounted for
`buildings.timezone` (already a column, default `'America/Panama'`) when computing "today" —
both `generate_monthly_payments()` and `evaluate_payment_due_dates()` used the database session's
own `current_date` (UTC). `tests/integration/finance-late-fee-sweep.test.ts` caught this directly:
a fixture building configured for "today" (in Panama's calendar) generated zero payments, because
the database's UTC `current_date` had already rolled to the next calendar day. Fixed in
`0027c_payment_sweeps_timezone_fix.sql` — both functions now compute "today" per building via
`now() at time zone b.timezone`, matching each building's actual configured calendar day rather
than the server's.

## Sweep functions needed their `EXECUTE` grant tightened to match precedent

The two new sweep functions were initially created with Postgres's default privilege set, which
(unlike the existing `expire_visitors()`/`purge_discarded_feedback()`) included `EXECUTE` for
`anon` and `PUBLIC`. `0027b_payment_sweeps_revoke_public_exec.sql` revokes both, matching the
`authenticated`/`service_role`-only precedent confirmed via `pg_proc.proacl` in T002.

## A note on multi-policy `UPDATE` semantics (for the next feature's RLS tests)

Two tests were initially written with an incorrect expectation and had to be corrected after a
live run: for a table with **two** permissive `UPDATE` policies (e.g. `payments`' resident-submits
vs. admin-approves), an actor whose row *is* selected under one policy's `USING` but whose intended
new row satisfies **no** policy's `WITH CHECK` gets an explicit RLS violation error (`42501`), not
a silent 0-row update — `WITH CHECK` clauses are OR'd across *all* permissive policies regardless
of which policy's `USING` admitted the row. A silent 0-row result only happens when `USING` itself
never matches the row for that actor at all (true when a table has exactly **one** `UPDATE` policy,
as `emergencies` does, or when the row is out of scope entirely, as in every cross-building denial
test). Fixed in `tests/integration/rls-payments.test.ts` and confirmed correctly-shaped in
`tests/integration/rls-emergencies.test.ts`.

## Testing constraint: Supabase Auth's sign-in rate limit

Unlike features 001/004 (which had no `SUPABASE_SERVICE_ROLE_KEY` at all), this session had full
credentials and ran every new test file — `rls-payments`, `renter-exclusion`, `finance-late-fee-
sweep`, `rls-maintenance`, `maintenance-next-due-date`, `rls-polls`, `rls-emergencies` — individually
to green, catching and fixing three real bugs in the process (the two above, plus a couple of
incorrect test assertions). A final full-suite `npm run test` run in this same session hit
Supabase Auth's sign-in rate limit (`"Request rate limit reached"`) purely from the cumulative
volume of `signInWithPassword` calls across ~10 separate test-file invocations — every test in
every **pre-existing** file failed the same way, confirming this is the shared platform limit
resetting on its own schedule, not a regression this feature introduced. **Whoever runs `npm run
test` next, once that window has reset, should treat it as this session's first true full-suite
green run** — nothing here should fail if it does.

## Not performed this session: the interactive quickstart.md walkthrough

T065 (the full manual UI walkthrough — clicking through Finance/Maintenance/Polls/Emergency as
real signed-in users) was not performed; this session had no browser-automation tool available.
`npm run typecheck`, `npm run lint`, and `npm run build` are all clean with every change in this
feature applied, and every module's automated RLS/behavior tests passed individually — but the
end-to-end UI flows (CSV upload round-trip, photo capture, the accordion poll view, the emergency
indicator/blink actually rendering) still want a real click-through before this is considered fully
validated per quickstart.md.
