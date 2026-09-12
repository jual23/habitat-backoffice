# Implementation Plan: Module Navigation Performance

**Branch**: `011-module-navigation-performance` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-module-navigation-performance/spec.md`

## Summary

Module-to-module navigation in the Habitat backoffice currently takes 2+ seconds because, on every navigation, several server round trips happen serially with no visible feedback in between: `middleware.ts` refreshes the Supabase session, the shared `(backoffice)/layout.tsx` independently re-derives the user's role via `getUserContext()`, and — critically — **every module's `page.tsx` calls `getUserContext()` again from scratch** (confirmed at 38 call sites across `app/(backoffice)/`), repeating the same `auth.getUser()` + `user_roles` (+ sometimes `profiles`) round trips the layout already just did. Several pages then run their own data queries and Storage signed-URL generation serially rather than in parallel (e.g., `facilities/page.tsx` fetches the building's timezone only *after* resolving every facility's signed image URL, instead of concurrently). On top of that, **no route segment under `app/(backoffice)/` has a `loading.tsx`**, so Next.js shows nothing at all — the old module stays frozen on screen — until this entire serial chain resolves, which is exactly the "did it freeze?" experience being reported.

This plan fixes the underlying waterfall (de-duplicate the redundant per-request auth/role lookups, parallelize each module's independent queries, stop needlessly regenerating still-valid signed URLs) and adds Next.js's native Suspense-based `loading.tsx` to every module so a visible loading state appears immediately regardless of how fast the data fetch ends up being. No new dependencies, no new infrastructure, and no change to who can access any module — only how quickly it appears. The one deliberate exception is FR-008: a module whose list can grow large now shows an initial ~25-record batch instead of the full set by default (with pagination/"load more" as an optional follow-up), a narrow, visible UX change made specifically to keep large data sets from delaying the navigation-speed target.

## Technical Context

**Language/Version**: TypeScript 5.6 (existing project), Next.js 14.2.15 (App Router), React 18.3.1 — no version changes.

**Primary Dependencies**: `@supabase/ssr` ^0.12.5 and `@supabase/supabase-js` ^2.45.4 (existing, unchanged). The fix uses only what the stack already provides: React's built-in `cache()` for per-request memoization and Next.js's built-in `loading.tsx`/`<Suspense>` for instant loading UI — no new package is introduced.

**Storage**: Supabase (the Habitat project) — unchanged. This feature does not add, remove, or relocate any persisted data; it changes when/how often existing reads happen within a single request.

**Testing**: Vitest (`npm run test`, existing). Because this touches `getUserContext()` and the layout/page authorization checks directly, Constitution Principle III (NON-NEGOTIABLE) applies: tests asserting identical role/`buildingId`/`apartmentId` outcomes (allowed and denied cases) for the memoized `getUserContext()` MUST exist before/alongside the refactor — see `research.md` §2 and `quickstart.md`.

**Target Platform**: Same as today — the Habitat backoffice web app, installed as a PWA, used by signed-in Building Administrators, Staff, and App Administrators.

**Project Type**: Existing web application. This feature modifies files within `app/(backoffice)/` (every module's `page.tsx`, new `loading.tsx` per module, `layout.tsx`) and `lib/session.ts`; it does not create a new project or directory.

**Performance Goals**: Module-to-module navigation shows destination content in ~1s typical (SC-001); ≥95% of transitions under 1.2s (SC-002); no transition over 2s under typical conditions (SC-003); a loading indicator or the content itself appears within 300ms of navigating (SC-004).

**Constraints**: No new external dependencies or infrastructure (Principle V) — the fix uses only built-in React/Next.js primitives already in the stack. MUST NOT change what `getUserContext()` returns for any user/role, only how many times it's computed per request (Principle II/III). Any caching introduced MUST be strictly scoped per-request or per-exact-storage-path — never shared across users or buildings (Principle I, NON-NEGOTIABLE). MUST NOT change what any module does functionally or who can access it (spec Assumptions), and MUST NOT regress client-side routing (Client Platform Requirements) — except FR-008's initial ~25-record batch limit on large list queries, spec.md's one deliberate, narrow UX exception to that "no functional change" rule.

**Scale/Scope**: All 18 backoffice modules — the 17 reachable from `SidebarNav` (`app/(backoffice)/sidebar-nav.tsx`: Panel, Facilities, Announcements, Activities, Visitors, Incidencias, Packages, Finance, Maintenance, Polls, Emergency, Broadcast, Documentation, Suggestions/Complaints, Apartments, Users, Customization) plus Reservations — which has its own `app/(backoffice)/reservations/page.tsx` and is included because reservations is a feature residents use from the mobile app, so the backoffice's own reservations view is real, user-facing surface even though it isn't a top-level sidebar link — plus the shared layout, all get both the de-duplicated auth lookup and a `loading.tsx`. Query-parallelization is applied wherever a module's `page.tsx` currently awaits independent Supabase calls serially (confirmed present at least in `facilities/page.tsx`; each module is audited individually in tasks.md rather than assumed).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature touches the exact code path (`getUserContext()`, `middleware.ts`, the backoffice `layout.tsx`) that Constitution Principles I–III treat as the system's most safety-critical surface, so this gate is evaluated with real weight rather than by scope exclusion:

| Principle / Section | Applicability | Status |
|---|---|---|
| I. Multi-Tenant Data Isolation (NON-NEGOTIABLE) | Applies directly — any memoization/caching introduced (per-request `getUserContext()` cache, signed-URL reuse) MUST stay strictly scoped so one user's role/`buildingId` or one building's signed asset URL can never be served from another user's/building's cached value | PASS — design commits to React `cache()` (guaranteed reset per request by Next.js, never shared across requests/users) and to keying any signed-URL reuse by the exact `{bucket, path}` already gated by existing Storage RLS — no new cross-tenant surface is introduced (research.md §2, §5) |
| II. Role-Based Access Control | Applies — `getUserContext()`'s *output* (which role, which building) MUST be byte-for-byte unchanged; only call-count is reduced | PASS — pure de-duplication, not a logic change; verified by Principle III tests below |
| III. Test-First for Authorization & Core Workflows (NON-NEGOTIABLE) | Applies directly — `getUserContext()` and the layout's redirect-if-unauthenticated/Staff-guard logic are exactly the "authorization rules" this principle governs | **Gate condition**: tests covering the memoized `getUserContext()` (all five `UserContext` shapes: app_admin, building_admin/staff, resident/renter, no-role, signed-out) MUST be written/updated before or alongside the refactor — tracked as an explicit, non-skippable task in tasks.md |
| IV. Auditability & Data Integrity | N/A — no create/update/delete behavior changes; this is a read-path speed fix | PASS (N/A) |
| V. Simplicity & Incremental Delivery | Applies, and is honored: the fix uses only built-in React (`cache()`) and Next.js (`loading.tsx`/`<Suspense>`) primitives already present in the stack — no new package, no new caching service/infrastructure (research.md §5 explicitly rejects introducing one for v1) | PASS |
| Security & Access Control Requirements | Server-side enforcement (middleware + RLS) is unchanged; only redundant *re-derivation* of already-established context is removed | PASS |
| Data Storage (Supabase requirement) | No new or alternative datastore | PASS (N/A change) |
| Client Platform Requirements (no full-page reload, PWA) | Adding `loading.tsx` is Next.js's own native Suspense mechanism for the App Router already in use — it is not a second/competing router, and does not touch service-worker/manifest installability | PASS |
| Development Workflow — "state which role(s) can access it" | Applies: this feature affects navigation for all three backoffice-eligible roles — **App Administrator, Building Administrator, and Staff** (Resident/Renter have no backoffice access at all, per Principle II, and are unaffected) | Stated, PASS |

**Result**: No violations, one binding gate condition (Principle III tests for `getUserContext()`), carried into tasks.md as a required, ordered-first task. Complexity Tracking is not needed — no new abstraction is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/011-module-navigation-performance/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — request-scoped context shape, not a DB schema
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output — the internal "module page" pattern contract
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/` is populated with one internal contract (`module-page-pattern.md`): the required shape every module's `page.tsx`/`loading.tsx` pair must follow post-fix. This project exposes no public API/CLI; the "contract" here is the internal engineering pattern that keeps all 18 modules — and any future one — consistently fast, which is exactly what FR-005 requires.

### Source Code (repository root)

No new top-level directories. This feature edits existing files in place:

```text
lib/
├── request-cache.ts                  # NEW — requestCache(): React cache() where available, a plain passthrough under Vitest (research.md §2b)
└── session.ts                        # getUserContext(supabase) — signature unchanged (kept testable, research.md §2); wrapped in requestCache() — MODIFIED

app/(backoffice)/
├── layout.tsx                        # reuses the memoized getUserContext() — MODIFIED
├── facilities/
│   ├── page.tsx                      # reuses memoized context; parallelize timezone query — MODIFIED
│   └── loading.tsx                   # NEW — instant loading UI (Suspense boundary)
├── incidencias/
│   ├── page.tsx                      # reuses memoized context — MODIFIED
│   └── loading.tsx                   # NEW
├── finance/
│   ├── page.tsx                      # reuses memoized context (queries already parallel) — MODIFIED
│   └── loading.tsx                   # NEW
├── users/
│   ├── page.tsx                      # reuses memoized context — MODIFIED
│   └── loading.tsx                   # NEW
├── ... (14 remaining modules: announcements, activities, visitors, packages,
│        maintenance, polls, emergency, broadcast, documentation,
│        suggestions-complaints, apartments, customization, panel, reservations)
│        each gets the same two changes: page.tsx reuses memoized context,
│        and a new loading.tsx sibling — enumerated per-module in tasks.md
└── ...

lib/supabase/
└── storage.ts                        # optional: short-TTL in-memory reuse for repeat signed-URL requests within a request — MODIFIED (research.md §5)
```

**Structure Decision**: This is a targeted performance refactor of the existing Next.js App Router backoffice, not a new project — every change lands inside `app/(backoffice)/` and `lib/`. The two structural additions are (1) a `loading.tsx` sibling next to every module's `page.tsx`, which is Next.js's own file-convention for a route-segment Suspense boundary, and (2) wrapping the existing `getUserContext()` in React's `cache()` so it is computed once per request and reused by both `layout.tsx` and whichever `page.tsx` is rendering, instead of being recomputed independently by each.

## Complexity Tracking

> No entries — Constitution Check reported no violations. The one binding gate condition (Principle III tests for `getUserContext()`) is a testing requirement, not a complexity/architecture exception.
