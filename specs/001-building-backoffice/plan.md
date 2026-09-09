# Implementation Plan: Building Administrator Backoffice

**Branch**: `001-building-backoffice` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-building-backoffice/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Give Building Administrators (and a narrowly-scoped Staff role) a single backoffice web app to
manage everything about their building: apartments and resident users, reservable facilities and
their reservation approvals, announcements, activities, an expected-visitor log, a document
library, resident suggestions/complaints, and building branding. Technical approach: a single
Next.js (TypeScript) application talking directly to a per-project Supabase Postgres database
("Habitat"), with all multi-tenant isolation and role permissions enforced as Postgres Row Level
Security (RLS) policies rather than a custom backend layer, and Supabase Edge Functions handling
the two time-based background rules (visitor auto-expiry, discarded-item auto-delete) plus any
mutation too complex for RLS alone (e.g., cascading facility deletion).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS

**Primary Dependencies**: Next.js 14+ (App Router), React 18, `@supabase/supabase-js` +
`@supabase/ssr` (Supabase client for browser/server contexts), Zod (input validation shared
between client forms and server actions)

**Storage**: Supabase Postgres — project **Habitat**, per the project constitution's Data Storage
section. Images, banners, logos, and uploaded documents go in Supabase Storage buckets, path-scoped
per building.

**Testing**: Vitest for unit and integration tests, run against a local Supabase stack (`supabase
start`) so that authorization/RLS tests exercise real Postgres policies rather than mocks. No
end-to-end browser test framework in this version (Principle V — added only if a real need
emerges).

**Target Platform**: Web — modern evergreen browsers (Chrome, Edge, Safari, Firefox), responsive
down to tablet width; no offline requirement.

**Project Type**: Web application — single Next.js project (frontend UI + server actions), no
separate custom backend service (see Architecture Decision in research.md).

**Performance Goals**: Standard interactive web-app responsiveness — primary backoffice views
(lists, forms) interactive within ~2s on a typical broadband connection. No high-throughput or
real-time requirement; this is a low-concurrency admin tool, not a public-facing high-traffic app.

**Constraints**: All data access MUST be safe to expose directly to the browser (no server ever
trusted to add authorization the database doesn't already enforce), per Principle I/II and the
chosen direct-client + RLS architecture. Uploaded images/documents need reasonable size limits to
protect storage costs (assumption: images ≤ 5MB, documents ≤ 20MB — enforced client-side and via
Storage bucket policy; revisit if real usage proves otherwise).

**Scale/Scope**: Multi-tenant across many buildings; each building expected to have on the order of
tens to a few hundred apartments/residents and a handful to dozens of facilities/activities. No
specific concurrent-user target — sized as a small-business admin tool, not a high-traffic
consumer app.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | How this plan satisfies it |
|------|--------|------------------------------|
| I. Multi-Tenant Data Isolation (NON-NEGOTIABLE) | PASS | Every table carries a `building_id`; isolation is enforced by Postgres RLS policies (database layer), not application code or hidden UI — satisfies "not merely hidden in the UI." |
| II. Role-Based Access Control | PASS | Exactly the four constitutional roles (App Administrator, Building Administrator, Staff, Resident) are modeled in a `profiles` table joined to `auth.users`; every RLS policy and server action checks role + `building_id`/`apartment_id` server-side (in Postgres itself, the strictest possible enforcement point). Staff accounts are provisioned by a Building Administrator within this feature (FR-039/040); App Administrator and Building Administrator rows are provisioned by the separate building-management feature. |
| III. Test-First for Authorization & Core Workflows (NON-NEGOTIABLE) | PASS (process gate — enforced at task ordering in tasks.md) | RLS policy tests (Vitest + local Supabase, one allow/deny case per role per table) and core CRUD tests MUST be written and failing before the corresponding migration/policy or UI is implemented; `/speckit-tasks` MUST order test tasks before implementation tasks per user story. |
| IV. Auditability & Data Integrity | PASS | An `audit_log` table records actor, action, entity, and timestamp for every create/update/delete/approve/decline/discard covered by FR-038; high-impact deletes (apartments with residents, facilities with pending reservations) are blocked or cascaded per the spec's Edge Cases rather than silently allowed. |
| V. Simplicity & Incremental Delivery | PASS | Single Next.js app, no custom backend service, RLS instead of a hand-rolled permission layer, no framework/plugin abstractions beyond what each user story needs. |
| Data Storage | PASS | Storage is set to the constitutionally-pinned Supabase project **Habitat**; connection configuration is environment-based per the Security & Access Control Requirements section. |

No violations — Complexity Tracking is empty.

**Post-Phase 1 re-check**: All gates above still PASS after design. [data-model.md](./data-model.md)
confirms every table carries `building_id` and the two FK/trigger mechanisms (apartment RESTRICT,
facility soft-delete cascade) needed by the spec's Edge Cases; [contracts/rls-policies.md](./contracts/rls-policies.md)
gives every table's isolation and role policy explicitly (Principle I/II); Principle III's
test-first requirement is carried forward into tasks.md ordering (next command); no new
complexity was introduced by the design — the Complexity Tracking table remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-building-backoffice/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── rls-policies.md
│   └── edge-functions.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
habitat/
├── app/                                # Next.js App Router
│   ├── (backoffice)/                   # Authenticated backoffice route group
│   │   ├── apartments/
│   │   ├── users/
│   │   ├── facilities/
│   │   ├── reservations/
│   │   ├── announcements/
│   │   ├── activities/
│   │   ├── visitors/                   # Staff-accessible
│   │   ├── documentation/
│   │   ├── suggestions-complaints/
│   │   └── customization/
│   ├── login/
│   └── layout.tsx
├── components/                         # Shared UI components (forms, tables, tabs, uploaders)
├── lib/
│   ├── supabase/                       # Browser + server Supabase client factories
│   └── validation/                     # Zod schemas shared by forms and server actions
├── supabase/
│   ├── migrations/                     # SQL: tables, RLS policies, triggers
│   ├── functions/                      # Edge Functions: visitor-expiry, discard-cleanup, etc.
│   └── seed.sql                        # Local dev seed data
└── tests/
    ├── integration/                    # Vitest + local Supabase: RLS + core workflow tests
    └── unit/                           # Vitest: pure logic (validation, formatting)
```

**Structure Decision**: Single Next.js project (Option 1 style, adapted to Next.js/Supabase
conventions instead of a generic `src/`). No separate frontend/backend split — the chosen
direct-client + RLS architecture means Next.js server actions call Supabase directly rather than
proxying to a distinct API service, so a second project would add a layer with no current
consumer (Principle V).

## Complexity Tracking

*No entries — Constitution Check passed without needing to justify any deviation.*
