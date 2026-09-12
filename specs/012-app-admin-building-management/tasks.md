---
description: 'Task list for the App Administrator Building Management feature'
---

# Tasks: App Administrator Building Management

**Input**: Design documents from `/specs/012-app-admin-building-management/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/app-admin-users-content.md](./contracts/app-admin-users-content.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested for the feature at large, but the Constitution Check in plan.md carries one **binding gate**: this feature adds new authorization-sensitive capabilities (building creation, Building Administrator assignment/reassignment), so Principle III (NON-NEGOTIABLE) requires tests proving both the allowed and denied cases, written before/alongside the implementation they cover. That gate is T002 (written first) plus T012/T016 (verified green once each story's implementation lands) below — it is not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story. Per contracts/app-admin-users-content.md, the existing `/users` route now renders entirely different content depending on `ctx.role` — Building Administrator's branch is never touched by this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the database can actually accept this feature's new writes before any code assumes it can

- [x] T001 Verify against the live Supabase project whether App Administrator already has the RLS permissions research.md §6 lists, and write/apply an additive migration for whatever's missing. **DONE — fully, including apply**: empirically probed the live project as a real signed-in `app_admin` account — `buildings` INSERT/UPDATE/SELECT-all and `user_roles` SELECT/DELETE were **already allowed**; only `user_roles` INSERT for `role = 'building_admin'` was denied. Wrote the one narrowly-scoped policy needed and applied it via the Supabase MCP server (`mcp__supabase__apply_migration`, once the user authorized that connector mid-session) as `0048_app_admin_building_admin_assignment_rls` — the local `supabase/migrations/` folder was stale (only went up to `0040`; the live project was already at `0047` from migrations applied outside this repo, consistent with `SCHEMA-ADAPTATION.md`'s established pattern), so the file is numbered `0048` to avoid colliding with an already-applied `0041`. `mcp__supabase__get_advisors` confirmed no new security findings. A direct query also confirmed the real-world stakes: **12 of the project's 59 existing buildings had zero Building Administrator** before this migration — exactly the scenario the F2 `/speckit-analyze` remediation (the existing-administrator dropdown, usable to fix a building with none) was written for.

**Checkpoint**: The database will actually accept every write this feature's code is about to assume it can make.

---

## Phase 2: Foundational (Blocking Prerequisites for US2 and US3)

**Purpose**: Shared building blocks that both the creation flow (US2) and the edit/reassign flow (US3) need. **Not** needed by US1 — see Dependencies below.

**⚠️ CRITICAL**: US2 and US3 cannot begin until this phase is complete. T002 MUST be written (and confirmed to fail — nothing it tests exists yet) before T003/T004.

- [x] T002 [Constitution Principle III gate] Write `tests/integration/app-admin-building-management.test.ts`. **DONE**, with one adaptation: like every other action in this codebase, `buildings-actions.ts`'s Server Actions depend on `next/headers`'s `cookies()` and can't be called directly from Vitest — so, matching `tests/integration/rls-*.test.ts`'s established pattern, this tests the real RLS-enforced boundary directly (signed-in role clients attempting the same `buildings`/`user_roles` operations the actions perform) plus `createBuildingUser()` end-to-end with a real App Administrator client. 8 tests: initially 6/8 passed, with the 2 "App Administrator can insert into `user_roles`" cases correctly failing until T001's migration was applied (confirmed that was the _only_ reason — all "denied" cases already passed) — now 8/8 pass, gate fully closed.
- [x] T003 Extend `createBuildingUser()`'s role union in `lib/user-provisioning.ts` from `'resident' | 'renter' | 'staff'` to also accept `'building_admin'`, following the exact `user_roles` insert shape Staff already uses (no `apartmentId`) (research.md §4). **DONE**.
- [x] T004 [P] Create `lib/validation/buildings.ts`: `createBuildingSchema` (a required, non-empty `name`) and a schema for the new-administrator-account path (email, password, first name, last name, document ID) — **duplicate** `lib/validation/users.ts`'s existing base-account-fields shape rather than importing it (research.md §9). **DONE**.

**Checkpoint**: `createBuildingUser()` can provision a Building Administrator, validation schemas exist, and the Principle III gate tests are in place (failing) — US2 and US3 can now begin.

---

## Phase 3: User Story 1 - App Administrator sees only what applies to them (Priority: P1) 🎯 MVP

**Goal**: An App Administrator's navigation shows only the Users module.

**Independent Test**: Sign in as App Administrator and confirm only the Users link appears; sign in as Building Administrator and Staff separately and confirm their navigation is unchanged.

**Note**: This story has no dependency on Phase 2 (Foundational) — it touches only navigation, not any of the new building/administrator write paths. It can be implemented and shipped first, in parallel with Foundational, or independently.

### Implementation for User Story 1

- [x] T005 [US1] Update `app/(backoffice)/layout.tsx`: compute `isAppAdmin = ctx.role === 'app_admin'` (alongside the existing `isStaffOnly`) and pass it to `SidebarNav`. **DONE**.
- [x] T006 [US1] Update `app/(backoffice)/sidebar-nav.tsx`: accept the new `isAppAdmin` prop; when true, filter `NAV_ITEMS` down to only the `/users` entry (research.md §2), following the exact pattern the existing `staffOnly` filter already uses. **DONE**.
- [x] T007 [US1] Manually verify (quickstart.md → Navigation section): sign in as each of App Administrator, Building Administrator, and Staff; confirm App Administrator sees only Users, and the other two roles' navigation is pixel-for-pixel unchanged from before this feature (depends on T005, T006). **Not done — requires a live browser session**, unavailable in this implementation environment.

**Checkpoint**: App Administrator's navigation is correctly scoped — independently demoable, with zero risk to the other two roles.

---

## Phase 4: User Story 2 - App Administrator onboards a new building (Priority: P2)

**Goal**: An App Administrator can create a new building (name + optional logo) and its first Building Administrator account, in one flow.

**Independent Test**: Sign in as App Administrator, create a building with a name (and optionally a logo), create its Building Administrator's account in the same flow, then confirm that new administrator can sign in and sees only their own building's data.

### Implementation for User Story 2

- [x] T008 [US2] Update `app/(backoffice)/users/page.tsx`: branch on `ctx.role` right after resolving context — `app_admin` fetches (a) all buildings (no `building_id` filter), (b) for each, the profile of whoever currently holds `role = 'building_admin'` for it (`null`/none for a building that predates this feature and has no match), and (c) the deduplicated list of every existing Building Administrator across all buildings, for the dropdown (data-model.md §4, research.md §10); the existing `building_admin` branch (today's queries, unchanged) stays exactly as-is (research.md §3). **DONE** — a first pass accidentally reverted 011-module-navigation-performance's `.range(0, 24)` caps on the apartments/residents queries below the new branch (a stale-context mistake, caught immediately via `git diff` and fixed); re-verified via `git diff` (purely additive) and the `cross-tenant-isolation`/`rls-profiles` suites (8/8 pass).
- [x] T009 [P] [US2] Create `app/(backoffice)/users/buildings-client.tsx`: renders the buildings list (name, logo, current administrator, or a clearly-flagged "no administrator" state for any building missing one) and a "Create building" form — name, optional logo file, and an administrator choice: pick an existing Building Administrator from the dropdown (T008's list), or fill in a new account's fields (contracts/app-admin-users-content.md). **DONE** (built together with T015's edit/reassign UI in one file).
- [x] T010 [US2] Create `app/(backoffice)/users/buildings-actions.ts` with `createBuilding()`: requires `ctx.role === 'app_admin'` (re-checked server-side, not just UI-gated); inserts the `buildings` row (name only); if a logo was provided, uploads it via the existing `uploadBuildingFile()` (reusing `updateCustomization()`'s square-image validation) and updates `logo_url` (best-effort — a failure here does not roll back the building, per FR-005's "optional"); assigns the administrator — either a plain `user_roles` insert for the selected existing Building Administrator, or a new account via the now-extended `createBuildingUser()`; **if that assignment fails, deletes the just-created building row** (research.md §8's rollback ordering); calls `writeAuditLog()` with `action: 'building.create'` (depends on T003, T004, T008, T009). **DONE** (built together with T013/T014 in one file).
- [x] T011 [US2] Wire `buildings-client.tsx`'s create-building form to `createBuilding()`: surface the square-logo-required error and the "an account with this email already exists" friendly error (matching the existing pattern from `createResident`/`createStaff`) for the new-account path; on success, refresh the buildings list (depends on T009, T010). **DONE**.
- [x] T012 [US2] Run `npm run test` and confirm T002's "App Administrator can create a building + administrator" and "Building Administrator/Staff denied" cases now pass (depends on T010). **DONE** — all pass now that T001's migration is applied; `tests/integration/app-admin-building-management.test.ts` is 8/8 green.

**Checkpoint**: An App Administrator can take a building from nonexistent to fully usable in one flow — independently demoable.

---

## Phase 5: User Story 3 - App Administrator manages existing buildings and their administrators (Priority: P3)

**Goal**: An App Administrator can edit an existing building's name/logo, see its current administrator, and reassign that role to a different user.

**Independent Test**: Sign in as App Administrator, edit an existing building's name/logo and confirm the change is visible, then reassign its administrator and confirm the previous holder loses access while the new one gains it.

### Implementation for User Story 3

- [x] T013 [US3] Extend `app/(backoffice)/users/buildings-actions.ts` with `updateBuilding()`: requires `app_admin`; updates `name`/`logo_url` (reusing T010's upload path); calls `writeAuditLog()` with `action: 'building.update'` (depends on T010). **DONE**.
- [x] T014 [US3] Extend `app/(backoffice)/users/buildings-actions.ts` with `reassignBuildingAdministrator()`: requires `app_admin`; supports either creating a brand-new account (via `createBuildingUser(role: 'building_admin')`) or assigning an existing Building Administrator selected from the dropdown (T008's list — never an App Administrator, FR-013); **inserts the new `user_roles` row before deleting the outgoing one, if any** (research.md §8 — never a zero-administrator window; deleting zero rows for a building that currently has none is an expected no-op, not an error — this is also how a building missing an administrator gets its first one assigned, FR-011); calls `writeAuditLog()` with `action: 'building_admin.reassign'` (depends on T003, T004, T010). **DONE**.
- [x] T015 [P] [US3] Extend `buildings-client.tsx` with an edit-building form (name/logo) and a reassign-administrator control (dropdown of existing Building Administrators, or create-new-account) — reusable both for a building with a current administrator and one flagged as having none, wired to T013/T014 (depends on T009, T013, T014). **DONE**.
- [x] T016 [US3] Run `npm run test` and confirm T002's remaining cases — "new administrator scoped to exactly one building" and "reassignment immediately revokes the previous administrator's access" — now pass (depends on T014). **DONE** — both pass; full file re-run twice for stability (one transient `Gateway Timeout` from Supabase's Admin API on an unrelated test, confirmed non-reproducing on immediate re-run).

**Checkpoint**: The full building/administrator lifecycle (create, edit, reassign) is complete and independently demoable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation against the spec's success criteria and the Constitution gate

- [ ] T017 Perform the full manual pass through `specs/012-app-admin-building-management/quickstart.md`, including the "No regression" section (Building Administrator/Staff workflows unaffected, cross-building isolation intact). **Not done — requires a live browser session**, unavailable in this implementation environment. No longer blocked by the migration (T001 is applied) — this is purely the remaining manual/visual verification step.
- [x] T018 Run `npm run test` and confirm no regression to Building Administrator/Staff behavior (SC-005). **DONE, targeted rather than the full 41-file suite** (running everything at once hits Supabase Auth's sign-in rate limit, per 011-module-navigation-performance's precedent): `tests/integration/app-admin-building-management.test.ts` (8/8, after T001's migration was applied mid-session), `tests/integration/get-user-context.test.ts` (8/8), `tests/integration/cross-tenant-isolation.test.ts` (3/3), `tests/integration/rls-profiles.test.ts` (5/5) all pass. `npm run typecheck`/`lint`/`build` clean throughout. Recommend a full `npm run test` run outside a heavy-testing window as a final confirmation.
- [x] T019 [P] Run `npm run lint`, `npm run typecheck`, and `npm run build` for a final clean pass across all touched files. **DONE** — all three clean; all 25 routes (including the larger `/users` bundle, 5.57 kB) build successfully.
- [x] T020 [P] Audit `users/page.tsx`, `buildings-client.tsx`, and `buildings-actions.ts` against `specs/012-app-admin-building-management/contracts/app-admin-users-content.md` for compliance. **DONE**: role branch is server-side only (`ctx.role` in `page.tsx`, no client toggle); `createBuilding`/`updateBuilding`/`reassignBuildingAdministrator` each independently call `requireAppAdmin()`; each calls `writeAuditLog()` with the contract's exact action names; `createBuilding`'s and `reassignBuildingAdministrator`'s write ordering matches research.md §8; `existingAdministrators` (the dropdown source) is built solely from `role = 'building_admin'` rows in `page.tsx` — never includes App Administrator accounts (FR-013).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS User Story 2 and User Story 3 only (see below)
- **User Story 1 (Phase 3)**: **No dependency on Foundational** — touches only navigation, none of Foundational's building/administrator write-path work. Can be done first, or in parallel with Setup/Foundational.
- **User Story 2 (Phase 4)**: Depends on Foundational (T002–T004) completion
- **User Story 3 (Phase 5)**: Depends on Foundational completion **and** on User Story 2's `buildings-client.tsx`/`buildings-actions.ts` existing (T009/T010) — it extends those same files rather than creating new ones
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- US1: T005 (layout) before T006 (sidebar-nav reads the new prop) before T007 (manual verification)
- US2: T008 (page branch) and T009 (client UI) can run in parallel; T010 (actions) depends on T003/T004 (Foundational) and needs T008/T009 as its integration points; T011 wires T009↔T010; T012 verifies
- US3: T013 and T014 both extend `buildings-actions.ts` (same file — sequential, not `[P]`); T015 (client UI) depends on both; T016 verifies

### Parallel Opportunities

- T004 (Foundational) can run in parallel with T002/T003 — different files
- User Story 1 (T005–T007) can be executed entirely in parallel with Foundational and/or User Story 2, since it shares no files or dependencies with either
- T008 and T009 (US2) can run in parallel — different files
- T015 (US3) is the only US3 implementation task not sharing a file with another US3 task, but it depends on both T013 and T014 completing first (same file, `buildings-actions.ts`, sequential)
- T019 and T020 (Polish) can run in parallel with each other

---

## Parallel Example: Foundational + User Story 1 together

```bash
# These can all be worked simultaneously — no shared files:
Task: "Write tests/integration/app-admin-building-management.test.ts" (T002)
Task: "Extend createBuildingUser() in lib/user-provisioning.ts" (T003)
Task: "Create lib/validation/buildings.ts" (T004)
Task: "Update app/(backoffice)/layout.tsx" (T005, User Story 1)
```

## Parallel Example: User Story 2

```bash
# Once Foundational is done, launch together:
Task: "Update app/(backoffice)/users/page.tsx to branch on role" (T008)
Task: "Create app/(backoffice)/users/buildings-client.tsx" (T009)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (no Foundational dependency — can genuinely go first)
2. **STOP and VALIDATE**: Confirm App Administrator's navigation is correctly scoped and the other two roles are unaffected
3. This alone is a demoable, low-risk MVP — it fixes today's confusing "sees a link that never works" experience with zero new authorization surface

### Incremental Delivery

1. User Story 1 → validate independently → demo (MVP! — navigation fixed)
2. Setup + Foundational → the database and shared building-blocks are ready
3. Add User Story 2 → validate independently → demo (buildings can be created end-to-end)
4. Add User Story 3 → validate independently → demo (buildings can be edited, administrators reassigned)
5. Phase 6 Polish → full quickstart.md pass + full test suite → ready to ship

## Notes

- [P] tasks touch different files (or, for T004, a file none of T002/T003 touch) with no ordering dependency
- Every task's file path is exact — no `[module]`/`[entity]` placeholders remain from the template
- T002/T012/T016 (the Constitution Principle III gate, written first and verified in two checkpoints) are not optional — this is the one binding gate condition from plan.md's Constitution Check
- `users/actions.ts` and `users-client.tsx` (Building Administrator's existing resident/staff UI) are **never touched** by any task in this list — per research.md §3/§7 and FR-002/SC-005, that code path is intentionally left completely alone
- **Post-`/speckit-analyze` corrections folded into this task list**: (1) there is no separate `assignBuildingAdministrator` function — `createBuilding` (T010) handles first-assignment inline, and `reassignBuildingAdministrator` (T014) handles every later change, including assigning an administrator to a building that currently has none (resolves the plan.md/contract drift `/speckit-analyze` flagged); (2) both T010 and T014 offer a choice between a new account and an existing Building Administrator selected from a dropdown (never an App Administrator, FR-013) — this is also the mechanism that resolves SC-003's coverage gap for buildings that predate this feature; (3) T004's new-administrator-account schema duplicates, rather than imports, `lib/validation/users.ts`'s private `baseAccountFields` shape.
- Commit after each task or logical group; validate at each phase checkpoint before moving on
