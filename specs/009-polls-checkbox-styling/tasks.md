---

description: "Task list template for feature implementation"
---

# Tasks: Polls Checkbox Styling

**Input**: Design documents from `/specs/009-polls-checkbox-styling/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: Not requested, and none needed — plan.md's Technical Context explains why: `Toggle`'s
`checked`/`onChange` contract is identical to a native checkbox's from the caller's point of view,
so there is no new logic branch to cover. Verification is `npm run typecheck`/`lint`/`build`
staying clean plus quickstart.md's manual check.

**Organization**: This feature has one user story (spec.md has a single P1) — the entire scope is
a one-file visual swap.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (the only story)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, existing structure — no new files, one file modified:
`app/(backoffice)/polls/polls-client.tsx`.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline is intact before changing anything

- [X] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run build` are clean on the current branch before this feature's change begins

**Checkpoint**: Baseline confirmed working; safe to start.

*(No Foundational phase — nothing here blocks or is shared infrastructure for a two-control, one-file swap.)*

---

## Phase 2: User Story 1 - Consistent on/off controls when creating a poll (Priority: P1) 🎯 MVP

**Goal**: Both boolean poll-creation options render and behave as the app's standard toggle
switch, matching contracts/ui-contract.md's mapping exactly.

**Independent Test**: Per quickstart.md — open `/polls`, confirm both controls render as pill
toggles (not checkboxes), toggle each on/off by mouse and by keyboard, then create a poll with
each combination of the two settings and confirm the resulting `polls` row matches.

### Implementation for User Story 1

- [X] T002 [US1] Import `Toggle` from `@/components/Toggle` in `app/(backoffice)/polls/polls-client.tsx`
- [X] T003 [US1] Replace the "Permitir múltiples respuestas" native `<input type="checkbox">` with `<Toggle checked={form.allow_multiple} onChange={(allow_multiple) => setForm({ ...form, allow_multiple })} label="Permitir múltiples respuestas" />` in `app/(backoffice)/polls/polls-client.tsx`, per contracts/ui-contract.md's mapping table (depends on T002)
- [X] T004 [US1] Replace the "Anónima" native `<input type="checkbox">` with `<Toggle checked={form.anonymous} onChange={(anonymous) => setForm({ ...form, anonymous })} label="Anónima" />` in `app/(backoffice)/polls/polls-client.tsx`, per contracts/ui-contract.md's mapping table (depends on T002)

**Checkpoint**: Both controls visually and behaviorally match the app's existing toggle pattern;
`createPoll()` and the `polls` table are unaffected.

---

## Phase 3: Polish & Cross-Cutting Concerns

- [X] T005 [P] Run `npm run typecheck && npm run lint && npm run build` and confirm all are clean with T002–T004 applied
- [ ] T006 Run quickstart.md's manual validation steps and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **User Story 1 (Phase 2)**: Depends on Setup
- **Polish (Phase 3)**: Depends on User Story 1 being complete

### Within User Story 1

- T002 (import) before T003/T004 (both use `Toggle`)
- T003 and T004 touch the same file — not parallel, but independent of each other's content
  (order between them doesn't matter)

### Parallel Opportunities

- None within User Story 1 (single file, sequential edits)
- Polish: T005 is independent of T006 (one is automated, one is manual)

---

## Implementation Strategy

### MVP First (and Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1 (the entire feature)
3. **STOP and VALIDATE**: run quickstart.md's manual validation
4. This alone delivers 100% of this feature's scope

### Incremental Delivery

Not meaningfully separable — two controls in one form, one component swap. Ship as one unit.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- Commit after Phase 2 (the actual fix) and again after Phase 3 (verification)
