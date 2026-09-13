---

description: "Task list for Button-Beside-Input Sizing"
---

# Tasks: Button-Beside-Input Sizing

**Input**: Design documents from `/specs/014-button-input-alignment/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/btn-inline-contract.md](./contracts/btn-inline-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested for this feature. Per plan.md's Constitution Check, this is a CSS-only visual fix — no authorization or core-CRUD-workflow behavior changes, so Principle III's test-first mandate does not apply. Verification is the manual walkthrough in quickstart.md.

**Organization**: Tasks are grouped by user story (P1/P2 from spec.md). Both stories style the same new `.btn-inline` class, so US2 extends the rule US1 creates rather than being built from a clean slate — this is called out explicitly below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 or US2 (maps to spec.md's User Stories)
- Exact file paths are included in every task

---

## Phase 1: Setup

*Not applicable to this feature.* No dependency, tooling, or environment setup is needed — this is a pure CSS/JSX edit in an already-running project.

## Phase 2: Foundational

*Not applicable to this feature.* There is no shared prerequisite beyond what User Story 1 itself creates (the `.btn-inline` class) — and per the note above, User Story 2 explicitly builds on that class rather than needing separate foundational work.

---

## Phase 3: User Story 1 - Button height matches the input beside it (Priority: P1) 🎯 MVP

**Goal**: Finance's "Guardar" button and Maintenance's "Crear" button render at the same height as the input/select field beside them.

**Independent Test**: Open Finance's apartment-fee row and Maintenance's new-task row; confirm the button's height visually (and via devtools computed style) matches the field(s) beside it (quickstart.md Scenarios 1–2, height checks only).

- [X] T001 [US1] Add `--control-height: 40px;` to the `:root` block in `app/globals.css` (alongside the existing `--radius`/`--radius-sm` custom properties, per data-model.md)
- [X] T002 [US1] Add a new `.btn-inline` rule to the `/* ---------- Buttons ---------- */` section of `app/globals.css`, setting `height: var(--control-height);` (depends on T001 — same file, same custom property)
- [X] T003 [P] [US1] In `app/(backoffice)/finance/finance-client.tsx`, change the "Guardar" button's `className="btn"` (apartment-fee row) to `className="btn btn-inline"` (depends on T002)
- [X] T004 [P] [US1] In `app/(backoffice)/maintenance/maintenance-client.tsx`, change the "Crear" button's `className="btn"` (new-task row) to `className="btn btn-inline"` (depends on T002)

**Checkpoint**: User Story 1 is fully functional and independently testable — both buttons now match their adjacent field's height. Shippable on its own per quickstart.md Scenarios 1–2 (height only).

---

## Phase 4: User Story 2 - Buttons beside an input have a consistent, contained width (Priority: P2)

**Goal**: The same two buttons (and any future button given `.btn-inline` per the contract) are capped at 150px wide with centered label text.

**Independent Test**: Inspect the same two buttons; confirm neither exceeds 150px wide and each label is horizontally centered (quickstart.md Scenarios 1–2, width/centering checks).

- [X] T005 [US2] Extend the `.btn-inline` rule added in T002 (`app/globals.css`) with `max-width: 150px;` and `justify-content: center;` (research.md Decision 3 — a cap, not a fixed width; no change needed at the two JSX call sites, since T003/T004 already applied the class)

**Checkpoint**: Both user stories now work together — height match, width cap, and centered text all apply to Finance's "Guardar" and Maintenance's "Crear".

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Confirm no regression outside the two targeted buttons.

- [X] T006 Run `grep -rn "btn-inline" app/` from the repo root and confirm exactly two JSX call sites (T003, T004) plus the one CSS definition (T002/T005) — no unintended extra matches
- [X] T007 Walk through [quickstart.md](./quickstart.md) Scenario 3 manually: confirm Finance's "Descargar plantilla CSV" button, a sample of standalone save/create buttons on other screens (e.g. Facilities, Announcements, Users), and the login screen's submit button are all pixel-identical to their pre-change appearance (spec FR-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational**: N/A for this feature (see above).
- **User Story 1 (Phase 3)**: No dependency on US2.
- **User Story 2 (Phase 4)**: Depends on User Story 1 — it extends the `.btn-inline` rule T002 creates, and relies on T003/T004 having already applied the class at both call sites. It does not require any new JSX change of its own.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within User Story 1

T001 → T002 (same file, T002 references the custom property T001 defines) → T003 and T004 (parallel, different files, both just need the class to exist).

### Parallel Opportunities

- T003 and T004 (different files) can run in parallel once T002 is done.
- T006 and T007 (Polish) can run in parallel — different verification methods, no file conflicts.

---

## Parallel Example: User Story 1

```bash
# After T001 and T002 (app/globals.css) are done:
Task: "Add btn-inline to the Guardar button's className in app/(backoffice)/finance/finance-client.tsx"
Task: "Add btn-inline to the Crear button's className in app/(backoffice)/maintenance/maintenance-client.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (T001–T004).
2. **STOP and VALIDATE**: Both buttons' height now matches their adjacent field — the core reported problem is fixed and shippable on its own.
3. Deploy/demo if ready.

### Incremental Delivery

1. User Story 1 → validate → ship (height fix, the MVP).
2. User Story 2 → validate → ship (width cap + centered text, a refinement on the same class).
3. Polish → confirm zero regression elsewhere (grep + visual spot-check).

## Notes

- Total scope: 2 files (`app/globals.css`, plus one `className` line each in `finance-client.tsx` and `maintenance-client.tsx`).
- No new component, dependency, route, or test infrastructure is introduced.
