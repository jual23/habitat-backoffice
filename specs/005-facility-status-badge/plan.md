# Implementation Plan: Single Facility Status Indicator

**Branch**: `005-facility-status-badge` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-facility-status-badge/spec.md`

## Summary

Consolidate the two status indicators currently shown on each facility card in `/facilities`
(the "Reservable"/"No reservable" `Badge` and the separate open/closed colored dot, both added in
feature 004) into a single `Badge` pill: green "Abierto" when the facility is currently open per
its existing schedule/timezone computation, red "Cerrado" when it isn't. The pill occupies the
exact position/format the reservable badge used (image overlay or header row); the dot is removed.
The reservable toggle in the card footer is untouched — reservable/not-reservable remains fully
visible and controllable there, per spec.md FR-007. This is a pure `facilities-client.tsx` display
change: no schema, RLS, Server Action, or new dependency is involved.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: None new — reuses the existing `Badge` component
(`components/Badge.tsx`) and the `isFacilityOpen()` helper already in `facilities-client.tsx`
(introduced by feature 004's facility open/closed bubble).

**Storage**: N/A — no schema, RLS, or data change. `facilities.reservable`, `opens_at`,
`closes_at`, `open_days`, and `buildings.timezone` are already fetched by `page.tsx` and passed to
the client component; nothing new is read.

**Testing**: None new. This is a display-only change to an existing Client Component with no
authorization surface, matching the precedent set by feature 004's own facilities-bubble user
story (spec.md's Tests note) — verified via `npm run typecheck`/`lint`/`build` plus a manual
quickstart.md walkthrough, no Vitest test required.

**Target Platform**: Web (existing Next.js backoffice, `/facilities` route) — same as every other
feature in this repo.

**Project Type**: Single Next.js application (existing `app/(backoffice)/facilities/` module) — no
new route, no new project.

**Performance Goals**: N/A — no new computation; `isFacilityOpen()` is already called once per
facility per render.

**Constraints**: The indicator must render in the two existing layout positions (image-overlay and
header-row) the reservable badge already occupies, using the existing `Badge` component's tone
options (`success` = green, `danger` = red) — no new visual component or styling system.

**Scale/Scope**: Same facilities list already rendered today (a handful to tens of cards per
building); no change in data volume.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0:

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS (N/A) | No data access change — same query as today, scoped the same way. |
| II. Role-Based Access Control | PASS (N/A) | No new role, no new page; `/facilities` remains Building Administrator/App Administrator only, unchanged. |
| III. Test-First for Authorization & Core Workflows | PASS (N/A) | No authorization logic is added or changed — this is a presentational consolidation of two already-existing, already-tested-elsewhere display elements. Nothing here meets the principle's trigger ("authorization rules... cross-building isolation"). |
| IV. Auditability & Data Integrity | PASS (N/A) | No create/update/delete action is added; the existing reservable toggle's `updateFacility()` call (and its audit log write) is unchanged. |
| V. Simplicity & Incremental Delivery | PASS | Removes a redundant UI element rather than adding one; reuses the existing `Badge` component and `isFacilityOpen()` helper as-is. |
| Security & Access Control Requirements | PASS | No change. |
| Data Storage | PASS | No change. |
| Client Platform Requirements | PASS | No new page/route; existing client-side rendering, no full page reload introduced. |
| Development Workflow & Quality Gates | PASS | No new backoffice page or nav link; not an authorization change. |

No unresolved violations. Complexity Tracking is empty (see below).

## Project Structure

### Documentation (this feature)

```text
specs/005-facility-status-badge/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/(backoffice)/facilities/
└── facilities-client.tsx   # MODIFIED: replace the reservable Badge + open/closed dot with
                             # one Badge (green "Abierto" / red "Cerrado") in the same position;
                             # remove the dot's <span>; reservable Toggle in the footer unchanged
```

No other file changes: `page.tsx` already fetches `reservable`, `opens_at`, `closes_at`,
`open_days`, and `buildingTimezone`; `actions.ts` and `lib/validation/facilities.ts` are untouched
since no field is added, removed, or revalidated differently.

**Structure Decision**: Single-file change within the existing Next.js `app/(backoffice)/` route
structure — no new route, component file, or module.

## Complexity Tracking

*No entries — Constitution Check has no unresolved violations.*
