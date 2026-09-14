# Phase 0 Research: Panel Dashboard Overview

No items in Technical Context were left as `NEEDS CLARIFICATION` — this
feature reuses the existing stack (Next.js/Supabase) and existing per-table
patterns throughout. The research below records the concrete decisions made
while translating the spec's business rules into this codebase's existing
conventions.

## 1. Day-boundary ("today") computation

**Decision**: Compute each building's "today" using its `buildings.timezone`
column — `(now() at time zone b.timezone)::date` server-side, or the
equivalent start/end-of-day instants computed in the page's server component
before querying with `.gte('created_at', startOfDay).lt('created_at', endOfDay)`.

**Rationale**: `buildings.timezone` already exists and is the established
pattern for day-boundary logic — `supabase/migrations/0027c_payment_sweeps_timezone_fix.sql`
fixed exactly this bug for payment sweeps (using the database's UTC
`current_date` produced off-by-one-day results near midnight in a building's
local timezone). Reusing the same column keeps "today" consistent across the
whole app rather than introducing a second, competing definition.

**Alternatives considered**:
- Using the server/database's UTC calendar day — rejected: reintroduces the
  exact bug already fixed for payments.
- Adding a new per-request "client timezone" — rejected: unnecessary
  complexity (Principle V) when the building already carries this data; the
  Panel is a building-scoped view, not a personal one.

## 2. Recent-activity feed construction

**Decision**: Run five small `select id, created_at, ... order by created_at
desc limit 5` queries in parallel (one per source table: `visitors`,
`packages`, `tickets`, `emergencies`, `feedback`), each already filtered by
`building_id` and respecting RLS, then merge the ≤25 resulting rows in
memory, sort by `created_at` descending, and take the first 5.

**Rationale**: Matches Principle V and the existing `panel/page.tsx` style,
which already runs a `Promise.all` of independent count queries. Building a
SQL `UNION` view or a generic "activity log" table would be new
infrastructure for a purely additive, read-only feed of five known types —
speculative generality the constitution explicitly discourages ("premature
multi-tenancy features... until a real second use case exists" / "avoid
speculative abstractions"). Merging ≤25 small rows in application code has no
meaningful performance cost.

**Alternatives considered**:
- A dedicated `activity_log` table populated by triggers on each source
  table — rejected for now: real infrastructure for a 5-item, always-live
  feed; revisit only if a second consumer (e.g., a notifications feature)
  needs the same union.
- Reusing `audit_log` — rejected: `audit_log` is populated by *backoffice
  actions* (`writeAuditLog` calls in `actions.ts` files), not by the
  resident-facing creation of visits/packages/tickets/emergencies/feedback
  (which happens outside this repo's backoffice, presumably from a resident
  mobile client writing directly to these tables under RLS). Querying
  `audit_log` would miss most real creation events entirely.

## 3. "Unread" suggestions/complaints — persisted read state

**Decision**: Add a nullable `feedback.viewed_at timestamptz` column. It is
set once, the first time a Building Administrator's session renders
`app/(backoffice)/suggestions-complaints/page.tsx` and sees that row (a
server-side "mark visible rows viewed" step on that page's existing data
fetch), and never reset. The Panel's unread count is
`count(*) where viewed_at is null and discarded_at is null`.

**Rationale**: The clarified answer (`/speckit-specify` Q&A) was "add real
read-tracking." The existing Suggestions/Complaints list
(`suggestions-complaints-client.tsx`) already renders each entry's full
`subject` and `body` inline — there is no separate "open/expand" interaction
to hook into — so the page load *is* the "viewing" moment. This keeps the
change additive (one column, no new UI state) rather than requiring a new
expand/detail view Principle V would flag as unnecessary for what the spec
asks.

**Alternatives considered**:
- Track read state per-viewer (a join table of `feedback_id, user_id,
  viewed_at`) — rejected: the spec's FR-015 defines unread as "not yet opened
  by *anyone*" (building-level, not per-admin), and a join table is
  unwarranted complexity for that.
- Mark read only on an explicit user click (e.g., a new "mark as read"
  button) — rejected: adds a UI affordance and a new decision (what happens
  if no one clicks it, ever) the spec doesn't ask for; simple view-marks-read
  matches how the module already presents full content immediately.

## 4. Staff access to `/panel`

**Decision**: Add `/panel` to the Staff allowlist in
`lib/supabase/middleware.ts` (the enforcement point, per its own comment) and
to the `staffOnly` filter in `sidebar-nav.tsx` (defense-in-depth /
navigation-visibility only). The Panel page itself computes which cards/rows
to render based on `ctx.role`, never rendering a card/row for a module Staff
cannot access.

**Rationale**: Principle II enumerates Staff's *six modules*; the Panel is not
a seventh module granting new data access — it is a read-only aggregate view
over data Staff's existing RLS grants already expose (Visitors, Incidencias,
Package Receipt, Emergency). Because the page itself filters by role (not
just the nav), this is consistent with "Authorization MUST be enforced
server-side... client-side UI state... MUST NOT be treated as an access
control": the actual data-fetching code never queries or returns
Residents/Reservations/Suggestions-Complaints data when `ctx.role === 'staff'`.

**Alternatives considered**:
- A second, Staff-only route (e.g., `/staff-panel`) — rejected: two pages to
  maintain for what is a subset of the same layout; against Principle V.
- Leaving Staff without Panel access and only updating the Building
  Administrator experience — rejected: contradicts FR-012, explicitly
  required by the spec and the original request ("When the admin or staff
  clicks on these...").
