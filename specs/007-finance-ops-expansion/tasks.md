---

description: "Task list template for feature implementation"
---

# Tasks: Building Operations Expansion (Renter, Finance, Visitor Column, Maintenance, Polls, Emergency)

**Input**: Design documents from `/specs/007-finance-ops-expansion/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/rls-policies.md](./contracts/rls-policies.md),
[quickstart.md](./quickstart.md)

**Scope note**: This covers User Stories 1–5 and 7 only. **User Story 6 (Broadcast) is out of
scope here** — it was already fully planned and tasked separately as
[../008-broadcast-message-persistence/tasks.md](../008-broadcast-message-persistence/tasks.md),
which supersedes this spec's Broadcast requirements (plan.md's Input note).

**Tests**: NOT optional. Constitution Principle III (NON-NEGOTIABLE) requires an automated
allow-case and deny-case test for every new RLS policy, written and failing before that policy
exists. This feature introduces five modules' worth of new authorization surface, including this
app's first Renter-vs-Resident distinction — `tests/integration/renter-exclusion.test.ts` gets its
own dedicated coverage spanning Finance and Polls, since both share the same `tenant_type`
mechanism (plan.md's Source Code list).

**Organization**: Tasks are grouped by user story, in spec.md's priority order (P1 → P2 → P3 → P4
→ P5 → P7), so each can be implemented, tested, and shipped independently — matching how feature
004 was delivered story-by-story (spec.md's Assumptions).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5, US7)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, same as every prior feature — `app/`, `components/`, `lib/`, `tests/` at
the repository root. This repo has no local `supabase/migrations/` directory (see
`specs/001-building-backoffice/SCHEMA-ADAPTATION.md`); migration tasks below still name a
`supabase/migrations/NNNN_*.sql` path as the canonical record of the change, applied to the live
project the same way (SQL editor/MCP) prior features' additive migrations were, with
`lib/supabase/database.types.ts` regenerated immediately after.

**Migration numbering**: continues from spec 008's tasks.md, which claims `0017`–`0021` in this
same planning session — this feature's migrations start at `0022`. Both features' numbers are
aspirational until actually applied; confirm the true next-available number against the live
project (T002) before the first migration in either feature is run, and renumber here if it has
drifted, per `SCHEMA-ADAPTATION.md`'s precedent.

**Note on Supabase MCP access**: this plan was authored while this session's Supabase MCP
connection was disconnected (research.md's Summary) — T002 below requires it. If it's still
disconnected when implementation starts, re-authorize it (`/mcp` or `claude mcp`) before
proceeding; nothing in any story's migrations can be verified against the live schema without it.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this feature builds on is intact before changing anything

- [X] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run test` are clean on the current branch before this feature's changes begin, and that `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` set per quickstart.md's Prerequisites

**Checkpoint**: Baseline confirmed working; safe to start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the live-schema assumptions every story's design depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Confirm against the live Habitat Supabase project (Supabase MCP — re-authorize first if disconnected): (a) the true next-available migration number, per this file's numbering note above; (b) `profiles`'/`user_roles`' current shape and the exact current definition of `handle_new_user()` (to extend for `tenant_type`, data-model.md's User Story 1 section); (c) `apartments` and `buildings` already have admin-scoped UPDATE policies covering new columns without a new policy, per contracts/rls-policies.md's flagged assumption; (d) `visitors.apartment_id` already exists and is simply unselected today (US3); (e) the exact current definitions of `expire_visitors()`/`purge_discarded_feedback()` (to mirror their shape for the two new Finance sweeps, research.md item 4) and that `pg_cron` is enabled; (f) the existing `"notifications insert by staff or admin for their building"` policy shape (reused unchanged, per contracts/rls-policies.md); (g) the `building-media`/`building-documents` Storage bucket path convention (research.md item 8). No code change — this only confirms every story below can rely on these as designed

**Checkpoint**: Confirmed; User Story 1 can proceed as specified (or adapt to any live-schema divergence found, per SCHEMA-ADAPTATION.md's precedent).

---

## Phase 3: User Story 1 - Provision a Renter account with restricted access (Priority: P1) 🎯 MVP

**Goal**: A Building Administrator can create a Renter account exactly like a Resident account
today; the system can distinguish Renter from Resident everywhere it matters (Finance exclusion,
Poll-voting exclusion — enforced in later phases once those modules exist).

**Independent Test**: Per quickstart.md — create a Renter account, confirm it provisions
identically to a Resident account and that `getUserContext()` reports `role: 'renter'` for it.
Full Finance-hidden/Poll-voting-blocked behavior is exercised once User Story 2 and User Story 5
land, since their RLS design already assumes this column exists (data-model.md).

### Implementation for User Story 1

- [X] T003 [US1] Migration: `tenant_type` enum (`resident`, `renter`) and `profiles.tenant_type` column (`NOT NULL DEFAULT 'resident'`) in `supabase/migrations/0022_tenant_type.sql` (depends on T002)
- [X] T004 [US1] Migration: extend `handle_new_user()` to additionally read `raw_user_meta_data->>'tenant_type'`, defaulting to `'resident'` when absent, and set `profiles.tenant_type` accordingly, in `supabase/migrations/0023_handle_new_user_tenant_type.sql` (depends on T003, and on T002's confirmed current `handle_new_user()` definition)
- [X] T005 [US1] Regenerate `lib/supabase/database.types.ts` after T003–T004 (depends on T004)
- [X] T006 [P] [US1] `lib/session.ts`: MODIFIED — `getUserContext()`'s "no `user_roles` row + `apartment_id` set" branch returns `role: profiles.tenant_type` (`'resident' | 'renter'`) instead of a hardcoded `'resident'` (depends on T005)
- [X] T007 [P] [US1] `lib/user-provisioning.ts`: MODIFIED — `createBuildingUser()` accepts a third `role: 'renter'` option, structurally identical to `'resident'` (same required `apartmentId`, no `user_roles` row) except passing `tenant_type: 'renter'` in the Admin API's `user_metadata` (depends on T005)
- [X] T008 [US1] `app/(backoffice)/users/users-client.tsx`: MODIFIED — add "Renter" to the role selector alongside the existing Resident/Staff choices (depends on T007)
- [X] T009 [US1] `app/(backoffice)/users/actions.ts`: MODIFIED — the resident-creation Server Action accepts `role: 'renter'`, passing it through to `createBuildingUser()` unchanged otherwise (depends on T007)

**Checkpoint**: Renter accounts are provisionable via Usuarios y roles and `getUserContext()`
correctly distinguishes Renter from Resident. This is the foundation User Story 2 and User Story 5
build their exclusion rules on.

---

## Phase 4: User Story 2 - Manage building payments (Finance module) (Priority: P2)

**Goal**: A Building Administrator sets per-apartment fees (individually or via CSV), configures
the payment cycle and late fee, reviews/approves payment confirmations, and can filter/export/view
history — with Staff, Resident, and Renter all excluded from the module itself.

**Independent Test**: Per quickstart.md — set a fee, generate a payment, submit and approve a
confirmation, confirm the resident notification fires, let a due date pass and confirm the late
fee applies exactly once.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [X] T010 [P] [US2] Extend `tests/fixtures.ts` with `createTestPayment(buildingId, apartmentId, overrides?)` (service-role insert, bypassing RLS, matching the `createTestTicket`/`createTestPackage` pattern) (depends on T005)
- [X] T011 [P] [US2] RLS allow/deny test for `payments` in `tests/integration/rls-payments.test.ts`, covering: SELECT allowed to `building_admin`/`app_admin` and the apartment's Resident, denied to `staff`, Renter, and other buildings; INSERT denied to everyone via a client (only `generate_monthly_payments()` inserts); the resident-submits-confirmation UPDATE vs. the admin-approves UPDATE as two separate allowed transitions, each denied to the other actor; that a content-immutability trigger rejects changes to `amount`/`apartment_id`/`building_id`/`available_date`/`due_date` even though the same caller's legitimate status update succeeds; and — calling `approvePayment()` itself, not just the raw RLS UPDATE — that approving a payment (status → `received`) inserts exactly one `notifications` row for every resident of that apartment (FR-018, SC-005) (depends on T010)
- [X] T012 [US2] Create `tests/integration/renter-exclusion.test.ts` with its Finance section: a Renter cannot SELECT or UPDATE any `payments` row for their own apartment, even though the apartment's Resident can (depends on T010; depends on T003 for `tenant_type`)
- [X] T013 [US2] `tests/integration/finance-late-fee-sweep.test.ts`: `generate_monthly_payments()` creates exactly one row per fee-having apartment with the correct `due_date` (including the month-rollover rule when the due day ≤ the available day, research.md item 4); `evaluate_payment_due_dates()` applies the configured late fee exactly once per payment and inserts a reminder `notifications` row for a payment due tomorrow (depends on T010)

### Implementation for User Story 2

- [X] T014 [US2] Migration: `apartments.monthly_fee` column and `buildings` payment/late-fee settings columns (`payment_available_day`, `payment_due_day`, `late_fee_type` enum, `late_fee_amount`) in `supabase/migrations/0024_finance_settings_columns.sql` (depends on T002; depends on T011–T013 failing)
- [X] T015 [US2] Migration: `payment_status` enum and `payments` table per data-model.md (columns, the `status <> 'received' OR reviewed_by IS NOT NULL` constraint, the `(building_id, apartment_id)`/`(building_id, status)`/`(status, due_date)` indexes) in `supabase/migrations/0025_payments_table.sql` (depends on T014)
- [X] T016 [US2] Migration: RLS policies for `payments` per contracts/rls-policies.md, plus the content-immutability `BEFORE UPDATE` trigger, in `supabase/migrations/0026_payments_rls.sql` (depends on T015)
- [X] T017 [US2] Migration: `generate_monthly_payments()` and `evaluate_payment_due_dates()` `SECURITY DEFINER` functions (writing their own `audit_log` rows, matching `expire_visitors()`'s precedent confirmed in T002), scheduled daily via `pg_cron`, in `supabase/migrations/0027_payment_sweeps.sql` (depends on T016)
- [X] T018 [US2] Regenerate `lib/supabase/database.types.ts` after T014–T017 (depends on T017)
- [X] T019 [P] [US2] `lib/csv.ts`: NEW — hand-rolled `parseFeeCsv(text)`/`generateFeeCsv(rows)` for the fixed two-column (apartment, amount) shape, with basic quoting/escaping (research.md item 3) (depends on T001)
- [X] T020 [P] [US2] `lib/validation/finance.ts`: NEW — Zod schemas `setApartmentFeeSchema`, `bulkFeeCsvRowSchema`, `financeSettingsSchema` (payment/due day, late fee type/amount), `approvePaymentSchema` (depends on T018)
- [X] T021 [US2] Server Actions in `app/(backoffice)/finance/actions.ts`: `setApartmentFee`, `bulkSetFees` (parses the uploaded CSV with T019, merges per FR-013 — only listed apartments change, unknown-apartment rows rejected individually per Edge Cases), `approvePayment` (updates `status: → 'received'`/`reviewed_by`/`reviewed_at`, **then inserts one `notifications` row for every resident of that apartment**, reusing the existing `"notifications insert by staff or admin for their building"` policy per contracts/rls-policies.md — FR-018, SC-005), `setFinanceSettings` — all `building_admin`/`app_admin` only, each calls `writeAuditLog()` and `revalidatePath('/finance')` (depends on T019, T020, T016)
- [X] T022 [US2] `app/(backoffice)/finance/template/route.ts`: NEW — `GET` Route Handler authenticating via `getUserContext()`, querying the building's apartments + current fees, and streaming the CSV template (`Content-Type: text/csv`, `Content-Disposition: attachment`) built with T019's `generateFeeCsv` (research.md item 2) (depends on T018, T019)
- [X] T023 [US2] `app/(backoffice)/finance/page.tsx`: NEW — Server Component; redirect to `/login` unless `ctx.role` is `building_admin`/`app_admin`; load apartments + fees, `buildings` settings, and the payments table for `ctx.buildingId` (depends on T018)
- [X] T024 [US2] `app/(backoffice)/finance/finance-client.tsx`: NEW — Client Component: fee editor (individual + CSV upload with a link to T022's template), payments table with apartment/date/status filters and a client-side Blob export of the current (filtered) view, and the payment-cycle/late-fee settings form (depends on T021, T022, T023)
- [X] T025 [P] [US2] `app/(backoffice)/sidebar-nav.tsx`: add `{ href: '/finance', label: 'Finanzas', ... }` to `NAV_ITEMS` (admin-only — no `staffOnly` filter change, per plan.md's Source Code list) (depends on T023)

**Checkpoint**: Finance is fully functional and independently testable — fee management, payment
generation/review/history/filter/export, and the Renter/Staff exclusion all work end-to-end.

---

## Phase 5: User Story 3 - See which apartment reported a visitor (Priority: P3)

**Goal**: Every Visitas row shows its associated apartment directly.

**Independent Test**: Per quickstart.md — open Visitas and confirm every row shows its apartment.

### Implementation for User Story 3

- [X] T026 [US3] `app/(backoffice)/visitors/page.tsx`: MODIFIED — add `apartment_id` (and its display label) to the existing `.select(...)` and table rendering; no schema or RLS change (`visitors.apartment_id` already exists, data-model.md's User Story 3 section) (depends on T002)

**Checkpoint**: Visitas displays the apartment for every visitor entry — independent of every other
story in this feature.

---

## Phase 6: User Story 4 - Schedule and track recurring maintenance tasks (Priority: P4)

**Goal**: A Building Administrator creates/reschedules maintenance tasks; Staff (or an admin) marks
a due task done with a photo, advancing its next due date per its configured frequency.

**Independent Test**: Per quickstart.md — create a recurring task, mark it done as Staff with a
photo, confirm the next due date advances; reschedule a task as admin and confirm it updates.

### Tests for User Story 4 ⚠️ (write first, confirm they fail)

- [X] T027 [P] [US4] Extend `tests/fixtures.ts` with `createTestMaintenanceTask(buildingId, overrides?)` and `createTestMaintenanceCompletion(taskId, buildingId, completedBy, overrides?)` (depends on T005)
- [X] T028 [P] [US4] RLS allow/deny test for `maintenance_tasks` and `maintenance_completions` in `tests/integration/rls-maintenance.test.ts`, covering: `maintenance_tasks` SELECT allowed to `building_admin`/`app_admin`/`staff`, denied to `resident`/Renter/other buildings; INSERT allowed to `building_admin`/`app_admin` only; UPDATE of `next_due_date` allowed to both admin and `staff`, denied for other buildings; immutable fields (`name`, `frequency`, `interval_months`, `building_id`) rejected for everyone; and `maintenance_completions` INSERT allowed to admin/`staff` only when the referenced task is actually due (`next_due_date <= current_date`), denied to `resident` and to a not-yet-due task, with no UPDATE/DELETE policy at all (append-only) (depends on T027)
- [X] T029 [P] [US4] Unit test for the next-due-date math in `tests/integration/maintenance-next-due-date.test.ts`, against a pure `advanceDueDate()` function extracted to `lib/maintenance.ts` (Server Actions can't be invoked from Vitest -- `tests/integration/tickets-workflow.test.ts`'s precedent): for each `frequency` (`weekly` → +7 days, `monthly` → +1 calendar month including a year-boundary case, `every_n_months` → +`interval_months` months, all computed from the task's *pre-completion* `next_due_date`, not from today), assert the date advances correctly; for `once`, assert it returns `null` (no further occurrence, Edge Cases) (FR-037, SC-009) (depends on T027)

### Implementation for User Story 4

- [X] T030 [US4] Migration: `maintenance_frequency` enum (`once`, `weekly`, `monthly`, `every_n_months`) and `maintenance_tasks` table per data-model.md (including the `frequency <> 'every_n_months' OR interval_months IS NOT NULL` constraint and the `(building_id, next_due_date)` index) in `supabase/migrations/0028_maintenance_tasks.sql` (depends on T002; depends on T028, T029 failing)
- [X] T031 [US4] Migration: `maintenance_completions` table (append-only, no `updated_at`) per data-model.md in `supabase/migrations/0029_maintenance_completions.sql` (depends on T030)
- [X] T032 [US4] Migration: RLS policies for `maintenance_tasks` and `maintenance_completions` per contracts/rls-policies.md in `supabase/migrations/0030_maintenance_rls.sql` (depends on T031)
- [X] T033 [US4] Regenerate `lib/supabase/database.types.ts` after T030–T032 (depends on T032)
- [X] T034 [P] [US4] `lib/validation/maintenance.ts`: NEW — Zod schemas `createMaintenanceTaskSchema`, `rescheduleTaskSchema`, `completeTaskSchema` (photo required per FR-036) (depends on T033)
- [X] T035 [US4] Server Actions in `app/(backoffice)/maintenance/actions.ts`: `createTask`, `rescheduleTask` (both `building_admin`/`app_admin` only); `completeTask` (`building_admin`/`app_admin`/`staff`) — inserts the `maintenance_completions` row (uploading the photo via the existing `building-media` Storage pattern, research.md item 8) then advances `next_due_date` per `frequency` in the same Server Action (research.md item 7 — no trigger; T029 gates the exact math), setting it `NULL` for a `once` task; each action calls `writeAuditLog()` and `revalidatePath('/maintenance')` (depends on T034, T032; depends on T029 failing)
- [X] T036 [US4] `app/(backoffice)/maintenance/page.tsx`: NEW — Server Component; redirect unless `ctx.role` is `building_admin`/`app_admin`/`staff`; load tasks + their completion history for `ctx.buildingId` (depends on T033)
- [X] T037 [US4] `app/(backoffice)/maintenance/maintenance-client.tsx`: NEW — Client Component: task list, create/reschedule form (admin only), mark-done action with a photo picker (device storage or camera, where available) visible to Staff and admin (depends on T035, T036)
- [X] T038 [P] [US4] `app/(backoffice)/sidebar-nav.tsx`: add the Maintenance nav item to `NAV_ITEMS` and extend the `staffOnly` filter's allow-list to include `/maintenance` (depends on T036)
- [X] T039 [P] [US4] `lib/supabase/middleware.ts`: extend the staff-only redirect allow-list to permit `/maintenance` (same shape as the existing `/visitors`/`/incidencias`/`/packages` entries) (depends on T036)

**Checkpoint**: Maintenance is fully functional and independently testable — task
creation/rescheduling, Staff mark-done with photo, and next-due-date advancement all work
end-to-end, independent of every other story in this feature.

---

## Phase 7: User Story 5 - Create and monitor community polls (Priority: P5)

**Goal**: A Building Administrator creates polls (single/multiple-answer, optionally anonymous)
that apartments vote in once each; results display per the accordion (active expanded, closed
collapsed) rule; Renter accounts can view but never vote.

**Independent Test**: Per quickstart.md — create a poll, vote from two apartments, change one
apartment's vote before closing, confirm results (attributed or aggregate-only per the anonymous
flag), let it close and confirm further votes are rejected.

### Tests for User Story 5 ⚠️ (write first, confirm they fail)

- [X] T040 [P] [US5] Extend `tests/fixtures.ts` with `createTestPoll(buildingId, createdBy, overrides?)`, `createTestPollOption(pollId, overrides?)`, and `createTestPollVote(pollId, apartmentId, optionId, voterId, overrides?)` (depends on T005)
- [X] T041 [P] [US5] RLS allow/deny test for `polls`, `poll_options`, and `poll_votes` in `tests/integration/rls-polls.test.ts`, covering: `polls`/`poll_options` SELECT allowed to any building member including Renter, denied to other buildings; INSERT/UPDATE/DELETE allowed to `building_admin`/`app_admin` only; `poll_votes` SELECT allowed to admins (full attribution) and to any resident-or-Renter of the vote's own apartment, denied for other apartments/buildings; INSERT/UPDATE/DELETE allowed to the Resident of the voting apartment only while `closes_at > now()`, denied to Renter and to a closed poll; and the `UNIQUE (poll_id, apartment_id, option_id)` constraint (depends on T040)
- [X] T042 [US5] Extend `tests/integration/renter-exclusion.test.ts` with its Polls section: a Renter can SELECT a poll and its own apartment's `poll_votes` row (view-only, FR-003) but INSERT/UPDATE into `poll_votes` for their apartment is denied, even though the same apartment's Resident succeeds (depends on T012, T040, T003)

### Implementation for User Story 5

- [X] T043 [US5] Migration: `polls` and `poll_options` tables per data-model.md in `supabase/migrations/0031_polls.sql` (depends on T002; depends on T041–T042 failing)
- [X] T044 [US5] Migration: `poll_votes` table (the `UNIQUE (poll_id, apartment_id, option_id)` constraint, the `(poll_id, apartment_id)` index) in `supabase/migrations/0032_poll_votes.sql` (depends on T043)
- [X] T045 [US5] Migration: RLS policies for `polls`, `poll_options`, and `poll_votes` per contracts/rls-policies.md — including the Renter-exclusion `WITH CHECK` shown there — in `supabase/migrations/0033_polls_rls.sql` (depends on T044)
- [X] T046 [US5] Regenerate `lib/supabase/database.types.ts` after T043–T045 (depends on T045)
- [X] T047 [P] [US5] `lib/validation/polls.ts`: NEW — Zod schema `createPollSchema` (title, optional description/attachment, an options array, `allow_multiple`, `anonymous`, `closes_at`) (depends on T046)
- [X] T048 [US5] Server Actions in `app/(backoffice)/polls/actions.ts`: `createPoll` (`building_admin`/`app_admin` only — inserts the poll then its options), `castVote`/`updateVote` semantics live in the mobile app (out of scope) but the admin-facing action set here is limited to poll management per FR-048; calls `writeAuditLog()` (`poll.create`) and `revalidatePath('/polls')` (depends on T047, T045)
- [X] T049 [US5] `app/(backoffice)/polls/page.tsx`: NEW — Server Component; redirect unless `ctx.role` is `building_admin`/`app_admin`; load polls + options for `ctx.buildingId`, querying only aggregate `count(*) group by option_id` for anonymous polls and the per-apartment breakdown for non-anonymous ones (research.md item 5) (depends on T046)
- [X] T050 [US5] `app/(backoffice)/polls/polls-client.tsx`: NEW — Client Component: accordion list (active polls expanded by default with live results, closed polls collapsed to name + final result), a create-poll form, and a results view switching between aggregate-only and per-apartment display per the poll's `anonymous` flag (depends on T048, T049)
- [X] T051 [P] [US5] `app/(backoffice)/sidebar-nav.tsx`: add the Polls nav item to `NAV_ITEMS` (admin-only — no `staffOnly` filter change) (depends on T049)

**Checkpoint**: Community Polls is fully functional and independently testable — creation, per-
apartment voting semantics (enforced by RLS for the mobile app's future use), anonymous/attributed
results, the accordion default states, and the Renter view-only restriction all work end-to-end.

---

## Phase 8: User Story 7 - View resident-reported emergencies (Priority: P7)

**Goal**: Staff and Building Administrators see reported emergencies in a dedicated view, with a
persistent backoffice-wide indicator and a blinking nav link while any remain unhandled.

**Independent Test**: Per quickstart.md — insert a test emergency, confirm the indicator and
blinking nav link appear for Staff/admin, open the view, acknowledge it, and confirm both clear.

### Tests for User Story 7 ⚠️ (write first, confirm they fail)

- [X] T052 [P] [US7] Extend `tests/fixtures.ts` with `createTestEmergency(buildingId, reportedBy, overrides?)` (depends on T005)
- [X] T053 [P] [US7] RLS allow/deny test for `emergencies` in `tests/integration/rls-emergencies.test.ts`, covering: SELECT allowed to `building_admin`/`app_admin`/`staff` only, denied to `resident`/Renter/other buildings; INSERT allowed to any resident or Renter of the building only for their own `reported_by`, denied when reporting on someone else's behalf; UPDATE (`status: unhandled → resolved`, `resolved_by`, `resolved_at`) allowed to `building_admin`/`app_admin`/`staff` only; immutable fields (`description`, `apartment_id`, `reported_by`, `building_id`) rejected for everyone (depends on T052)

### Implementation for User Story 7

- [X] T054 [US7] Migration: `emergency_status` enum (`unhandled`, `resolved`) and `emergencies` table per data-model.md (including the `status <> 'resolved' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL)` constraint and the `(building_id, status)` index) in `supabase/migrations/0034_emergencies.sql` (depends on T002; depends on T053 failing)
- [X] T055 [US7] Migration: RLS policies for `emergencies` per contracts/rls-policies.md, plus a content-immutability `BEFORE UPDATE` trigger for `description`/`apartment_id`/`reported_by`/`building_id`, in `supabase/migrations/0035_emergencies_rls.sql` (depends on T054)
- [X] T056 [US7] Regenerate `lib/supabase/database.types.ts` after T054–T055 (depends on T055)
- [X] T057 [P] [US7] `lib/validation/emergency.ts`: NEW — Zod schema `acknowledgeEmergencySchema` (depends on T056)
- [X] T058 [US7] Server Action `app/(backoffice)/emergency/actions.ts`: `acknowledgeEmergency(emergencyId, buildingId)` — `building_admin`/`app_admin`/`staff` only, sets `status: 'resolved'`/`resolved_by`/`resolved_at`, calls `writeAuditLog()` (`emergency.resolve`), and `revalidatePath('/emergency')` plus the root layout path so the indicator re-evaluates immediately (depends on T057, T055)
- [X] T059 [US7] `app/(backoffice)/emergency/page.tsx`: NEW — Server Component; redirect unless `ctx.role` is `building_admin`/`app_admin`/`staff`; load emergencies for `ctx.buildingId` (depends on T056)
- [X] T060 [US7] `app/(backoffice)/emergency/emergency-client.tsx`: NEW — Client Component: emergency list (reporter, apartment, time, description) with an acknowledge/resolve action per row (depends on T058, T059)
- [X] T061 [US7] `app/(backoffice)/layout.tsx`: MODIFIED — Server Component adds an unhandled-emergency count check (`(building_id, status)` index, T054) for the signed-in user's building, rendering a small top-right indicator element (linking to `/emergency`) only when the count is greater than zero — this app's first layout-level dynamic element (research.md item 6) (depends on T056)
- [X] T062 [US7] `app/(backoffice)/sidebar-nav.tsx`: add the Emergency nav item to `NAV_ITEMS` with a CSS blink class applied conditionally on T061's same unhandled-count boolean, and extend the `staffOnly` filter's allow-list to include `/emergency` (depends on T061, T059)
- [X] T063 [P] [US7] `lib/supabase/middleware.ts`: extend the staff-only redirect allow-list to permit `/emergency` (depends on T059)

**Checkpoint**: Emergency is fully functional and independently testable — reporting (data-layer
only, per spec.md's Assumptions), the Staff/admin view, acknowledge/resolve, and the persistent
indicator/blink all work end-to-end. All of spec 007's in-scope stories (P1–P5, P7) are now
complete; P6 (Broadcast) is tracked and shipped via spec 008.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verification that spans every story in this feature

- [X] T064 [P] Run `npm run typecheck && npm run lint && npm run test && npm run build` and confirm all are clean with every change from T002–T063 applied
- [ ] T065 Run quickstart.md's full manual validation script (all six per-story walkthroughs plus its Cross-cutting checks section — immutability triggers, cross-building denial, Staff/Renter exclusion) and record results
- [X] T066 [P] Re-read plan.md's Constitution Check and Complexity Tracking table and confirm they still hold with the actual implementation; if the live schema diverged from data-model.md's assumptions (especially the `apartments`/`buildings` admin-UPDATE-policy assumption T002 was meant to confirm), add a `SCHEMA-ADAPTATION.md`-style note to this feature's directory

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup. Confirms the live-schema assumptions every story
  below depends on — genuinely blocking
- **User Story 1 (Phase 3)**: Depends on Phase 2. MVP — the foundation Finance and Polls build
  their Renter-exclusion rules on
- **User Story 2 (Phase 4)**: Depends on Phase 2 for its own tables, and on User Story 1's `T003`
  (`tenant_type` column) for the Renter-exclusion tests/policies
- **User Story 3 (Phase 5)**: Depends only on Phase 2 — fully independent of every other story
- **User Story 4 (Phase 6)**: Depends only on Phase 2 — fully independent of every other story
- **User Story 5 (Phase 7)**: Depends on Phase 2 for its own tables, and on User Story 1's `T003`
  for the Renter-exclusion tests/policies
- **User Story 7 (Phase 8)**: Depends only on Phase 2 — fully independent of every other story
- **Polish (Phase 9)**: Depends on every user story phase being complete

Stories are implemented in priority order (P1 → P2 → P3 → P4 → P5 → P7) as written, but P3, P4,
and P7 have no cross-story dependency and could just as validly run in any order, or in parallel
with each other, once Phase 2 is done — only P2 and P5 are genuinely gated on P1.

### Within Each Story

- Fixtures before their tests; tests before the migrations they gate; migrations before type
  regeneration; type regeneration before validation/actions; validation before actions; actions
  and the page before the client component; nav/middleware edits last, independent of the client
  component's exact contents (only need the route to exist)
- User Story 2 and User Story 5 additionally depend on User Story 1's `T003` migration having
  landed before their own Renter-exclusion test/policy tasks can pass

### Parallel Opportunities

- Setup: single task
- Foundational: single verification task
- US1: `T006` and `T007` can run in parallel once `T005` lands
- US2: `T011`–`T013` can run in parallel once `T010` lands (three different test files); `T019`
  and `T020` can run in parallel with each other; `T025` is independent once `T023` lands
- US3: single task, parallel with every other story once Phase 2 is done
- US4: fixtures (`T027`) land first, then `T028` (RLS test) and `T029` (next-due-date behavior
  test) can run in parallel with each other (different files, both depend only on `T027`); later,
  `T038` and `T039` can run in parallel once `T036` lands
- US5: `T040`–`T041` (fixture then test) are sequential; `T051` is independent once `T049` lands
- US7: `T052`–`T053` (fixture then test) are sequential; `T063` is independent once `T059` lands
- Across stories: US3, US4, and US7 touch entirely disjoint files from each other and from US1/US2/
  US5, so once Phase 2 is done, all four of {US2, US3, US4, US7} could in principle be worked in
  parallel by different people — only US5 must wait on US1's `T003`

---

## Parallel Example: User Story 2

```bash
# After T010 (fixtures) lands, launch all three test files together:
Task: "RLS allow/deny test for payments in tests/integration/rls-payments.test.ts"
Task: "Renter-exclusion Finance section in tests/integration/renter-exclusion.test.ts"
Task: "finance-late-fee-sweep test in tests/integration/finance-late-fee-sweep.test.ts"

# Once schema + types land, these two can run in parallel:
Task: "Hand-rolled CSV helpers in lib/csv.ts"
Task: "Zod schemas in lib/validation/finance.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Renter role)
4. **STOP and VALIDATE**: run quickstart.md's User Story 1 manual validation
5. This alone delivers the account-type foundation; it is not yet independently valuable without
   at least one of Finance/Polls to exclude Renter from, but it is independently *testable and
   shippable* per spec.md's own priority ordering

### Incremental Delivery

Each phase after Phase 3 is a complete, independently testable increment:

1. Phase 3 (User Story 1) → validate → the Renter role exists, distinguishable everywhere
2. Phase 4 (User Story 2) → validate → Finance is fully usable, including Renter exclusion
3. Phase 5 (User Story 3) → validate → Visitas shows apartments (can be done any time after Phase 2)
4. Phase 6 (User Story 4) → validate → Maintenance is fully usable
5. Phase 7 (User Story 5) → validate → Polls is fully usable, including Renter view-only access
6. Phase 8 (User Story 7) → validate → Emergency is fully usable, indicator/blink working
7. Phase 9 → final cross-cutting validation across everything above

This mirrors feature 004's precedent (spec.md's Assumptions): ship one user story at a time in
priority order, stopping at each checkpoint to validate before moving on.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- `sidebar-nav.tsx` and `lib/supabase/middleware.ts` are each touched by more than one story
  (Finance, Maintenance, Polls, Emergency) — these edits are never marked `[P]` against each other
  and naturally serialize because the stories themselves run in priority order
- Per `SCHEMA-ADAPTATION.md`'s precedent (specs/001, specs/004, specs/006, specs/008), if the live
  Habitat schema has drifted from data-model.md's assumptions by the time T002/the migration tasks
  run, adapt to the live definition and record the mapping rather than assuming data-model.md is
  authoritative (T066)
- Commit after each task or logical group
- Stop at each story's checkpoint to validate before moving to the next
