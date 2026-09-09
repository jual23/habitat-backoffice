# Implementation Plan: Facility Status, Incidencias & Package Receipt

**Branch**: `004-facilities-incidencias-packages` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-facilities-incidencias-packages/spec.md`

## Summary

Three additions to the existing Next.js/Supabase backoffice, all scoped to Staff and Building
Administrator (per Constitution v1.5.0, which this feature's spec drove an amendment of — Staff's
role is now explicitly enumerated as Visitors + Incidencias + Package Receipt):

1. **Incidencias**: a new sortable/filterable ticket table backed by two new tables
   (`tickets`, `ticket_comments`) with a five-state status lifecycle (Pending → In Progress →
   Resolved, or → Rejected with a required reason, or → Duplicate with a required link to another
   ticket), plus resident-visible comments while a ticket is In Progress.
2. **Package receipt**: a new `packages` table plus a small register-package form (apartment
   dropdown, description, optional photo) that fires one `notifications` row per resident of the
   apartment, and a "Recogido" action that marks a package collected.
3. **Facilities polish**: an open/closed status bubble on each facility card, computed from the
   facility's existing `opens_at`/`closes_at`/`open_days` schedule and the building's `timezone`
   (no new columns), and removal of the `capacity` field from the facility form and card.

All three follow the codebase's existing pattern: Next.js Server Components fetch data with the
request-scoped Supabase client, Client Components handle interaction, `'use server'` Server Actions
validate with Zod and mutate, Supabase RLS is the authorization boundary (Constitution Principle
I/II), and `writeAuditLog()` records create/update actions (Principle IV). No custom backend API is
introduced.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js` (data/auth/storage/realtime),
`zod` (validation) — same stack as every existing backoffice module; no new dependency is required.

**Storage**: Supabase Postgres (the constitutionally-pinned **Habitat** project) for `tickets`,
`ticket_comments`, and `packages`; the existing `notifications` table for package-arrival alerts;
the existing `building-media` Storage bucket (via `lib/supabase/storage.ts`'s
`uploadBuildingFile`/`trySignedUrlFor`) for optional package photos, reusing the `{building_id}/...`
path convention and 5MB image limit already enforced there.

**Testing**: Vitest (`tests/integration/*.test.ts`), following the existing pattern of one
allow-case and one deny-case RLS integration test per table/operation (Principle III), running
against the real Habitat Supabase project via `tests/fixtures.ts`'s service-role helpers.

**Target Platform**: Web (installable PWA per Constitution's Client Platform Requirements),
Next.js server runtime for Server Components/Actions.

**Project Type**: Web application (single Next.js app, `app/(backoffice)/...` route groups) —
matches the existing repo structure; no frontend/backend split.

**Performance Goals**: No new performance targets beyond the existing app's standard: table/list
views render from a single scoped query (no N+1), consistent with `facilities`/`visitors`/`feedback`
pages already in the app.

**Constraints**: Multi-tenant isolation (Principle I) — every new table carries `building_id` and is
scoped by RLS the same way `visitors`/`feedback` are. Staff's route access is limited to exactly
`/visitors`, `/incidencias`, and `/packages` (Constitution v1.5.0); no other module.

**Scale/Scope**: Single building's worth of tickets/packages per view (tens to low hundreds of open
rows at a time, matching the existing `visitors`/`feedback` list sizes) — no pagination
infrastructure exists elsewhere in the app and none is introduced here beyond client-side
sort/filter over the loaded set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0 (amended for this feature — see spec.md's driven amendment
expanding Staff's Principle II scope to include Incidencias and Package Receipt):

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS | `tickets`, `ticket_comments` (via its parent ticket), and `packages` all carry/inherit `building_id`; RLS scopes every SELECT/INSERT/UPDATE to the caller's building, per contracts/rls-policies.md. |
| II. Role-Based Access Control | PASS (post-amendment) | Staff's scope now explicitly includes Incidencias and Package Receipt (Constitution v1.5.0). Building Administrator retains its existing full building-scoped access. No new role introduced. |
| III. Test-First for Authorization & Core Workflows | PASS (planned) | Each new RLS policy gets an allow+deny Vitest integration test before implementation, per contracts/rls-policies.md, matching the existing `tests/integration/rls-*.test.ts` pattern. |
| IV. Auditability & Data Integrity | PASS (planned) | Ticket status changes, comments, and package register/pickup actions call `writeAuditLog()`, matching every existing mutating server action. |
| V. Simplicity & Incremental Delivery | PASS | Reuses existing patterns (Server Actions, Zod schemas, `notifications` table, `building-media` bucket, Badge/Modal/Toggle components) rather than introducing new infrastructure (no new job queue, no push/SMS integration, no generic workflow engine for the ticket status machine). |
| Security & Access Control Requirements | PASS | All authorization server-side via RLS; no client-only gating. |
| Data Storage | PASS | Same Habitat Supabase project; no alternative datastore. |
| Client Platform Requirements | PASS (planned) | New `/incidencias` and `/packages` pages use `next/link`/`next/navigation` (no full page reloads), consistent with the existing sidebar/route pattern; PWA shell is already in place app-wide. |
| Development Workflow & Quality Gates | PASS (planned) | This plan states role access up front (Staff + Building Administrator); new nav entries use client-side routing per the existing `SidebarNav` pattern. |

No unresolved violations. Complexity Tracking is empty (see below).

## Project Structure

### Documentation (this feature)

```text
specs/004-facilities-incidencias-packages/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── rls-policies.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/(backoffice)/
├── facilities/
│   ├── facilities-client.tsx   # MODIFIED: status bubble, capacity field removed
│   ├── actions.ts               # MODIFIED: capacity dropped from create/update input
│   └── page.tsx                 # MODIFIED: pass building timezone to client for bubble calc
├── incidencias/                 # NEW
│   ├── page.tsx                 # Server Component: loads tickets scoped to building, guards role
│   ├── incidencias-client.tsx   # Client Component: sortable/filterable table, status actions, comments
│   └── actions.ts                # 'use server': status transitions, comments, rejection, duplicate-link
├── packages/                     # NEW
│   ├── page.tsx                  # Server Component: loads packages scoped to building, guards role
│   ├── packages-client.tsx       # Client Component: register form (modal), list, "Recogido" action
│   └── actions.ts                 # 'use server': register package (+ notify residents), mark picked up
├── sidebar-nav.tsx                # MODIFIED: add Incidencias/Packages nav items; extend staffOnly filter
└── reservations/                  # UNCHANGED (referenced for "full capacity used" assumption)

lib/
├── session.ts                     # UNCHANGED (getUserContext already returns building_id for staff)
├── supabase/
│   ├── database.types.ts          # MODIFIED: regenerated after new tables/enums are added
│   └── middleware.ts              # MODIFIED: staff route guard allow-list gains /incidencias, /packages
└── validation/
    ├── facilities.ts               # MODIFIED: capacity removed from facilitySchema
    ├── tickets.ts                  # NEW: Zod schemas (status transition, reject reason, duplicate link, comment)
    └── packages.ts                 # NEW: Zod schema (apartment_id, description, optional photo)

components/
└── Badge.tsx                       # UNCHANGED (reused for ticket/package status pills)

tests/
├── fixtures.ts                     # MODIFIED: add createTestTicket/createTestPackage helpers
└── integration/
    ├── rls-tickets.test.ts         # NEW
    ├── rls-ticket-comments.test.ts # NEW
    ├── rls-packages.test.ts        # NEW
    ├── tickets-workflow.test.ts    # NEW: status machine (reject requires reason, duplicate requires link, etc.)
    └── packages-notify.test.ts     # NEW: registering a package notifies every resident of the apartment
```

**Structure Decision**: Single Next.js application (existing `app/(backoffice)/` route-group
structure). Two new route folders (`incidencias/`, `packages/`) follow the exact
page.tsx/`*-client.tsx`/actions.ts split already used by `facilities/`, `visitors/`, and
`suggestions-complaints/`. No new project, package, or service is introduced.

## Complexity Tracking

*No entries — Constitution Check has no unresolved violations.*
