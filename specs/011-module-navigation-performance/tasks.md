---

description: "Task list for the Module Navigation Performance feature"
---

# Tasks: Module Navigation Performance

**Input**: Design documents from `/specs/011-module-navigation-performance/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/module-page-pattern.md](./contracts/module-page-pattern.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested for the feature at large, but the Constitution Check in plan.md carries one **binding gate**: because this feature changes how `getUserContext()` (an authorization-determining function) is invoked, Principle III (NON-NEGOTIABLE) requires tests proving its output is unchanged, written *before* the refactor. That gate is T002/T006 below — it is not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story. Per the corrected clarification (spec.md → Clarifications), the module-to-module navigation loading state is a **skeleton**, not the `blocks-shuffle-4.svg` icon — that icon is reserved for a different, out-of-scope use case (brief in-page loading, e.g. a modal submitting and closing) and is not touched by this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Module scope (18 modules, per spec.md FR-005 and `sidebar-nav.tsx` + the standalone `reservations` route)

Panel, Facilities, Incidencias, Finance, Users, Announcements, Activities, Apartments, Broadcast, Customization, Documentation, Emergency, Maintenance, Packages, Polls, Reservations, Suggestions/Complaints, Visitors.

---

## Phase 1: Setup

**Purpose**: Establish a real "before" measurement so the fix's impact is verifiable, not assumed

- [ ] T001 Time the 6 representative transitions from quickstart.md's baseline table (Panel→Facilities, Facilities→Incidencias, Incidencias→Finance, Finance→Users, Users→Facilities repeat, Panel→Announcements) using DevTools, and record the results in a new `specs/011-module-navigation-performance/baseline-measurements.md`. **Not done — requires a live browser + DevTools session against a running dev server with a real signed-in session**, unavailable in this implementation environment. Recommended as the first manual step before/while verifying the shipped fix.

**Checkpoint**: A real "before" number exists to compare against once the fix lands.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: De-duplicate `getUserContext()` per request — the mechanism every other task depends on — under the Constitution's Principle III test gate

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete. T002 MUST be written and passing against **today's** (pre-refactor) `getUserContext()` before T003 changes it.

- [X] T002 [Constitution Principle III gate] Write `tests/integration/get-user-context.test.ts`, covering all 5 `UserContext` shapes from `lib/session.ts` — app_admin, building_admin, staff, resident, renter (and the no-role and signed-out cases) — using `tests/fixtures.ts` (`createTestUser`, `createTestBuilding`, `createTestApartment`, `getServiceClient`) and `tests/setup.ts` (`signIn`/`signInAs`), following the style of `tests/integration/user-provisioning.test.ts`. **DONE** — 8/8 tests pass; behavior-preservation was additionally confirmed via `git diff` showing the refactor is purely additive (no logic change) to `getUserContext()`'s body.
- [X] T003 **Corrected during implementation** (research.md §2, §2b): `getUserContext(supabase)`'s signature is kept **unchanged** — removing the parameter broke direct testability, since `createClient()` depends on `next/headers`'s `cookies()`, which requires a live Next.js request context that Vitest tests don't have (the same reason `createBuildingUser()` in `lib/user-provisioning.ts` already takes its client as a plain argument). Instead: (a) `createClient()` in `lib/supabase/server.ts` is wrapped in a new `requestCache()` helper (`lib/request-cache.ts` — React's `cache()` where available, a plain passthrough under Vitest) so every caller within one request gets the *same* client instance; (b) `getUserContext()` is wrapped in the same `requestCache()`, which now hits correctly since its `supabase` argument is request-stable. **DONE**.
- [X] T004 ~~Update the call site in `app/(backoffice)/layout.tsx`~~ — **not needed**: since T003's corrected design keeps `getUserContext(supabase)`'s signature unchanged, no call site requires editing. `layout.tsx` already calls it correctly.
- [X] T005 ~~Update the remaining 19 non-navigation call sites~~ — **not needed**, same reason as T004: the signature never changed, so `activities/actions.ts` through `visitors/staff-actions.ts` (and everything else) already compile and behave correctly, unmodified. Confirmed via `npm run typecheck` (zero errors) immediately after T003 landed, before any other file was touched.
- [X] T006 Ran `npm run typecheck` (clean) and `npm run test` (T002's 8 tests pass in isolation; a full-suite run separately confirmed no regression beyond Supabase Auth's sign-in rate limit — an environmental artifact of running many integration test files back-to-back, not a code regression, verified by re-running affected files individually and via `git stash` comparison against the unmodified codebase) — closes the Constitution Principle III gate.

**Checkpoint**: `getUserContext()` is memoized per request (no call site needed editing — see Notes), and Principle III's test gate is closed. User-story work can now begin.

---

## Phase 3: User Story 1 - Switching modules feels instant during daily work (Priority: P1) 🎯 MVP

**Goal**: Prove the fix on a representative pilot of modules — the destination module's content appears in ~1 second instead of 2+.

**Independent Test**: Time the 6 baseline transitions from T001 again after this phase; each should now land at ~1 second.

### Implementation for User Story 1

- [X] T007 [P] [US1] Update `app/(backoffice)/panel/page.tsx`: audit for independent-query parallelization and a list-batch cap per contracts/module-page-pattern.md. **DONE — no change needed**: its 5 queries are already `count`-only (`head: true`, no rows) and already run via `Promise.all`; there is no list-shaped result to cap under FR-008.
- [X] T008 [P] [US1] Update `app/(backoffice)/facilities/page.tsx`: parallelize the facilities query and the building-timezone query via `Promise.all` (research.md §1.3 — was sequential) instead of fetching timezone after resolving signed URLs; cap the facilities query to an initial ~25-record batch (`.range(0, 24)`) per FR-008 — this is the contract's reference implementation (contracts/module-page-pattern.md). **DONE**.
- [X] T009 [P] [US1] Update `app/(backoffice)/incidencias/page.tsx`: audit and parallelize any independent Supabase queries via `Promise.all`; cap the primary list query to an initial ~25-record batch (`.range(0, 24)`/`.limit(25)`) per FR-008 and contracts/module-page-pattern.md rule 5, if that module's content is a list that can grow large. **DONE** — tickets/apartments/duplicateCandidates parallelized (comments stays sequential, it depends on tickets' IDs); tickets capped to `.range(0, 24)`.
- [X] T010 [P] [US1] Update `app/(backoffice)/finance/page.tsx`: its three queries are already parallel via `Promise.all`; additionally cap the payments query to an initial ~25-record batch (`.range(0, 24)`, ordered by `due_date` as today) per FR-008. **DONE**.
- [X] T011 [P] [US1] Update `app/(backoffice)/users/page.tsx`: audit and parallelize any independent Supabase queries via `Promise.all`; cap the primary list query to an initial ~25-record batch (`.range(0, 24)`/`.limit(25)`) per FR-008 and contracts/module-page-pattern.md rule 5, if that module's content is a list that can grow large. **DONE** — already parallel; capped `apartments` and `residents` (the two building-size-scaling lists).
- [X] T012 [P] [US1] Update `app/(backoffice)/announcements/page.tsx`: audit and parallelize any independent Supabase queries (including signed-URL resolution) via `Promise.all`; cap the announcements query to an initial ~25-record batch per FR-008. **DONE** — capped; signed-URL resolution stays sequential after (depends on the announcements result).
- [ ] T013 [US1] Re-time the 6 baseline transitions from `specs/011-module-navigation-performance/baseline-measurements.md` (T001) and record the "after" numbers in the same file — confirm each now lands at ~1 second (depends on T007–T012). **Not done — requires a live browser + DevTools session**, unavailable in this implementation environment; `npm run build` confirms all 6 modules compile and bundle correctly (see Notes).

**Checkpoint**: The pilot set (6 modules + layout) demonstrably hits the ~1 second target — a testable, demoable MVP.

---

## Phase 4: User Story 2 - Fast switching holds for every role and every module (Priority: P2)

**Goal**: Extend the identical fix to the remaining 12 modules, and confirm the improvement holds for every role (Staff, Building Administrator, App Administrator), not just the pilot set.

**Independent Test**: Sign in as Staff and time transitions between its accessible modules; sign in as App Administrator and spot-check several non-pilot modules — all meet the same ~1 second target.

### Implementation for User Story 2

- [X] T014 [P] [US2] Update `app/(backoffice)/activities/page.tsx`: cap the primary list query to an initial ~25-record batch per FR-008. **DONE** — single query (no parallelization needed); `activities` capped to `.range(0, 24)`.
- [X] T015 [P] [US2] Update `app/(backoffice)/apartments/page.tsx`: audit for parallelization and cap the primary list query per FR-008. **DONE** — already parallel (2 queries); both `apartments` and `residents` capped.
- [X] T016 [P] [US2] Update `app/(backoffice)/broadcast/page.tsx`: audit for parallelization and cap the primary list query per FR-008. **DONE** — already parallel (3 queries); `broadcasts` capped (templates/settings left uncapped, naturally small).
- [X] T017 [P] [US2] Update `app/(backoffice)/customization/page.tsx`: audit for parallelization and a list-batch cap per contracts/module-page-pattern.md. **DONE — no change needed**: a single settings row (accent color + logo), no list to cap or parallelize — exempt per contract rule 5.
- [X] T018 [P] [US2] Update `app/(backoffice)/documentation/page.tsx`: audit for parallelization and cap the primary list query per FR-008. **DONE** — already parallel (2 queries); `documents` capped (the folder tree is typically small, left uncapped).
- [X] T019 [P] [US2] Update `app/(backoffice)/emergency/page.tsx`: cap the primary list query per FR-008. **DONE** — single query (no parallelization needed); `emergencies` capped to `.range(0, 24)`.
- [X] T020 [P] [US2] Update `app/(backoffice)/maintenance/page.tsx`: audit for parallelization and cap the primary list query per FR-008. **DONE** — already parallel; `tasks` capped to `.range(0, 24)`; `completions`' pre-existing deliberate `.limit(50)` (from an earlier feature) left as-is.
- [X] T021 [P] [US2] Update `app/(backoffice)/packages/page.tsx`: audit and parallelize any independent Supabase queries via `Promise.all`; cap the primary list query per FR-008. **DONE** — `apartments` and `packages` were sequential (independent of each other) and are now parallelized; `packages` capped to `.range(0, 24)`.
- [X] T022 [P] [US2] Update `app/(backoffice)/polls/page.tsx`: cap the primary list query per FR-008. **DONE** — top-level `polls` query capped to `.range(0, 24)`; the per-poll options/votes sub-queries (already inside a `Promise.all` over polls) were left unchanged to limit refactor risk for marginal gain.
- [X] T023 [P] [US2] Update `app/(backoffice)/reservations/page.tsx`: cap the primary list query per FR-008. **DONE** — single query (no parallelization needed); `reservations` capped to `.range(0, 24)`.
- [X] T024 [P] [US2] Update `app/(backoffice)/suggestions-complaints/page.tsx`: cap the primary list query per FR-008. **DONE** — single query (no parallelization needed); `entries` capped to `.range(0, 24)`.
- [X] T025 [P] [US2] Update `app/(backoffice)/visitors/page.tsx`: cap the primary list query per FR-008. **DONE** — single query (no parallelization needed); `visitors` capped to `.range(0, 24)`.
- [ ] T026 [US2] Sign in as a Staff account and time transitions across its accessible modules (Visitors, Incidencias, Packages, Maintenance, Emergency, Broadcast); sign in as an App Administrator and spot-check at least 3 non-pilot modules — confirm all meet the ~1 second target (depends on T014–T025). **Not done — requires a live browser session**; `npm run build` confirms all 12 modules compile/bundle correctly, and `npm run test` confirms no RLS/access-control regression for the roles exercised (see T048).

**Checkpoint**: All 18 modules and every role are demonstrably fast — User Stories 1 and 2 both hold.

---

## Phase 5: User Story 3 - Slower conditions never look like the app froze (Priority: P3)

**Goal**: Every module shows an immediate skeleton loading state on navigation, so the app never appears frozen even under slow conditions or an unusually large dataset — independent of how fast the underlying fetch turns out to be.

**Independent Test**: Throttle the network (or navigate into a data-heavy module) and confirm a skeleton appears almost immediately, well before the real content is ready.

### Implementation for User Story 3

Each `loading.tsx` is a lightweight, static Suspense fallback (per contracts/module-page-pattern.md) — a skeleton that loosely approximates that module's layout (a list/card-shaped placeholder), with no data fetching or auth check of its own.

- [X] T027 [P] [US3] Create `app/(backoffice)/panel/loading.tsx` — `SkeletonGrid` (components/skeleton.tsx)
- [X] T028 [P] [US3] Create `app/(backoffice)/facilities/loading.tsx` — `SkeletonGrid`
- [X] T029 [P] [US3] Create `app/(backoffice)/incidencias/loading.tsx` — `SkeletonList`
- [X] T030 [P] [US3] Create `app/(backoffice)/finance/loading.tsx` — `SkeletonList`
- [X] T031 [P] [US3] Create `app/(backoffice)/users/loading.tsx` — `SkeletonList`
- [X] T032 [P] [US3] Create `app/(backoffice)/announcements/loading.tsx` — `SkeletonList`
- [X] T033 [P] [US3] Create `app/(backoffice)/activities/loading.tsx` — `SkeletonList`
- [X] T034 [P] [US3] Create `app/(backoffice)/apartments/loading.tsx` — `SkeletonList`
- [X] T035 [P] [US3] Create `app/(backoffice)/broadcast/loading.tsx` — `SkeletonList`
- [X] T036 [P] [US3] Create `app/(backoffice)/customization/loading.tsx` — `SkeletonCard` (single settings form, not a list)
- [X] T037 [P] [US3] Create `app/(backoffice)/documentation/loading.tsx` — `SkeletonList`
- [X] T038 [P] [US3] Create `app/(backoffice)/emergency/loading.tsx` — `SkeletonList`
- [X] T039 [P] [US3] Create `app/(backoffice)/maintenance/loading.tsx` — `SkeletonList`
- [X] T040 [P] [US3] Create `app/(backoffice)/packages/loading.tsx` — `SkeletonList`
- [X] T041 [P] [US3] Create `app/(backoffice)/polls/loading.tsx` — `SkeletonList`
- [X] T042 [P] [US3] Create `app/(backoffice)/reservations/loading.tsx` — `SkeletonList`
- [X] T043 [P] [US3] Create `app/(backoffice)/suggestions-complaints/loading.tsx` — `SkeletonList`
- [X] T044 [P] [US3] Create `app/(backoffice)/visitors/loading.tsx` — `SkeletonList`

  All 18 built on shared, reusable building blocks in `components/skeleton.tsx` (new) with matching CSS added to `app/globals.css` — `SkeletonHeader`/`SkeletonRow`/`SkeletonList`/`SkeletonTile`/`SkeletonGrid`/`SkeletonCard` — rather than 18 bespoke implementations, per Principle V. `npm run build` confirms every route compiles with its `loading.tsx` Suspense boundary attached.
- [ ] T045 [US3] Throttle the network (DevTools "Fast 3G") and navigate into at least 3 modules (including one data-heavy one, e.g. Facilities or Finance); confirm each shows its skeleton almost immediately and that `app/(backoffice)/layout.tsx`'s sidebar/header stay visible and interactive throughout (depends on T027–T044). **Not done — requires a live browser session**; the mechanism itself (Next.js's native `loading.tsx` Suspense convention, per research.md §6) doesn't depend on this manual check to function, but the visual verification is still recommended before shipping.

**Checkpoint**: All 18 modules show an immediate skeleton — the app never appears frozen, regardless of connection speed or data size.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation against the spec's success criteria and the Constitution gate

- [ ] T046 Time at least 15–20 transitions across the full 18-module set and confirm ≥95% land under 1.2 seconds and none exceed 2 seconds (SC-002, SC-003), recording results in `specs/011-module-navigation-performance/baseline-measurements.md`. **Not done — requires a live browser + DevTools session**, unavailable in this implementation environment. Recommended as the final manual step before shipping.
- [ ] T047 Perform the full manual pass through `specs/011-module-navigation-performance/quickstart.md`, including the "Abandoned navigation" edge case (rapid clicks between two modules) and the "No functional or authorization regression" checklist (Staff/cross-building checks). **Not done — requires a live browser session.** The "No functional or authorization regression" portion is separately covered by T048's automated test run.
- [X] T048 Run `npm run test` and confirm no access-control regression (SC-006). **DONE, with a noted environmental caveat**: `tests/integration/get-user-context.test.ts` (8/8), `tests/integration/cross-tenant-isolation.test.ts` (3/3), and `tests/integration/rls-payments.test.ts` (11/11 — Finance, the most heavily modified module) all pass in full. `tests/integration/rls-tickets.test.ts` passes 9/10 — the 1 failure (`allows marking a ticket duplicate...`) was confirmed via `git stash` to fail identically on the unmodified codebase (a pre-existing RLS issue, unrelated to this feature). Running the *entire* 41-file suite back-to-back hits Supabase Auth's sign-in rate limit partway through (many integration tests each sign in several fresh users) — re-running the rate-limited files individually afterward passed cleanly, confirming the failures were a volume/timing artifact of this session's testing, not a real regression. `npm run typecheck` and `npm run lint` are both clean, and `npm run build` succeeds for all 25 routes. Recommend re-running the full `npm run test` once outside of a heavy-testing window (e.g., an hour after this session) as a final confirmation.
- [X] T049 [P] Audit every modified `page.tsx`/`loading.tsx` pair against `specs/011-module-navigation-performance/contracts/module-page-pattern.md` for compliance. **DONE**: rule 1 (memoized context) — unchanged call sites, `getUserContext()` now memoized via `requestCache()`, all 18. Rule 2 (`Promise.all` for independent queries) — applied wherever queries were genuinely independent (facilities+timezone, incidencias' tickets+apartments+duplicates, packages' apartments+packages); left sequential where genuinely dependent (ticket comments on ticket IDs, signed-URL resolution on its list result). Rule 3 (no access-control changes) — confirmed: no `.eq()`/RLS-scoped filter, redirect condition, or role check was touched in any file. Rule 5 (~25-record cap) — applied to all 15 modules with a growable list; Panel and Customization correctly exempted (no list). Rule 6 (optional pagination) — not implemented this pass (see T051). `loading.tsx` contract — all 18 exist, are static (no data/auth), and shape-match their module via shared `components/skeleton.tsx` primitives.
- [X] T050 [P] Run `npm run lint` and `npm run typecheck` for a final clean pass across all touched files. **DONE** — both clean; `npm run build` also succeeds (all 25 routes).
- [ ] T051 [P] Where a module's list commonly exceeds ~25 records in practice (e.g., Facilities, Incidencias, Packages, Users, Apartments, Announcements, Activities, Finance's payments list), add a simple "load more" control to that module's `*-client.tsx` that calls a Server Action for the next `range()` batch and appends it client-side, per contracts/module-page-pattern.md rule 6 (FR-008's SHOULD — optional per module, not required for every one of the 18). **Deliberately not done this pass** — explicitly a SHOULD/optional follow-up per spec.md FR-008, not required for the feature's MUST-level completion; left as documented future work.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories. T002 MUST complete (and pass against the pre-refactor code) before T003.
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1 (P1) has no dependency on US2 or US3
  - US2 (P2) has no dependency on US1's completion beyond Foundational, but is logically sequenced after US1 since it extends the same pattern to the remaining modules
  - US3 (P3) has no dependency on US1/US2's page.tsx changes — `loading.tsx` files are purely additive and can technically be built any time after Foundational, but are sequenced last to match priority order
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Every module's `page.tsx`/`loading.tsx` task is independent of every other module's — all are marked `[P]`
- Each story's final "re-measure"/"verify" task depends on that story's module tasks being done first

### Parallel Opportunities

- All of T007–T012 (US1) can run in parallel — 6 different files, no shared dependency beyond Foundational
- All of T014–T025 (US2) can run in parallel — 12 different files
- All of T027–T044 (US3) can run in parallel — 18 different files, and can even run in parallel with US1/US2's work since `loading.tsx` doesn't touch `page.tsx`
- T049, T050, and T051 (Polish) can run in parallel with each other

---

## Parallel Example: User Story 1

```bash
# Once Foundational (T002–T003) is done, launch the pilot module updates together:
Task: "Update app/(backoffice)/panel/page.tsx: audit only, no change needed"
Task: "Update app/(backoffice)/facilities/page.tsx: Promise.all + range(0,24)"
Task: "Update app/(backoffice)/incidencias/page.tsx: Promise.all + range(0,24)"
Task: "Update app/(backoffice)/finance/page.tsx: range(0,24) on payments"
Task: "Update app/(backoffice)/users/page.tsx: range(0,24) on apartments+residents"
Task: "Update app/(backoffice)/announcements/page.tsx: range(0,24)"
```

## Parallel Example: User Story 3

```bash
# All 18 loading.tsx files are independent and can be created together:
Task: "Create app/(backoffice)/panel/loading.tsx"
Task: "Create app/(backoffice)/facilities/loading.tsx"
Task: "Create app/(backoffice)/incidencias/loading.tsx"
# ...and so on for the remaining 15 modules
```

---

## Implementation Strategy

### MVP First (Foundational + User Story 1 Only)

1. Complete Phase 1: Setup (baseline numbers)
2. Complete Phase 2: Foundational (CRITICAL — the Principle III gate and the per-request memoization refactor block everything else)
3. Complete Phase 3: User Story 1 (6-module pilot)
4. **STOP and VALIDATE**: Re-time the pilot transitions; confirm ~1 second
5. This alone proves the mechanism works and is a demoable MVP

### Incremental Delivery

1. Setup + Foundational → the memoization mechanism is proven correct and in place
2. Add User Story 1 → validate independently → demo (MVP! — 6 modules visibly faster)
3. Add User Story 2 → validate independently → demo (all 18 modules, all roles, consistently fast)
4. Add User Story 3 → validate independently → demo (no module ever looks frozen, even under bad conditions)
5. Phase 6 Polish → full quickstart.md pass + full test suite → ready to ship

## Notes

- [P] tasks touch different files with no ordering dependency
- Every task's file path is exact — no `[module]`/`[entity]` placeholders remain from the template
- The 18-module scope corrects a minor gap between `data-model.md`'s earlier table (17 modules, matching `sidebar-nav.tsx` only) and spec.md's FR-005, which also names Reservations — `app/(backoffice)/reservations/page.tsx` exists and calls `getUserContext()` even though it isn't a top-level sidebar link, so it's included here for full FR-005 compliance.
- T002/T006 (the Constitution Principle III gate) are not optional and must not be skipped or reordered — this is the one binding gate condition from plan.md's Constitution Check.
- FR-008 (large data sets) is implemented as an initial ~25-record batch cap on each module's primary list query (research.md §9, contracts/module-page-pattern.md rule 5) — folded into T007–T025's per-module tasks above — with pagination/"load more" as an explicit but optional follow-up (rule 6, T051), rather than in-page progressive/streaming rendering.
- `getUserContext(supabase)` **keeps its existing parameter** — a mid-implementation correction from this task list's original T003/T004/T005 (which called for dropping it). Removing it broke direct testability, since it would then need to call `createClient()` internally, which depends on `next/headers`'s `cookies()` — unavailable outside a live Next.js request, including in Vitest tests. Instead, `createClient()` itself is now cached per-request (so every caller shares one client instance, making the `supabase` argument stable), and both it and `getUserContext()` are wrapped via a new `requestCache()` helper (`lib/request-cache.ts`) instead of importing React's `cache()` directly, because the plain `react` package Vitest resolves doesn't export `cache()` at all (only Next.js's own bundler provides it) — see research.md §2/§2b for the full account. Net effect: T004 and T005 (updating call sites for a signature change) turned out to be unnecessary — no call site anywhere needed editing.
- **Manual, browser-dependent tasks not completed in this implementation pass**: T001, T013, T026, T045, T046, T047 all require a live browser + DevTools session (timing measurements, network throttling, visual confirmation) unavailable in this environment. Everything code-level is done and verified via `npm run typecheck`, `npm run lint`, `npm run build` (all clean/passing) and `npm run test` (see T048). Recommend running these six manually before considering the feature fully shipped.
- T051 (optional "load more" pagination) was deliberately left undone this pass — it's an explicit SHOULD in spec.md FR-008, not required for MUST-level completion.
- Commit after each task or logical group; validate at each phase checkpoint before moving on.
