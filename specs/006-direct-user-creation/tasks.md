---

description: "Task list template for feature implementation"
---

# Tasks: Direct User Creation (Replacing Invitations)

**Input**: Design documents from `/specs/006-direct-user-creation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/provisioning.md](./contracts/provisioning.md),
[quickstart.md](./quickstart.md)

**Tests**: NOT optional for User Story 1. Constitution Principle III (NON-NEGOTIABLE) requires an
automated allow/deny test before authorization-relevant logic ships. `createBuildingUser()` is
genuinely new authorization surface even though it adds no new RLS policy — it deliberately
bypasses RLS for the `auth.users` insert (that's the only way to create an account with an
admin-chosen password), which means the *application code itself*, not Postgres, is the
enforcement point for "this building only" (research.md item 4, contracts/provisioning.md). User
Story 2 (editing identity fields) introduces no new authorization surface — it extends an existing
field set through the existing, already-covered `"profiles managed by admins"` RLS policy — so,
per the precedent set in `specs/004-facilities-incidencias-packages/tasks.md` for its own
display/edit-only stories, it is verified via quickstart.md's manual steps plus the standard
`npm run typecheck`/`lint`/`build` gates, with no new automated test required.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P2) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US2)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, same as every prior feature — `app/`, `components/`, `lib/`, `tests/` at
the repository root. This repo has no local `supabase/migrations/` directory (see
`specs/001-building-backoffice/SCHEMA-ADAPTATION.md`); migration tasks below still name a
`supabase/migrations/NNNN_*.sql` path as the canonical record of the change, applied to the live
project the same way (SQL editor/MCP) prior features' additive migrations were, with
`lib/supabase/database.types.ts` regenerated immediately after.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this feature builds on is intact before changing anything

- [X] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run test` are clean on the current branch before this feature's changes begin, and note whether `.env.local` has a real `SUPABASE_SERVICE_ROLE_KEY` value (not just the placeholder key name) — required both for this feature's new test (T006) and, per plan.md's Constraints, for `lib/supabase/admin.ts` (T007) to work in the running app itself, not just in tests

**Checkpoint**: Baseline confirmed working; safe to start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema groundwork both user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Confirm the existing artifacts contracts/provisioning.md and data-model.md rely on are present in the live Habitat Supabase project exactly as described: the `"profiles managed by admins"` policy on `profiles`, the `"staff role insert by building admins"` policy on `user_roles`, and the current `handle_new_user()` trigger function body (query via `lib/supabase/database.types.ts`'s `Functions` section plus a direct policy check) — no code change, this only confirms T004's trigger edit and T009's `createBuildingUser()` can rely on them as described (depends on T001)
- [X] T003 Migration: add nullable `first_name`, `last_name`, `document_id` text columns to `profiles` per data-model.md in `supabase/migrations/0015_profiles_identity_fields.sql` (depends on T002)
- [X] T004 Migration: extend `handle_new_user()` (the existing `AFTER INSERT ON auth.users` trigger function) to also read `first_name`, `last_name`, `document_id`, `building_id`, `apartment_id` out of `new.raw_user_meta_data` and set them on the `profiles` row it creates — per data-model.md's Triggers section (the exact INSERT statement to use), preserving the existing `full_name`/`email` population unchanged — in `supabase/migrations/0016_handle_new_user_metadata.sql` (depends on T003)
- [X] T005 Regenerate `lib/supabase/database.types.ts` from the live schema after T003–T004 are applied (depends on T004)

**Checkpoint**: Confirmed and applied; US1 and US2 can both proceed.

---

## Phase 3: User Story 1 - Create a resident or staff account directly (Priority: P1) 🎯 MVP

**Goal**: A Building Administrator fills in first name, last name, document ID, email, (apartment,
for Resident), and a temporary password on Usuarios y roles, and submitting immediately creates a
real, sign-in-capable account — no pending `invitations` row.

**Independent Test**: Per quickstart.md's User Story 1 section — create a Resident and a Staff
account through the new form, confirm each appears as a full member (not "pendiente") immediately,
and confirm signing in with the given email/temporary password succeeds right away for both.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T006 [P] [US1] Integration test for `createBuildingUser()` in `tests/integration/user-provisioning.test.ts`, covering contracts/provisioning.md's behavior table: allows a building_admin to create a resident (apartment required) and a staff account (no apartment) scoped to their own building; denies/rejects when the target email already has an account; denies/rejects when the apartment belongs to a different building than the acting admin's; denies/rejects a temporary password shorter than the minimum (research.md item 5); and confirms the created account's `building_id`/`apartment_id` always match the *acting admin's own* building — never a value the test tries to smuggle in through any other argument (research.md item 4) — using `tests/fixtures.ts`'s `createTestBuilding`/`createTestApartment`/`createTestUser` and `tests/setup.ts`'s `signInAs()` for the request-scoped client half of the call (depends on T005)

### Implementation for User Story 1

- [X] T007 [P] [US1] `lib/supabase/admin.ts`: a server-only service-role Supabase client getter (`getAdminClient()`), mirroring `tests/fixtures.ts`'s `getServiceClient()` shape but for the running app — reads `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL` from the environment, throws a clear error if the key is missing, and is never imported by any `'use client'` file (depends on T005)
- [X] T008 [P] [US1] `lib/validation/users.ts`: Zod schemas `createResidentAccountSchema` and `createStaffAccountSchema` (shared base: `email`, `password` min 8 chars per research.md item 5, `first_name` min-length, `last_name` min-length, `document_id` min-length; `createResidentAccountSchema` additionally requires `apartment_id` uuid) (depends on T005)
- [X] T009 [US1] `lib/user-provisioning.ts`: `createBuildingUser(opts)` per contracts/provisioning.md — takes `{ adminClient, requestClient, actorId, buildingId, role, email, password, firstName, lastName, documentId, apartmentId? }` as plain arguments (no `cookies()`/`getUserContext()` call inside it, per research.md item 3); for `role === 'resident'`, first confirms `apartmentId` belongs to `buildingId` (query `apartments`) before calling `adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, first_name, last_name, document_id, building_id: buildingId, apartment_id } })`; for `role === 'staff'`, calls the same `createUser` without `apartment_id`, then inserts `{ user_id, role: 'staff', building_id: buildingId }` into `user_roles` via `requestClient` (relying on the existing `"staff role insert by building admins"` policy); maps Supabase Auth's duplicate-email error to a friendly message; returns `{ userId }` or `{ error }` (depends on T006 failing, T007, T008)
- [X] T010 [P] [US1] `app/(backoffice)/users/actions.ts`: rewrite `createResident()` to validate with T008's `createResidentAccountSchema`, resolve `ctx`/`buildingId` via `getUserContext()` exactly as today (never accepting a client-supplied building id for the elevated call — research.md item 4), call `createBuildingUser()` with `role: 'resident'`, write the audit log as `resident.create` (replacing `resident.invite`) with the new field values in `metadata`, and `revalidatePath('/users')`; remove the now-unused `invitations`-insert code path (depends on T009)
- [X] T011 [P] [US1] `app/(backoffice)/visitors/staff-actions.ts`: rewrite `createStaff()` the same way as T010 using T008's `createStaffAccountSchema`, calling `createBuildingUser()` with `role: 'staff'`, audit action `staff.create` (replacing `staff.invite`); remove the inline `staffInviteSchema` (superseded by T008) and the now-unused `invitations`-insert code path (depends on T009)
- [X] T012 [P] [US1] `app/(backoffice)/users/page.tsx`: add `first_name, last_name, document_id` to the `residents` query's `.select(...)` and to the `roleProfiles` query's `.select(...)` (for the Staff/Admin tabs), passing them through to `UsersClient` (depends on T005)
- [X] T013 [US1] `app/(backoffice)/users/users-client.tsx`: replace the "Invitar usuario" card with a "Crear usuario" form — first name, last name, document ID, email, temporary password, role selector (unchanged), apartment selector (Resident only, unchanged) — calling T010's `createResident()`/T011's `createStaff()` on submit; update the Residente/Personal table columns to display `document_id` alongside the existing columns (FR-011); remove the invite-specific copy ("Enviar invitación" → "Crear usuario") (depends on T010, T011, T012)

**Checkpoint**: User Story 1 is fully functional and independently testable — a Building
Administrator can create a resident or staff account and it's immediately usable, without
Incidencias/Packages/Facilities or User Story 2 existing.

---

## Phase 4: User Story 2 - Correct a resident's identity details after creation (Priority: P2)

**Goal**: A Building Administrator can edit an existing resident's first name, last name, and
document ID (in addition to the email/apartment fields already editable today).

**Independent Test**: Per quickstart.md's User Story 2 section — edit an existing resident's first
name, last name, or document ID and save; confirm the Residente list reflects the change; confirm
clearing any of the three to blank is rejected.

### Implementation for User Story 2

*(No new automated test — see the Tests note at the top of this document.)*

- [X] T014 [P] [US2] `lib/validation/apartments.ts`: extend `updateResidentSchema` with optional `first_name`, `last_name`, `document_id` fields (each, if provided, must be non-blank — reuse the existing `.refine()` pattern requiring at least one field to update) (depends on T005)
- [X] T015 [US2] `app/(backoffice)/users/actions.ts`: extend `updateResident()` to accept and validate the new fields via T014's schema (the existing `supabase.from('profiles').update(parsed.data)` call already generalizes to any validated field, so this is primarily a schema/type change plus confirming the update still goes through the existing `"profiles managed by admins"` RLS policy unchanged) (depends on T010, T014 — same file as T010, apply sequentially after it)
- [X] T016 [US2] `app/(backoffice)/users/users-client.tsx`: extend the resident edit-row form (`editForm`/`startEditResident`/`saveResidentEdit`) to include first name, last name, and document ID inputs alongside the existing email/apartment inputs, calling T015's updated `updateResident()` (depends on T013, T015 — same file as T013, apply sequentially after it)

**Checkpoint**: Both user stories are independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification that spans both user stories

- [X] T017 [P] Run `npm run typecheck && npm run lint && npm run test && npm run build` and confirm all are clean with every change from T002–T016 applied — if `SUPABASE_SERVICE_ROLE_KEY` has a real value (per T001), T006's test should now pass green, not merely fail-to-run
- [ ] T018 Run quickstart.md's full manual validation script (both user stories plus the Cross-cutting checks section — non-admin denial, cross-building apartment denial, pre-existing pending invitations unaffected) and record results
- [X] T019 [P] Re-read plan.md's Constitution Check and Complexity Tracking table and confirm they still hold with the actual implementation; if the `profiles` migration or `handle_new_user()` edit diverges from data-model.md the way feature 001's did, add a `SCHEMA-ADAPTATION.md`-style note to this feature's directory

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup. Blocks both user stories — T003/T004 add the
  columns and trigger behavior both US1 (creation) and US2 (editing) require to exist
- **User Stories (Phase 3–4)**: Both depend on Phase 2. US1 and US2 are logically independent, but
  share two files (`app/(backoffice)/users/actions.ts`, `app/(backoffice)/users/users-client.tsx`)
  — see the shared-file notes on T015/T016 below
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- US1: test (T006) before the implementation it gates (T009); `lib/` helpers (T007, T008) can run
  parallel to the test and to each other; T009 depends on all three; T010/T011 (the two Server
  Action call sites) depend on T009 and are independent of each other (different files); T012 (page
  query) only depends on T005 and can run anytime; T013 (the form) depends on T010, T011, T012
- US2: T014 (schema) depends only on T005 and can be written anytime, even in parallel with US1;
  T015 depends on T010 (same file, `users/actions.ts` — apply sequentially after it, not in
  parallel) and T014; T016 depends on T013 (same file, `users-client.tsx` — apply sequentially
  after it) and T015

### Parallel Opportunities

- Setup: single task, nothing to parallelize
- Foundational: sequential (each migration step depends on the last); nothing to parallelize
- US1: T006, T007, T008 can run in parallel once T005 lands (three different files, no
  interdependency); T010 and T011 can run in parallel once T009 lands (different files); T012 can
  run in parallel with any of the above once T005 lands
- US1 and US2's schema task (T014) can be staffed in parallel with all of US1 — it touches a file
  US1 never touches
- US1 and US2 are NOT fully parallel end-to-end: T015 must wait for T010, and T016 must wait for
  T013, because each pair shares a file
- Polish: T017 and T019 can run in parallel; T018 (manual walkthrough) is best done once T017 is
  clean

---

## Parallel Example: User Story 1

```bash
# Once T005 (types regenerated) lands, launch these three together:
Task: "Integration test for createBuildingUser() in tests/integration/user-provisioning.test.ts"
Task: "lib/supabase/admin.ts service-role client getter"
Task: "lib/validation/users.ts Zod schemas for account creation"

# Once T009 (createBuildingUser) lands, these two can run in parallel:
Task: "Rewrite createResident() in app/(backoffice)/users/actions.ts"
Task: "Rewrite createStaff() in app/(backoffice)/visitors/staff-actions.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (direct account creation, fully functional end-to-end)
4. **STOP and VALIDATE**: run quickstart.md's User Story 1 section
5. This alone delivers the entire behavior change the user asked for (spec.md's stated priority)

### Incremental Delivery

1. Setup + Foundational → ready
2. Add US1 (direct creation) → validate independently → deploy/demo (MVP!)
3. Add US2 (edit identity fields) → validate independently → deploy/demo
4. Phase 5: Polish, run full quickstart.md, ship

### Parallel Team Strategy

With multiple developers: one completes Setup + Foundational, then Developer A takes US1's
`lib/`/test tasks (T006–T009) while Developer B starts US2's schema task (T014, independent of
US1). Once US1's T010/T013 land, Developer B (or whoever's free) picks up T015/T016, which must
wait for those specific files regardless of who's staffed on what.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- `[Story]` labels map every user-story-phase task back to spec.md for traceability
- This feature's only shared-file friction is *within* itself, between US1 and US2
  (`users/actions.ts`: T010 then T015; `users-client.tsx`: T013 then T016) — apply those edits
  sequentially, not simultaneously
- Per SCHEMA-ADAPTATION.md's precedent (specs/001, specs/004), if the live Habitat schema's
  `handle_new_user()` or `profiles` shape has drifted from data-model.md's assumptions by the time
  T003/T004 run, adapt to the live definition and record the mapping rather than assuming
  data-model.md is authoritative (T019)
- Commit after each task or logical group
- Stop at either checkpoint to validate a story independently before continuing

## Implementation Notes (added post-implementation)

- **T018 is intentionally left unchecked.** This session verified the DB-level trigger logic
  directly via SQL (the exact `jsonb->>`/`nullif(...)::uuid` expressions `handle_new_user()` now
  uses, including the empty-string-`apartment_id` and missing-metadata edge cases), and confirmed
  `npm run typecheck`/`lint`/`test`/`build` are all clean — but could not exercise the real
  end-to-end path (an actual `auth.admin.createUser()` call, the trigger firing on a real
  `auth.users` insert, and a fresh sign-in with the temporary password) because
  `SUPABASE_SERVICE_ROLE_KEY` has no value in this environment and no browser-automation tool was
  available. See `SCHEMA-ADAPTATION.md` in this feature's directory for the full account, including
  an unrelated schema drift discovered during type regeneration (six migrations from other,
  concurrent work on this shared project — `tickets.photo_url`, `news_comments`, `news_reactions` —
  none of which this feature touches).
- Whoever adds a real `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` next should treat that as the
  first red/green run of `tests/integration/user-provisioning.test.ts`, and should also add that
  same key to this app's actual deployment environment — `createResident()`/`createStaff()` will
  otherwise fail for every real user once this ships, not just in tests.
