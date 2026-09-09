# Implementation Plan: Polls Checkbox Styling

**Branch**: `009-polls-checkbox-styling` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-polls-checkbox-styling/spec.md`

## Summary

`app/(backoffice)/polls/polls-client.tsx`'s two boolean poll-creation options ("Permitir múltiples
respuestas", "Anónima") are the only place in this entire backoffice using a native, unstyled
`<input type="checkbox">` — every other on/off setting already uses the existing `Toggle` component
(`components/Toggle.tsx`, a labeled pill-switch). This plan replaces those two raw checkboxes with
`Toggle`, with no change to the underlying `allow_multiple`/`anonymous` state, validation, or the
`createPoll()` Server Action.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: None new — `components/Toggle.tsx` already exists and is already used
elsewhere in this backoffice (e.g., Customization's settings toggles).

**Storage**: N/A — no schema, RLS, or Server Action change; `allow_multiple`/`anonymous` are
already-existing `polls` columns (007-finance-ops-expansion) and this feature doesn't touch them.

**Testing**: No new automated test — this is a visual-only change with no new logic branch to
cover (Toggle's own `onChange` plumbing is identical to a native checkbox's, and `createPoll()` is
untouched). Verified by `npm run typecheck`/`npm run lint`/`npm run build` staying clean plus a
manual visual check (quickstart.md).

**Target Platform**: Web (existing Next.js backoffice), same page.

**Project Type**: Single Next.js application. Zero new files — one existing file (`polls-
client.tsx`) modified.

**Performance Goals**: N/A — no measurable performance dimension to this change.

**Constraints**: None beyond Constitution Principle V (Simplicity) — reuse the existing component
exactly as-is; do not introduce a new checkbox/toggle abstraction for a two-control change.

**Scale/Scope**: Two controls, one file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | N/A | No data access change — same query, same RLS, same page. |
| II. Role-Based Access Control | N/A | No access-control change — the Polls page's existing Building-Administrator-only guard is untouched. |
| III. Test-First for Authorization & Core Workflows | N/A | No authorization or core-workflow logic changes; nothing new to test-first against. |
| IV. Auditability & Data Integrity | N/A | No mutation path changes — `createPoll()` and its `writeAuditLog()` call are untouched. |
| V. Simplicity & Incremental Delivery | PASS | Reuses the existing `Toggle` component exactly as already used elsewhere — no new component, no new dependency, no new pattern. |
| Development Workflow & Quality Gates | PASS | Not a new page/nav link — no new client-side routing or role-access statement needed. |

No unresolved violations. No Complexity Tracking entries — this plan introduces nothing new.

## Project Structure

### Documentation (this feature)

```text
specs/009-polls-checkbox-styling/
├── plan.md              # This file
├── research.md           # Phase 0 output — no NEEDS CLARIFICATION existed; documents the one
│                          #   decision (reuse the existing Toggle component) for the record
├── data-model.md         # Phase 1 output — N/A, no entities (see note in file)
├── contracts/
│   └── ui-contract.md    # Phase 1 output — the Toggle usage contract
├── quickstart.md         # Phase 1 output
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/(backoffice)/polls/
└── polls-client.tsx      # MODIFIED: the two `<input type="checkbox">` controls in the poll
                           #   creation form become `<Toggle>` (components/Toggle.tsx), same
                           #   checked/onChange wiring, same labels
```

**Structure Decision**: Single Next.js application, existing structure. One file modified, zero
files added — the smallest possible change that satisfies the spec.

## Complexity Tracking

*No entries — Constitution Check has no violations to justify.*
