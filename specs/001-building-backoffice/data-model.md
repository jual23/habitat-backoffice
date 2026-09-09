# Phase 1 Data Model: Building Administrator Backoffice

All tables live in the constitutionally-pinned Supabase project **Habitat**. Every table below
(except `buildings`, a prerequisite entity owned by a separate, not-yet-specified feature) carries
`building_id` and is protected by RLS per [contracts/rls-policies.md](./contracts/rls-policies.md).
Timestamps are `timestamptz`; ids are `uuid` (`gen_random_uuid()`) unless noted.

## Prerequisite entity (not created by this feature)

### `buildings`
Referenced by every table below via `building_id`. Assumed to already exist, created by the App
Administrator's building-management feature (see spec.md Assumptions).

- `id` (PK)
- `name`

## `profiles`
One row per `auth.users` row. Unifies all four kinds of human account (App Administrator,
Building Administrator, Staff, and Resident "User") behind a single `role` column, per
research.md item 2.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK, FK → `auth.users.id` | |
| `email` | text | Kept in sync with `auth.users.email`; editable by a Building Administrator for their building's residents (FR-004). |
| `role` | enum: `app_admin`, `building_admin`, `staff`, `resident` | Constitution Principle II's three administrative roles, plus `resident` for the Users module's managed accounts. |
| `building_id` | uuid, FK → `buildings.id`, nullable | Required for `building_admin` and `staff`; null for `app_admin` (spans all buildings) and `resident` (see `apartment_id`). |
| `apartment_id` | uuid, FK → `apartments.id`, nullable, `ON DELETE RESTRICT` | Required for `role = resident` only (FR-002). The `RESTRICT` is what enforces "cannot delete an apartment with residents" (Edge Cases). |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Validation**: a `CHECK` constraint enforces exactly one of these three shapes, matched to
`role`:

| `role` | `building_id` | `apartment_id` |
|---|---|---|
| `app_admin` | must be `NULL` | must be `NULL` |
| `building_admin`, `staff` | required (their building) | must be `NULL` |
| `resident` | must be `NULL` | required (their apartment) |

A resident's building is reached via `apartments.building_id`, so residents don't need a separate
`building_id` column value. Staff rows (`role = 'staff'`) may only be inserted/deleted by a
`building_admin` of the same `building_id` (FR-039/FR-040) — see
[contracts/rls-policies.md](./contracts/rls-policies.md).

## `apartments`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `unit_label` | text | e.g. "4B". Unique per `building_id` (FR-001). |
| `created_at` | timestamptz | |

**Relationships**: has many `profiles` (`role = resident`) — multiple residents per apartment
allowed (FR-003).

## `facilities`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `name` | text | e.g. "Gymnasium" (FR-008). |
| `image_url` | text, nullable | Path into the `facility-images` Storage bucket. |
| `opening_hours` | text | Free-form per spec Assumptions (applies uniformly every day; no per-day schedule in v1). |
| `is_reservable` | boolean, default `false` | Gates whether reservations can be created (FR-008). |
| `deleted_at` | timestamptz, nullable | Soft delete (Principle IV) — see Triggers below for FR-009's cascade behavior. |
| `created_at` / `updated_at` | timestamptz | |

## `reservations`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `facility_id` | uuid, FK → `facilities.id` | |
| `building_id` | uuid, FK → `buildings.id` | Denormalized from the facility for simpler RLS policies. |
| `requested_by` | uuid, FK → `profiles.id` | The resident who requested it (created out-of-band; see spec.md Assumptions). |
| `starts_at` / `ends_at` | timestamptz | The requested time slot. |
| `status` | enum: `requested`, `approved`, `declined` | FR-010. |
| `decided_by` | uuid, FK → `profiles.id`, nullable | Building Administrator who approved/declined (FR-038 audit trail). |
| `decided_at` | timestamptz, nullable | |
| `created_at` | timestamptz | |

**State transitions**: `requested → approved` (FR-011), `requested → declined` (FR-012 and the
FR-009 cascade). `approved`/`declined` are terminal — no further transitions in this version.

## `announcements`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `title` / `body` | text | FR-014. |
| `banner_image_url` | text, nullable | FR-016. |
| `pinned` | boolean, default `false` | FR-017/018. |
| `created_by` | uuid, FK → `profiles.id` | Audit (FR-038). |
| `created_at` / `updated_at` | timestamptz | |

**Ordering**: list queries `ORDER BY pinned DESC, created_at DESC` — this is how "pinned appears
above unpinned" (Acceptance Scenario 4/5) is realized without a separate sort-order column.

## `announcement_attachments`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `announcement_id` | uuid, FK → `announcements.id`, `ON DELETE CASCADE` | FR-015. |
| `file_url` | text | Path into the `announcement-attachments` bucket. |
| `file_name` | text | Original filename, for display. |
| `uploaded_at` | timestamptz | |

## `activities`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `name` | text | |
| `activity_date` | timestamptz | FR-019. |
| `max_participants` | integer, nullable, `CHECK (max_participants IS NULL OR max_participants > 0)` | FR-020. |
| `banner_image_url` | text, nullable | |
| `created_at` / `updated_at` | timestamptz | |

## `visitors`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `name` | text | |
| `status` | enum: `expected`, `arrived`, `expired` | FR-021. Default `expected`. |
| `created_at` | timestamptz | Expiry is computed from this (`created_at + interval '8 hours'`), not stored redundantly. |
| `arrived_at` | timestamptz, nullable | Set when marked arrived (FR-023). |

**State transitions**: `expected → arrived` (Staff action, FR-023). `expected → expired`
(automatic, FR-024, via the `visitor-expiry` scheduled function — see
[contracts/edge-functions.md](./contracts/edge-functions.md)). `arrived` is terminal and MUST NOT
be overwritten by the expiry sweep (FR-025) — the sweep's `WHERE status = 'expected'` clause is
what guarantees this.

## `folders`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `parent_folder_id` | uuid, FK → `folders.id`, nullable, `ON DELETE CASCADE` | Self-reference for nesting (FR-028). Null = top-level folder. |
| `name` | text | |
| `created_at` | timestamptz | |

## `documents`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `folder_id` | uuid, FK → `folders.id`, `ON DELETE CASCADE` | FR-029 — deleting a folder deletes its documents' rows automatically; the owning server action additionally purges the corresponding Storage objects (row cascade alone doesn't delete Storage bytes). |
| `building_id` | uuid, FK → `buildings.id` | Denormalized for simpler RLS policies. |
| `file_url` | text | Path into the `documents` bucket. |
| `file_name` | text | |
| `uploaded_by` | uuid, FK → `profiles.id` | Audit (FR-038). |
| `uploaded_at` | timestamptz | |

## `suggestions_complaints`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id` | |
| `type` | enum: `suggestion`, `complaint` | Drives the two tabs (FR-030). |
| `content` | text | Resident-submitted; read-only to Building Administrators (spec.md Assumptions). |
| `submitted_by` | uuid, FK → `profiles.id` | The resident (created out-of-band; see spec.md Assumptions). |
| `favorited` | boolean, default `false` | FR-031. |
| `discarded_at` | timestamptz, nullable | FR-032/033. A second discard on an already-discarded row is a no-op (Edge Cases) — enforced in the server action, not by re-writing `discarded_at`. |
| `created_at` | timestamptz | |

## `building_customization`

One row per building (1:1).

| Field | Type | Notes |
|---|---|---|
| `building_id` | uuid, PK, FK → `buildings.id` | |
| `accent_color` | text | Hex color string (FR-034). |
| `logo_url` | text, nullable | Path into the `branding-logos` bucket; upload validated as square before storing (FR-035). |
| `updated_at` | timestamptz | |

## `audit_log`

Cross-cutting (FR-038, Constitution Principle IV).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `building_id` | uuid, FK → `buildings.id`, nullable | Null only for App Administrator actions that span buildings. |
| `actor_id` | uuid, FK → `profiles.id` | |
| `action` | text | e.g. `facility.create`, `reservation.approve`, `visitor.mark_arrived`. |
| `entity_type` / `entity_id` | text / uuid | What was acted on. |
| `metadata` | jsonb, nullable | Free-form details (e.g., previous → new value for edits). |
| `created_at` | timestamptz | |

**Write path**: rows are never inserted directly by a client role (see
[contracts/rls-policies.md](./contracts/rls-policies.md) — no role has an INSERT grant on this
table). Every write goes through the `log_audit(actor_id, building_id, action, entity_type,
entity_id, metadata)` `SECURITY DEFINER` SQL function (research.md item 7), which any
authenticated role may call via RPC; the function validates `actor_id` against the caller's own
`auth.uid()` (a caller can never log an action as someone else) before inserting, bypassing RLS
for that single trusted write.

## Triggers (database-enforced business rules)

- **`facilities` soft-delete cascade** (FR-009): a `BEFORE UPDATE` trigger on `facilities` that,
  when `deleted_at` transitions from `NULL` to non-null, sets `status = 'declined'` on all of that
  facility's `reservations` still `status = 'requested'`.
- **Apartment deletion block** (Edge Cases): no trigger needed — the `profiles.apartment_id`
  foreign key's `ON DELETE RESTRICT` makes Postgres itself refuse the delete while residents
  remain, surfacing as a standard FK-violation error for the UI to translate into a friendly
  message.
- **Folder deletion cascade** (FR-029): no trigger needed for the row data — `ON DELETE CASCADE`
  on `folders.parent_folder_id` and `documents.folder_id` handles it declaratively.

Time-based state changes (visitor expiry, discard cleanup) are handled by scheduled Edge
Functions, not triggers — see [contracts/edge-functions.md](./contracts/edge-functions.md) and
research.md item 4 for why.
