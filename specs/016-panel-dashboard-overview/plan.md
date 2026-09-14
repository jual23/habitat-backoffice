# Implementation Plan: Panel Dashboard Overview

**Branch**: `016-panel-dashboard-overview` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-panel-dashboard-overview/spec.md`

## Summary

Replace the Panel's current five-tile shortcut grid with a real daily-operations
dashboard: four top stat cards (Residents, today's Incidencias, today's
Paquetería, today's Visitas), a left-column feed of the 5 most recent
operational events (visits, packages, incidencias, emergencies,
suggestions/complaints), and a right-column pending-work summary (open
incidencias, undelivered packages, unread suggestions/complaints, in-progress
reservation requests) — every card, feed entry, and summary row linking to its
source module. The Panel is also opened up to Staff for the first time, with
cards/rows scoped to only the modules Staff already has access to (Visitors,
Incidencias, Package Receipt, Emergency). Reading this requires one small
schema addition: a `viewed_at` column on `feedback` so "unread" is a real,
persisted state rather than an approximation of `starred`/`discarded_at`.

Technical approach: extend the existing server component
(`app/(backoffice)/panel/page.tsx`), which already runs a `Promise.all` of
building-scoped count queries — add the new counts/feed queries to that same
pattern (no new abstraction), mark feedback rows viewed as a side effect of
rendering `app/(backoffice)/suggestions-complaints/page.tsx` (the list already
shows full subject+body inline, so "opening the module" *is* "viewing the
list"), and widen the Staff route allowlist in `lib/supabase/middleware.ts`
and `SidebarNav` to include `/panel`.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: `@supabase/ssr` / `@supabase/supabase-js` (data
access + auth), `zod` (validation, where applicable) — no new dependency
needed for this feature

**Storage**: Supabase Postgres (project **Habitat**, per Constitution "Data
Storage") — reads across existing `profiles`, `tickets`, `packages`,
`visitors`, `emergencies`, `feedback`, `reservations` tables; one migration
adds `feedback.viewed_at`

**Testing**: Vitest (`tests/integration/*.test.ts` for RLS/authorization and
cross-tenant isolation, `tests/unit/*.test.ts` for pure logic) — this feature
follows the existing per-table `rls-*.test.ts` convention

**Target Platform**: Web (installable PWA backoffice), server-rendered pages
via Next.js

**Project Type**: Single Next.js web application (no separate frontend/backend
split) — this feature only touches the existing `app/(backoffice)/` route
group

**Performance Goals**: Panel data is fetched with one batch of parallel,
building-scoped, indexed count/select queries (mirroring the existing
`panel/page.tsx` pattern) — no client-side polling or new infrastructure;
consistent with SC-001 (operator reads the day's numbers within 5 seconds of
opening the page, i.e., within a normal server-rendered page load)

**Constraints**: Must preserve Principle I (every query building-scoped) and
Principle II (Staff sees only its six permitted modules' data — no Residents
count, no Reservations, no Suggestions/Complaints for Staff); marking feedback
"read" must not be exposed to Staff, since Staff has no access to the
Suggestions/Complaints module at all

**Scale/Scope**: One building's data per page load; all counts and the
5-item feed are small-cardinality aggregate queries (no pagination needed)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Multi-Tenant Data Isolation)** — PASS. Every new query (today's
  incidencias/packages/visitas, open incidencias, undelivered packages, unread
  feedback, in-progress reservations, the 5-event feed) is filtered by
  `building_id = ctx.buildingId`, the same pattern the current `panel/page.tsx`
  already uses. No cross-building read is introduced.
- **Principle II (Role-Based Access Control)** — PASS, with a specific design
  point to enforce: opening the Panel to Staff (FR-012) must not leak data
  outside Staff's six enumerated modules. The plan omits the Residents card,
  the Reservations row, and the Suggestions/Complaints row (and any feed entry
  of that type) when rendering for `ctx.role === 'staff'` — server-side, not
  just visually (Security & Access Control Requirements: "the client is never
  a trust boundary"). This is a *visibility* change on data Staff's RLS
  policies already allow it to read for its own modules; no policy is widened
  for Staff, and the one new column (`feedback.viewed_at`) grants Staff no new
  access (see data-model.md — only `building_admin`/`app_admin` may update
  it).
- **Principle III (Test-First for Authorization & Core Workflows)** — PASS,
  planned: `tests/integration/rls-suggestions-complaints.test.ts` gets new
  cases for `viewed_at` (building_admin can set it; staff/resident cannot;
  cross-building denied) written before the migration is exercised by
  application code. `tests/integration/cross-tenant-isolation.test.ts` gets a
  Panel-query case. Buildings/facilities/activities/announcements CRUD is
  unchanged by this feature.
- **Principle IV (Auditability & Data Integrity)** — N/A / PASS. This feature
  touches buildings/facilities/activities/announcements not at all, and adds
  no create/update/delete workflow to them. Marking a feedback row's
  `viewed_at` is a passive, non-destructive, easily-reversible-in-effect read
  receipt (not enumerated in Principle IV's audit-log list); no audit log
  entry is added for it, matching how `starred` also has no audit log today —
  only `favorite`/`discard` (explicit admin actions) do.
- **Principle V (Simplicity & Incremental Delivery)** — PASS. No new
  abstraction layer: the feed is built by running five small, already-indexed
  `select ... order by created_at desc limit 5` queries in parallel and
  merging in memory (not a new SQL view/union function) — the same "extend the
  existing `Promise.all`" pattern the current Panel already uses. No new
  library, no generic "activity log" table.
- **Client Platform Requirements** — PASS. All new links use `next/link`
  (`Link`), matching the current `panel/page.tsx`; no full-page navigation is
  introduced.

No violations to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-panel-dashboard-overview/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── panel-view-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/(backoffice)/
├── panel/
│   ├── page.tsx                 # MODIFIED: 4 stat cards + 2-column layout, role-scoped
│   └── loading.tsx               # MODIFIED: skeleton for new layout
├── suggestions-complaints/
│   ├── page.tsx                  # MODIFIED: marks unread rows viewed on load
│   └── actions.ts                 # unchanged (favorite/discard stay as-is)
├── sidebar-nav.tsx                # MODIFIED: staffOnly allowlist gains '/panel'
lib/
├── supabase/middleware.ts         # MODIFIED: Staff route guard gains '/panel'
└── supabase/database.types.ts     # MODIFIED (regenerated): feedback.viewed_at

supabase/migrations/
└── 0049_feedback_viewed_at.sql    # NEW: viewed_at column (no new policy needed)

tests/integration/
├── rls-suggestions-complaints.test.ts  # MODIFIED: viewed_at RLS cases
└── cross-tenant-isolation.test.ts      # MODIFIED: Panel query case
```

**Structure Decision**: This is a feature within the existing single Next.js
backoffice app (`app/(backoffice)/`) — no new project, package, or service
boundary. Data access continues through the existing `createClient()` /
`getUserContext()` / RLS stack; the only schema change is one additive column
plus its RLS policy.

## Complexity Tracking

*No violations — table intentionally omitted.*
