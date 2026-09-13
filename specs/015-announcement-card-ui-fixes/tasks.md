---
description: 'Task list template for feature implementation'
---

# Tasks: Announcement Card UI Fixes

**Input**: Design documents from `/specs/015-announcement-card-ui-fixes/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: Not requested, and none needed — plan.md's Technical Context explains why: no new
authorization or data-mutation branch is introduced (existing `createAnnouncement`/
`updateAnnouncement`/`addAttachment`/`togglePin` Server Actions and their guards are called exactly
as before, just from a different UI location, or with an additive return field). Verification is
`npm run typecheck`/`lint`/`build` staying clean plus quickstart.md's manual walkthrough.

**Organization**: Tasks are grouped by the two user stories in spec.md — US1 (P1, attach controls)
and US2 (P2, thumbtack icon). Both touch `app/(backoffice)/announcements/announcements-client.tsx`
but different, non-overlapping sections of it, so they are listed as sequential (not `[P]`) within
that file but do not block each other logically — US2 could be done first without breaking US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 or US2
- Every task includes its exact file path

## Path Conventions

Single Next.js project, existing structure. Files touched:

- `app/(backoffice)/announcements/actions.ts`
- `app/(backoffice)/announcements/announcements-client.tsx`
- `components/icons.tsx`
- `app/globals.css`

---

## Phase 1: Setup

**Purpose**: Confirm the baseline is intact before changing anything

- [x] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run build` are clean on the current branch before this feature's changes begin

**Checkpoint**: Baseline confirmed working; safe to start.

_(No Foundational phase — US1 and US2 are independent UI fixes to the same existing screen; neither
introduces shared infrastructure the other depends on.)_

---

## Phase 2: User Story 1 - Clean announcement cards in the list view (Priority: P1) 🎯 MVP

**Goal**: The file-picker input and "Adjuntar" button no longer appear on cards in the plain
list/preview view; they instead appear in the create/edit modal once an announcement id exists to
attach to (editing an existing one, or right after creating a new one), per
contracts/ui-contract.md sections 1–3.

**Independent Test**: Per quickstart.md scenarios 1–4 — with the modal closed, confirm no card
shows a file input/"Adjuntar" button while already-uploaded attachment chips still render and
open; then create a new announcement and confirm the attach section appears after saving; then
edit an existing announcement and confirm the same attach section appears there too; close the
modal in each case and confirm the controls disappear again from the list.

### Implementation for User Story 1

- [x] T002 [US1] In `app/(backoffice)/announcements/actions.ts`, add `export type CreateAnnouncementResult = { ok: true; id: string } | { ok: false; error: string };` and change `createAnnouncement`'s return type from `Promise<ActionResult>` to `Promise<CreateAnnouncementResult>`, returning `{ ok: true, id: data.id }` on success instead of `{ ok: true }` (per contracts/ui-contract.md section 2) — leave `updateAnnouncement`, `deleteAnnouncement`, `togglePin`, and `addAttachment` untouched
- [x] T003 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, remove the per-row `attachmentTargets: Record<string, File | null>` state and replace it with a single `const [attachFile, setAttachFile] = useState<File | null>(null);` scoped to the modal's current target (per data-model.md's Client-side state table)
- [x] T004 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, remove the file `<input type="file">` and "Adjuntar" `<button>` block (currently rendered unconditionally inside each row, around the existing attachments chips) from the row/card markup — keep the existing already-uploaded attachment chips (`att.file_name` buttons) exactly as they are, per contracts/ui-contract.md section 1 and FR-004
- [x] T005 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, add a new attach section (file `<input type="file">` + "Adjuntar" `<button>`, reusing `IconPaperclip` as today) inside the `<Modal>`, rendered only when `editingId !== null`, wired to the new `attachFile` state and calling `addAttachment(editingId, buildingId, fileFormData(attachFile)!)` on click (depends on T002, T003, T004)
- [x] T006 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, update `submit()` so that on a successful `createAnnouncement()` call it sets `editingId` to the returned `result.id` and does **not** close the modal (leaving the modal open in edit-like mode so the new attach section from T005 becomes visible), while the `updateAnnouncement()` branch keeps closing the modal on success exactly as today (per contracts/ui-contract.md section 3) (depends on T002)
- [x] T007 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, reset `attachFile` to `null` in `openCreate()` and `openEdit()` (mirroring how `bannerFile` is already reset there) so a stale file selection never carries over between modal openings (depends on T003)
- [x] T008 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, update the attach-upload handler so that after a successful `addAttachment` call it clears `attachFile` (via `setAttachFile(null)`) instead of the old per-row `attachmentTargets` update (depends on T005)

**Checkpoint**: At this point, User Story 1 is fully functional and independently testable — no
attach controls in the plain list view, and a working attach flow inside both create (post-save)
and edit.

---

## Phase 3: User Story 2 - Distinguishable pin icon and state (Priority: P2)

**Goal**: The pin toggle renders a thumbtack-style icon everywhere it appears, and a pinned
announcement's icon is shown in a visually distinct, highlighted style, per
contracts/ui-contract.md section 4.

**Independent Test**: Per quickstart.md scenario 5 — with one pinned and one unpinned
announcement visible, confirm both toggle buttons render a thumbtack shape (not the old map-marker
teardrop), confirm the pinned one is visually filled/highlighted (accent border, soft-accent
background, accent icon color) versus the unpinned one's neutral style, and confirm toggling
pin/unpin updates the style immediately.

### Implementation for User Story 2

- [x] T009 [P] [US2] In `components/icons.tsx`, replace `IconPin`'s inner `<path>`/`<circle>` with a thumbtack-style glyph (round/flat head with a short point beneath), keeping the same export name, signature, and `base(...)` wrapper call (per research.md Decision 3)
- [x] T010 [P] [US2] In `app/globals.css`, add a `.icon-btn.pinned` rule near the existing `.icon-btn`/`.icon-btn.danger` rules, setting `border-color: var(--color-accent)`, `background: var(--color-accent-soft)`, and `color: var(--color-accent)` (per research.md Decision 4 and contracts/ui-contract.md section 4)
- [x] T011 [US2] In `app/(backoffice)/announcements/announcements-client.tsx`, update the pin toggle `<button>`'s `className` to conditionally include `pinned` (e.g. ``className={`icon-btn${a.pinned ? ' pinned' : ''}`}``) alongside its existing `icon-btn` class, leaving its `aria-label`/`title` text unchanged (depends on T010)

**Checkpoint**: All user stories are now independently functional — US1's attach-control placement
and US2's icon/style changes coexist without touching each other's code paths.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T012 [P] Run `npm run typecheck && npm run lint && npm run build` and confirm all are clean with T002–T011 applied
- [x] T013 Run quickstart.md's manual validation steps (scenarios 1–5) and record results (requires a live browser session against a signed-in Building Administrator account — not performed in this environment; verified instead by static code trace, see completion report)

---

## Phase 5: Post-Implementation Adjustment (2026-09-13)

**Why**: Direct feedback after using the built flow — saving a new announcement must close the
create form immediately, like every other create action in this backoffice, instead of staying
open post-save in an edit-like "attach" mode (the behavior T006 originally introduced). This
supersedes research.md Decision 2 and revises spec.md FR-002; see contracts/ui-contract.md sections
1–3 for the updated contract.

- [X] T014 [US1] In `app/(backoffice)/announcements/actions.ts`, revert `createAnnouncement`'s return type from `Promise<CreateAnnouncementResult>` back to `Promise<ActionResult>`, remove the now-unused `CreateAnnouncementResult` type, and return `{ ok: true }` (no `id`) on success
- [X] T015 [US1] In `app/(backoffice)/announcements/announcements-client.tsx`, revert `submit()` to a single ternary call (`editingId ? updateAnnouncement(...) : createAnnouncement(...)`) that closes the modal (`setModalOpen(false)`) on success for both branches, removing the `setEditingId(result.id)` post-create branch from T006
- [X] T016 [P] Update spec.md (FR-002, User Story 1 scenario 3, SC-002, Assumptions), research.md (Decision 2, marked superseded), data-model.md (`editingId` state row), contracts/ui-contract.md (sections 1–3), and quickstart.md (scenario 2) to describe the new create-closes-immediately behavior instead of the reverted "stay open to attach" flow
- [X] T017 [P] Run `npm run typecheck && npm run lint && npm run build` and confirm all are clean with T014–T015 applied

**Checkpoint**: Creating an announcement now behaves identically to every other create flow in the
backoffice (saves and closes); attaching a file to a brand-new announcement is a deliberate second
step via "Editar", not part of the create form itself.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **User Story 1 (Phase 2)**: Depends on Setup
- **User Story 2 (Phase 3)**: Depends on Setup — independent of User Story 1's changes (different
  sections of the same file; can be done before, after, or interleaved with Phase 2)
- **Polish (Phase 4)**: Depends on both User Story 1 and User Story 2 being complete

### Within User Story 1

- T002 (action return type) before T005 and T006, which consume `result.id`
- T003 (new state) before T004, T005, T007, T008, which reference `attachFile`/remove
  `attachmentTargets`
- T004 before T005 (remove the old control before adding the new one, to avoid a moment with two
  attach UIs)
- T005 before T008 (the upload handler T008 modifies lives inside/alongside the section T005 adds)

### Within User Story 2

- T009 and T010 are independent of each other (different files: `components/icons.tsx` vs.
  `app/globals.css`) — both can run in parallel
- T011 depends on T010 (the `pinned` class must exist before it's applied); T011 does not depend on
  T009 (the icon swap and the class application are independent edits, though both are needed for
  the full visual effect)

### Parallel Opportunities

- T009 and T010 (`[P]`) — different files, no shared state
- Phase 2 (US1) and Phase 3 (US2) can be worked in parallel by two people, since they touch
  different, non-overlapping regions of `announcements-client.tsx` plus entirely separate files
  (`actions.ts` for US1; `icons.tsx`/`globals.css` for US2) — only final integration in
  `announcements-client.tsx` (T011 vs. T003–T008) needs a quick merge check since it's the same
  file
- T012 (automated) and T013 (manual) in Polish are independent of each other

---

## Parallel Example: User Story 2

```bash
# Launch both independent US2 edits together:
Task: "Replace IconPin's glyph with a thumbtack shape in components/icons.tsx"
Task: "Add .icon-btn.pinned rule in app/globals.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1 (attach controls hidden from preview, moved into create/edit)
3. **STOP and VALIDATE**: Run quickstart.md scenarios 1–4 independently
4. Ship if ready — this alone resolves the main complaint in the feature request

### Incremental Delivery

1. Complete Setup → baseline confirmed
2. Add User Story 1 → validate independently → ship (MVP)
3. Add User Story 2 → validate independently → ship
4. Polish (typecheck/lint/build + full quickstart pass) once both stories are in

### Parallel Team Strategy

With two developers: one takes Phase 2 (US1: `actions.ts` + the attach-control half of
`announcements-client.tsx`), the other takes Phase 3 (US2: `icons.tsx` + `globals.css` + the pin
toggle's `className`) — both merge into `announcements-client.tsx` with minimal overlap (T011 is a
one-line `className` change against the same button T003–T008 don't touch).
