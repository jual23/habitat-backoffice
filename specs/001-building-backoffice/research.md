# Phase 0 Research: Building Administrator Backoffice

All items below were resolved during planning; no `NEEDS CLARIFICATION` markers remain in
Technical Context.

## 1. Architecture: direct Supabase client + RLS vs. custom backend API

**Decision**: Next.js talks to Supabase directly from server actions (and, where appropriate,
client components) using the Supabase JS client. All authorization and multi-tenant isolation is
enforced by Postgres Row Level Security policies, not by a hand-rolled API layer.

**Rationale**: Confirmed with the user as the preferred architecture. It satisfies Principle I
(isolation enforced at the data-access layer, not hidden in the UI) and Principle II
(server-side-enforced authorization) about as strictly as possible — Postgres itself refuses the
query, regardless of what the client does — while adding zero extra infrastructure, which is what
Principle V (Simplicity) asks for at this stage.

**Alternatives considered**:
- *Custom backend API service* (Node/Express, etc.) owning all business logic, with Supabase used
  only as a database — rejected for now: it duplicates authorization logic in application code
  that RLS already gives us at the database layer, adds a service to deploy/operate, and the spec
  has no requirement (e.g., non-Postgres consumers, complex orchestration) that RLS can't satisfy.
  Revisit if a future feature needs logic RLS genuinely cannot express.

## 2. Modeling roles (App Administrator, Building Administrator, Staff) in Supabase

**Decision**: A `profiles` table (one row per `auth.users` row) carries `role` (`app_admin` |
`building_admin` | `staff`) and, for `building_admin`/`staff`, a `building_id` foreign key. RLS
policies join against `profiles` (via `auth.uid()`) rather than relying on Supabase Auth custom
JWT claims.

**Rationale**: A joined table is simpler to query, update, and audit than custom claims baked into
JWTs (which require a token refresh or a claims-hook to change), and keeps role/building
assignment as ordinary rows subject to the same audit trail (Principle IV) as everything else.
`app_admin` rows have no `building_id` (their access spans all buildings, per Principle I's
explicit exception).

**Alternatives considered**:
- *Custom JWT claims* for role/building — rejected: faster to read at the edge, but harder to
  revoke/change instantly (stale tokens) and adds indirection for a project this size.

## 3. Enforcing per-building isolation with RLS

**Decision**: Every feature table includes a non-nullable `building_id`. A single reusable SQL
helper function (`is_building_member(building_id)` — checks the caller's `profiles` row) backs
`USING`/`WITH CHECK` clauses across all policies, plus a separate `is_app_admin()` helper that
bypasses the building check.

**Rationale**: A shared helper function keeps ~40 policies (roughly one SELECT/INSERT/UPDATE/DELETE
set per table) consistent and reviewable in one place, directly satisfying Principle I's
"structurally, not by convention" requirement — a typo'd policy is far more visible when it fails
to call the shared helper than when isolation logic is duplicated ad hoc per table.

**Alternatives considered**:
- *Per-table bespoke policy logic* — rejected: higher risk of one table's isolation policy being
  written (or edited) incorrectly and silently leaking data.

## 4. Time-based background rules (visitor 8h expiry, discard 24h delete)

**Decision**: Two Supabase Edge Functions, each invoked on a schedule (`pg_cron` triggering an
HTTP call, or Supabase's native Cron Triggers) roughly every 5–15 minutes:
`visitor-expiry` (FR-024) and `discard-cleanup` (FR-033).

**Rationale**: Both rules are pure time-based state transitions with no user-facing latency
requirement (a few minutes of slack past the 8h/24h mark is acceptable — the spec's SC-003/SC-004
allow a 24–25h window), so a periodic sweep is simpler and cheaper than a per-row scheduled job or
a client-side check. Edge Functions (rather than a `pg_cron`-scheduled SQL function directly) are
used so the same audit-log-writing code path (FR-038) is reused instead of duplicated in SQL.

**Alternatives considered**:
- *Per-row scheduled jobs* — rejected: unnecessary operational complexity for a coarse, tolerant
  deadline.
- *Client-side/on-read expiry* (compute status on the fly when a list is queried) — rejected: FR-024
  and FR-033 require the status to actually change (and, for discard-cleanup, the row to actually
  be deleted) independent of anyone viewing the list; a purely on-read approach would leave stale
  "Expected"/discarded rows in the database indefinitely if nobody looks.

## 5. File uploads (facility images, banners, logos, documents)

**Decision**: A single Supabase Storage bucket per asset category (`facility-images`,
`announcement-attachments`, `activity-banners`, `documents`, `branding-logos`), with object paths
prefixed by `building_id/...` and Storage RLS policies mirroring the same `is_building_member` /
`is_app_admin` helpers used for table policies.

**Rationale**: Supabase Storage policies can reuse the exact same SQL helper functions as table
RLS, keeping isolation logic in one place (see item 3) instead of re-implementing it for files.
Splitting by asset category (rather than one giant bucket) keeps per-bucket size/type validation
rules (e.g., square-logo check, image vs. document MIME types) simple and independent.

**Alternatives considered**:
- *One shared bucket for everything* — rejected: mixes validation rules (e.g., "must be square"
  only applies to logos) and makes bucket-level policy review harder.

## 6. Testing RLS and authorization rules (Principle III)

**Decision**: Vitest integration tests run against a local Supabase stack (`supabase start`).
Each test authenticates as a seeded test user of a given role/building via the Supabase JS client
and asserts the expected allow/deny outcome directly against the real database — no mocking of
Postgres or RLS.

**Rationale**: Principle III requires authorization tests covering both allowed and denied cases
before implementation. Testing against a real local Postgres with real RLS policies is the only
way to actually verify the policies (a mocked or application-level test would test the mock, not
the enforcement mechanism that matters).

**Alternatives considered**:
- *pgTAP* (SQL-native RLS test framework) — a reasonable alternative; not chosen only to keep the
  whole test suite in one language/runner (TypeScript/Vitest) per Principle V, avoiding a second
  test toolchain. Revisit if RLS policies grow complex enough that SQL-native testing pays for
  itself.

## 7. Writing to `audit_log` from ordinary (non-service-role) server actions

**Decision**: `audit_log` has no direct INSERT grant for any role. All writes from ordinary,
session-authenticated server actions go through a single `log_audit(actor_id, building_id,
action, entity_type, entity_id, metadata)` Postgres function marked `SECURITY DEFINER`, exposed
as an RPC. The function itself checks `actor_id = auth.uid()` before inserting, so it can safely
bypass RLS without letting a caller log an action as someone else.

**Rationale**: `/speckit-analyze` (finding I1) caught that the original design — ordinary
`building_admin`/`staff` server actions calling `writeAuditLog()` with their normal
session-scoped client — would have been silently denied by RLS, since `audit_log` INSERT was
scoped to the service role only. A `SECURITY DEFINER` function is the standard Postgres/Supabase
pattern for "let any authenticated user trigger one specific, narrowly-scoped privileged write"
without handing out a service-role key (which would defeat RLS for everything, not just audit
logging) or duplicating the service role into ordinary application code.

**Alternatives considered**:
- *Grant `authenticated` a scoped RLS INSERT policy on `audit_log` directly* (e.g., "insert only
  where `actor_id = auth.uid()`") — rejected: it's workable, but a `SECURITY DEFINER` function is
  more defensible for an append-only, immutable audit table (no policy misconfiguration can ever
  let a role read back and tamper with its own just-inserted row before the transaction commits,
  and the function is one reviewable choke point for all audit writes).
- *A dedicated service-role-only server client for audit writes* — rejected: it would mean every
  server action needs two Supabase clients (its own session client, plus a service-role one just
  for the audit call), which is more surface area for a service-role key to leak than a single
  `SECURITY DEFINER` function.
