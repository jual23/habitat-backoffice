---
description: "Task list template for feature implementation"
---

# Tasks: Panel Dashboard Overview

**Input**: Design documents from `/specs/016-panel-dashboard-overview/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/panel-view-contract.md](./contracts/panel-view-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: Not broadly requested. Per plan.md's Constitution Check, the one place tests are
mandatory (Principle III, NON-NEGOTIABLE) is the new `feedback.viewed_at` authorization surface and
the multi-tenant isolation of the new Panel queries — both are included below. Everything else
(aggregation/rendering logic) is verified via `npm run typecheck`/`lint`/`test` staying clean plus
quickstart.md's manual walkthrough.

**Organization**: Tasks are grouped by the four user stories in spec.md, in priority order
(US1 → US2 → US3 → US4). US1, US2, and US3 build up `app/(backoffice)/panel/page.tsx`
incrementally (stat cards → activity feed → pending summary) as the Building Administrator
experience; US4 (staff access) is deliberately last — it adds role-based visibility on top of the
already-complete page rather than being threaded through each earlier story, matching how
spec.md's own "Independent Test" for US4 is written ("logging in as Staff... confirming only...
appear").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3, or US4
- Every task includes its exact file path

## Path Conventions

Single Next.js project, existing structure. Files touched:

- `lib/panel.ts` (new)
- `app/(backoffice)/panel/page.tsx`
- `app/(backoffice)/panel/loading.tsx`
- `app/globals.css`
- `supabase/migrations/0049_feedback_viewed_at.sql` (new)
- `lib/supabase/database.types.ts`
- `app/(backoffice)/suggestions-complaints/page.tsx`
- `lib/supabase/middleware.ts`
- `app/(backoffice)/sidebar-nav.tsx`
- `tests/integration/rls-suggestions-complaints.test.ts`
- `tests/integration/cross-tenant-isolation.test.ts`
- `tests/unit/panel-day-bounds.test.ts` (new — added during Polish, T023, after catching a real bug)

---

## Phase 1: Setup

**Purpose**: Confirm the baseline is intact before changing anything

- [X] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run test` are clean on the current branch before this feature's changes begin (typecheck/lint clean; full `npm run test` shows pre-existing, unrelated `Request rate limit reached` failures from Supabase Auth when the whole suite signs in back-to-back — not caused by this feature; scoped test files are run individually later to avoid tripping the same limit)

**Checkpoint**: Baseline confirmed working; safe to start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared logic both US1 (today's counts) and US2 (feed timestamps/merge)
need, so neither story reimplements it differently

**⚠️ CRITICAL**: Complete before starting US1 or US2

- [X] T002 Create `lib/panel.ts` — **note**: the initial `getBuildingDayBounds` had a real bug (offset computed via `new Date(localeString)`, which parses in the *server's own* local timezone rather than UTC — silently wrong offset whenever they differ), caught and fixed during Polish (T023) via `tests/unit/panel-day-bounds.test.ts`, added as permanent regression coverage exporting: `getBuildingDayBounds(timezone: string, now?: Date): { startIso: string; endIso: string }` (computes the current building-local calendar day's start/end instants as ISO strings, using `Intl.DateTimeFormat` with the given IANA `timezone` — no new dependency, mirrors the `now() at time zone b.timezone` pattern from `supabase/migrations/0027c_payment_sweeps_timezone_fix.sql` but computed in TypeScript since these are ordinary `select` queries, not a Postgres function); `formatRelativeTime(iso: string, now?: Date): string` (Spanish relative strings: "Ahora", "hace N min", "hace N horas", "hace N días"); and `type ActivityItem = { id: string; type: 'visit' | 'package' | 'incidencia' | 'emergency' | 'feedback'; createdAt: string; title: string; href: string }` plus `mergeRecentActivity(groups: ActivityItem[][], limit?: number): ActivityItem[]` (flattens the groups, sorts by `createdAt` descending with `id` as a stable tiebreaker, returns the first `limit` — default 5, per FR-007/edge case on tie ordering)

**Checkpoint**: `lib/panel.ts` ready — US1 and US2 can now both proceed.

---

## Phase 3: User Story 1 - At-a-glance daily snapshot (Priority: P1) 🎯 MVP

**Goal**: The Panel's top row shows exactly four cards — Residentes, Incidencias (hoy), Paquetería
(hoy), Visitas (hoy) — replacing today's five generic shortcut tiles (Apartamentos, Residentes,
Reservas pendientes, Actividades próximas, Visitas esperadas).

**Independent Test**: Per quickstart.md scenario 1 — seed a building with a known resident count
and today's incidencias/packages/visits (plus at least one of each dated yesterday), open `/panel`
as the building_admin, and confirm each of the four cards shows the correct **today-only** count
(FR-001–FR-005), including `0` when nothing qualifies (no error/blank state).

### Implementation for User Story 1

- [X] T003 [US1] In `app/(backoffice)/panel/page.tsx`, fetch `buildings.timezone` for `ctx.buildingId` and call `getBuildingDayBounds()` (from `lib/panel.ts`, T002) to get today's `startIso`/`endIso` for this building
- [X] T004 [US1] In `app/(backoffice)/panel/page.tsx`, replace the current `Promise.all` (`apartments`, `residents`, `pendingReservations`, `upcomingActivities`, `pendingVisitors`) with one that keeps the existing `residents` count query (profiles with `apartment_id is not null`, per FR-002 — no `tenant_type` filter, so owners and renters both count) and adds three new building-scoped counts: `tickets` created within `[startIso, endIso)`, `packages` created within `[startIso, endIso)`, and `visitors` created within `[startIso, endIso)` (depends on T003)
- [X] T005 [US1] In `app/(backoffice)/panel/page.tsx`, replace the old `stats` array/tile grid with four cards — Residentes → `/apartments` (keep existing target), Incidencias → `/incidencias`, Paquetería → `/packages`, Visitas → `/visitors` — reusing the existing `.tile`/`.grid` CSS classes and swapping icons to `IconUsers`, `IconWrench`, `IconPackage`, `IconWalking` respectively (matching `sidebar-nav.tsx`'s icon choices for these modules) (depends on T004)
- [X] T006 [P] [US1] Update `app/(backoffice)/panel/loading.tsx` so its skeleton matches the new 4-card top row (instead of the previous 5-tile grid)
- [X] T007 [P] [US1] Add a new case to `tests/integration/cross-tenant-isolation.test.ts` seeding two buildings with today's tickets/packages/visitors/residents in each, confirming a `building_admin` of Building A querying `/panel`'s data only ever sees Building A's counts (Principle I/III)

**Checkpoint**: User Story 1 fully functional and independently testable — the Panel shows correct, today-scoped, building-scoped counts.

---

## Phase 4: User Story 2 - Recent activity feed (Priority: P2)

**Goal**: Below the stat cards, a left-column "Actividad reciente" list shows the 5 most recent
events across visits, packages, incidencias, emergencies, and suggestions/complaints, newest
first, each linking to its module.

**Independent Test**: Per quickstart.md scenario 2 — seed 6+ events of mixed types at different
times, open `/panel`, confirm exactly 5 appear newest-first with correct type labels and relative
timestamps (FR-007/FR-008); clear all events and confirm an empty-state message instead of an
error.

### Implementation for User Story 2

- [X] T008 [US2] In `app/(backoffice)/panel/page.tsx`, add five parallel building-scoped queries (joined into the existing `Promise.all`), each `select`ing the top 5 rows by `created_at desc` from `visitors`, `packages`, `tickets`, `emergencies`, and `feedback` (only non-discarded feedback, i.e. `discarded_at is null`, since a discarded entry shouldn't surface in the feed) — selecting enough columns from each to build a human label (e.g. ticket `title`, package `description`, visitor `full_name`, emergency `description`, feedback `subject`)
- [X] T009 [US2] In `app/(backoffice)/panel/page.tsx`, map each query's rows into `ActivityItem[]` (per `lib/panel.ts`'s type, T002) with the right `type`, a short title/description, and the right module `href` (`/visitors`, `/packages`, `/incidencias`, `/emergency`, `/suggestions-complaints`), then call `mergeRecentActivity()` to get the final 5-item list (depends on T008)
- [X] T010 [US2] In `app/(backoffice)/panel/page.tsx`, render the left column "Actividad reciente" card: for each item, its type label, title, and `formatRelativeTime(item.createdAt)`, wrapped in a `Link` to `item.href`; render an empty-state message (e.g. "Sin actividad reciente todavía.") when the merged list is empty (FR-008) (depends on T009)
- [X] T011 [P] [US2] In `app/globals.css`, add a `.panel-columns` two-column grid rule (stacking to one column below the existing mobile breakpoint, per the responsive conventions already used by `.grid`) for the activity-feed/pending-summary layout, reusing `.row-list`/`.row` for each column's items rather than introducing new row styles

**Checkpoint**: User Stories 1 AND 2 both work independently — top cards plus a live, correctly-ordered activity feed.

---

## Phase 5: User Story 3 - Pending-items summary with direct navigation (Priority: P2)

**Goal**: A right-column "Solicitudes pendientes" summary shows open incidencias, undelivered
packages, unread suggestions/complaints, and in-progress reservation requests, each linking to its
module and each visible even at `0`. Unread tracking is a new, persisted `feedback.viewed_at`
state, per data-model.md.

**Independent Test**: Per quickstart.md scenario 3 — seed each pending category with a known
count, open `/panel` as building_admin, confirm each row's count and its navigation target; open
`/suggestions-complaints` and confirm the unread count on `/panel` drops afterward (FR-009,
FR-015).

### Tests for User Story 3 (authorization — Principle III, NON-NEGOTIABLE)

> Written alongside the migration, before `suggestions-complaints/page.tsx` or `panel/page.tsx`
> come to rely on `viewed_at` being enforceable.

- [X] T012 [P] [US3] In `tests/integration/rls-suggestions-complaints.test.ts`, add cases: a `building_admin` can `update feedback set viewed_at = now()` on a row in their own building; a `staff` user cannot (no feedback access at all); a `resident` cannot; a `building_admin` of a *different* building cannot set it on this row (cross-building denial) — all 4 new cases pass against the live schema, confirming the existing `"feedback managed by admins"` policy (not a new one — see T013) correctly covers the new column
- [X] T013 [US3] Create `supabase/migrations/0049_feedback_viewed_at.sql` adding nullable `feedback.viewed_at timestamptz` — renumbered from the originally-planned `0041` (the live database's migration history, inspected via the `supabase` MCP, is ahead of this repo's tracked files, already through `0048`) and simplified to drop the originally-planned dedicated UPDATE policy after inspecting the live `pg_policy` rows for `feedback` directly: the existing `"feedback managed by admins"` `FOR ALL`/`can_admin_building` policy already grants building_admin/app_admin UPDATE on any column, and the `feedback_prevent_content_change` trigger doesn't guard `viewed_at` — confirmed via `pg_get_functiondef` — so no new policy is needed (data-model.md updated to match). Applied to the live Habitat Supabase project via `mcp__supabase__apply_migration`.

### Implementation for User Story 3

- [X] T014 [P] [US3] Update `lib/supabase/database.types.ts`'s `feedback` table `Row`/`Insert`/`Update` shapes to include `viewed_at: string | null` — regenerated via `mcp__supabase__generate_typescript_types`. This also pulled in unrelated drift the stale checked-in file was missing (`payments.rejection_reason`, `payment_status` gaining `'rejected'`, a `poll_results` RPC) from migrations already live but predating this repo's tracked history; that surfaced a pre-existing compile error in `app/(backoffice)/finance/finance-client.tsx` (its local `Payment['status']` type didn't include `'rejected'`), fixed minimally (type + label/tone only, per user decision) rather than left broken or masked by reverting to stale types
- [X] T015 [US3] In `app/(backoffice)/suggestions-complaints/page.tsx`, after fetching this building's feedback entries for display, `update` (via the server client) any of the returned rows where `viewed_at is null` to `viewed_at: new Date().toISOString()`, scoped to `building_id = ctx.buildingId` and only when `ctx.role` is `building_admin` or `app_admin` (per contracts/panel-view-contract.md's "mark viewed" side effect — Staff never reaches this page today, so no role branch is needed for it, but guard defensively anyway) (depends on T013, T014)
- [X] T016 [US3] In `app/(backoffice)/panel/page.tsx`, add four building-scoped queries to the existing `Promise.all`: open incidencias (`tickets` where `status in ('pending','in_progress')`), packages not delivered (`packages` where `status = 'pending'`), unread feedback (`feedback` where `viewed_at is null and discarded_at is null`), reservations in progress (`reservations` where `status = 'requested'`) (depends on T014)
- [X] T017 [US3] In `app/(backoffice)/panel/page.tsx`, render the right column "Solicitudes pendientes" summary: one row per count from T016 with its label, value (rendered even at `0`, per FR-010), and a `Link` to `/incidencias`, `/packages`, `/suggestions-complaints`, `/reservations` respectively (depends on T016, T011)
- [X] T018 [P] [US3] Add a case to `tests/integration/cross-tenant-isolation.test.ts` covering the four new pending-summary queries from T016 (open incidencias, undelivered packages, unread feedback, in-progress reservations), confirming Building A's counts never include Building B's rows (Principle I/III) (depends on T016)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — the full Building Administrator Panel experience is complete.

---

## Phase 6: User Story 4 - Role-appropriate panel for Staff (Priority: P3)

**Goal**: Staff can now open `/panel` (previously redirected to `/login`) and see the same layout,
scoped server-side to only the modules Staff already has access to: no Residentes card, no
suggestion/complaint feed entries, no "Quejas y sugerencias" or "Reservas de instalaciones" rows.

**Independent Test**: Per quickstart.md scenario 4 — sign in as staff, open `/panel`, confirm it
no longer redirects, confirm the Residentes card and the two Staff-inaccessible summary rows are
absent, and confirm the remaining cards/feed/rows are present and correct.

### Implementation for User Story 4

- [X] T019 [P] [US4] In `lib/supabase/middleware.ts`, add `!pathname.startsWith('/panel')` to the Staff route guard's allowed-paths condition (alongside `/visitors`, `/incidencias`, `/packages`, `/maintenance`, `/emergency`, `/broadcast`)
- [X] T020 [P] [US4] In `app/(backoffice)/sidebar-nav.tsx`, add `item.href === '/panel'` to the `staffOnly` filter's allowed list so Staff sees the "Panel" nav link again
- [X] T021 [US4] In `app/(backoffice)/panel/page.tsx`, change the top guard from `ctx.role !== 'building_admin' && ctx.role !== 'app_admin'` to also allow `ctx.role === 'staff'`
- [X] T022 [US4] In `app/(backoffice)/panel/page.tsx`, branch on `ctx.role === 'staff'` to: skip the `residents` count query and omit the Residentes card (T005); skip the `feedback`-derived query from T008 when building the activity-feed candidate pool (so suggestion/complaint entries can never be selected into the merged feed for Staff — not merely hidden after merging); skip the unread-feedback and reservations-in-progress queries from T016 and omit those two rows (T017) — all decided server-side before rendering, per contracts/panel-view-contract.md's access table (depends on T005, T008, T016, T017)

**Checkpoint**: All four user stories independently functional — Staff now has a working, correctly-scoped Panel.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories

- [X] T023 Run quickstart.md's validation, to the extent possible in this session (no browser automation available): (1) `npm run build` succeeds cleanly, `/panel` compiles as a dynamic route; (2) the `0049_feedback_viewed_at` migration was applied to and verified against the live Habitat Supabase project via the `supabase` MCP (column exists, no new advisories); (3) all of this feature's integration tests pass live (RLS + cross-tenant isolation, 12 new cases total); (4) added and ran `tests/unit/panel-day-bounds.test.ts`, which caught and pinned a fix for a real timezone-offset bug in `lib/panel.ts`. **Not done**: an actual browser click-through of the 5 manual scenarios (staff login redirect removed, live clicking through cards/feed/rows) — recommend the user does a quick pass before merging
- [X] T024 Run `npm run typecheck`, `npm run lint`, and `npm run test` and confirm all green — `typecheck` and `lint` are clean on the final state. `npm run test` as a full suite is currently rate-limited in this environment (Supabase Auth throttles concurrent sign-ins across 40+ integration test files — the same pre-existing condition observed at T001, unrelated to this feature); every test file this feature added or changed (`cross-tenant-isolation.test.ts`, `rls-suggestions-complaints.test.ts`, `panel-day-bounds.test.ts` — 19 test cases total) passes 100% when run individually, confirmed 3 separate times during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS US1 and US2 (both consume `lib/panel.ts`)
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational; independent of US1's implementation but shares the same `Promise.all`/render pass in `page.tsx`, so in practice do it after US1 lands to avoid merge churn on the same file
- **US3 (Phase 5)**: Independent of US1/US2's query logic (different tables/queries) but, like US2, edits the same `page.tsx` — sequence after US2
- **US4 (Phase 6)**: Explicitly depends on US1 + US2 + US3 being complete — it wraps their output in role-based visibility rather than being buildable first
- **Polish (Phase 7)**: Depends on all four user stories

### Within Each User Story

- US1: T003 → T004 → T005 (same file, sequential); T006 and T007 are separate files, parallel-safe once T005 lands (T006 doesn't strictly need T005 done, but matching the final markup is easier once it exists)
- US2: T008 → T009 → T010 (same file, sequential); T011 (CSS) parallel-safe alongside T008–T010
- US3: T013 → T012 (policy must exist before the RLS test can assert against it) → T014 → {T015, T016} (different files, parallel-safe) → T017 (depends on T016) → T018 (parallel-safe alongside T017, both only need T016)
- US4: {T019, T020} parallel-safe (different files) → T021 → T022

### Parallel Opportunities

- T006 and T007 (US1)
- T011 alongside T008–T010 (US2)
- T012 and T014 once T013 lands (US3)
- T015 and T016 once T014 lands (US3)
- T018 alongside T017 once T016 lands (US3)
- T019 and T020 (US4)

---

## Parallel Example: User Story 3

```bash
# Once T013 (migration) lands:
Task: "Add viewed_at RLS cases to tests/integration/rls-suggestions-complaints.test.ts"
Task: "Add viewed_at to lib/supabase/database.types.ts's feedback table shapes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (`lib/panel.ts`)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md scenario 1, independently
5. Deploy/demo if ready — the Panel already looks meaningfully more useful with just the 4 top cards

### Incremental Delivery

1. Setup + Foundational → ready
2. US1 → validate → demo (top cards)
3. US2 → validate → demo (+ activity feed)
4. US3 → validate → demo (+ pending summary, unread tracking)
5. US4 → validate → demo (Staff gains Panel access, correctly scoped)

---

## Notes

- [P] tasks touch different files with no incomplete dependency between them
- [Story] label maps every task to its user story for traceability
- No new runtime dependency is introduced anywhere in this feature
- Commit after each task or logical group
- Avoid: vague tasks, same-file conflicts marked [P], cross-story dependencies that break US1–US3's independence (US4 is the one deliberate exception, by design)
