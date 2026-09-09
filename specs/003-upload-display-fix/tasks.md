---

description: "Task list template for feature implementation"
---

# Tasks: Uploaded Content Displays Correctly

**Input**: Design documents from `/specs/003-upload-display-fix/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/file-access.md](./contracts/file-access.md),
[quickstart.md](./quickstart.md)

**Tests**: Only User Story 3 (cross-building isolation) gets a written-first automated test, per
plan.md's Constitution Check commitment to Principle III (NON-NEGOTIABLE) — it is the one part of
this feature that is an authorization guarantee, not just a display fix. User Stories 1 and 2 are
verified via quickstart.md's manual steps plus the existing `npm run typecheck`/`lint`/`build`
gates; this matches the feature's own scope (a rendering bug fix reusing already-authorized reads,
not new CRUD/authorization surface).

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US3)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, same as feature 001 — `app/`, `lib/`, `tests/` at the repository root. This
feature edits existing files in place; no new top-level structure.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this fix builds on is intact before changing anything

- [X] T001 Verify `npm run dev` runs against the live Habitat project using the existing `.env.local` from feature 001, and that `npm run typecheck`/`npm run lint` are currently clean on `main` before this feature's changes begin

**Checkpoint**: Baseline confirmed working; safe to start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared infrastructure every user story's call sites use

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add `trySignedUrlFor()` to `lib/supabase/storage.ts` — wraps the existing `signedUrlFor()` (feature 001) and returns `null` instead of throwing on failure (FR-005/FR-006), per contracts/file-access.md's "every call site MUST catch the throw case" rule. Keep `signedUrlFor()` itself unchanged (still used directly by tests that need to assert the throw, per T019)

**Checkpoint**: `trySignedUrlFor()` exists and is unit-reachable; user story implementation can now begin.

---

## Phase 3: User Story 1 - Uploaded images appear right away (Priority: P1) 🎯 MVP

**Goal**: Every image field (`facilities.image_url`, `activities.banner_url`,
`announcements.banner_url`, `buildings.logo_url`) renders as an actual image, immediately after
upload and on every subsequent page load, instead of a raw storage path.

**Independent Test**: Upload a facility photo; confirm it renders without a reload; reload the
page and confirm it still renders (per quickstart.md §1).

### Implementation for User Story 1

- [X] T003 [P] [US1] `app/(backoffice)/facilities/page.tsx` — after fetching facilities, generate a 24h signed URL per row for `image_url` via `trySignedUrlFor()` (`Promise.all`), pass as `image_signed_url` to `FacilitiesClient` (depends on T002)
- [X] T004 [US1] `app/(backoffice)/facilities/facilities-client.tsx` — render `image_signed_url` in the `<img>` `src` instead of the raw `image_url`; when `null`, keep the existing icon-avatar tile fallback unchanged (depends on T003)
- [X] T005 [P] [US1] `app/(backoffice)/activities/page.tsx` — same signed-URL pattern for `banner_url` (depends on T002)
- [X] T006 [US1] `app/(backoffice)/activities/activities-client.tsx` — render the signed banner URL; fall back to the existing icon-avatar tile when `null` (depends on T005)
- [X] T007 [P] [US1] `app/(backoffice)/announcements/page.tsx` — same signed-URL pattern for `banner_url` (depends on T002)
- [X] T008 [US1] `app/(backoffice)/announcements/announcements-client.tsx` — render the signed banner URL as an `<img>` (currently no banner is rendered on this page at all — add it) (depends on T007)
- [X] T009 [P] [US1] `app/(backoffice)/customization/page.tsx` — same signed-URL pattern for `buildings.logo_url` (depends on T002)
- [X] T010 [US1] `app/(backoffice)/customization/customization-client.tsx` — replace the current raw-path text line ("Actual: {logoUrl}") with an actual `<img>` preview using the signed URL (depends on T009)
- [X] T011 [P] [US1] `app/(backoffice)/layout.tsx` — generate a signed URL for the sidebar's `buildings.logo_url` and render it in `.sidebar-logo` instead of the raw path; keep the `IconShield` fallback when `null` or no logo is set (depends on T002)
- [X] T012 [P] [US1] Update `specs/003-upload-display-fix/spec.md`'s Assumptions: record that the login page (`app/login/page.tsx`) keeps the generic Habitat shield icon rather than a per-building logo, because it has no building context before authentication — Acceptance Scenario 2's "and on the login page" clause is descoped accordingly

**Checkpoint**: User Story 1 is fully functional and independently testable — every image field
across the backoffice displays correctly, immediately and after reload.

---

## Phase 4: User Story 2 - Uploaded documents can be opened (Priority: P2)

**Goal**: Documents (Documentos, announcement attachments) can be opened/downloaded after upload
via an on-demand signed URL.

**Independent Test**: Upload a document; click to open it; confirm the retrieved file matches
what was uploaded (per quickstart.md §2).

### Implementation for User Story 2

- [X] T013 [P] [US2] `app/(backoffice)/documentation/actions.ts` — add `getDocumentUrl(documentId: string)` server action per contracts/file-access.md: look up the document's `file_path` (RLS-scoped select), call `trySignedUrlFor()` (1h default), return `{ ok: true, url } | { ok: false, error }` (depends on T002)
- [X] T014 [US2] `app/(backoffice)/documentation/documentation-client.tsx` — add an "Abrir" button per document row calling `getDocumentUrl()` and opening the returned URL in a new tab; show the existing inline `error-text` pattern on failure (depends on T013)
- [X] T015 [P] [US2] `app/(backoffice)/announcements/actions.ts` — add `getAttachmentUrl(attachmentId: string)` server action, same shape as T013 but for `announcement_attachments.file_path` (depends on T002)
- [X] T016 [US2] `app/(backoffice)/announcements/page.tsx` — additionally fetch each announcement's `announcement_attachments` (`id`, `file_name`) and pass to the client (same file as T007 — sequential, not parallel, with it)
- [X] T017 [US2] `app/(backoffice)/announcements/announcements-client.tsx` — list each announcement's existing attachments with an "Abrir" button calling `getAttachmentUrl()` (same file as T008 — sequential with it; depends on T015, T016)

**Checkpoint**: User Stories 1 and 2 both work independently — images display, and documents/
attachments can be opened.

---

## Phase 5: User Story 3 - Uploaded content stays private to the right building (Priority: P3)

**Goal**: Confirm — with an automated, written-first test per Constitution Principle III — that
none of the new signed-URL call sites can be used to read another building's files, and that a
missing file fails soft (FR-005) rather than crashing a page.

**Independent Test**: As Building A's admin, attempt to obtain a signed URL for Building B's
facility image and for a document/attachment id belonging to Building B; both are denied (per
quickstart.md §3).

### Tests for User Story 3 ⚠️ (write first, confirm they fail against pre-fix behavior)

- [X] T018 [P] [US3] Extend `createTestFacility()` in `tests/fixtures.ts` with an optional `image_url` override, so a fixture facility can point at a specific Storage path for the test below
- [X] T019 [US3] `tests/integration/signed-url-access.test.ts` — using `createTestBuilding`/`createTestUser`/`createTestFacility` (T018) for two buildings: (a) assert `signedUrlFor()` throws when called (via the per-request pattern, i.e. a signed-in client) for a path belonging to a *different* building's admin (FR-004); (b) assert `getDocumentUrl()`/`getAttachmentUrl()` (T013/T015) return `{ ok: false }` for another building's document/attachment id; (c) assert `trySignedUrlFor()` (T002) returns `null`, not a throw, for a path that doesn't exist in Storage when called by a legitimate same-building member (FR-005) (depends on T002, T013, T015, T018)

**Checkpoint**: All three user stories are independently functional; the isolation guarantee this
feature depends on (existing Storage RLS, per research.md item 3) is now explicitly covered by a
test rather than trusted by assertion.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification that spans every user story

- [X] T020 [P] Run `npm run typecheck && npm run lint && npm run build` and confirm all three are clean with every change from T002–T019 applied
- [ ] T021 Run quickstart.md's full manual validation script (all three user stories plus the edge-case spot-checks) and record results — NOT run: requires a signed-in browser session, which this environment doesn't have; `npm run test`'s automated portion was confirmed to compile/collect correctly (fails only on the pre-existing missing-`SUPABASE_SERVICE_ROLE_KEY` limitation, same as feature 001). Whoever has the service-role key and a browser should run this next.
- [X] T022 [P] Re-read `specs/003-upload-display-fix/plan.md`'s Post-Phase 1 Constitution re-check and confirm it still holds with the actual implementation (no new complexity was introduced beyond what plan.md anticipated)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (every eager/on-demand
  call site uses `trySignedUrlFor()` from T002)
- **User Stories (Phase 3–5)**: All depend on Foundational completion. US1 and US2 touch disjoint
  files except where noted (T007/T016 and T008/T017 share a file — sequential within those pairs,
  but US1 and US2 as a whole can still proceed in parallel by different people). US3's test (T019)
  additionally depends on US2's two new actions (T013, T015) existing to test against.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- US1: each field's `page.tsx` task before its matching `*-client.tsx` task (signed URL must exist
  before the client can render it)
- US2: `actions.ts` tasks (T013, T015) before the client-wiring tasks that call them (T014, T017);
  T016 (page.tsx attachment fetch) before T017 (client rendering)
- US3: fixture extension (T018) before the test that uses it (T019)

### Parallel Opportunities

- Foundational: T002 is a single task (nothing to parallelize yet)
- US1: T003, T005, T007, T009, T011, T012 can all run in parallel (six different files); each
  has one dependent client-rendering task that must follow it individually
- US2: T013 and T015 (the two new actions, different files) can run in parallel
- US1 and US2 can be staffed in parallel once Foundational (T002) is done, except for the two
  shared-file pairs noted above
- Polish: T020 and T022 can run in parallel; T021 (manual walkthrough) is best done once T020
  is clean

---

## Parallel Example: User Story 1

```bash
# Launch the four independent "generate signed URL" page tasks together:
Task: "Generate signed image_url for facilities in app/(backoffice)/facilities/page.tsx"
Task: "Generate signed banner_url for activities in app/(backoffice)/activities/page.tsx"
Task: "Generate signed banner_url for announcements in app/(backoffice)/announcements/page.tsx"
Task: "Generate signed logo_url for customization in app/(backoffice)/customization/page.tsx"

# Each is then followed individually by its own client-rendering task once its page.tsx lands.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (`trySignedUrlFor()`)
3. Complete Phase 3: User Story 1 (all images display correctly)
4. **STOP and VALIDATE**: run quickstart.md §1 manually
5. This alone fixes the most visible part of the bug (nothing uploaded through the app currently
   displays as an image anywhere)

### Incremental Delivery

1. Setup + Foundational → shared helper ready
2. Add US1 (images) → validate → the app no longer looks broken
3. Add US2 (documents) → validate → uploaded documents are actually retrievable
4. Add US3 (isolation test) → validate → the fix is proven not to have traded correctness for
   convenience
5. Phase 6: Polish, run full quickstart.md, ship

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- `[Story]` labels map every user-story-phase task back to spec.md for traceability
- This feature adds no new database migration, RLS policy, or dependency — every task is either a
  read-time rendering change or a new read-only server action, per plan.md's Constraints
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
