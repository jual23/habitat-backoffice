# Phase 1 Data Model: Facility Status, Incidencias & Package Receipt

Timestamps are `timestamptz`; ids are `uuid` (`gen_random_uuid()`) unless noted. This extends the
live Habitat Supabase schema (see `specs/001-building-backoffice/SCHEMA-ADAPTATION.md` for the
project's naming conventions this follows: `building_id` on every tenant-scoped table, `profiles.id`
as the FK target for "a user" rather than `auth.users.id` directly).

## New enum: `ticket_status`

`pending | in_progress | rejected | resolved | duplicate` — see research.md item 1.

## New enum: `package_status`

`pending | picked_up`

## New table: `tickets` (Incidencia)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` | Isolation scope (Principle I). |
| `apartment_id` | uuid, nullable, FK `apartments.id` | Denormalized from the reporter's `profiles.apartment_id` at creation time, for display without a join. Nullable in case a future ticket-creation path allows a common-area report not tied to one apartment. |
| `reported_by` | uuid, NOT NULL, FK `profiles.id` | The resident who filed it. Ticket *creation* is out of this feature's scope (spec.md Assumptions) — this column is populated by whatever process inserts the row; this feature only reads it for display and to know who a comment/rejection-reason is visible to. |
| `title` | text, NOT NULL | FR-002. Immutable once filed — see Triggers below. |
| `description` | text, nullable | Free-form detail beyond the title. Immutable once filed — see Triggers below. |
| `status` | `ticket_status`, NOT NULL, default `'pending'` | FR-005/FR-011. |
| `rejection_reason` | text, nullable | Required by the app layer when `status = 'rejected'` (FR-008); a `CHECK` enforces this at the DB level too (see Triggers/Constraints below) since it's cheap and matches the codebase's existing use of `CHECK` for similarly hard invariants (e.g. `activities_max_participants_check`). |
| `duplicate_of_ticket_id` | uuid, nullable, FK `tickets.id` ON DELETE SET NULL | Required by the app layer when `status = 'duplicate'` (FR-009); must reference a ticket that is currently `pending` or `in_progress` at the moment the link is created (FR-009) — see Constraints and Triggers. |
| `created_at` | timestamptz | FR-002 (sortable creation date). |
| `updated_at` | timestamptz | |

**Constraints**:
- `CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)` — FR-008.
- `CHECK (status <> 'duplicate' OR duplicate_of_ticket_id IS NOT NULL)` — FR-009.
- `CHECK (duplicate_of_ticket_id IS NULL OR duplicate_of_ticket_id <> id)` — Edge Cases ("cannot
  duplicate itself").

Two further rules from FR-009 and FR-010 — the duplicate target's status, and the ticket's own
prior status before becoming `resolved` — depend on looking at *another row* (or the row's *own
prior* value), which a plain `CHECK` constraint cannot express (a `CHECK` only sees the one row
being written, not `OLD` or other rows). Both are enforced instead via the RLS `UPDATE` policy's
`WITH CHECK` and a trigger, respectively — see contracts/rls-policies.md and Triggers below.

**Indexes**: `(building_id, status)` and `(building_id, created_at)` to support the table's default
scoped load and sort; a plain b-tree on `title` is unnecessary since sort-by-title happens
client-side over the already-scoped result set (research.md item 7).

## New table: `ticket_comments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `ticket_id` | uuid, NOT NULL, FK `tickets.id` ON DELETE CASCADE | |
| `author_id` | uuid, NOT NULL, FK `profiles.id` | The Staff/Admin who wrote it (FR-007). |
| `body` | text, NOT NULL | |
| `created_at` | timestamptz | |

No `updated_at`/edit support — comments are an append-only status-update log (spec.md doesn't
request editing or deleting a comment).

## New table: `packages`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` | Isolation scope. |
| `apartment_id` | uuid, NOT NULL, FK `apartments.id` | FR-014 (selected from the dropdown). |
| `description` | text, NOT NULL | FR-014. Immutable once registered — see Triggers below. |
| `photo_url` | text, nullable | Storage object path in the existing `building-media` bucket (FR-014/FR-015 — optional); read via `trySignedUrlFor()` like every other image in the app. Immutable once registered — see Triggers below. |
| `status` | `package_status`, NOT NULL, default `'pending'` | FR-017. |
| `registered_by` | uuid, NOT NULL, FK `profiles.id` | The Staff/Admin who logged it (Principle IV attribution). |
| `picked_up_at` | timestamptz, nullable | Set when marked "Recogido" (FR-018). |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Indexes**: `(building_id, status)` for the pending/picked-up split view.

## Modified table: `facilities`

No schema change. `capacity` remains in the table (research.md item 4) but is no longer written or
read by the create/edit form or card. The open/closed bubble is computed from the already-existing
`opens_at`, `closes_at`, `open_days` columns plus `buildings.timezone` — no new column.

## Reused, unmodified tables

- **`buildings.timezone`** — read (not written) by the facilities open/closed calculation
  (research.md item 3).
- **`apartments`** — `unit_number` (with `tower`) populates the package form's dropdown (FR-014) and
  the ticket's denormalized `apartment_id` display.
- **`profiles`** — `apartment_id` identifies "every resident of the selected apartment" for
  package notifications (FR-016) and is the join target for `reported_by`/`author_id`.
- **`notifications`** — one row inserted per resident per registered package (research.md item 5);
  no schema change.
- **Storage `building-media` bucket** — package photos, same `{building_id}/...` path convention as
  facility/announcement/activity images.

## State transitions: `tickets.status`

```text
pending ──▶ in_progress ──▶ resolved
   │             │
   │             └────────▶ duplicate (requires duplicate_of_ticket_id)
   │
   └────────────────────────▶ rejected (requires rejection_reason)
   └────────────────────────▶ duplicate (requires duplicate_of_ticket_id)
```

Enforced in the `incidencias/actions.ts` Server Actions (research.md item 1): a transition request
is rejected with a validation error if the required companion field (`rejection_reason` /
`duplicate_of_ticket_id`) is missing, before the row is written — matching FR-008/FR-009 and the
Edge Cases ("Rejecting a ticket without entering a reason must be blocked"). `resolved`, `rejected`,
and `duplicate` are treated as terminal for this feature (no requirement reopens a ticket); comments
are only accepted while `status = 'in_progress'` (FR-007). **`pending` → `resolved` directly (skipping
`in_progress`) is explicitly disallowed** (FR-010) — the diagram above deliberately does not draw
that edge. As with content-immutability (Triggers below), the app-layer check alone isn't a real
guarantee in this architecture (a direct Supabase call can set `status = 'resolved'` on a `pending`
row without going through the Server Action), so this rule is additionally enforced by the
`tickets_status_transition_guard` trigger.

## State transitions: `packages.status`

```text
pending ──▶ picked_up
```

One-way (FR-018); no requirement to un-mark a package as picked up.

## Triggers (database-enforced business rules)

- **`tickets` content-immutability trigger**: a `BEFORE UPDATE` trigger on `tickets`, matching the
  existing `feedback_content_immutable_trigger` precedent (SCHEMA-ADAPTATION.md item 7), that
  raises an exception if `NEW.title`, `NEW.description`, `NEW.apartment_id`, or `NEW.reported_by`
  differ from their `OLD` values. Needed because the RLS UPDATE policy that legitimately lets
  `staff`/`building_admin` change `status`/`rejection_reason`/`duplicate_of_ticket_id`
  (contracts/rls-policies.md) is a row-level grant — Postgres RLS alone cannot restrict *which
  columns* an already-permitted UPDATE touches, so without this trigger the same policy would also
  silently permit rewriting a resident's original ticket title/description. This is the
  architecture's substitute for the fixed-shape API endpoints a traditional backend would use
  instead (there is no custom backend here — see plan.md's Summary).
- **`packages` content-immutability trigger**: the same pattern on `packages` — a `BEFORE UPDATE`
  trigger rejecting any change to `NEW.description`, `NEW.photo_url`, or `NEW.apartment_id` versus
  `OLD`, so the UPDATE policy that lets `staff`/`building_admin` transition `status`/`picked_up_at`
  cannot also be used to alter what a package was registered as.
- **`tickets_status_transition_guard` trigger** (FR-010): a `BEFORE UPDATE` trigger on `tickets`
  that raises an exception if `NEW.status = 'resolved'` and `OLD.status <> 'in_progress'` — the
  DB-level backstop for "a ticket must pass through In Progress before it can be Resolved," for the
  same reason the content-immutability triggers exist: the Server Action's own check
  (`incidencias/actions.ts`) is bypassable by a direct Supabase call, so the invariant has to hold
  at the row level too. Scoped narrowly to the one confirmed rule — it does not attempt to police
  every other transition (e.g. re-rejecting an already-rejected ticket), since nothing in spec.md
  requires that yet (Principle V).

Both content-immutability triggers allow `status` (and, for tickets, additionally
`rejection_reason`/`duplicate_of_ticket_id`; for packages, `picked_up_at`) to change freely — only
the content columns listed above are rejected.
