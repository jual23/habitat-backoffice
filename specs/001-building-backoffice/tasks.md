---

description: "Task list template for feature implementation"
---

# Tasks: Building Administrator Backoffice

**Input**: Design documents from `/specs/001-building-backoffice/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: NOT optional in this feature. Constitution Principle III (NON-NEGOTIABLE) requires
automated tests for authorization rules and core CRUD workflows written before the corresponding
implementation. Every user story phase below has a Tests sub-phase that MUST be written and
failing before its Implementation sub-phase begins, per plan.md's Constitution Check and
research.md item 6 (real RLS tests against a local Supabase stack, not mocks).

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P8) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US8)
- Every task includes its exact file path

## Path Conventions

Single Next.js project per plan.md's Structure Decision — `app/`, `components/`, `lib/`,
`supabase/`, `tests/` at the repository root (no separate frontend/backend split).

## Revision Note

This version incorporates the `/speckit-analyze` remediation pass: T009/T012 now build and use a
`log_audit()` RPC instead of a service-role-only insert (I1); T011 references plan.md's upload
size limits (U2); T017 is new — a shared test-fixture helper (G2); every server-action task now
explicitly calls `writeAuditLog()` (U1); three new tasks (T058, T061, T064) add Staff provisioning
(G1); SC-001/002/005/007 timing checks moved into quickstart.md rather than a task (G3); the
`profiles` CHECK constraint ambiguity (A1) was resolved in data-model.md, not here.

**Implementation checkpoint note (2026-09-03)**: `/speckit-implement` found the live Habitat
Supabase project already carrying a complete, independently-built schema/RLS/functions for most of
this feature under different names. Per the user's explicit choice, the implementation adapts to
that existing schema rather than replacing it — **see
[SCHEMA-ADAPTATION.md](./SCHEMA-ADAPTATION.md)** for the full table/column mapping before reading
`[X]` marks below as "matches data-model.md literally." T004–T009 and T022/T023's migrations are
marked done because the equivalent schema/RLS already existed (plus three genuinely-new additive
migrations: `audit_log`/`log_audit()`, the apartments RESTRICT-delete fix, and staff-provisioning
policies) — no fresh `supabase/migrations/000N_*.sql` files matching the literal task descriptions
were created. T015's seed script is written but deliberately not run against the shared live
project (see the script's own header). T018–T021's tests are written but not executed to
green — this environment had no `SUPABASE_SERVICE_ROLE_KEY`, required by `tests/fixtures.ts`; see
SCHEMA-ADAPTATION.md's Testing constraint section. Phases 4–11 (US2–US8, Polish) are not yet
started.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the Next.js (App Router, TypeScript) project skeleton at the repository root per plan.md's Project Structure (`app/`, `components/`, `lib/`, `supabase/`, `tests/`)
- [X] T002 Initialize `package.json` with Next.js 14+, React 18, `@supabase/supabase-js`, `@supabase/ssr`, Zod, and Vitest as dependencies (depends on T001)
- [X] T003 [P] Configure ESLint + Prettier (or equivalent) at the repository root

**Checkpoint**: Project scaffolding exists; nothing runnable yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared database schema, helpers, auth, and test harness that every user story
depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Run `supabase init` and establish the `supabase/migrations/` and `supabase/functions/` directory structure (depends on T001)
- [X] T005 [P] Migration: `buildings` table (`id`, `name`) per data-model.md, in `supabase/migrations/0001_buildings.sql` (depends on T004)
- [X] T006 [P] Migration: `apartments` table per data-model.md, in `supabase/migrations/0002_apartments.sql` (depends on T004)
- [X] T007 Migration: `profiles` table (role enum `app_admin`/`building_admin`/`staff`/`resident`, `building_id`, `apartment_id` FK with `ON DELETE RESTRICT`, and the 3-way CHECK constraint from data-model.md's Validation table) in `supabase/migrations/0003_profiles.sql` (depends on T005, T006)
- [X] T008 [P] Migration: `audit_log` table (no INSERT grant for any role — see data-model.md's Write path note) per data-model.md, in `supabase/migrations/0004_audit_log.sql` (depends on T004)
- [X] T009 Migration: SQL helper functions `is_app_admin()`, `is_building_member(building_id)` (research.md item 3), and the `log_audit(actor_id, building_id, action, entity_type, entity_id, metadata)` `SECURITY DEFINER` RPC function that validates `actor_id = auth.uid()` before inserting into `audit_log` (research.md item 7), in `supabase/migrations/0005_rls_helpers.sql` (depends on T007, T008)
- [X] T010 [P] Implement Supabase client factories (browser + server contexts) in `lib/supabase/client.ts` and `lib/supabase/server.ts`
- [X] T011 [P] Implement generic Supabase Storage upload/download helper in `lib/supabase/storage.ts`, enforcing plan.md's assumed size limits (images ≤5MB, documents ≤20MB) before upload (used by facilities, announcements, activities, documentation, customization)
- [X] T012 Implement `writeAuditLog()` helper in `lib/audit.ts` that calls the `log_audit()` RPC from T009 via `supabase.rpc('log_audit', ...)`, used by every server action that creates/edits/deletes/approves/declines/discards (depends on T009)
- [X] T013 Implement the login page and Supabase Auth session handling in `app/login/page.tsx` (depends on T010)
- [X] T014 Implement `app/(backoffice)/layout.tsx`: session check, role-based navigation, redirect-if-unauthenticated, and the Staff route guard restricting `staff` to `/visitors` only (FR-037) (depends on T007, T009, T013)
- [X] T015 [P] Seed script: seed two buildings with one `app_admin`, one `building_admin` per building, two apartments per building, and one resident per apartment, in `supabase/seed.sql` (depends on T007). Staff accounts are NOT seeded here — create them via T064's `createStaff` action or `tests/fixtures.ts` (T017), since FR-039 makes Staff provisioning part of this feature rather than fixture data.
- [X] T016 [P] Configure Vitest and a test-auth helper that signs in as a given seeded role/building for integration tests, in `tests/setup.ts` (depends on T010)
- [X] T017 [P] Implement a service-role test-fixture helper in `tests/fixtures.ts` (e.g. `createTestApartment()`, `createTestProfile()`), bypassing RLS to set up rows integration tests need but no UI role can insert directly. Establishes the pattern later stories extend with their own fixture functions (`createTestReservation()` in US2, `createTestVisitor()` in US5, `createTestSuggestionComplaint()` in US7) as their tables become available (depends on T007, T008)

**Checkpoint**: Login works, roles/buildings/apartments schema exists, RLS helpers and the audit
RPC exist, file upload and test-fixture helpers exist, test harness can authenticate as any
seeded role. User story implementation can now begin.

---

## Phase 3: User Story 1 - Manage Apartments and Residents (Priority: P1) 🎯 MVP

**Goal**: A Building Administrator can maintain their apartment roster and resident accounts.

**Independent Test**: Create an apartment, create a resident in it, edit their email, move them
to another apartment, delete them — all verifiable without any other module existing.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T018 [P] [US1] RLS allow/deny test for `apartments` (per contracts/rls-policies.md) in `tests/integration/rls-apartments.test.ts`
- [X] T019 [P] [US1] RLS allow/deny test for `profiles` resident rows (per contracts/rls-policies.md) in `tests/integration/rls-profiles.test.ts`
- [X] T020 [P] [US1] Integration test: deleting an apartment with residents still assigned is rejected (Edge Cases) in `tests/integration/apartments-delete-restrict.test.ts`
- [X] T021 [P] [US1] Integration test: multiple residents can be associated with one apartment (FR-003) in `tests/integration/apartments-multi-resident.test.ts`

### Implementation for User Story 1

- [X] T022 [US1] Migration: RLS policies for `apartments` per contracts/rls-policies.md, in `supabase/migrations/0006_apartments_rls.sql` (depends on T018 failing)
- [X] T023 [US1] Migration: RLS policies for `profiles` resident rows per contracts/rls-policies.md, in `supabase/migrations/0007_profiles_rls.sql` (depends on T019 failing)
- [X] T024 [P] [US1] Zod validation schemas for the apartment and resident forms in `lib/validation/apartments.ts`
- [X] T025 [US1] Server actions `createApartment`/`updateApartment`/`deleteApartment` in `app/(backoffice)/apartments/actions.ts`, each calling `writeAuditLog()` (T012) on success (depends on T022, T024, T012)
- [X] T026 [US1] Server actions `createResident`/`updateResident`/`deleteResident` in `app/(backoffice)/users/actions.ts`, each calling `writeAuditLog()` (T012) on success (depends on T023, T024, T012)
- [X] T027 [P] [US1] Apartments list/detail page (create/edit/delete apartment, view its residents) in `app/(backoffice)/apartments/page.tsx` (depends on T025)
- [X] T028 [P] [US1] Users (residents) list/detail page (create/edit email/reassign apartment/delete) in `app/(backoffice)/users/page.tsx` (depends on T026)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Manage Facilities and Approve Reservations (Priority: P2)

**Goal**: A Building Administrator manages facilities and approves/declines reservation requests.

**Independent Test**: Create a reservable facility, approve one pending reservation and decline
another, and confirm their statuses change — independent of every other module.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [X] T029 [P] [US2] RLS allow/deny test for `facilities` in `tests/integration/rls-facilities.test.ts`
- [X] T030 [P] [US2] RLS allow/deny test for `reservations` (view own vs. others', approve/decline) in `tests/integration/rls-reservations.test.ts`
- [X] T031 [P] [US2] Integration test: soft-deleting a facility auto-declines its "Requested" reservations (FR-009) in `tests/integration/facilities-delete-cascade.test.ts`
- [X] T032 [P] [US2] Integration test: approve/decline transitions on a "Requested" reservation (FR-011/012), using a new `createTestReservation()` fixture function added to `tests/fixtures.ts` (per T017's pattern), in `tests/integration/reservations-workflow.test.ts`

### Implementation for User Story 2

- [X] T033 [US2] Migration: `facilities` table with `deleted_at` soft-delete cascade trigger per data-model.md, in `supabase/migrations/0008_facilities.sql` (depends on T031 failing)
- [X] T034 [US2] Migration: `reservations` table with status enum/transition constraint, in `supabase/migrations/0009_reservations.sql` (depends on T033, T032 failing)
- [X] T035 [US2] Migration: RLS policies for `facilities` and `reservations`, plus the `facility-images` Storage bucket policy, in `supabase/migrations/0010_facilities_reservations_rls.sql` (depends on T029, T030 failing)
- [X] T036 [P] [US2] Zod validation schema for the facility form in `lib/validation/facilities.ts`
- [X] T037 [US2] Server actions `createFacility`/`updateFacility`/`deleteFacility` in `app/(backoffice)/facilities/actions.ts` (image upload via T011's size-limited helper), each calling `writeAuditLog()` (T012) on success (depends on T035, T036, T012)
- [X] T038 [US2] Server actions `approveReservation`/`declineReservation` in `app/(backoffice)/reservations/actions.ts`, each calling `writeAuditLog()` (T012) on success (depends on T035, T012)
- [X] T039 [P] [US2] Facilities list/detail page with image upload, opening hours, reservable toggle in `app/(backoffice)/facilities/page.tsx` (depends on T037)
- [X] T040 [P] [US2] Reservations list page (filterable by status) with approve/decline actions in `app/(backoffice)/reservations/page.tsx` (depends on T038)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Publish Announcements (Priority: P3)

**Goal**: A Building Administrator manages announcements with attachments, a banner, and pinning.

**Independent Test**: Create an announcement with an attachment and a banner, pin it, and confirm
it sorts above unpinned announcements.

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [X] T041 [P] [US3] RLS allow/deny test for `announcements` and `announcement_attachments` in `tests/integration/rls-announcements.test.ts`
- [X] T042 [P] [US3] Integration test: pinned announcements sort above unpinned (Acceptance Scenarios 4/5) in `tests/integration/announcements-pin-order.test.ts`

### Implementation for User Story 3

- [X] T043 [US3] Migration: `announcements` and `announcement_attachments` tables in `supabase/migrations/0011_announcements.sql` (depends on T042 failing)
- [X] T044 [US3] Migration: RLS policies for both tables plus the `announcement-attachments` Storage bucket policy, in `supabase/migrations/0012_announcements_rls.sql` (depends on T041 failing)
- [X] T045 [P] [US3] Zod validation schema for the announcement form in `lib/validation/announcements.ts`
- [X] T046 [US3] Server actions `createAnnouncement`/`updateAnnouncement`/`deleteAnnouncement`/`togglePin`/`addAttachment` in `app/(backoffice)/announcements/actions.ts` (attachment/banner upload via T011's size-limited helper), each calling `writeAuditLog()` (T012) on success (depends on T043, T044, T045, T012)
- [X] T047 [P] [US3] Announcements list/detail page with attachment upload, banner upload, pin toggle in `app/(backoffice)/announcements/page.tsx` (depends on T046)

**Checkpoint**: User Stories 1–3 all work independently.

---

## Phase 6: User Story 4 - Manage Activities (Priority: P4)

**Goal**: A Building Administrator manages activities with a date, optional participant cap, and
a banner.

**Independent Test**: Create an activity with a date and banner, one with a participant cap and
one without, then edit/delete an activity.

### Tests for User Story 4 ⚠️ (write first, confirm they fail)

- [X] T048 [P] [US4] RLS allow/deny test for `activities` in `tests/integration/rls-activities.test.ts`
- [X] T049 [P] [US4] Integration test: `max_participants` rejects zero/negative and accepts null (FR-020) in `tests/integration/activities-max-participants.test.ts`

### Implementation for User Story 4

- [X] T050 [US4] Migration: `activities` table with `max_participants` CHECK constraint in `supabase/migrations/0013_activities.sql` (depends on T049 failing)
- [X] T051 [US4] Migration: RLS policies for `activities` plus the `activity-banners` Storage bucket policy, in `supabase/migrations/0014_activities_rls.sql` (depends on T048 failing)
- [X] T052 [P] [US4] Zod validation schema for the activity form in `lib/validation/activities.ts`
- [X] T053 [US4] Server actions `createActivity`/`updateActivity`/`deleteActivity` in `app/(backoffice)/activities/actions.ts` (banner upload via T011's size-limited helper), each calling `writeAuditLog()` (T012) on success (depends on T050, T051, T052, T012)
- [X] T054 [P] [US4] Activities list/detail page with date, banner upload, participant cap field in `app/(backoffice)/activities/page.tsx` (depends on T053)

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Track Expected Visitors, Staff Provisioning (Priority: P5)

**Goal**: A Building Administrator can provision Staff accounts; Staff view expected visitors and
mark arrivals; unactioned visitors auto-expire after 8 hours.

**Independent Test**: As `building_admin`, create a Staff account. As that Staff account, mark a
seeded expected visitor as arrived; separately confirm a different expected visitor automatically
becomes "Expired" once 8 hours pass.

### Tests for User Story 5 ⚠️ (write first, confirm they fail)

- [X] T055 [P] [US5] RLS allow/deny test for `visitors`, including that only `staff`/`building_admin` of the same building can view/update in `tests/integration/rls-visitors.test.ts`
- [X] T056 [P] [US5] Integration test: `visitor-expiry` sweep moves "Expected" → "Expired" past 8h and never touches "Arrived" (FR-024/025), using a new `createTestVisitor()` fixture function added to `tests/fixtures.ts` (per T017's pattern), in `tests/integration/visitor-expiry.test.ts`
- [X] T057 [P] [US5] Integration test: a `staff` session is denied every non-Visitors route (FR-037) in `tests/integration/staff-route-guard.test.ts`
- [X] T058 [P] [US5] RLS allow/deny test for `profiles` staff rows: a `building_admin` can create/delete `staff` rows scoped to their own `building_id` only, cannot create/delete another building's staff, and cannot insert any role other than `staff` through this path (FR-039/FR-040) in `tests/integration/rls-staff-provisioning.test.ts`

### Implementation for User Story 5

- [X] T059 [US5] Migration: `visitors` table with a constraint/trigger preventing `arrived → expired` in `supabase/migrations/0015_visitors.sql` (depends on T056 failing)
- [X] T060 [US5] Migration: RLS policies for `visitors` in `supabase/migrations/0016_visitors_rls.sql` (depends on T055 failing)
- [X] T061 [US5] Migration: RLS policies for `profiles` staff rows (`building_admin` INSERT/DELETE scoped to their own `building_id`, `role` fixed to `'staff'`; no UPDATE) per contracts/rls-policies.md, in `supabase/migrations/0017_profiles_staff_rls.sql` (depends on T058 failing)
- [X] T062 [US5] Implement the `visitor-expiry` scheduled Edge Function (per contracts/edge-functions.md) in `supabase/functions/visitor-expiry/index.ts`, with its cron schedule configured (depends on T059, T060)
- [X] T063 [US5] Server action `markVisitorArrived` in `app/(backoffice)/visitors/actions.ts`, calling `writeAuditLog()` (T012) on success (depends on T060, T012)
- [X] T064 [US5] Server actions `createStaff`/`deleteStaff` (FR-039/040) in `app/(backoffice)/visitors/staff-actions.ts`, each calling `writeAuditLog()` (T012) on success (depends on T061, T012)
- [X] T065 [P] [US5] Visitors list page (Staff-accessible) with the mark-arrived action, plus a Building-Administrator-only "Manage Staff" panel (create/remove Staff accounts) in `app/(backoffice)/visitors/page.tsx` (depends on T063, T064)

**Checkpoint**: User Stories 1–5 all work independently.

---

## Phase 8: User Story 6 - Manage Documentation (Priority: P6)

**Goal**: A Building Administrator organizes documents into (nested) folders.

**Independent Test**: Create a folder, upload a document into it, delete both.

### Tests for User Story 6 ⚠️ (write first, confirm they fail)

- [X] T066 [P] [US6] RLS allow/deny test for `folders` and `documents` in `tests/integration/rls-documentation.test.ts`
- [X] T067 [P] [US6] Integration test: deleting a folder cascades to its subfolders and documents, including Storage objects (FR-029) in `tests/integration/folders-delete-cascade.test.ts`

### Implementation for User Story 6

- [X] T068 [US6] Migration: `folders` (self-referencing, `ON DELETE CASCADE`) and `documents` tables in `supabase/migrations/0018_documentation.sql` (depends on T067 failing)
- [X] T069 [US6] Migration: RLS policies for `folders`/`documents` plus the `documents` Storage bucket policy, in `supabase/migrations/0019_documentation_rls.sql` (depends on T066 failing)
- [X] T070 [P] [US6] Zod validation schemas for folder/document forms in `lib/validation/documentation.ts`
- [X] T071 [US6] Server actions `createFolder`/`renameFolder`/`deleteFolder` (incl. Storage object purge) and `uploadDocument`/`deleteDocument` in `app/(backoffice)/documentation/actions.ts` (upload via T011's size-limited helper), each calling `writeAuditLog()` (T012) on success (depends on T068, T069, T070, T012)
- [X] T072 [P] [US6] Documentation folder-tree and document list/upload page in `app/(backoffice)/documentation/page.tsx` (depends on T071)

**Checkpoint**: User Stories 1–6 all work independently.

---

## Phase 9: User Story 7 - Review Suggestions and Complaints (Priority: P7)

**Goal**: A Building Administrator reviews suggestions/complaints in two tabs and can favorite or
discard entries; discarded entries auto-delete after 24 hours.

**Independent Test**: Switch between the two tabs, favorite an entry, discard another, and confirm
the discarded entry is permanently gone 24 hours later.

### Tests for User Story 7 ⚠️ (write first, confirm they fail)

- [X] T073 [P] [US7] RLS allow/deny test for `suggestions_complaints`, including that `content`/`type` cannot be edited by a Building Administrator in `tests/integration/rls-suggestions-complaints.test.ts`
- [X] T074 [P] [US7] Integration test: `discard-cleanup` sweep deletes rows discarded >24h ago and re-discarding an already-discarded row is a no-op (FR-032/033, Edge Cases), using a new `createTestSuggestionComplaint()` fixture function added to `tests/fixtures.ts` (per T017's pattern), in `tests/integration/discard-cleanup.test.ts`

### Implementation for User Story 7

- [X] T075 [US7] Migration: `suggestions_complaints` table in `supabase/migrations/0020_suggestions_complaints.sql` (depends on T074 failing)
- [X] T076 [US7] Migration: RLS policies for `suggestions_complaints` in `supabase/migrations/0021_suggestions_complaints_rls.sql` (depends on T073 failing)
- [X] T077 [US7] Implement the `discard-cleanup` scheduled Edge Function (per contracts/edge-functions.md) in `supabase/functions/discard-cleanup/index.ts`, with its cron schedule configured (depends on T075, T076)
- [X] T078 [US7] Server actions `toggleFavorite`/`discardEntry` in `app/(backoffice)/suggestions-complaints/actions.ts`, each calling `writeAuditLog()` (T012) on success (depends on T076, T012)
- [X] T079 [P] [US7] Suggestions/Complaints tabbed page with favorite/discard actions in `app/(backoffice)/suggestions-complaints/page.tsx` (depends on T078)

**Checkpoint**: User Stories 1–7 all work independently.

---

## Phase 10: User Story 8 - Customize Building Branding (Priority: P8)

**Goal**: A Building Administrator sets an accent color and uploads a square logo.

**Independent Test**: Set an accent color and upload a logo; confirm both are saved and
retrievable, and that a non-square logo is rejected.

### Tests for User Story 8 ⚠️ (write first, confirm they fail)

- [X] T080 [P] [US8] RLS allow/deny test for `building_customization` in `tests/integration/rls-customization.test.ts`
- [X] T081 [P] [US8] Integration test: uploading a non-square logo is rejected with a validation message (FR-035, Acceptance Scenario 3) in `tests/integration/customization-logo-validation.test.ts`

### Implementation for User Story 8

- [X] T082 [US8] Migration: `building_customization` table (1:1 with `buildings`) in `supabase/migrations/0022_building_customization.sql` (depends on T080 failing)
- [X] T083 [US8] Migration: RLS policies for `building_customization` plus the `branding-logos` Storage bucket policy, in `supabase/migrations/0023_customization_rls.sql` (depends on T080 failing)
- [X] T084 [US8] Server action `updateCustomization` (accent color + logo upload via T011's size-limited helper, with square-aspect validation) in `app/(backoffice)/customization/actions.ts`, calling `writeAuditLog()` (T012) on success (depends on T082, T083, T081 failing, T012)
- [X] T085 [P] [US8] Customization page: accent-color picker + logo uploader in `app/(backoffice)/customization/page.tsx` (depends on T084)

**Checkpoint**: All eight user stories are independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening that spans every user story

- [X] T086 [P] Cross-tenant isolation sweep test: as `building_admin` and `staff` of Building A, attempt every operation in contracts/rls-policies.md against Building B's rows and confirm all are denied (SC-008) in `tests/integration/cross-tenant-isolation.test.ts`
- [ ] T087 Run the full [quickstart.md](./quickstart.md) validation script end-to-end, including its SC-001/002/005/007 timing checks, and record results — NOT run: needs a running dev server, real seeded accounts, and a browser session, none of which this sandbox has; also blocked on the same missing `SUPABASE_SERVICE_ROLE_KEY` as the automated tests
- [X] T088 [P] Add loading, empty, and error states consistently across all `app/(backoffice)/*/page.tsx` views — empty states done everywhere; inline error messages done on every action; no explicit `loading.tsx`/Suspense boundaries were added (Next.js's own navigation loading indicator is the only loading affordance) — revisit if slow queries make that feel insufficient
- [X] T089 Security hardening pass: confirm the Supabase service-role key (used only by Edge Functions) is never referenced from any client-bundled code path, and confirm `log_audit()` (T009) cannot be called to log an `actor_id` other than the caller's own
- [X] T090 [P] Write `README.md` local-dev setup: `supabase start`, `supabase db reset`, `npm run dev`, `npm run test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–10)**: All depend on Foundational completion; stories are independent of
  each other and may proceed in parallel or in priority order (P1 → P8)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

None of US1–US8 depend on one another's implementation — each has its own tables (beyond the
shared `buildings`/`profiles`/`audit_log` foundation) and its own RLS policies. They are ordered
P1→P8 by business priority (see spec.md "Why this priority" for each), not by technical
dependency, so the recommended order is priority order but any story can be built once Phase 2 is
done. US5 additionally owns Staff provisioning (FR-039/040), which only that story's tests
(T058) and implementation (T061, T064, T065) touch — no other story depends on it either.

### Within Each User Story

- Tests MUST be written and failing before that story's Implementation tasks (Constitution
  Principle III)
- Migrations (tables) before RLS policy migrations before server actions before UI
- Story is checkpoint-complete before moving to the next priority

### Parallel Opportunities

- Setup: T003 in parallel with T001/T002's sequence
- Foundational: T005/T006/T008 in parallel; T010/T011 in parallel; T015/T016/T017 in parallel
  once their dependencies land
- Once Foundational is done, all eight user story phases can be staffed and built in parallel
- Within each story, all `[P]`-marked test tasks run together, and all `[P]`-marked UI/schema
  tasks that don't share a file run together

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "RLS allow/deny test for apartments in tests/integration/rls-apartments.test.ts"
Task: "RLS allow/deny test for profiles resident rows in tests/integration/rls-profiles.test.ts"
Task: "Integration test: apartment delete blocked with residents in tests/integration/apartments-delete-restrict.test.ts"
Task: "Integration test: multiple residents per apartment in tests/integration/apartments-multi-resident.test.ts"

# Then, after their respective migrations land, the two pages together:
Task: "Apartments list/detail page in app/(backoffice)/apartments/page.tsx"
Task: "Users (residents) list/detail page in app/(backoffice)/users/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Apartments & Residents)
4. **STOP and VALIDATE**: run T018–T021 plus the relevant quickstart.md section independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (Apartments & Residents) → validate → MVP
3. Add US2 (Facilities & Reservations) → validate
4. Add US3 (Announcements) → validate
5. Add US4 (Activities) → validate
6. Add US5 (Visitors + Staff Provisioning) → validate
7. Add US6 (Documentation) → validate
8. Add US7 (Suggestions & Complaints) → validate
9. Add US8 (Customization) → validate
10. Phase 11: Polish, run full quickstart.md, ship

### Parallel Team Strategy

Once Phase 2 (Foundational) is done, up to 8 developers can each own one user story phase — they
touch disjoint tables, RLS policy files, and route folders, so integration risk is low. Coordinate
only on shared files: `lib/audit.ts`, `lib/supabase/*`, `tests/fixtures.ts`, and
`app/(backoffice)/layout.tsx` (Foundational, already built by this point).

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- `[Story]` labels map every user-story-phase task back to spec.md for traceability
- Every RLS policy task has a corresponding allow/deny test written first, per Constitution
  Principle III and research.md item 6
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
