# Phase 1 Data Model: Panel Dashboard Overview

This feature is read-heavy over existing tables. Exactly one schema change is
introduced.

## Schema change

### `feedback` (Suggestions & Complaints) — add `viewed_at`

| Column       | Type          | Nullable | Default | Notes                                                          |
|--------------|---------------|----------|---------|-----------------------------------------------------------------|
| `viewed_at`  | `timestamptz` | yes      | `null`  | Set once, first time a Building Administrator's session renders the Suggestions/Complaints list and this row is included. Never reset (not cleared by discard/undiscard). |

**Migration**: `supabase/migrations/0049_feedback_viewed_at.sql` (renumbered
during implementation — the live database's migration history is ahead of
this repo's tracked `supabase/migrations/` files, already at `0048` via
migrations applied directly through the Supabase MCP for other features;
`0041` was already taken live by `payment_status_add_rejected`)

```sql
alter table public.feedback
  add column viewed_at timestamptz;
```

**No new RLS policy is needed** — confirmed by inspecting the live
`pg_policy` rows for `feedback` directly before writing this migration:
`feedback`'s existing `"feedback managed by admins"` policy is a `FOR ALL`
policy (`using`/`with check`: `can_admin_building(auth.uid(), building_id)`),
which already grants a building_admin/app_admin UPDATE on *every* column of a
row in their own building — including a newly added one. Staff has no policy
on `feedback` at all (no access to this module, per Constitution Principle
II), and residents/renters only have `"feedback insert own"` and `"feedback
read own or admin"` — neither grants UPDATE — so both are correctly denied
without any additional policy. The existing
`feedback_prevent_content_change` trigger only guards
`subject`/`body`/`type`/`user_id`/`building_id` (confirmed via
`pg_get_functiondef`), so it does not block `viewed_at`.

**Validation rules**: None beyond the RLS policy above — `viewed_at` is
server-set (via the Suggestions/Complaints page's own data load), not
user-input, so no zod schema is needed for it.

**State transition**: `null` → `<timestamp>`, one-way (no UI to "mark
unread" — out of scope per the spec).

## Read model (no new tables) — Panel query shapes

All of the following are scoped to `building_id = ctx.buildingId` and, where
noted, to the current building-local calendar day (`research.md` §1).

| Panel element | Source table | Filter | Notes |
|---|---|---|---|
| Residents (top card) | `profiles` | `apartment_id is not null` | Counts Resident + Renter `tenant_type` alike (no filter on it) — matches existing query. |
| Incidencias today (top card) | `tickets` | `created_at` within today | Any status. |
| Paquetería today (top card) | `packages` | `created_at` within today | Any status. |
| Visitas today (top card) | `visitors` | `created_at` within today | Any status. |
| Recent activity (left, ×5) | `visitors`, `packages`, `tickets`, `emergencies`, `feedback` | top 5 by `created_at` from each, merged, top 5 overall | See research.md §2. |
| Open incidencias (right) | `tickets` | `status in ('pending','in_progress')` | Matches `incidencias/page.tsx`'s existing definition. |
| Packages not delivered (right) | `packages` | `status = 'pending'` | Matches `packages/actions.ts`'s existing definition. |
| Unread suggestions/complaints (right) | `feedback` | `viewed_at is null and discarded_at is null` | New — see schema change above. |
| Reservations in progress (right) | `reservations` | `status = 'requested'` | Matches `reservations/actions.ts`'s existing definition; identical to the current Panel's `pendingReservations` query. |

### Role-scoped visibility (not a data filter — an element-visibility rule)

| Element | Building Administrator | Staff |
|---|---|---|
| Residents card | shown | **hidden** (no Users/Residents access) |
| Incidencias/Paquetería/Visitas cards | shown | shown (all three are Staff modules) |
| Activity feed: visit/package/incidencia/emergency entries | shown | shown |
| Activity feed: suggestion/complaint entries | shown | **hidden** (no Suggestions/Complaints access) |
| Open incidencias row | shown | shown |
| Packages not delivered row | shown | shown |
| Unread suggestions/complaints row | shown | **hidden** |
| Reservations in progress row | shown | **hidden** (no Reservations access) |

This mirrors `SidebarNav`'s existing `staffOnly` module list
(Visitors, Incidencias, Package Receipt, Maintenance, Broadcast, Emergency) —
Reservations, Suggestions/Complaints, and Residents/Users are simply not on
it.

## Entities already defined elsewhere (unchanged)

- `tickets` (Incidencia) — `supabase/migrations/0010_tickets.sql`
- `packages` — `supabase/migrations/0013_packages.sql`
- `visitors` — pre-existing (see `lib/supabase/database.types.ts`)
- `emergencies` — `supabase/migrations/0034_emergencies.sql`
- `reservations` — pre-existing (see `lib/supabase/database.types.ts`)
- `profiles` (incl. `tenant_type`) — `supabase/migrations/0022_tenant_type.sql`
