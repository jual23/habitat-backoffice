# Phase 1 Data Model: Broadcast Module (Send, Persist, Deactivate)

Timestamps are `timestamptz`; ids are `uuid` (`gen_random_uuid()`) unless noted. Follows this
project's established conventions (`specs/001-building-backoffice/SCHEMA-ADAPTATION.md`,
`specs/004-facilities-incidencias-packages/SCHEMA-ADAPTATION.md`): `building_id` on every
tenant-scoped table, an enum per lifecycle rather than a boolean, "who did this" columns
(`sent_by`, `deactivated_by`, `created_by`) left unconstrained (no FK to `auth.users`/`profiles`),
matching `visitors.created_by`/`feedback.user_id`/`tickets.reported_by`.

**Not verified against the live schema** — see research.md item 7. The first implementation task
must confirm the assumptions flagged below before any migration is applied, the same way features
004/006 did.

## New enum: `broadcast_status`

`active | deactivated` — research.md item 4.

## New table: `broadcasts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | Isolation scope (Principle I). |
| `message` | text, NOT NULL | The alert text. Immutable once sent — see Triggers. |
| `icon` | text, nullable | A key into the built-in icon set (research.md item 2); copied from `broadcast_templates.icon` when sent from a template, `NULL` for ad-hoc sends (research.md item 3). Immutable once sent. |
| `template_id` | uuid, nullable, FK `broadcast_templates.id` ON DELETE SET NULL | Which saved template this was sent from, if any — lineage only, not required by any FR. Immutable once sent. |
| `status` | `broadcast_status`, NOT NULL, default `'active'` | spec 008 FR-001. |
| `sent_by` | uuid, NOT NULL | The Building Administrator or Staff member who sent it (Principle IV attribution). Unconstrained, per this schema's convention for actor columns. |
| `deactivated_by` | uuid, nullable | Set when deactivated. Unconstrained, same convention. |
| `deactivated_at` | timestamptz, nullable | Set when deactivated (spec 008 FR-004). |
| `created_at` | timestamptz | When it was sent/activated (spec 008's Key Entity). |
| `updated_at` | timestamptz | |

**Constraints**:
- `CHECK (status <> 'deactivated' OR (deactivated_at IS NOT NULL AND deactivated_by IS NOT NULL))`
  — a deactivated broadcast always records who and when.
- `CHECK (status = 'deactivated' OR (deactivated_at IS NULL AND deactivated_by IS NULL))` — an
  active broadcast never has stale deactivation data.

**Indexes**: `(building_id, status)` — the active-broadcasts list (both the backoffice and,
per spec 008, the mobile app's own query) is always scoped this way.

No uniqueness constraint on `(building_id, status = 'active')` — spec 008's resolved FR-006
requires multiple simultaneous active broadcasts per building to be fully supported.

## New table: `broadcast_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | Isolation scope. |
| `message` | text, NOT NULL | The reusable message text (spec 007 FR-052). |
| `icon` | text, nullable | Same built-in icon key space as `broadcasts.icon` (research.md item 2). |
| `created_by` | uuid, NOT NULL | The Building Administrator who saved it. Unconstrained. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Indexes**: `(building_id)` — the template picker loads all of a building's templates; no
sort/filter infrastructure beyond client-side, matching every other small list in this app.

## Modified table: `buildings`

| Column | Type | Notes |
|---|---|---|
| `staff_broadcast_enabled` | boolean, NOT NULL, default `false` | **NEW**. spec 007 FR-053 / Constitution v1.6.0 — defaults to off; a Building Administrator toggles it on to let Staff send/deactivate broadcasts for their building. |

**Assumption to confirm before implementation** (research.md item 7): `buildings` already has an
UPDATE policy letting a `building_admin` edit their own building's settings — Customization
(feature 001) already lets a `building_admin` edit `accent_color`/`logo_url` on `buildings`, which
strongly implies one exists. If so, `setStaffBroadcastPermission()`'s Server Action reuses that
existing policy unchanged; no new `buildings` RLS policy should be added unless that assumption
turns out to be wrong.

## Reused, unmodified tables

- **`notifications`** — one row inserted per resident/renter of the building per broadcast sent
  (research.md item 1), via the new trigger below (bypasses RLS, same as
  `notify_reservation_decision()`/`notify_visitor_arrival()` already do) — no schema change.
- **`push_tokens`** — read by the same trigger to fan out a push notification per resident, exactly
  like the two existing push-sending triggers already do — no schema change.
- **`profiles`** — `building_id`/`apartment_id` identify "every resident of this building" for both
  the fan-out trigger and (once that role exists) automatically includes future Renter accounts,
  with zero change to this feature (research.md item 6).

## State transitions: `broadcasts.status`

```text
active ──▶ deactivated
```

One-way (spec 008's FR-005 — no automatic expiration, and nothing in either spec re-activates a
deactivated broadcast). Multiple `broadcasts` rows for the same building can independently be
`active` at once (research.md item 4) — this is a per-row lifecycle, not a per-building singleton.

## Triggers (database-enforced business rules)

- **`broadcasts` content-immutability trigger**: a `BEFORE UPDATE` trigger, matching the
  `tickets_content_immutable`/`packages_content_immutable` precedent (feature 004), rejecting any
  change to `NEW.message`, `NEW.icon`, `NEW.building_id`, or `NEW.template_id` versus `OLD` — the
  UPDATE policy that legitimately lets an authorized admin/staff member set `status`/
  `deactivated_at`/`deactivated_by` is a row-level grant that can't itself restrict which columns
  change, so this trigger is the backstop, same reasoning as every prior content-immutability
  trigger in this app.
- **`notify_broadcast_sent()` trigger**: an `AFTER INSERT ON broadcasts`, `SECURITY DEFINER`
  trigger (research.md item 1) that, for every `profiles` row with
  `building_id = NEW.building_id AND apartment_id IS NOT NULL`: inserts one `notifications` row
  (`title` derived from the broadcast, `body = NEW.message`, `link` pointing at wherever the mobile
  app's active-broadcasts view lives), then loops that resident's `push_tokens` and calls
  `net.http_post` to Expo's push endpoint — exactly mirroring `notify_reservation_decision()`'s and
  `notify_visitor_arrival()`'s existing shape.

## Key entity summary (spec.md's Key Entities, made concrete)

- **Broadcast Message** (spec 007/008) = a `broadcasts` row: message, optional icon (inherited from
  a template or none), status (`active`/`deactivated`), who sent/deactivated it and when.
- Predetermined/reusable message = a `broadcast_templates` row, referenced by `broadcasts.template_id`
  when used.
