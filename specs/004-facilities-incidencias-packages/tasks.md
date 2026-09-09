---

description: "Task list template for feature implementation"
---

# Tasks: Facility Status, Incidencias & Package Receipt

**Input**: Design documents from `/specs/004-facilities-incidencias-packages/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/rls-policies.md](./contracts/rls-policies.md),
[quickstart.md](./quickstart.md)

**Tests**: NOT optional for User Stories 1 and 2. Constitution Principle III (NON-NEGOTIABLE)
requires an automated allow-case and deny-case test for every new RLS policy, written and failing
before that policy exists — `tickets`, `ticket_comments`, and `packages` are new authorization
surface. User Story 3 (facilities bubble + capacity removal) introduces no new table, column, or
RLS policy — the existing `facilities` SELECT policy already covers it — so, per the precedent set
in `specs/003-upload-display-fix/tasks.md` for its own display-only stories, it is verified via
quickstart.md's manual steps plus the standard `npm run typecheck`/`lint`/`build` gates, with no new
automated test required.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US3)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, same as every prior feature — `app/`, `components/`, `lib/`, `tests/` at
the repository root. This repo has no local `supabase/migrations/` directory (see
`specs/001-building-backoffice/SCHEMA-ADAPTATION.md` — the live Habitat Supabase project's schema
is managed directly, not via versioned migration files); migration tasks below still name a
`supabase/migrations/NNNN_*.sql` path as the canonical record of the change, to be applied to the
live project the same way (SQL editor/MCP) prior features' additive migrations were, with
`lib/supabase/database.types.ts` regenerated immediately after.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this feature builds on is intact before changing anything

- [X] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run test` are clean on the current branch before this feature's changes begin, and that `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` set per quickstart.md's Prerequisites

**Checkpoint**: Baseline confirmed working; safe to start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-story groundwork

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

This feature has no shared code-level prerequisite spanning all three stories — each story
introduces its own tables/actions/UI independently (US1: tickets, US2: packages, US3: no schema
change at all). The one true precondition, Constitution v1.5.0 amending Staff's Principle II scope
to include Incidencias and Package Receipt, is **already merged** (see plan.md's Constitution
Check). US3 has no dependency on this phase and may start immediately after Setup.

- [X] T002 Confirm the RLS helper functions `is_app_admin(_user_id)`, `is_building_member(_building, _user_id)`, and `has_building_role(_building, _role, _user_id)` referenced by contracts/rls-policies.md exist in the live Habitat Supabase project with those exact signatures (query `lib/supabase/database.types.ts`'s `Functions` section, which already lists them) — no code change, this only confirms US1/US2's new RLS policies (T009, T024) can rely on them as written

**Checkpoint**: Confirmed; US1 and US2 migrations can proceed as specified.

---

## Phase 3: User Story 1 - Triage and resolve maintenance requests (Incidencias) (Priority: P1) 🎯 MVP

**Goal**: Staff/Building Admin see every maintenance ticket for their building in a sortable,
filterable table and can move each through Pending → In Progress (with resident-visible comments)
→ Resolved, or → Rejected (with a required reason), or → Duplicate (linked to another ticket).

**Independent Test**: Per quickstart.md's User Story 1 section — seed a Pending ticket, open
`/incidencias` as Staff/Admin, sort and filter the table, then walk one ticket to Resolved, one to
Rejected (reason required), and one to Duplicate (linked).

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T003 [P] [US1] Extend `tests/fixtures.ts` with `createTestTicket(buildingId, reportedBy, overrides?)` (service-role insert, bypassing RLS, matching the `createTestVisitor`/`createTestSuggestionComplaint` pattern) and `createTestTicketComment(ticketId, authorId, overrides?)`
- [X] T004 [P] [US1] RLS allow/deny test for `tickets` (SELECT/INSERT/UPDATE per contracts/rls-policies.md), covering: the cross-building deny case; the "duplicate link must be same building **and** target status `pending`/`in_progress`" `WITH CHECK` (allow linking to a `pending` or `in_progress` ticket, deny linking to a `resolved`/`rejected`/`duplicate` one, per FR-009); the `tickets_status_transition_guard` trigger (allow `in_progress` → `resolved`, deny `pending` → `resolved` directly, per FR-010); and — per data-model.md's Triggers section — that a `staff`/`building_admin` UPDATE changing `title`/`description`/`apartment_id`/`reported_by` is rejected by the content-immutability trigger even though that same role can update `status` — in `tests/integration/rls-tickets.test.ts` (depends on T003)
- [X] T005 [P] [US1] RLS allow/deny test for `ticket_comments` (SELECT for staff/admin/reporting resident, INSERT only while parent ticket is `in_progress`, denied to other buildings/residents) in `tests/integration/rls-ticket-comments.test.ts` (depends on T003)
- [X] T006 [P] [US1] Integration test for the ticket status-transition rules at the Server Action/app-validation layer (the friendly-error path in front of T004's DB-level backstop) — rejecting without `rejection_reason` is blocked, marking duplicate without `duplicate_of_ticket_id` is blocked, a ticket cannot duplicate itself, marking duplicate against a `resolved`/`rejected`/`duplicate` ticket is blocked (FR-009), resolving a `pending` ticket directly (without first going `in_progress`) is blocked (FR-010), and a comment insert is rejected when the ticket is not `in_progress` (spec.md Edge Cases) — in `tests/integration/tickets-workflow.test.ts` (depends on T003)

### Implementation for User Story 1

- [X] T007 [US1] Migration: `ticket_status` enum (`pending`, `in_progress`, `rejected`, `resolved`, `duplicate`) and the `tickets` table per data-model.md (`building_id`, `apartment_id`, `reported_by`, `title`, `description`, `status`, `rejection_reason`, `duplicate_of_ticket_id`, timestamps, plus the three `CHECK` constraints) in `supabase/migrations/0010_tickets.sql` (depends on T002)
- [X] T008 [US1] Migration: `ticket_comments` table per data-model.md (`ticket_id` FK `ON DELETE CASCADE`, `author_id`, `body`, `created_at`) in `supabase/migrations/0011_ticket_comments.sql` (depends on T007)
- [X] T009 [US1] Migration: RLS policies for `tickets` and `ticket_comments` per contracts/rls-policies.md — the `tickets` UPDATE policy's `WITH CHECK` includes the "same building **and** target status `pending`/`in_progress`" subquery for `duplicate_of_ticket_id` (contracts/rls-policies.md) — **plus** two triggers on `tickets`: the `BEFORE UPDATE` content-immutability trigger rejecting any change to `title`/`description`/`apartment_id`/`reported_by` (data-model.md's Triggers section — a row-level RLS policy alone cannot restrict which columns an otherwise-permitted UPDATE touches; matches the existing `feedback_content_immutable_trigger` precedent), and the `tickets_status_transition_guard` trigger rejecting `status → 'resolved'` unless the row's current status is `'in_progress'` (FR-010) — in `supabase/migrations/0012_tickets_rls.sql` (depends on T004, T005, T006 failing; depends on T007, T008)
- [X] T010 [US1] Regenerate `lib/supabase/database.types.ts` from the live schema after T007–T009 are applied (depends on T009)
- [X] T011 [P] [US1] Zod validation schemas in `lib/validation/tickets.ts`: `rejectTicketSchema` (`ticket_id`, `rejection_reason` min-length), `markDuplicateSchema` (`ticket_id`, `duplicate_of_ticket_id`, refined to reject self-reference), `addCommentSchema` (`ticket_id`, `body` min-length) (depends on T010)
- [X] T012 [US1] Server Actions in `app/(backoffice)/incidencias/actions.ts`: `startProgress(ticketId, buildingId)`, `resolveTicket(ticketId, buildingId)` (fetches the ticket first and returns a friendly validation error if its current `status !== 'in_progress'`, ahead of the `tickets_status_transition_guard` trigger's DB-level rejection — FR-010), `rejectTicket(input)`, `markDuplicate(input)` (fetches the target ticket first and returns a friendly validation error if its `status` isn't `pending`/`in_progress`, ahead of the RLS `WITH CHECK` — FR-009), `addComment(input)` — each authorized via `getUserContext()` for `staff`/`building_admin`/`app_admin` scoped to the ticket's `buildingId`, validated with T011's schemas, and calling `writeAuditLog()` on success (`ticket.status_change`/`ticket.comment` actions), then `revalidatePath('/incidencias')` (depends on T009, T011)
- [X] T013 [P] [US1] Add `IconWrench` to `components/icons.tsx`, matching the existing hand-drawn outline-icon pattern (base() helper), for the Incidencias nav item
- [X] T014 [US1] `app/(backoffice)/incidencias/page.tsx`: Server Component — redirect to `/login` unless `ctx.role` is `staff`/`building_admin`/`app_admin`; load all tickets for `ctx.buildingId` (`id, title, description, status, rejection_reason, duplicate_of_ticket_id, apartment_id, reported_by, created_at`), plus each ticket's comments, plus the building's other tickets filtered to `status IN ('pending', 'in_progress')` (`id, title`) for the duplicate-picker dropdown (FR-009); pass to the client component (depends on T010)
- [X] T015 [US1] `app/(backoffice)/incidencias/incidencias-client.tsx`: Client Component rendering the ticket table (Title/Date/Status columns, click-to-sort ascending/descending per column, a status filter dropdown using the existing `Badge` component for status pills); per-row actions calling T012's Server Actions — "Start progress", a comment box shown only while `in_progress` (resident-visible per FR-007), a "Reject" flow requiring a reason before submit, a "Mark duplicate" flow with a ticket-picker sourced from T014's Pending/In-Progress-only list (excluding the ticket itself), and "Resolve" shown only when the ticket is currently `in_progress` (disabled/hidden while `pending`, per FR-010); the Duplicate status renders as a link to the referenced ticket (depends on T012, T014)
- [X] T016 [US1] `app/(backoffice)/sidebar-nav.tsx`: add `{ href: '/incidencias', label: 'Incidencias', icon: IconWrench }` to `NAV_ITEMS`, and extend the `staffOnly` filter's condition from `item.href === '/visitors'` to also match `/incidencias` (depends on T013)
- [X] T017 [US1] `lib/supabase/middleware.ts`: extend the staff-only redirect condition from `!pathname.startsWith('/visitors')` to also allow `/incidencias` (i.e. redirect only when the path starts with neither) (same staff-scope change as T016; can be done alongside it)

**Checkpoint**: User Story 1 is fully functional and independently testable — Incidencias can be
triaged end-to-end without Packages or the facilities bubble existing.

---

## Phase 4: User Story 2 - Register and track package receipt (Priority: P2)

**Goal**: Staff register an arriving package (apartment, description, optional photo), every
resident of that apartment is notified, and Staff later mark it "Recogido".

**Independent Test**: Per quickstart.md's User Story 2 section — register a package with and
without a photo, confirm every resident of the apartment gets a notification, then mark it
Recogido.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [X] T018 [P] [US2] Extend `tests/fixtures.ts` with `createTestPackage(buildingId, apartmentId, registeredBy, overrides?)` (service-role insert)
- [X] T019 [P] [US2] RLS allow/deny test for `packages` (SELECT for staff/admin/apartment residents, INSERT scoped to building+matching apartment, UPDATE `pending → picked_up` only, denied cross-building, and — per data-model.md's Triggers section — that a `staff`/`building_admin` UPDATE changing `description`/`photo_url`/`apartment_id` is rejected by the content-immutability trigger even though that same role can update `status`/`picked_up_at`) in `tests/integration/rls-packages.test.ts` (depends on T018)
- [X] T020 [US2] Integration test: registering a package inserts one `notifications` row per resident of the target apartment (multiple residents → multiple notifications; zero residents → package still saves, no notification rows) in `tests/integration/packages-notify.test.ts` (depends on T018; exercises the `registerPackage` action from T024, so implement after T024 exists even though the test is written first per Principle III and confirmed failing before T024)

### Implementation for User Story 2

- [X] T021 [US2] Migration: `package_status` enum (`pending`, `picked_up`) and the `packages` table per data-model.md (`building_id`, `apartment_id`, `description`, `photo_url`, `status`, `registered_by`, `picked_up_at`, timestamps) in `supabase/migrations/0013_packages.sql` (depends on T002)
- [X] T022 [US2] Migration: RLS policies for `packages` per contracts/rls-policies.md, **plus** a `BEFORE UPDATE` content-immutability trigger on `packages` rejecting any change to `description`/`photo_url`/`apartment_id` (data-model.md's Triggers section, same rationale as T009's `tickets` trigger), and confirm/widen the existing `notifications` table's INSERT policy so a `staff`/`building_admin` can insert a notification addressed to a resident (`user_id`) in their own building — per contracts/rls-policies.md's flagged assumption that this may currently be self-only (`user_id = auth.uid()`) — in `supabase/migrations/0014_packages_rls.sql` (depends on T019 failing; depends on T021)
- [X] T023 [US2] Regenerate `lib/supabase/database.types.ts` from the live schema after T021–T022 are applied (depends on T022)
- [X] T024 [P] [US2] Zod validation schema in `lib/validation/packages.ts`: `registerPackageSchema` (`apartment_id` uuid, `description` min-length, optional photo handled via the existing `fileFormData`/`fileFromFormData` pattern from `lib/supabase/storage.ts`) (depends on T023)
- [X] T025 [US2] Server Actions in `app/(backoffice)/packages/actions.ts`: `registerPackage(buildingId, input, photoFormData?)` — validates with T024, uploads the optional photo via `uploadBuildingFile()` (bucket `building-media`, path segment `packages`), inserts the `packages` row, queries `profiles` for every `apartment_id` match, inserts one `notifications` row per resident found, calls `writeAuditLog()` (`package.register`), `revalidatePath('/packages')`; and `markPickedUp(packageId, buildingId)` — updates `status`/`picked_up_at`, calls `writeAuditLog()` (`package.pickup`) (depends on T022, T024)
- [X] T026 [P] [US2] Add `IconPackage` to `components/icons.tsx`, matching the existing outline-icon pattern, for the Packages nav item
- [X] T027 [US2] `app/(backoffice)/packages/page.tsx`: Server Component — redirect to `/login` unless `ctx.role` is `staff`/`building_admin`/`app_admin`; load the building's `apartments` (`id, unit_number, tower`) for the register form's dropdown, load `packages` (`id, apartment_id, description, photo_url, status, created_at, picked_up_at`) with signed photo URLs via `trySignedUrlFor()` (matching `facilities/page.tsx`'s pattern), pass to the client (depends on T023)
- [X] T028 [US2] `app/(backoffice)/packages/packages-client.tsx`: Client Component — "Registrar paquete" button opening a `Modal` form (apartment `<select>` from the passed apartment list, description text input, optional photo file input using `fileFormData()`); a list/table distinguishing pending vs. `Recogido` packages (via `Badge`); a "Recogido" action per pending row calling T025's `markPickedUp` (depends on T025, T027)
- [X] T029 [US2] `app/(backoffice)/sidebar-nav.tsx`: add `{ href: '/packages', label: 'Paquetería', icon: IconPackage }` to `NAV_ITEMS`, and extend the `staffOnly` filter to also match `/packages` (same file as T016 — apply sequentially after it, not in parallel) (depends on T026)
- [X] T030 [US2] `lib/supabase/middleware.ts`: extend the staff-only allow-list to also permit `/packages` (same file as T017 — apply sequentially after it, not in parallel)

**Checkpoint**: User Stories 1 and 2 both work independently — Incidencias triage and package
receipt/notification/pickup are both fully functional.

---

## Phase 5: User Story 3 - Facility open/closed bubble & simpler facility form (Priority: P3)

**Goal**: Every facility card shows a green/red status bubble reflecting whether it's currently
open, computed from its existing schedule and the building's timezone; the capacity field is gone
from the create/edit form and from the card.

**Independent Test**: Per quickstart.md's User Story 3 section — view `/facilities` within and
outside a facility's configured hours and confirm the bubble color; confirm the form and card no
longer reference capacity.

### Implementation for User Story 3

*(No new automated test — see the Tests note at the top of this document.)*

- [X] T031 [P] [US3] Remove `capacity` from `facilitySchema` in `lib/validation/facilities.ts`
- [X] T032 [US3] `app/(backoffice)/facilities/actions.ts`: drop `capacity` from `createFacility`/`updateFacility`'s handling (it no longer appears in `FacilityInput` after T031, so this is a review/cleanup pass over both functions and their JSDoc-style comments referencing it) (depends on T031)
- [X] T033 [US3] `app/(backoffice)/facilities/page.tsx`: add `open_days` to the `facilities` select (currently missing — only `opens_at`/`closes_at` are fetched), drop `capacity` from the select, and additionally fetch the building's `timezone` (`supabase.from('buildings').select('timezone').eq('id', buildingId).single()`), passing it to `FacilitiesClient` as a new `buildingTimezone` prop. Before wiring T034's weekday mapping, spot-check at least one live `facilities.open_days` value against its building's actual real-world open days to confirm the 0=Sunday..6=Saturday encoding assumed in research.md item 3 — if the live data instead uses a different convention (e.g. ISO 1=Monday..7=Sunday), adjust the mapping T034 implements accordingly (depends on T031)
- [X] T034 [US3] `app/(backoffice)/facilities/facilities-client.tsx`: add an `isFacilityOpen(facility, buildingTimezone)` helper using `Intl.DateTimeFormat` with the building's `timeZone` to get the current weekday (mapped to `open_days`' 0=Sunday..6=Saturday convention, research.md item 3) and time, compared against `opens_at`/`closes_at` (handling the overnight-spanning case where `closes_at < opens_at`); render a small colored dot/bubble (green when open, red when closed) absolutely positioned in the card's upper-right corner; remove the `capacity`/"Cupo" text from the card's meta line, the `capacity` field from the create/edit form, and `capacity` from the `Facility` type and `emptyForm`/`openEdit`/`submit`/`toggleReservable` (depends on T032, T033)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification that spans every user story

- [X] T035 [P] Run `npm run typecheck && npm run lint && npm run test` and confirm all are clean with every change from T002–T034 applied
- [ ] T036 Run quickstart.md's full manual validation script (all three user stories plus the Cross-cutting checks section — staff route guard, cross-building RLS spot-check) and record results
- [X] T037 [P] Re-read plan.md's Constitution Check table and confirm it still holds with the actual implementation (no new complexity introduced beyond what plan.md anticipated); if `packages`/`tickets` migrations diverge from data-model.md the way feature 001's did, add a `SCHEMA-ADAPTATION.md`-style note to this feature's directory

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup. Only US1 and US2's migration tasks (T009, T022)
  depend on it; **US3 has no dependency on Phase 2** and may start immediately after Phase 1
- **User Stories (Phase 3–5)**: US1 and US2 each depend on Phase 2; US3 depends only on Phase 1.
  All three are otherwise independent of each other — no story's implementation tasks import or
  call another story's code
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- US1: fixture (T003) before its tests (T004–T006); tests before the migrations they gate (T007–T009);
  migrations before type regen (T010); type regen before validation/actions (T011–T012); icon
  (T013) can run anytime before the nav task (T016); page (T014) before client (T015); actions
  (T012) before client (T015); nav (T016) and middleware (T017) last, independent of each other
- US2: same shape — fixture (T018) before tests (T019–T020); T020 is written first but only
  runs green once T024's action exists (noted inline); migrations (T021–T022) before type regen
  (T023); validation (T024) before actions (T025); page (T027) before client (T028); nav (T029)
  and middleware (T030) are sequential with US1's T016/T017 (same files)
- US3: schema removal (T031) before the two files that consume `FacilityInput`/the select (T032,
  T033); both before the client changes (T034)

### Parallel Opportunities

- Setup: single task, nothing to parallelize
- Foundational: single verification task
- US1: T003 (fixture) parallel with nothing yet; T004, T005, T006 can run in parallel once T003
  lands (three different test files); T011 and T013 can run in parallel with each other
- US2: T018 alone; T019 parallel with nothing else needing T018 first except T020; T024 and T026
  can run in parallel
- US1 and US2 can be staffed fully in parallel (disjoint tables/files) except for the two
  shared-file pairs (`sidebar-nav.tsx`: T016 then T029; `middleware.ts`: T017 then T030), which
  must be applied sequentially regardless of which story's developer gets there first
- US3 can be staffed in parallel with US1 and US2 from the very start (no shared files, no shared
  dependency)
- Polish: T035 and T037 can run in parallel; T036 (manual walkthrough) is best done once T035 is
  clean

---

## Parallel Example: User Story 1

```bash
# After T003 (fixture) lands, launch all three test files together:
Task: "RLS allow/deny test for tickets in tests/integration/rls-tickets.test.ts"
Task: "RLS allow/deny test for ticket_comments in tests/integration/rls-ticket-comments.test.ts"
Task: "Ticket status-transition rules test in tests/integration/tickets-workflow.test.ts"

# Once schema + types land, these two can run in parallel:
Task: "Zod schemas in lib/validation/tickets.ts"
Task: "Add IconWrench to components/icons.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Incidencias, fully functional end-to-end)
4. **STOP and VALIDATE**: run quickstart.md's User Story 1 section
5. This alone delivers the highest-priority operational workflow (spec.md's stated MVP rationale)

### Incremental Delivery

1. Setup + Foundational → ready (US3 could also start here in parallel)
2. Add US1 (Incidencias) → validate independently → deploy/demo
3. Add US2 (Package receipt) → validate independently → deploy/demo
4. Add US3 (facility bubble + capacity removal) → validate independently → deploy/demo
5. Phase 6: Polish, run full quickstart.md, ship

### Parallel Team Strategy

With multiple developers: one completes Setup + Foundational, then Developer A takes US1,
Developer B takes US2, Developer C takes US3 (can start immediately, even before Foundational
finishes). Coordinate only on the two shared-file edit pairs noted above
(`sidebar-nav.tsx`, `middleware.ts` between US1 and US2).

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- `[Story]` labels map every user-story-phase task back to spec.md for traceability
- This feature's only shared-file friction is between US1 and US2 (`sidebar-nav.tsx`,
  `middleware.ts`) — apply those edits sequentially, not simultaneously, regardless of which
  story's tasks reach them first
- Per SCHEMA-ADAPTATION.md's precedent, if the live Habitat schema already contains something
  resembling `tickets`/`packages` under different names when implementation starts, adapt to it
  and record the mapping rather than assuming data-model.md is authoritative (T037)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing

---

## Implementation Notes (added post-implementation)

- **T036 is intentionally left unchecked.** This session verified the DB-level business rules
  (status-transition guard, content-immutability triggers) directly via SQL against the live
  project, and confirmed `npm run typecheck`/`lint`/`build` are clean with the new `/incidencias`
  and `/packages` routes registered — but did not perform a full interactive browser walkthrough
  of quickstart.md, since that requires real signed-in Staff/Admin/Resident sessions and no
  browser-automation tool or `SUPABASE_SERVICE_ROLE_KEY` (needed to mint disposable auth users)
  was available in this environment. See `SCHEMA-ADAPTATION.md` in this feature's directory for
  the full account of what was and wasn't verified, and how to finish T036.
- See `SCHEMA-ADAPTATION.md` (this directory) for the schema divergences discovered during
  implementation (RLS helper function argument order, the `notifications` INSERT policy being
  wholly new rather than a widening, FK conventions for actor columns).
