---

description: "Task list for Error Message Language Consistency"
---

# Tasks: Error Message Language Consistency

**Input**: Design documents from `/specs/013-error-message-language/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/error-message-contract.md](./contracts/error-message-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Not requested for this feature. Per research.md Decision 4, no new automated tests are needed — existing integration tests assert on `{ ok, error }` shape and business outcomes, not on the literal error string's language, and none of this feature's edits change control flow, authorization, or data access.

**Organization**: Tasks are grouped by user story (P1/P2/P3 from spec.md). Every task translates message text only — no validation rule, business check, authorization decision, or query changes in any task below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, or US3 (maps to spec.md's User Stories)
- Exact file paths are included in every task

## Important cross-cutting note (read before starting)

The audit for this feature (research.md) found that **every** `app/(backoffice)/**/actions.ts` file defines its own local `requireBuildingAdmin()`/`requireAppAdmin()`/similar guard function containing `throw new Error('Not authorized')`. This is a duplicated-per-file pattern (not a shared import) predating this feature, and this feature does not refactor that duplication (Principle V — no unrequested architecture change) — it only translates the string. To avoid 20 near-duplicate one-line tasks, **each US2 file task below also includes translating that file's local `throw new Error('Not authorized')` to `throw new Error('No autorizado.')`** as a small bundled addition (every file with this throw already has a US2 task for its `.message` passthroughs). This is called out explicitly in each affected task.

---

## Phase 1: Setup

**Purpose**: Establish the audit baseline this feature's completion is measured against (research.md Decision 4).

- [X] T001 Run the three grep patterns from [contracts/error-message-contract.md](./contracts/error-message-contract.md)'s Verification section from the repo root and record the current match counts (expected, per research.md: ~30 hardcoded literals, ~90 `.message`/compound passthroughs, ~30 Zod messages) as the before-snapshot to compare against the Polish phase's final audit.

---

## Phase 2: Foundational

*Not applicable to this feature.* No single prerequisite blocks all three user stories: US1 (hardcoded literal translation) and US3 (permission/not-found literal translation) need no shared infrastructure, and US2's only prerequisite (`lib/errors.ts`) is specific to that story alone — it is created as US2's first task below, not here, so that US1 and US3 remain independently completable without it.

---

## Phase 3: User Story 1 - Everyday action errors match the interface language (Priority: P1) 🎯 MVP

**Goal**: Every hardcoded English business-rule and form-validation message becomes Spanish, with no change to the underlying check.

**Independent Test**: Trigger a duplicate-unit error in Apartamentos, or leave a required field blank in any create form, and confirm the message is in Spanish (quickstart.md Scenario 1).

### Validation messages (`lib/validation/*.ts`)

- [X] T002 [P] [US1] Translate custom Zod messages in `lib/validation/activities.ts` to Spanish: `'Title is required'` → e.g. "El título es obligatorio.", `'Date is required'` → "La fecha es obligatoria."
- [X] T003 [P] [US1] Translate custom Zod messages in `lib/validation/announcements.ts` to Spanish: `'Title is required'` → "El título es obligatorio."
- [X] T004 [P] [US1] Translate custom Zod messages in `lib/validation/apartments.ts` to Spanish: `'Unit number is required'`, `'A valid email is required'`, `'An apartment must be selected'`, `'First name cannot be blank'`, `'Last name cannot be blank'`, `'Document ID cannot be blank'`, `'Provide at least one field to update'`
- [X] T005 [P] [US1] Translate custom Zod messages in `lib/validation/broadcast.ts` to Spanish: `'A message is required'` (3 occurrences)
- [X] T006 [P] [US1] Translate custom Zod messages in `lib/validation/buildings.ts` to Spanish: `'Name is required'` (2 occurrences), `'A valid email is required'`, `'First name is required'`, `'Last name is required'`, `'Document ID is required'`, `'Password must be at least 8 characters'`
- [X] T007 [P] [US1] Translate custom Zod messages in `lib/validation/documentation.ts` to Spanish: `'Name is required'`
- [X] T008 [P] [US1] Translate custom Zod messages in `lib/validation/facilities.ts` to Spanish: `'Name is required'`
- [X] T009 [P] [US1] Translate custom Zod messages in `lib/validation/maintenance.ts` to Spanish: `'A name is required'`, `'A date is required'` (2 occurrences)
- [X] T010 [P] [US1] Translate custom Zod messages in `lib/validation/packages.ts` to Spanish: `'A description is required'`
- [X] T011 [P] [US1] Translate custom Zod messages in `lib/validation/polls.ts` to Spanish: `'A title is required'`, `'At least one answer option is required'`, `'A closing date is required'`
- [X] T012 [P] [US1] Translate custom Zod messages in `lib/validation/tickets.ts` to Spanish: `'A rejection reason is required'`, `'A ticket cannot be marked as a duplicate of itself'`, `'Comment cannot be empty'`
- [X] T013 [P] [US1] Translate custom Zod messages in `lib/validation/users.ts` to Spanish: `'A valid email is required'`, `'First name is required'`, `'Last name is required'`, `'Document ID is required'`, `'An apartment must be selected'`, `'Password must be at least 8 characters'`
- [X] T014 [P] [US1] Audit `lib/validation/customization.ts`, `lib/validation/emergency.ts`, and `lib/validation/finance.ts` for any English custom Zod messages (none matched the initial grep, but confirm) and translate any found to Spanish

### Business-rule messages (`lib/user-provisioning.ts`, `app/(backoffice)/**/actions.ts`)

- [X] T015 [P] [US1] Translate hardcoded English messages in `lib/user-provisioning.ts` to Spanish: `'An apartment must be selected for this account.'`, `'That apartment was not found in this building.'`, `'An account with this email already exists.'`
- [X] T016 [P] [US1] Translate hardcoded English messages in `app/(backoffice)/apartments/actions.ts` to Spanish: `'This unit already exists in this building.'` (2 occurrences), `'Cannot delete an apartment that still has residents assigned to it.'`
- [X] T017 [P] [US1] Translate hardcoded English messages in `app/(backoffice)/broadcast/actions.ts` to Spanish: `'Staff broadcast permission is not enabled for this building.'` (2 occurrences), `'This broadcast is no longer active.'`
- [X] T018 [P] [US1] Translate hardcoded English messages in `app/(backoffice)/incidencias/actions.ts` to Spanish: `'This ticket is no longer pending.'`, `'Only a ticket that is In Progress can be resolved.'`, `'A ticket can only be marked duplicate of a Pending or In Progress ticket.'`, `'Comments can only be added while the ticket is In Progress.'`
- [X] T019 [P] [US1] Translate hardcoded English message in `app/(backoffice)/emergency/actions.ts` to Spanish: `'This emergency was already handled.'`
- [X] T020 [P] [US1] Translate hardcoded English message in `app/(backoffice)/visitors/actions.ts` to Spanish: `'This visitor is no longer pending.'`
- [X] T021 [P] [US1] Translate hardcoded English message in `app/(backoffice)/finance/actions.ts` to Spanish: `'This payment can no longer be approved.'`
- [X] T022 [P] [US1] Translate hardcoded English messages in `app/(backoffice)/maintenance/actions.ts` to Spanish: `'A photo is required to mark this task done.'`, `'Could not advance the task schedule.'`
- [X] T023 [P] [US1] Translate hardcoded English message in `app/(backoffice)/packages/actions.ts` to Spanish: `'This package is no longer pending.'`
- [X] T024 [P] [US1] Translate hardcoded English message in `app/(backoffice)/reservations/actions.ts` to Spanish: `'This reservation is no longer pending.'` (2 occurrences)
- [X] T025 [P] [US1] Translate hardcoded English message in `app/(backoffice)/announcements/actions.ts` to Spanish: `'No file selected'` (line ~171; do not touch this file's `'Not authorized'`/`'Attachment not found'`/`'Could not open this attachment'`, handled in T047)
- [X] T026 [P] [US1] Translate hardcoded English message in `app/(backoffice)/documentation/actions.ts` to Spanish: `'No file selected'` (line ~133; do not touch this file's `'Document not found'`/`'Could not open this document'`, handled in T048)

**Checkpoint**: User Story 1 is fully functional and independently testable — every everyday business-rule and validation error now reads in Spanish.

---

## Phase 4: User Story 2 - Unexpected or technical failures still read in Spanish (Priority: P2)

**Goal**: No raw Postgres/Storage/Auth error text, and no Zod-fallback English text, ever reaches the user — replaced by a Spanish generic message via a shared helper.

**Independent Test**: Review any `actions.ts` file below and confirm every `.message` forward now routes through `toFriendlyMessage()`, and every `?? 'Invalid input'` Zod fallback now reads in Spanish (quickstart.md Scenario 2).

- [X] T027 [US2] Create `lib/errors.ts` exporting `toFriendlyMessage(error: unknown, fallback: string): string` per [data-model.md](./data-model.md): logs `error` via `console.error` and always returns `fallback`, per research.md Decision 2

> All tasks below depend on T027 and each edit a different file, so they may run in parallel with each other once T027 is complete.

- [X] T028 [P] [US2] In `app/(backoffice)/visitors/actions.ts`: wrap the `error.message` passthrough (line ~27) with `toFriendlyMessage(error, '<Spanish fallback>')`; translate that file's `throw new Error('Not authorized')` (line ~18) to `throw new Error('No autorizado.')`
- [X] T029 [P] [US2] In `app/(backoffice)/incidencias/actions.ts`: wrap all `.message` passthroughs (lines ~40, 75, 103, 145, 182) with `toFriendlyMessage()`; restructure the compound `fetchError?.message ?? 'Ticket not found'` / `'Target ticket not found'` (lines ~69, 136) into a not-found check (translated directly, e.g. "Ticket no encontrado.") plus a `toFriendlyMessage()`-wrapped error check; replace `?? 'Invalid input'` (lines ~94, 126, 164) with a Spanish fallback (e.g. "Datos inválidos. Revisa el formulario."); translate `throw new Error('Not authorized')` (line ~25) to Spanish
- [X] T030 [P] [US2] In `app/(backoffice)/facilities/actions.ts`: wrap `.message` passthroughs (lines ~56, 101, 132) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~29, 79) with a Spanish fallback; replace `e instanceof Error ? e.message : 'Image upload failed'` (lines ~46, 96) with `toFriendlyMessage(e, 'No se pudo subir la imagen.')`; translate `throw new Error('Not authorized')` (line ~17) to Spanish
- [X] T031 [P] [US2] In `app/(backoffice)/packages/actions.ts`: wrap the `.message` passthrough (line ~105) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (line ~32) with a Spanish fallback; replace `e instanceof Error ? e.message : 'Photo upload failed'` (line ~49) with `toFriendlyMessage(e, 'No se pudo subir la foto.')`; replace `error?.message ?? 'Could not register package'` (line ~65) with `toFriendlyMessage(error, 'No se pudo registrar el paquete.')`; translate `throw new Error('Not authorized')` (line ~16) to Spanish
- [X] T032 [P] [US2] In `app/(backoffice)/broadcast/actions.ts`: wrap `.message`/compound passthroughs (lines ~84, 121, 153, 178, 200, 228) with `toFriendlyMessage()` and Spanish fallbacks (e.g. `'Could not send broadcast'` → "No se pudo enviar el aviso.", `'Could not save template'` → "No se pudo guardar la plantilla."); replace `?? 'Invalid input'` (lines ~47, 139, 169, 220) with a Spanish fallback; translate both `throw new Error('Not authorized')` occurrences (lines ~24, 34) to Spanish
- [X] T033 [P] [US2] In `app/(backoffice)/documentation/actions.ts`: wrap `.message` passthroughs (lines ~42, 65, 110, 162, 186) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (line ~32) with a Spanish fallback; replace `e instanceof Error ? e.message : 'Upload failed'` (line ~145) with `toFriendlyMessage(e, 'No se pudo subir el archivo.')`; translate `throw new Error('Not authorized')` (line ~25) to Spanish
- [X] T034 [P] [US2] In `app/(backoffice)/users/actions.ts`: wrap `.message` passthroughs (lines ~114, 140, 165) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~47, 106) with a Spanish fallback; translate `throw new Error('Not authorized')` (line ~21) to Spanish (this file's separate standalone `'Not authorized'` return at line ~51 is handled in T047)
- [X] T035 [P] [US2] In `app/(backoffice)/announcements/actions.ts`: wrap `.message` passthroughs (lines ~60, 103, 125, 148, 198) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~34, 82) with a Spanish fallback; replace `e instanceof Error ? e.message : 'Banner upload failed'` (lines ~50, 98) and `'Attachment upload failed'` (line ~183) with `toFriendlyMessage(e, ...)` and a Spanish fallback; translate `throw new Error('Not authorized')` (line ~23) to Spanish (this file's separate standalone `'Not authorized'`/`'Attachment not found'`/`'Could not open this attachment'` are handled in T047)
- [X] T036 [P] [US2] In `app/(backoffice)/polls/actions.ts`: wrap `.message` passthroughs (line ~50) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (line ~28) with a Spanish fallback; replace `error?.message ?? 'Could not create poll'` (line ~45) with `toFriendlyMessage(error, 'No se pudo crear la encuesta.')`; translate `throw new Error('Not authorized')` (line ~16) to Spanish
- [X] T037 [P] [US2] In `app/(backoffice)/maintenance/actions.ts`: wrap `.message` passthroughs (lines ~90, 153, 160) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~44, 81, 118) with a Spanish fallback; replace `error?.message ?? 'Could not create task'` (line ~60) and `e instanceof Error ? e.message : 'Photo upload failed'` (line ~144) with `toFriendlyMessage()` calls and Spanish fallbacks; translate both `throw new Error('Not authorized')` occurrences (lines ~24, 33) to Spanish
- [X] T038 [P] [US2] In `app/(backoffice)/apartments/actions.ts`: wrap `.message` passthroughs (lines ~41, 78, 115) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~26, 64) with a Spanish fallback; translate `throw new Error('Not authorized')` (line ~15) to Spanish
- [X] T039 [P] [US2] In `app/(backoffice)/customization/actions.ts`: wrap the `.message` passthrough (line ~57) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (line ~25) with a Spanish fallback; replace `e instanceof Error ? e.message : 'Logo upload failed'` (line ~52) with `toFriendlyMessage(e, 'No se pudo subir el logo.')`; translate `throw new Error('Not authorized')` (line ~30) to Spanish
- [X] T040 [P] [US2] In `app/(backoffice)/suggestions-complaints/actions.ts`: wrap both `.message` passthroughs (lines ~28, 56) with `toFriendlyMessage()`; translate `throw new Error('Not authorized')` (line ~14) to Spanish
- [X] T041 [P] [US2] In `app/(backoffice)/emergency/actions.ts`: wrap the `.message` passthrough (line ~43) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (line ~32) with a Spanish fallback; translate `throw new Error('Not authorized')` (line ~16) to Spanish
- [X] T042 [P] [US2] In `app/(backoffice)/finance/actions.ts`: wrap `.message` passthroughs (lines ~46, 103, 157, 207) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~37, 139, 194) with a Spanish fallback and `?? 'Invalid row'` (line ~89) similarly; restructure `fetchError?.message ?? 'Payment not found'` (line ~148) into a not-found check ("Pago no encontrado.") plus a `toFriendlyMessage()`-wrapped error check; translate `throw new Error('Not authorized')` (line ~26) to Spanish
- [X] T043 [P] [US2] In `app/(backoffice)/reservations/actions.ts`: wrap both `.message` passthroughs (lines ~32, 60) with `toFriendlyMessage()`; translate `throw new Error('Not authorized')` (line ~14) to Spanish
- [X] T044 [P] [US2] In `app/(backoffice)/users/buildings-actions.ts`: wrap `.message` passthroughs (lines ~61, 190, 237) with `toFriendlyMessage()`; replace `?? 'Invalid input'` (lines ~66, 97, 163) with a Spanish fallback; replace `insertError?.message ?? 'Could not create the building.'` (line ~107) with `toFriendlyMessage(insertError, 'No se pudo crear el edificio.')`; replace `e instanceof Error ? e.message : 'Logo upload failed'` (line ~185) with `toFriendlyMessage(e, 'No se pudo subir el logo.')`; translate `throw new Error('Not authorized')` (line ~29) to Spanish
- [X] T045 [P] [US2] In `app/(backoffice)/activities/actions.ts`: update `translateCheckViolation()` (line ~22) to (a) return a Spanish message for the known `activities_max_participants_check` case and (b) call `toFriendlyMessage(error, 'No se pudo guardar la actividad.')` instead of returning the raw `message` unchanged for any other case; update its two call sites (lines ~61, 104) to pass the full `error` object rather than `error.message`; translate `throw new Error('Not authorized')` (line ~17) to Spanish
- [X] T046 [P] [US2] In `app/(backoffice)/visitors/staff-actions.ts`: translate `throw new Error('Not authorized')` (line ~17) to Spanish (this file's separate standalone `'Not authorized'` return at line ~39 is handled in T047)

**Checkpoint**: User Stories 1 AND 2 both work independently — no raw technical error text or English fallback reaches the user.

---

## Phase 5: User Story 3 - Permission and "not found" errors match the interface language (Priority: P3)

**Goal**: Standalone (non-passthrough) permission-rejection and record-not-found messages read in Spanish.

**Independent Test**: Attempt an action without the right role, or open an attachment/document that no longer exists, and confirm the message is in Spanish (quickstart.md Scenario 3).

- [X] T047 [P] [US3] Translate standalone hardcoded messages in `app/(backoffice)/announcements/actions.ts` to Spanish: `'Not authorized'` (line ~224), `'Attachment not found'` (line ~232), `'Could not open this attachment'` (line ~235)
- [X] T048 [P] [US3] Translate standalone hardcoded messages in `app/(backoffice)/documentation/actions.ts` to Spanish: `'Document not found'` (line ~216), `'Could not open this document'` (line ~219)
- [X] T049 [P] [US3] Translate standalone hardcoded message in `app/(backoffice)/users/actions.ts` to Spanish: `'Not authorized'` (line ~51)
- [X] T050 [P] [US3] Translate standalone hardcoded message in `app/(backoffice)/visitors/staff-actions.ts` to Spanish: `'Not authorized'` (line ~39)

**Checkpoint**: All three user stories are independently functional — every category of error (business-rule, unanticipated/technical, permission/not-found) reads in Spanish.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm full-repo compliance and no regressions.

- [X] T051 Re-run the three grep patterns from [contracts/error-message-contract.md](./contracts/error-message-contract.md) across the repo and confirm zero remaining matches (SC-001, SC-002); compare against T001's baseline
- [X] T052 Walk through every scenario in [quickstart.md](./quickstart.md) (Scenarios 1–4) manually and confirm each error message shown is in Spanish
- [X] T053 Run the existing integration suite subset that exercises the touched actions (e.g. `npx vitest run tests/integration/rls-tickets.test.ts` and any other suites covering apartments/finance/incidencias/maintenance business rules) and confirm all still pass — these assert on `{ ok, error }` shape and outcomes, not string language, so no failures are expected from this feature's edits
- [X] T054 Read through every file touched in Phases 3–5 once more to confirm no validation rule, business check, authorization decision, or query changed — only message text (plan.md Constraints)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: N/A for this feature.
- **User Story 1 (Phase 3)**: Depends only on Setup. No dependency on US2 or US3.
- **User Story 2 (Phase 4)**: Depends only on Setup (T027 must complete before T028–T046). No dependency on US1 or US3.
- **User Story 3 (Phase 5)**: Depends only on Setup. No dependency on US1 or US2.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Recommended order despite independence

Although each story is independently testable, several files receive tasks from more than one phase (e.g. `announcements/actions.ts` appears in T025, T035, and T047). Running the phases in priority order (Setup → US1 → US2 → US3 → Polish) — rather than fully in parallel — avoids two tasks editing the same file at the same time. Within a phase, all `[P]`-marked tasks touch different files and can run concurrently.

### Within User Story 2

T027 (create `lib/errors.ts`) MUST complete before any of T028–T046, since every one of those tasks calls `toFriendlyMessage()`.

---

## Implementation Notes (post-completion)

All 54 tasks are complete. While editing each file end-to-end (reading the whole file rather than only the lines a task named), a few additional English strings surfaced that this list's line-number estimates didn't originally call out — fixed in the same pass, under the task already covering that file, so no task count changed:

- `finance/actions.ts` (T021/T042): `'apartment not found in this building'` and `'No rows updated'` inside `bulkSetFees()`'s per-row error handling.
- `customization/actions.ts` (T039) and `users/buildings-actions.ts` (T044): a template-literal `` `Logo must be square (got ${w}×${h}).` `` message, missed by the plain-string grep patterns.
- `visitors/staff-actions.ts` (T046): two `.message` passthroughs (`deleteStaff`, `cancelStaffInvitation`) and one Zod `?? 'Invalid input'` fallback (`createStaff`) that the original file-scoped task description under-specified.
- **New, not in the original file inventory**: `app/(backoffice)/finance/template/route.ts` — a Route Handler (not an `actions.ts` Server Action, so it fell outside every original grep pattern) returning `new Response('Not authorized', { status: 403 })`. Translated to `'No autorizado.'`.

Final verification (Polish phase, T051): re-ran all three contract grep patterns plus a broader sweep (`e instanceof Error ? e.message :`, case-insensitive `'Invalid input'|'not found'|'Could not'|...`) across `app/`, `lib/`, confirming zero remaining matches anywhere in application source (test files excluded, per spec Assumptions). T053's integration-test run found one pre-existing failure (`rls-tickets.test.ts`'s "allows marking a ticket duplicate" case, a `42501` RLS rejection) — confirmed via `git stash` to fail identically on the pre-feature codebase, unrelated to this feature's message-text-only changes.

---

## Parallel Example: User Story 1

```bash
# After T001 (Setup), launch validation-file translations together:
Task: "Translate custom Zod messages in lib/validation/activities.ts to Spanish"
Task: "Translate custom Zod messages in lib/validation/broadcast.ts to Spanish"
Task: "Translate custom Zod messages in lib/validation/polls.ts to Spanish"
# ...and so on for T002–T026, all independent files
```

## Parallel Example: User Story 2

```bash
# After T027 (create lib/errors.ts) completes:
Task: "Wrap error.message passthroughs in app/(backoffice)/visitors/actions.ts with toFriendlyMessage()"
Task: "Wrap error.message passthroughs in app/(backoffice)/finance/actions.ts with toFriendlyMessage()"
Task: "Wrap error.message passthroughs in app/(backoffice)/apartments/actions.ts with toFriendlyMessage()"
# ...and so on for T028–T046, all independent files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 3: User Story 1 (T002–T026).
3. **STOP and VALIDATE**: Run quickstart.md Scenario 1 — every everyday business-rule/validation error should now be in Spanish. This alone resolves the majority of the reported problem (research.md: the largest single category, ~60 of ~150 total occurrences).
4. Deploy/demo if ready.

### Incremental Delivery

1. Setup → Foundation confirmed not needed.
2. Add User Story 1 → validate → this is already a meaningful, shippable improvement (MVP).
3. Add User Story 2 → validate → closes the raw-technical-error leak.
4. Add User Story 3 → validate → closes the remaining permission/not-found gaps.
5. Polish → full-repo audit confirms SC-001/SC-002 (100% Spanish, no mixed-language screens).

### Parallel Team Strategy

Each user story's tasks are almost entirely `[P]` (different files) and independent of the other two stories — three people could take US1, US2, and US3 simultaneously after Setup, respecting the "same file, different phase" caution above (coordinate before editing a file more than one phase touches, e.g. `announcements/actions.ts`, `documentation/actions.ts`, `users/actions.ts`, `visitors/staff-actions.ts`, `emergency/actions.ts`).
