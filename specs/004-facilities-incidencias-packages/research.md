# Phase 0 Research: Facility Status, Incidencias & Package Receipt

## 1. Ticket ("Incidencia") status model

**Decision**: A single Postgres enum `ticket_status` with exactly five values:
`pending | in_progress | rejected | resolved | duplicate`. Transitions are enforced in the Server
Action layer (not a DB trigger/state machine), mirroring how `reservations.status` and
`visitors.status` transitions are validated in existing actions rather than via a generic
workflow engine.

**Rationale**: Matches spec FR-005–FR-011 exactly; a plain enum + application-level transition
checks is the simplest thing that satisfies Principle V, and is consistent with the codebase's
existing precedent (no DB-level state-machine constraints on `reservation_status`/`visitor_status`
beyond the one `CHECK`/trigger noted in SCHEMA-ADAPTATION.md for visitors' one-way `arrived`
transition).

**Alternatives considered**: A `CHECK` constraint encoding legal transitions (rejected — the
existing codebase doesn't do this for its two other status enums, and it would need updating
whenever a new terminal state is added, working against Principle V); a separate `ticket_status_history`
audit table (rejected as redundant — `audit_log` via `writeAuditLog()` already records every status
change with actor/timestamp per Principle IV, so a second history table would duplicate it).

## 2. Duplicate-ticket linking

**Decision**: `tickets.duplicate_of_ticket_id` (nullable, self-referencing FK to `tickets.id`,
`ON DELETE SET NULL`). Required (NOT NULL enforced at the application/Zod layer, not a DB
constraint, since the column must otherwise stay nullable for every other status) when
`status = 'duplicate'`; a `CHECK (duplicate_of_ticket_id IS NULL OR duplicate_of_ticket_id <> id)`
prevents a ticket from duplicating itself.

**Rationale**: A self-referencing FK is the simplest way to satisfy FR-009 ("select another
existing ticket... display a link to the referenced ticket") and gives the UI a `.select` join
target for one query. `ON DELETE SET NULL` rather than `RESTRICT`/`CASCADE` because tickets aren't
deleted anywhere in this feature (no delete requirement in spec.md) — this is future-proofing
against an eventual delete/cleanup feature, not active behavior here.

**Alternatives considered**: A separate `ticket_duplicates` join table (rejected — over-engineered
for a 1:1 "this ticket points at that one" relationship; Principle V).

## 3. Facility open/closed status computation

**Decision**: Computed client-side (no new column, no server-computed field) in
`facilities-client.tsx`, using the facility's existing `opens_at`/`closes_at`/`open_days` plus the
**building's `timezone`** column (already present on `buildings`, currently unused by the
facilities UI). `open_days` is treated as JS `Date#getDay()` values (0 = Sunday … 6 = Saturday),
matching the only other place the codebase makes a day-of-week assumption (none currently — this
is a new precedent, documented here for `/speckit-tasks`/implementation to follow consistently).
"Now" is derived via `Intl.DateTimeFormat` with the building's `timeZone` option to get the correct
wall-clock day/time regardless of the viewer's own browser timezone. An overnight range
(`closes_at < opens_at`, e.g. 22:00–02:00) is treated as spanning into the next day: open if
`now >= opens_at` OR `now < closes_at` (when `open_days` includes the appropriate day per the Edge
Cases note in spec.md).

**Rationale**: `buildings.timezone` already exists and is exactly the input needed to answer "is it
currently within this facility's hours" correctly for a resident/staff member viewing the page —
computing from server or browser-local time would silently misreport for anyone not physically in
the building's own timezone. No new schema is needed (Principle V) since every required input
already exists on `facilities` and `buildings`.

**Alternatives considered**: A manual `is_open` boolean toggle on `facilities` (rejected —
spec.md's Assumptions explicitly say no manual override is introduced this feature; would also
require staff to remember to flip it, unlike a schedule-derived value which is always accurate);
computing "now" via the request's server clock in UTC without timezone conversion (rejected —
correct only for buildings in UTC, wrong everywhere else, and `timezone` is already there to avoid
exactly this bug).

## 4. Capacity field removal

**Decision**: Remove `capacity` from `facilitySchema` (lib/validation/facilities.ts), the create/edit
form, and the card display. The underlying `facilities.capacity` column is left in place at the
database level (not dropped) — it simply becomes write-once-never (no UI writes it going forward,
existing values become inert).

**Rationale**: Spec FR-020/FR-021 only require the field disappear from the *experience*; the
Assumptions section notes "historical reservation records are unaffected." Dropping the column
would be an irreversible schema change with no stated requirement driving it, and Principle V says
build the minimum the spec needs — leaving the column is strictly simpler and fully reversible if a
future feature wants it back.

**Alternatives considered**: Dropping the `capacity` column outright (rejected — unnecessary
irreversible migration for a UI-only requirement; nothing in spec.md asks for the column's removal,
only the field's).

## 5. Package-arrival notification delivery

**Decision**: Reuse the existing `notifications` table exactly as-is (`user_id`, `building_id`,
`title`, `body`, `link`). The `registerPackage` Server Action, after inserting the `packages` row,
queries `profiles` for every row with `apartment_id = <selected apartment>` and inserts one
`notifications` row per resident found (title e.g. "Tienes un paquete", body = the package
description, `link` pointing at `/packages` — residents don't have a UI in this repo, so the link
is forward-looking for whatever resident-facing surface later reads this same table).

**Rationale**: Matches spec.md's Assumption that package notifications use "the product's existing
in-app notification mechanism." No trigger is used (consistent with how `writeAuditLog()` calls are
explicit in every existing Server Action rather than DB-trigger-driven) — this keeps the "who gets
notified and why" logic visible in one place (Principle V) and matches Constitution Principle IV's
requirement that the action be attributable to the acting Staff/Admin user.

**Alternatives considered**: A DB trigger on `packages` INSERT that fans out to `notifications`
(rejected — the only other scheduled/trigger-driven side effects in this codebase,
`expire_visitors()`/`purge_discarded_feedback()`, are batch sweeps run on a schedule, not
per-insert triggers; a single Server Action call site doesn't need that indirection). External push
notification / email / SMS (rejected — no such integration exists anywhere in the app yet, and
spec.md's Assumptions explicitly scope this to the existing in-app mechanism).

## 6. Staff route access (`middleware.ts`, `sidebar-nav.tsx`)

**Decision**: Extend the existing single-purpose allow-list in `lib/supabase/middleware.ts` from
`pathname.startsWith('/visitors')` to also allow `/incidencias` and `/packages`; extend
`SidebarNav`'s `staffOnly` filter (currently `item.href === '/visitors'`) to include the two new
hrefs.

**Rationale**: Constitution v1.5.0 (amended for this feature) enumerates exactly these three
modules as Staff's scope; both gates already exist as small, explicit allow-lists (not a generic
permission table), so extending them in place is the minimal change consistent with Principle V and
the existing code shape — no new authorization abstraction is introduced.

**Alternatives considered**: Introducing a generic per-role route-permission table/config
(rejected — three hardcoded modules is not yet enough repetition to justify replacing the existing
simple allow-list, per Principle V; revisit only if a fourth Staff module is ever proposed).

## 7. Table sort/filter implementation

**Decision**: Client-side sort and status filter over the full set of tickets loaded for the
building (same pattern as `suggestions-complaints-client.tsx`'s `useMemo`-filtered tab view), not a
server round-trip per sort/filter change.

**Rationale**: Scale/Scope (Technical Context) is tens to low hundreds of rows per building — well
within what a client-side `Array.sort`/`.filter` over already-fetched data handles instantly, and
it avoids adding query-param-driven server refetching infrastructure that nothing else in this app
uses yet (Principle V).

**Alternatives considered**: Server-side sorting/filtering via query params and a fresh Supabase
query per change (rejected as unnecessary complexity at this scale; would be revisited if a
building's ticket volume grows enough to matter, per Principle V's "until a real second use case
exists").

## Summary

All Technical Context unknowns are resolved; no `NEEDS CLARIFICATION` markers remain. No new
runtime dependency is introduced.
