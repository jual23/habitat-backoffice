# Internal Contract: Backoffice Module Page Pattern

This is not a public API — it's the internal pattern every module under `app/(backoffice)/` MUST follow after this feature, so the 1-second navigation target (FR-005, SC-005) holds consistently and any future module starts out fast rather than needing a follow-up fix. Reviewers should check new/changed module pages against this contract the same way authorization changes are checked against Principle I/III (constitution → Development Workflow & Quality Gates).

## Required shape

```text
app/(backoffice)/<module>/
├── page.tsx      # Server Component
└── loading.tsx   # Suspense fallback — REQUIRED, sibling of page.tsx
```

## `page.tsx` contract

1. **MUST** obtain the signed-in user's context via the memoized `getUserContext()` from `lib/session.ts` — **MUST NOT** re-implement or duplicate the `auth.getUser()` / `user_roles` / `profiles` lookups locally.
2. **MUST** issue all *independent* Supabase queries (queries that don't depend on another query's result) together via `Promise.all`, not as separate sequential `await` statements. A query MAY still be sequential if it genuinely depends on data from an earlier query (e.g., needs an ID the first query returned) — the contract is "no *unnecessary* serialization," not "no serialization ever."
3. **MUST NOT** change its own role/access checks, RLS-scoped filters (`.eq('building_id', ...)`, etc.), or redirect conditions as part of adopting this pattern — this contract governs *speed*, not *authorization logic* (Constitution Principle II/III boundary).
4. **SHOULD** keep expensive per-row work (e.g., signed-URL generation for N images) inside its own `Promise.all` so it runs concurrently with, or immediately after, the primary list query — never nested behind a second, avoidable round trip.
5. **MUST** cap its primary list query to an initial batch of ~25 records (e.g., `.range(0, 24)` or `.limit(25)`) rather than fetching the full table, if that module's content is a list that can grow large (research.md §9, FR-008). A module whose content is naturally small and bounded (e.g., a fixed set of settings) is exempt.
6. **SHOULD** offer a way to fetch/view records beyond the initial batch (pagination or "load more") where the module's `*-client.tsx` UI reasonably supports it — a per-module judgment call, not mandatory for every module.

## `*-client.tsx` pagination note

Rule 6 above is optional per module by design. Where adopted, the simplest pattern is a "load more" control in the client component that calls a Server Action for the next `range()`/`limit()` batch, appending to the existing list client-side — no new global pagination component or state-management library is required (Principle V).

## `loading.tsx` contract

1. **MUST** exist for every module route segment — Next.js uses it automatically as the `<Suspense>` fallback for that segment's `page.tsx`; no manual `<Suspense>` wiring is needed or expected.
2. **SHOULD** visually approximate the module's real layout (e.g., a card/list skeleton for list-style modules) closely enough that the transition from loading state to real content doesn't jump/reflow jarringly — but MUST NOT fetch data or perform any authorization check itself; it is a static fallback.
3. **MUST** render fast enough to be visible well under 300ms (it has no data dependency, so this should hold trivially) — this is what satisfies FR-003/SC-004.

## Example (reference implementation)

`app/(backoffice)/facilities/page.tsx` and its new `app/(backoffice)/facilities/loading.tsx` (introduced by this feature) are the reference example other modules' tasks are modeled on: memoized context, `Promise.all` over the facilities query and the building-timezone query, the facilities query capped to an initial ~25-record batch (rule 5), and a lightweight list-skeleton `loading.tsx`.

## Out of scope for this contract

- Signed-URL caching (research.md §5) — not part of this contract; revisit separately if a future measurement shows it's needed.
- Client Component (`*-client.tsx`) internals beyond the optional "load more" pagination note above (rule 6) — this contract otherwise governs the Server Component `page.tsx`/`loading.tsx` pair only, not how the client component renders the data it receives.
