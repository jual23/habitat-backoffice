# Phase 1 Data Model: Module Navigation Performance

This feature introduces **no new persisted data or database entities** — it changes *when and how often* existing data is computed within a single request, and *what the user sees while waiting*. What follows documents the one request-scoped shape this feature touches, and the per-module mapping used to plan and verify the fix (not a database schema).

## 1. `UserContext` (existing type, now request-memoized)

Defined in `lib/session.ts`, unchanged in shape — this feature changes *how many times per request* it is computed (§2 of research.md), never what it contains.

| Shape | Fields | When returned |
|---|---|---|
| App Administrator | `user`, `role: 'app_admin'`, `buildingId: null` | User has an `app_admin` row in `user_roles` |
| Building Admin / Staff | `user`, `role: 'building_admin' \| 'staff'`, `buildingId: string` | User has a `building_admin`/`staff` row in `user_roles` with a building |
| Resident / Renter | `user`, `role: 'resident' \| 'renter'`, `buildingId`, `apartmentId` | No admin/staff role row; `profiles` has `building_id` + `apartment_id` |
| No role | `user`, `role: null`, `buildingId: null` | Signed in, but none of the above resolves |
| Signed out | `user: null`, `role: null`, `buildingId: null` | No active Supabase session |

**Change in this feature**: `getUserContext(supabase)` keeps its existing signature — it still takes a Supabase client as a plain argument, exactly like `createBuildingUser()` (`lib/user-provisioning.ts`), so it stays directly testable outside a Next.js request context (research.md §2, revised during implementation). What changed: (1) `createClient()` (`lib/supabase/server.ts`) is now cached per-request via `requestCache()` (`lib/request-cache.ts`), so every caller within one request receives the *same* client instance instead of a fresh one each time; (2) `getUserContext()` is wrapped in the same `requestCache()`, so — because its `supabase` argument is now stable within a request — the first call (from `layout.tsx`) computes the real value, and every subsequent call in the same request (from whichever module's `page.tsx` is rendering) reads the memoized result instead of re-querying `auth.getUser()`/`user_roles`/`profiles`. `requestCache()` uses React's `cache()` when available (inside the real Next.js app) and is a no-op passthrough otherwise (e.g., under Vitest, where `react`'s plain build doesn't export `cache()` at all — research.md §2b). Either way, the cache key is implicit and request-scoped — it is never keyed by user ID or shared across requests, so two different users' requests can never read each other's cached context (Principle I).

**Validation rule carried over unchanged**: every existing redirect/guard that reads `ctx.role`/`ctx.buildingId` (e.g., `layout.tsx`'s `redirect('/login')` for resident/renter/null roles, each module's own role check) MUST see byte-identical values before and after memoization — this is the Principle III test gate from plan.md.

## 2. Module → loading-state mapping

Not a data entity — the set of route segments this feature adds a `loading.tsx` Suspense boundary to, and (where applicable) parallelizes queries for. The 17 modules below are sourced from `app/(backoffice)/sidebar-nav.tsx`'s `NAV_ITEMS`; Reservations is the 18th — it has its own `app/(backoffice)/reservations/page.tsx` and is in scope even though it isn't a top-level sidebar link, because reservations is a feature residents use from the mobile app and the backoffice's reservations view is real, user-facing surface for administrators managing it (spec.md FR-005).

| Module (route) | `loading.tsx` added | Independent queries to parallelize (research.md §4) |
|---|---|---|
| `/panel` | Yes | Audit during implementation |
| `/facilities` | Yes | Facilities query + building timezone query (currently sequential — confirmed) |
| `/announcements` | Yes | Audit during implementation |
| `/activities` | Yes | Audit during implementation |
| `/visitors` | Yes | Audit during implementation |
| `/incidencias` | Yes | Audit during implementation |
| `/packages` | Yes | Audit during implementation |
| `/finance` | Yes | Already parallel (`Promise.all`) — no change needed beyond removing the redundant `getUserContext()` call |
| `/maintenance` | Yes | Audit during implementation |
| `/polls` | Yes | Audit during implementation |
| `/emergency` | Yes | Audit during implementation |
| `/broadcast` | Yes | Audit during implementation |
| `/documentation` | Yes | Audit during implementation |
| `/suggestions-complaints` | Yes | Audit during implementation |
| `/apartments` | Yes | Audit during implementation |
| `/users` | Yes | Audit during implementation |
| `/customization` | Yes | Audit during implementation |
| `/reservations` | Yes | Audit during implementation (not a sidebar link, but a real module — see note above) |

"Audit during implementation" is intentional, not a gap: `facilities/page.tsx` and `finance/page.tsx` were read directly to seed research.md; the remaining 16 modules follow the same two-step check (does this page call `getUserContext()` redundantly with the now-memoized version — yes, always, since all 38 call sites get the same fix — and does it await independent queries serially) as individual tasks in tasks.md, rather than assumed wholesale from two samples.

## 3. Relationships

```text
Request
 └── getUserContext() [React cache(), computed once]
       ├── read by layout.tsx  (redirect-if-unauthenticated / Staff nav filter)
       └── read by page.tsx    (module-specific role gate + buildingId for queries)

Route segment (per module)
 ├── page.tsx    — Server Component; independent queries run via Promise.all
 └── loading.tsx — Suspense fallback shown immediately while page.tsx resolves
```

## 4. Validation rules (from spec Functional Requirements)

- `getUserContext()`'s memoized result MUST equal its non-memoized result for the same request, for all five `UserContext` shapes (FR-007, Constitution Principle III gate).
- Every module route segment MUST have a `loading.tsx` sibling (FR-003, FR-005).
- No module's `page.tsx` query set may introduce a *new* sequential dependency that didn't exist before — parallelization only removes unnecessary serialization, it never changes query results (FR-008, spec Assumptions).
- A signed-URL cache is explicitly **not** part of this iteration's data model (research.md §5, deferred) — no TTL/cache-key design is finalized here; revisit only if measurement shows it's still needed.
- Any module whose primary content is a potentially-large list MUST cap its initial query to ~25 records (`.range(0, 24)`/`.limit(25)`) rather than fetching the full table (FR-008, research.md §9); a module offering "load more"/pagination beyond that batch is a per-module SHOULD, not a MUST.
