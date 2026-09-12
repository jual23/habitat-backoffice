# Implementation Plan: App Administrator Building Management

**Branch**: `012-app-admin-building-management` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-app-admin-building-management/spec.md`

## Summary

App Administrator's navigation currently shows the full set of building-operational modules (Facilities, Incidencias, Finance, and so on), even though every one of those pages already falls back to a "manage this per-building elsewhere" placeholder for this role — because `getUserContext()` gives App Administrator `buildingId: null`, and there is, today, no "elsewhere": no UI exists anywhere in the app to create a building, create a Building Administrator account, or reassign one. This plan (1) narrows App Administrator's navigation to the Users module only, (2) makes that same Users module show building/administrator-management content instead of the resident/staff content Building Administrator sees there, and (3) adds the building create/edit and Building-Administrator assign/reassign capability itself — implementing, for the first time in this codebase, exactly what the constitution's Principle II already describes as App Administrator's role ("creates and manages buildings, and assigns Building Administrators") and what the Security & Access Control Requirements section already states ("Building Administrator accounts MUST be provisioned only by an App Administrator").

Every piece of supporting infrastructure this needs already exists and is reused as-is: `lib/supabase/admin.ts`'s service-role client (the only sanctioned way to create an `auth.users` row with an admin-set password), `lib/user-provisioning.ts`'s `createBuildingUser()` (extended to accept `role: 'building_admin'`, alongside its existing `resident`/`renter`/`staff`), `lib/audit.ts`'s `writeAuditLog()`, the existing Zod validation pattern (`lib/validation/`), and Customization's own logo-upload mechanism (`uploadBuildingFile()`). No new architecture is introduced.

Assigning a building's administrator (at creation, FR-006, or reassignment, FR-009) always offers a choice: create a brand-new account, or select an existing Building Administrator from a dropdown (someone who already administers a different building) — avoiding an unnecessary new account every time, and, as a direct side effect, giving the App Administrator a single self-service way to fix any building that currently lacks an administrator (research.md §10). That dropdown deliberately never lists App Administrator accounts (FR-013) — not a scope preference, but because `getUserContext()`'s existing role-resolution order would make such a dual-role account permanently unable to actually use the Building Administrator access it would nominally hold (research.md §10).

## Technical Context

**Language/Version**: TypeScript 5.6 (existing project), Next.js 14.2.35 (App Router), React 18.3.1 — no version changes.

**Primary Dependencies**: `@supabase/ssr`, `@supabase/supabase-js`, `zod` — all existing, unchanged. No new package.

**Storage**: Supabase (the Habitat project) — unchanged datastore. This feature likely requires **additive RLS policies** on `buildings` (INSERT/UPDATE for App Administrator) and `user_roles` (INSERT/DELETE for App Administrator assigning/reassigning `role = 'building_admin'`) — the live schema predates this codebase (per `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`), so these must be verified against the live project during implementation and added only if missing, following that same document's established "additive migration" pattern. A `buildings` SELECT-all policy for App Administrator is very likely already present (Principle I already treats "App Administrator spans all buildings" as foundational and several other tables already branch on `is_app_admin` for broad access) but is verified, not assumed.

**Testing**: Vitest (`npm run test`, existing pattern: `tests/integration/*.test.ts` against the live project's RLS via `tests/fixtures.ts`/`tests/setup.ts`). Constitution Principle III (NON-NEGOTIABLE) applies directly here — see Constitution Check.

**Target Platform**: Same as today — the Habitat backoffice web app.

**Project Type**: Existing web application. This feature adds files under `app/(backoffice)/users/` (role-branched content), extends `lib/user-provisioning.ts` and `lib/validation/`, and adds one new module directory for the buildings list/detail views (see Project Structure). It does not touch any other module's `page.tsx` — App Administrator's exclusion from those is a navigation change, not a per-page authorization change (see research.md §5 for why that's sufficient here).

**Performance Goals**: Not a focus of this feature (no stated latency/throughput target); ordinary web app expectations apply, consistent with 011-module-navigation-performance's work, which this feature does not undo.

**Constraints**: Building Administrator's and Staff's navigation, module access, and behavior MUST remain completely unchanged (FR-002, SC-005) — every change here is additive to App Administrator's own path. `SUPABASE_SERVICE_ROLE_KEY` MUST continue to be used only from `lib/supabase/admin.ts`, never from a Client Component (existing constraint, unchanged). A building MUST NOT end up with zero designated Building Administrators at any point a request completes (FR-011) — ordering of multi-step writes must account for this (research.md §4/§6).

**Scale/Scope**: One role's (App Administrator) navigation and one existing route's (`/users`) content; one new capability (building create/edit, Building Administrator assign/reassign) with no new top-level route — it lives at the existing `/users` entry, branched by role (spec.md Edge Cases).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature both narrows navigation for a role (App Administrator) and adds a brand-new authorization-sensitive capability (creating Building Administrator accounts, creating buildings, reassigning cross-building-scoped access) — the second half is exactly the kind of change Principles I–III exist to guard.

| Principle / Section | Applicability | Status |
|---|---|---|
| I. Multi-Tenant Data Isolation (NON-NEGOTIABLE) | Applies directly — App Administrator is the constitution's one explicit exception to per-building isolation ("spans all buildings by design"). This feature must ensure the new buildings-list/create/edit/assign capability is reachable **only** by App Administrator, and that creating a new Building Administrator scopes their access to exactly the one building they're assigned to (never broader) | PASS — the new actions require `ctx.role === 'app_admin'` server-side (not just hidden nav), and the new Building Administrator's `user_roles` row is scoped to a single `building_id`, identical in shape to every existing `building_admin` row |
| II. Role-Based Access Control | Applies directly — this feature implements Principle II's own text for App Administrator ("creates and manages buildings, and assigns Building Administrators") for the first time; it does not introduce a new role or redefine an existing one | PASS |
| III. Test-First for Authorization & Core Workflows (NON-NEGOTIABLE) | Applies directly and is a **binding gate**: building creation, Building Administrator assignment/reassignment, and the navigation restriction are all "authorization rules" and cross-building-isolation-relevant changes. Tests covering both allowed and denied cases MUST exist before/alongside implementation — see tasks.md | **Gate condition**: integration tests proving (a) only App Administrator can create a building / assign or reassign its administrator, (b) a newly assigned Building Administrator's access is scoped to exactly that building, (c) the previous administrator loses that building's access immediately on reassignment, (d) Building Administrator/Staff behavior is provably unchanged |
| IV. Auditability & Data Integrity | Applies — building creation, building edits, and Building Administrator assignment/reassignment are all create/update actions on a shared resource | Every new mutation calls `writeAuditLog()` (existing pattern), action names `building.create` (covers the building row and its first administrator, whichever path was chosen), `building.update`, `building_admin.reassign` (covers both reassigning an existing administrator and assigning one to a building that had none) |
| V. Simplicity & Incremental Delivery | Applies, and is honored: every piece of supporting logic (service-role client, `createBuildingUser()`, audit logging, Zod validation, logo upload) is reused, extended in place rather than duplicated or replaced | PASS |
| Security & Access Control Requirements | Applies directly — this section already states "Building Administrator accounts MUST be provisioned only by an App Administrator," which today is unenforced because no such flow exists at all; this feature is that flow's first implementation | PASS, closes a previously-unimplemented constitutional requirement |
| Data Storage (Supabase requirement) | No new/alternative datastore; likely additive RLS policies only (verified, not assumed — see Technical Context) | PASS |
| Client Platform Requirements (PWA, client-side routing) | Unaffected — no new top-level route, content is branched within the existing `/users` route using the app's own client-side routing already | PASS |
| Development Workflow — "state which role(s) can access it" | Applies: this feature's new capability is **App Administrator only**; Building Administrator and Staff are explicitly, deliberately unaffected (FR-002, SC-005) | Stated, PASS |

**Result**: No violations. One binding gate condition (Principle III tests), carried into tasks.md as required, ordered tasks — same pattern as 011-module-navigation-performance's Principle III gate.

## Project Structure

### Documentation (this feature)

```text
specs/012-app-admin-building-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output — the App Administrator Users-module content contract
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

No new top-level directories. This feature edits/adds files within the existing `app/(backoffice)/` tree and `lib/`:

```text
app/(backoffice)/
├── layout.tsx                        # sidebar filtering gains an "App Administrator sees only Users" branch — MODIFIED
├── sidebar-nav.tsx                   # NAV_ITEMS filter extended: app_admin → only the /users item — MODIFIED
└── users/
    ├── page.tsx                      # branches on ctx.role: app_admin → buildings data + new client; building_admin → today's unchanged path — MODIFIED
    ├── users-client.tsx               # UNCHANGED — Building Administrator's resident/staff UI, untouched
    ├── actions.ts                    # UNCHANGED — existing resident/staff actions untouched (research.md §7 on requireBuildingAdmin())
    ├── buildings-client.tsx           # NEW — App Administrator's buildings list/create/edit/assign UI (Client Component); the create/reassign forms offer a choice: an existing-Building-Administrator dropdown, or a new-account form
    └── buildings-actions.ts           # NEW — Server Actions: createBuilding (handles first-administrator assignment inline — new account or existing selection, research.md §8/§10), updateBuilding, reassignBuildingAdministrator (also used to assign an administrator to a building that currently has none)

lib/
├── user-provisioning.ts              # createBuildingUser()'s role union extended to include 'building_admin' — MODIFIED
└── validation/
    └── buildings.ts                   # NEW — createBuildingSchema (name), createBuildingAdminAccountSchema (reuses the existing base account fields shape)

supabase/migrations/
└── (new, only if verification finds a gap) 00XX_app_admin_building_management_rls.sql   # additive INSERT/UPDATE (buildings) and INSERT/DELETE (user_roles, role='building_admin') policies scoped to app_admin — see research.md §6
```

**Structure Decision**: Everything lives at the existing `/users` route (spec.md Edge Cases: "the same navigation entry shows different content depending on which of these two roles is viewing it") — no new top-level module/route is created. `buildings-client.tsx` and `buildings-actions.ts` are new, separate files alongside the existing `users-client.tsx`/`actions.ts` (rather than branching inside those files) so Building Administrator's existing, working code path is never touched — satisfying FR-002/SC-005 by construction, the same way 011-module-navigation-performance kept every unrelated file untouched.

## Complexity Tracking

> No entries — Constitution Check reported no violations. The one binding gate condition (Principle III tests) is a testing requirement, not a complexity/architecture exception.
