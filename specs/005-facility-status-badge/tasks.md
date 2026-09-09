---

description: "Task list template for feature implementation"
---

# Tasks: Single Facility Status Indicator

**Input**: Design documents from `/specs/005-facility-status-badge/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested. Per plan.md's Testing section, this is a display-only change to an
existing Client Component with no authorization surface — it doesn't meet Constitution Principle
III's trigger ("authorization rules... cross-building isolation"), matching the precedent set by
feature 004's own facilities-bubble story. Verified via `npm run typecheck`/`lint`/`build` plus a
manual quickstart.md walkthrough.

**Organization**: This feature has a single user story (spec.md P1), so there is one implementation
phase plus Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, same as every prior feature — `app/(backoffice)/facilities/`. No new
route, table, or dependency is introduced (plan.md's Project Structure).

---

## Phase 1: Setup

**Purpose**: N/A — no new dependency, environment variable, or project structure is needed. This
feature modifies one existing, already-building file. Skipped; proceed directly to the user story.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — no schema, RLS, Server Action, or shared infrastructure change is required
(plan.md's Constitution Check: all gates PASS/N-A). Skipped; the user story has no prerequisite
beyond the code already shipped in feature 004 (the `isFacilityOpen()` helper and `Badge`
component, both already in place).

---

## Phase 3: User Story 1 - One glance tells you if a facility is open (Priority: P1) 🎯 MVP

**Goal**: Every facility card shows exactly one status pill (green "Abierto" / red "Cerrado", using
the existing `Badge` component) in the position the "Reservable"/"No reservable" badge used to
occupy; the separate open/closed dot is removed; the reservable toggle in the footer is unaffected.

**Independent Test**: Per quickstart.md's User Story 1 section — open `/facilities`, confirm a
facility within its open hours shows one green "Abierto" pill and no dot, one outside its hours
shows one red "Cerrado" pill and no dot, both the photo and no-photo card layouts place the pill
where the old reservable badge was, and the footer's "Reservable" toggle still works.

### Implementation for User Story 1

*(No new automated test — see the Tests note at the top of this document.)*

- [X] T001 [US1] In `app/(backoffice)/facilities/facilities-client.tsx`, replace the image-overlay `Badge` (`<span className="tile-badge-overlay">` block showing `f.reservable ? 'Reservable' : 'No reservable'` with `tone={f.reservable ? 'success' : 'neutral'}`) with a `Badge` showing `open ? 'Abierto' : 'Cerrado'` and `tone={open ? 'success' : 'danger'}`, reusing the `open` value already computed by the existing `isFacilityOpen(f, buildingTimezone)` call in the `facilities.map()` body — do not add a second computation
- [X] T002 [US1] In the same file, replace the header-row `Badge` (the second occurrence, inside `{!f.image_signed_url && (...)}`, currently showing the same reservable label/tone) with the identical `open`-driven `Badge` as T001, so both the photo and no-photo layouts show the same single indicator in the same relative position
- [X] T003 [US1] In the same file, delete the absolutely-positioned status-dot `<span>` (the `title={open ? 'Abierto ahora' : 'Cerrado ahora'}` element with the inline `borderRadius: '50%'` styles) and its now-unnecessary wrapping `style={{ position: 'relative' }}` on the `.tile` div if nothing else on the card still needs relative positioning (re-check after T001/T002 — the `Badge` replacing the dot is positioned by the existing `tile-badge-overlay`/header-row layout, not by absolute placement, so the dot's positioning is no longer needed) (depends on T001, T002)
- [X] T004 [US1] Confirm the footer `Toggle` (`checked={f.reservable}`, `label="Reservable"`) and its `toggleReservable()` handler are untouched — no code change expected here, this is a verification-only step per spec.md FR-007/SC-003 (depends on T003)

**Checkpoint**: User Story 1 is fully functional — every facility card shows exactly one
open/closed pill, the dot is gone, and reservable remains controllable via the footer toggle.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verification that spans the (single) user story

- [X] T005 [P] Run `npm run typecheck && npm run lint && npm run build` and confirm all are clean with T001–T004 applied
- [X] T006 Run quickstart.md's full manual validation script (User Story 1 section plus the Cross-cutting checks — photo vs. no-photo layouts, footer toggle) and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — nothing to do
- **Foundational (Phase 2)**: Skipped — nothing to do
- **User Story 1 (Phase 3)**: No dependency beyond the code already in place from feature 004
- **Polish (Phase 4)**: Depends on User Story 1 being complete

### Within User Story 1

- T001 and T002 touch the same file but different, non-overlapping JSX blocks — either order works,
  but neither is marked [P] since both must land before T003 can safely remove the now-orphaned
  dot markup without leaving stale references
- T003 depends on T001, T002 (must confirm both badges are already `open`-driven before deleting
  the dot that previously carried that information)
- T004 is a verification step, last, confirming no regression

### Parallel Opportunities

- None within User Story 1 — T001–T004 are small, sequential edits to the same single file
  (`facilities-client.tsx`), which is itself the entire scope of this feature
- Polish: T005 and T006 can run in parallel with each other

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (the entire feature)
2. **STOP and VALIDATE**: run quickstart.md's User Story 1 section
3. This alone delivers 100% of this feature's scope (spec.md has only one user story)

### Incremental Delivery

Not applicable — this feature is a single, atomic UI consolidation with one user story. There is no
meaningful smaller increment than "both badges are now the open/closed pill and the dot is gone."

---

## Notes

- This is the smallest kind of feature this repo's workflow handles: one file, one story, no
  schema/RLS/test surface. Setup and Foundational phases are intentionally empty rather than
  padded with busywork, per Constitution Principle V.
- Commit after T001–T004 as one logical group (they're only meaningfully testable together).

## Implementation Notes (added post-implementation)

- **T006** was verified statically rather than via an interactive browser session (no
  browser-automation tool or real Building Administrator login was available in this
  environment): confirmed the resulting JSX has exactly one `open`-driven `Badge` per layout
  branch (image-overlay and header-row), confirmed the dot `<span>` and its `position: relative`
  wrapper are gone, confirmed the footer `Toggle`/`toggleReservable()` are byte-for-byte unchanged,
  and grepped the repo for any leftover "No reservable"/"Abierto ahora"/"Cerrado ahora" strings
  (none found). `isFacilityOpen()` itself — the source of the `open` boolean — is unchanged from
  feature 004 and was not re-verified here. Recommend a quick eyeball of `/facilities` in a real
  browser session the next time someone is signed in, to confirm the visual result matches
  expectations pixel-for-pixel, but the risk of this being wrong is low given the change is a pure
  label/tone swap with no new logic.
