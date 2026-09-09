# Contract: Row Level Security Policies

This is the authorization contract for the feature — with a direct Supabase client and no custom
backend (research.md item 1), these RLS policies **are** the enforcement point for Constitution
Principle I (isolation) and Principle II (roles). Every policy in this feature reuses two SQL
helper functions (research.md item 3):

- `is_app_admin()` — true if the caller's `profiles.role = 'app_admin'`.
- `is_building_member(target_building_id uuid)` — true if the caller's `profiles.building_id` (for
  `building_admin`/`staff`) or `profiles.apartment_id`'s building (for `resident`) equals
  `target_building_id`.

Per Principle III, a Vitest integration test for **both** the allow case and the deny case of each
row below MUST exist (and fail against an unimplemented policy) before that policy is written.

## `apartments`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`staff` of the same building; `resident` of that apartment's building; `app_admin` | Everyone else |
| INSERT / UPDATE / DELETE | `building_admin` of the same building (DELETE additionally blocked by FK RESTRICT while residents remain — see data-model.md) | `staff`, `resident`, other buildings' `building_admin` |

## `profiles` (resident and staff rows are managed here; `app_admin`/`building_admin` rows are
provisioned by the separate building-management feature per the constitution's Security & Access
Control Requirements — see spec.md Assumptions)

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Self; `building_admin`/`staff` of the same building; `app_admin` | Cross-building |
| INSERT (`role = resident`) | `building_admin` of the target apartment's building | `staff`, other buildings |
| UPDATE (email, `apartment_id`) on `role = resident` rows | `building_admin` of the resident's current building (FR-004/005) | `staff`, other buildings, self (residents don't self-edit in this feature) |
| DELETE (`role = resident`) | `building_admin` of that resident's building (FR-006) | `staff`, other buildings |
| INSERT (`role = staff`) | `building_admin` of the target `building_id` (FR-039); `building_id` MUST equal the inserting admin's own | `staff`, `resident`, other buildings, and any insert where `role` is not exactly `'staff'` |
| DELETE (`role = staff`) | `building_admin` of that staff row's building (FR-040) | `staff`, `resident`, other buildings |
| UPDATE on `role = staff` rows | Nobody — a Staff account is created or removed, never edited, in this feature | Everyone |
| INSERT/UPDATE/DELETE where the target `role` is `app_admin` or `building_admin` | Nobody, via this feature | Everyone — those rows are owned by the separate building-management feature |

## `facilities`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Anyone in the same building (`building_admin`, `staff`\*, `resident`); `app_admin` | Cross-building. \*Staff has no UI for this per FR-037, but table-level SELECT is harmless since Staff already sees building-scoped facility names via visitor context; UI enforcement still hides the module. |
| INSERT / UPDATE / DELETE | `building_admin` of the same building (FR-008/009) | `staff`, `resident`, other buildings |

## `reservations`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin` of the facility's building (FR-013); the `resident` who made the request | Other residents, `staff`, other buildings |
| INSERT (`status = 'requested'` only) | Out of scope for this feature (spec.md Assumptions) — policy still exists so the resident-facing feature can rely on it later | N/A |
| UPDATE (`status → approved`/`declined`) | `building_admin` of the facility's building only, and only when current `status = 'requested'` (FR-011/012) | `staff`, `resident`, other buildings |

## `announcements` / `announcement_attachments`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Anyone in the same building; `app_admin` | Cross-building |
| INSERT / UPDATE / DELETE | `building_admin` of the same building (FR-014–018) | `staff`, `resident`, other buildings |

## `activities`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Anyone in the same building; `app_admin` | Cross-building |
| INSERT / UPDATE / DELETE | `building_admin` of the same building (FR-019/020) | `staff`, `resident`, other buildings |

## `visitors`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `staff` and `building_admin` of the same building (FR-022) | `resident`, other buildings |
| INSERT | Out of scope for this feature (spec.md Assumptions) — policy exists for the future resident-facing feature | N/A |
| UPDATE (`status: expected → arrived` only) | `staff` and `building_admin` of the same building (FR-023) | `resident`, other buildings, and any transition away from `arrived` (FR-025 — enforced by a `CHECK`/trigger rejecting updates where `OLD.status = 'arrived'`) |

## `folders` / `documents`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Anyone in the same building; `app_admin` | Cross-building |
| INSERT / UPDATE / DELETE | `building_admin` of the same building (FR-026/027) | `staff`, `resident`, other buildings |

## `suggestions_complaints`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin` of the same building (FR-030); the `resident` who submitted it | Other residents, `staff`, other buildings |
| INSERT | Out of scope for this feature (spec.md Assumptions) — policy exists for the future resident-facing feature | N/A |
| UPDATE (`favorited`, `discarded_at` only) | `building_admin` of the same building (FR-031/032) | `staff`, `resident`, other buildings, and any change to `content`/`type` (spec.md Assumptions — content is read-only to admins) |

## `building_customization`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Anyone in the same building; `app_admin` | Cross-building |
| INSERT / UPDATE | `building_admin` of the same building (FR-034/035) | `staff`, `resident`, other buildings |
| DELETE | Nobody through this feature (row is created once, then updated) | — |

## `audit_log`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin` of the same building; `app_admin` | `staff`, `resident`, other buildings |
| INSERT (direct table insert) | Nobody — no role has a direct INSERT grant, including `building_admin`/`app_admin` | Everyone |
| INSERT (via the `log_audit(...)` RPC, see data-model.md) | Any authenticated role, for actions they themselves performed (the function pins `actor_id` to the caller's own `auth.uid()`) | Logging an action as a different `actor_id` |
| UPDATE / DELETE | Nobody — audit rows are immutable | Everyone |

Scheduled Edge Functions (`visitor-expiry`, `discard-cleanup`) use the Supabase service role, which
bypasses RLS entirely, so they call `log_audit(...)` (or insert directly) without going through the
RPC's caller-identity check — see [edge-functions.md](./edge-functions.md).

## Storage bucket policies

The five Storage buckets (`facility-images`, `announcement-attachments`, `activity-banners`,
`documents`, `branding-logos`) use path-prefix (`{building_id}/...`) policies built from the same
`is_building_member`/`is_app_admin` helpers, mirroring the table each bucket belongs to: write
access matches that table's INSERT/UPDATE grant above, read access matches its SELECT grant.
