# Phase 0 Research: Building Operations Expansion (US1-US5, US7)

## 1. Distinguishing Renter from Resident: a `profiles` column, not a `user_roles` row

**Decision**: `profiles.tenant_type` — a new `tenant_type` enum (`'resident' | 'renter'`), `NOT NULL
DEFAULT 'resident'`, meaningful only when `apartment_id IS NOT NULL`. `lib/session.ts`'s
`getUserContext()` is extended so the "no `user_roles` row + `apartment_id` set" branch returns
`role: profiles.tenant_type` instead of a hardcoded `'resident'`. `handle_new_user()` (already
extended in feature 006 to read `building_id`/`apartment_id` from `raw_user_meta_data`) additionally
reads `tenant_type`, defaulting to `'resident'` when absent (so every existing/other caller is
unaffected). `lib/user-provisioning.ts`'s `createBuildingUser()` gains a third `role: 'renter'`
option, structurally identical to `'resident'` (same required `apartmentId`, no `user_roles` row)
except it passes `tenant_type: 'renter'` in the Admin API's `user_metadata`.

**Rationale**: Resident is already represented as an *absence* (no `user_roles` row) plus
`profiles.building_id`/`apartment_id`, per `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`.
Renter needs to be "the same kind of thing, but distinguishable" — the minimal change is one new
column read at the exact point Resident is already inferred, not a structural change to how
apartment-scoped accounts are represented. This also directly answers Constitution v1.7.0's Sync
Impact Report's flagged follow-up ("distinguishing Renter from Resident will need its own signal").

**Alternatives considered**: A `user_roles` row with `role = 'renter'` (the `app_role` enum already
has an unused `'resident'` value, suggesting a parallel `'renter'` value) — rejected because it
would make Renter structurally different from Resident (a real `user_roles` row vs. an absence),
complicating every place that currently treats "no `user_roles` row + apartment set" as sufficient
to mean "occupant of an apartment." Finance/Polls exclusion checks become "is `tenant_type =
'resident'`" either way, so this doesn't simplify those checks, it just moves where the bit lives —
keeping it next to `building_id`/`apartment_id` on `profiles`, where the rest of an occupant's
identity already lives, is more consistent as a matter of data locality.

## 2. Fee CSV template download needs a Route Handler, not a Server Action

**Decision**: `app/(backoffice)/finance/template/route.ts` — a `GET` Route Handler that
authenticates the same way a Server Action would (`getUserContext()`), queries the building's
apartments + current fees, builds the CSV text, and returns a `Response` with
`Content-Type: text/csv` and `Content-Disposition: attachment`.

**Rationale**: Next.js Server Actions return serializable data to be consumed by client-side
JavaScript — they cannot hand the browser a native file-download response with the right headers
for a "Save As" flow. A Route Handler is the standard Next.js mechanism for exactly this (a real
HTTP response with custom headers), and this app already has route-group conventions that extend
cleanly to one.

**Alternatives considered**: A Server Action returning the CSV text as a string, with the client
constructing a `Blob`/`<a download>` itself (rejected for the *template download* specifically —
works fine for the payments *export*, which already has the data client-side after filtering, but
the template needs a fresh building-scoped DB query the client shouldn't run directly; a Route
Handler keeps that query server-side and authorized the same way every other read in this app is).
The payments table **export** (FR-024), by contrast, *does* use the simpler client-side
Blob-from-already-loaded-data approach — no Route Handler needed there, since nothing new needs
fetching.

## 3. CSV parsing/generation: hand-rolled, no new dependency

**Decision**: `lib/csv.ts` — two small functions, `parseFeeCsv(text): { apartmentLabel: string;
amount: number }[]` and `generateFeeCsv(rows): string`, handling exactly the fixed two-column shape
(apartment identifier, amount) with basic quoting/escaping for the handful of characters that need
it (commas, quotes, newlines within a field).

**Rationale**: Principle V — this app has no CSV dependency today, and the shape here is fixed and
narrow (two columns, no nested structures, no multi-line records beyond standard CSV quoting). A
full CSV library (e.g., PapaParse) is more than a ~30-line hand-rolled parser needs to be for this
one, well-defined use.

**Alternatives considered**: Adding a CSV library (rejected — Principle V; this app parses no other
CSV anywhere, so there's no existing precedent to extend, and the format here is too simple to
justify a new dependency for).

## 4. Payment generation, late fees, and reminders: two new scheduled sweeps

**Decision**: Two new SQL functions, `generate_monthly_payments()` and
`evaluate_payment_due_dates()`, scheduled via `pg_cron` alongside the existing
`expire_visitors()`/`purge_discarded_feedback()` (feature 001), both running daily:
- `generate_monthly_payments()`: for every building whose `payment_available_day` matches today's
  day-of-month, insert one `payments` row per apartment with a configured `monthly_fee`, computing
  `due_date` from `payment_due_day` — if the due day's numeric value is *less than or equal to* the
  available day's, the due date rolls to next month (a payment can't be due before it's available).
- `evaluate_payment_due_dates()`: for every `payments` row with `status IN ('pending', 'submitted')`
  and `due_date = tomorrow`, insert a reminder `notifications` row per resident (FR-021); for every
  such row with `due_date < today`, apply the building's configured late fee and set
  `status = 'overdue'` (FR-020 — exactly once, since this only fires for rows not already
  `'overdue'`).

**Rationale**: This app already has exactly this shape of requirement solved twice
(`expire_visitors()`, `purge_discarded_feedback()`, both `pg_cron`-scheduled `SECURITY DEFINER`
functions that write their own `audit_log` rows). Reusing it for Finance is the most consistent
choice, not a new mechanism (Complexity Tracking).

**Alternatives considered**: A real-time trigger evaluating on every read (rejected — "due" is a
function of *today's date*, not of any row being written, so there's nothing to trigger off of
without a periodic check). A serverless cron/Edge Function outside Postgres (rejected — `pg_cron`
is already enabled and used in this project; a second scheduling mechanism would be inconsistent
complexity, not less).

## 5. Poll anonymity: an application-layer query-shaping decision, not a column-level RLS rule

**Decision**: `poll_votes` always stores `apartment_id` and `voter_id` (Principle IV — who cast a
vote is always recorded, for audit purposes, regardless of the poll's anonymity setting). RLS lets
a Building Administrator `SELECT` `poll_votes` rows for their building's polls unconditionally.
**Anonymity is enforced by `app/(backoffice)/polls/page.tsx` itself**: for an anonymous poll, the
Server Component queries only aggregate counts per option (`count(*) group by option_id`, never
`apartment_id`/`voter_id`) and passes only that aggregate to the client; for a non-anonymous poll,
it also queries and passes the per-apartment breakdown.

**Rationale**: Postgres RLS is a row-level mechanism — it cannot conditionally hide specific
*columns* of an already-visible row based on another column's value (`anonymous`) without a
separate view or column-privilege scheme, both more machinery than this needs. Since every read in
this app already goes through a Server Component that shapes exactly what reaches the client (no
generic passthrough API), the simplest correct place to enforce "don't show apartment attribution
for an anonymous poll" is the same place that already decides what a query selects.

**Alternatives considered**: Two separate tables (`poll_votes_anonymous`/`poll_votes_attributed`)
gated by different RLS policies (rejected — massively overcomplicated for a display concern, and
still wouldn't need RLS to do the hiding, just the query). A Postgres view exposing only aggregates
for anonymous polls (rejected — adds a schema object for something one `page.tsx` query already
handles cleanly).

## 6. The emergency indicator needs a layout-level change (no topbar exists today)

**Decision**: `app/(backoffice)/layout.tsx` gains a small, absolutely/fixed-positioned indicator
element in the top-right of the `.main` content area (not a new topbar/header row — this app's
shell is sidebar-only today), rendered only when an unhandled emergency exists for the signed-in
user's building, linking to `/emergency`. `SidebarNav`'s Emergency `NAV_ITEMS` entry gets a CSS
animation class applied conditionally on the same "unhandled emergency exists" boolean, passed down
from the layout's own server-side check.

**Rationale**: Spec 007's FR-060 requires the indicator to be visible from *any* backoffice page,
which only the shared layout can provide — this app has never needed a layout-level dynamic element
before (every prior feature's UI lives entirely within its own page/route). This is the plan's one
genuinely new structural pattern (Complexity Tracking), scoped to exactly the one indicator
requested.

**Alternatives considered**: Client-side polling from a component mounted in the layout (rejected
as a first pass — the unhandled-emergency check is a simple building-scoped count query the layout
Server Component already does the same way it already loads `buildingName`/`logoSignedUrl`; no
polling infrastructure is needed for a value that only needs to be fresh on navigation/reload,
matching how the rest of this app has no live-update infrastructure either).

## 7. Maintenance next-due-date advancement: a Server Action, not a trigger

**Decision**: `completeTask()` (maintenance actions) does two writes in one Server Action using the
request-scoped client: insert the `maintenance_completions` row, then update
`maintenance_tasks.next_due_date` (advanced per `frequency`, or set `NULL` for a one-time task).

**Rationale**: Unlike Broadcast's notification fan-out (which needed `SECURITY DEFINER` specifically
to bypass RLS for a building-wide write a single resident's session could never be authorized for),
advancing a task's own `next_due_date` is a normal, already-authorized write the completing Staff/
Admin's own RLS-scoped client can make directly — no elevated privilege is needed, so a trigger
would add indirection without adding capability.

**Alternatives considered**: A trigger on `maintenance_completions` INSERT computing the next date
(rejected — no capability gap to bridge, unlike the cases where this app's existing triggers exist
specifically to bypass RLS or guarantee atomicity across a fan-out; a two-statement Server Action is
simpler and keeps the "what happens when you complete a task" logic in one readable place).

## 8. Photo/attachment storage: reuse existing buckets and path convention

**Decision**: Payment-confirmation photos, maintenance-completion photos, and poll attachments all
use the existing `building-media` (images) / `building-documents` (non-image attachments) buckets
and `{building_id}/...` path convention, via `uploadBuildingFile()`/`trySignedUrlFor()` — new path
segments (`payments`, `maintenance`, `polls`) alongside the existing `facilities`/`packages`/
`tickets` ones.

**Rationale**: Directly matches every prior feature's Storage usage; no new bucket, no new upload
mechanism.

## Summary

Seven new tables (`payments`, `maintenance_tasks`, `maintenance_completions`, `polls`,
`poll_options`, `poll_votes`, `emergencies`), a handful of new columns (`profiles.tenant_type`,
`apartments.monthly_fee`, several `buildings` settings columns), two new scheduled sweeps, one new
Route Handler, one small `lib/csv.ts` helper, and one layout-level UI addition — no new runtime
dependency. All Technical Context unknowns are resolved; no `NEEDS CLARIFICATION` markers remain.
This plan was authored without live database verification this session (Supabase MCP was
disconnected — same caveat as spec 008's plan); the first implementation task should re-confirm
this plan's assumptions against the live schema before any migration is written, per that same
precedent.
