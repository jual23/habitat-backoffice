# Implementation Plan: Announcement Card UI Fixes

**Branch**: `015-announcement-card-ui-fixes` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-announcement-card-ui-fixes/spec.md`

## Summary

`app/(backoffice)/announcements/announcements-client.tsx` currently renders a file-picker input and
an "Adjuntar" button unconditionally at the bottom of every announcement card in the list — the
read-only preview surface — because that is the only place in the module today with any UI for
adding an attachment (the create/edit modal has no attachment section at all). This plan moves that
file-picker/"Adjuntar" control out of the plain list view and into the create/edit modal, gated on
whether an announcement id exists to attach to (an existing announcement being edited, or a
just-created one), while leaving already-uploaded attachment chips visible in the list unchanged.
Separately, `components/icons.tsx`'s `IconPin` (a map/location teardrop marker) is replaced with a
thumbtack-style glyph, and the pinned state gets a distinct filled/accent treatment — reusing the
app's existing soft-accent "active" badge convention (`--color-accent` / `--color-accent-soft`,
already used for `.nav-item.active` and `.tab.active`) — instead of the current plain color-only
tint.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: None new — reuses the existing `Modal` component
(`components/Modal.tsx`), the existing `IconPin`/`IconPaperclip` glyphs in `components/icons.tsx`
(one edited in place, one reused as-is), and the existing `addAttachment` Server Action
(`app/(backoffice)/announcements/actions.ts`), which already accepts an announcement id.

**Storage**: N/A for schema/RLS — no new table, column, or policy. `addAttachment` already requires
an existing `announcements.id`, which is why the "creation" attach step needs the record to exist
first (see research.md).

**Testing**: No new automated test suite — this is a UI-surface and glyph/style change with no new
authorization or data-mutation branch (the existing `createAnnouncement`/`updateAnnouncement`/
`addAttachment` Server Actions and their guards are untouched). Verified by `npm run typecheck`,
`npm run lint`, and a manual walkthrough (quickstart.md) covering: no attach controls in the list
view, attach controls present and working during create and edit, and the thumbtack icon's two
visual states.

**Target Platform**: Web (existing Next.js backoffice), same page
(`app/(backoffice)/announcements`).

**Project Type**: Single Next.js application. One component file substantially edited
(`announcements-client.tsx`), one icon edited in place (`components/icons.tsx`), one stylesheet
edited (`app/globals.css`) to add a pinned-state modifier class. Zero new files, zero new routes.

**Performance Goals**: N/A — no measurable performance dimension; same number of DOM nodes moved
between two existing render locations.

**Constraints**: Per Constitution Principle V (Simplicity): no new attachment-upload abstraction,
no new modal, no new icon component library — reuse `Modal`, `addAttachment`, and the existing
`.icon-btn`/badge CSS conventions already in `app/globals.css`.

**Scale/Scope**: Two UI fixes, one existing screen, one existing modal, one existing icon.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | N/A | No query or RLS change — same building-scoped `announcements`/`announcement_attachments` data, same access paths. |
| II. Role-Based Access Control | N/A | No access-control change — the Announcements page's existing Building-Administrator/App-Administrator-only guard (`requireBuildingAdmin()`) is untouched; only where controls render changes. |
| III. Test-First for Authorization & Core Workflows | N/A | No authorization or core-CRUD logic changes; `createAnnouncement`/`updateAnnouncement`/`deleteAnnouncement`/`togglePin`/`addAttachment` Server Actions are called exactly as before, just from a different UI location. |
| IV. Auditability & Data Integrity | N/A | No new mutation path — existing `addAttachment` and `togglePin` calls (and their audit logging, if any) are unchanged; only the surrounding UI moves. |
| V. Simplicity & Incremental Delivery | PASS | Reuses the existing `Modal`, `addAttachment` action, and the app's existing soft-accent "active" CSS convention — no new component, dependency, or pattern introduced. |
| Development Workflow & Quality Gates | PASS | Not a new page/nav link — no new client-side routing or role-access statement needed; this is a same-page UI change. |

No unresolved violations. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/015-announcement-card-ui-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output — resolves how "creation" gets an attach control
│                          #   despite addAttachment needing an existing announcement id
├── data-model.md         # Phase 1 output — no new entities/fields; documents what stays the same
├── contracts/
│   └── ui-contract.md   # Phase 1 output — the card/modal render-condition and icon-state contract
├── quickstart.md         # Phase 1 output
└── checklists/
    └── requirements.md   # Already created by /speckit-specify
```

### Source Code (repository root)

```text
app/(backoffice)/announcements/
├── announcements-client.tsx   # MODIFIED: remove the per-row file input + "Adjuntar" button from
│                                #   the list card; add an attach section to the create/edit Modal,
│                                #   shown once an announcement id exists to attach to (editing an
│                                #   existing one, or right after a new one is created)
└── actions.ts                  # UNCHANGED: createAnnouncement/updateAnnouncement/addAttachment/
                                 #   togglePin signatures and guards stay exactly as they are;
                                 #   createAnnouncement's returned id is what the client now reads
                                 #   after a successful create to enable the attach section

components/
└── icons.tsx                   # MODIFIED: IconPin's SVG path becomes a thumbtack-style glyph
                                 #   (round head + point) instead of the map/location teardrop

app/
└── globals.css                 # MODIFIED: add a pinned-state modifier (reusing the existing
                                 #   --color-accent / --color-accent-soft "active badge" pattern
                                 #   already used by .nav-item.active / .tab.active) for the pin
                                 #   toggle button, alongside the existing .icon-btn/.icon-btn.danger
                                 #   convention
```

**Structure Decision**: Single Next.js application, existing structure. Two files modified in
place plus one stylesheet addition, zero files added — the smallest change that satisfies both
user stories without introducing a new component or abstraction.

## Complexity Tracking

*No entries — Constitution Check has no violations to justify.*
