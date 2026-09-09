# Phase 1 Data Model: Building Operations Expansion (US1-US5, US7)

Timestamps are `timestamptz`; ids are `uuid` (`gen_random_uuid()`) unless noted. Follows this
project's established conventions (enum-per-lifecycle, `building_id` on every tenant-scoped table,
unconstrained "who did this" actor columns, content-immutability triggers where a row-level UPDATE
policy would otherwise let a field it shouldn't be silently change). **Not verified against the
live schema this session** (research.md's Summary) — confirm before migrating, per this feature's
first implementation task.

## User Story 1: Renter role

### Modified table: `profiles`

| Column | Type | Notes |
|---|---|---|
| `tenant_type` | `tenant_type` enum (`resident`, `renter`), NOT NULL, default `'resident'` | **NEW**. Meaningful only when `apartment_id IS NOT NULL`; ignored for staff/admin profiles. Set via `handle_new_user()`'s `raw_user_meta_data->>'tenant_type'`, defaulting to `'resident'` (research.md item 1). |

No RLS change to `profiles` itself — the existing `"profiles managed by admins"`/`"profiles read
own"` policies already cover this new column at the row level; `tenant_type` is read (not
separately authorized) wherever a caller already has row access.

## User Story 2: Finance module

### Modified table: `apartments`

| Column | Type | Notes |
|---|---|---|
| `monthly_fee` | numeric(12,2), nullable | **NEW**. Current fee; `NULL` = no fee configured (payment generation skips it — Edge Cases). Individually or bulk-settable by a Building Administrator (FR-010/011/013). |

### Modified table: `buildings`

| Column | Type | Notes |
|---|---|---|
| `payment_available_day` | smallint, nullable, `CHECK (payment_available_day BETWEEN 1 AND 31)` | **NEW**. FR-014. `NULL` = payment generation inactive for this building. |
| `payment_due_day` | smallint, nullable, same `CHECK` | **NEW**. FR-014. |
| `late_fee_type` | `late_fee_type` enum (`flat`, `percent`), nullable | **NEW**. FR-019. `NULL` = no late fee configured. |
| `late_fee_amount` | numeric(12,2), nullable | **NEW**. Flat currency amount or percentage value depending on `late_fee_type`. |

### New enum: `payment_status`

`pending | submitted | received | overdue` — research.md item 4.

### New table: `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | |
| `apartment_id` | uuid, NOT NULL, FK `apartments.id` ON DELETE RESTRICT | Matches `packages.apartment_id`'s precedent (NOT NULL apartment reference → RESTRICT, not SET NULL). |
| `amount` | numeric(12,2), NOT NULL | Captured from `apartments.monthly_fee` at generation time — independent of later fee changes. |
| `late_fee_amount` | numeric(12,2), nullable | Set once, when the sweep marks the row `overdue` (FR-020). |
| `status` | `payment_status`, NOT NULL, default `'pending'` | |
| `confirmation_photo_url` | text, nullable | Set by the resident (mobile app, out of scope) when submitting; Storage path, read via `trySignedUrlFor()`. |
| `available_date` | date, NOT NULL | When this payment became available (the building's `payment_available_day` for that month). |
| `due_date` | date, NOT NULL | research.md item 4's rollover rule. |
| `reviewed_by` | uuid, nullable | The Building Administrator who approved it. Unconstrained (actor-column convention). |
| `reviewed_at` | timestamptz, nullable | |
| `created_at` / `updated_at` | timestamptz | |

**Constraints**: `CHECK (status <> 'received' OR reviewed_by IS NOT NULL)` — an approved payment
always records who approved it.

**Indexes**: `(building_id, apartment_id)` for the payment-history view (FR-022); `(building_id,
status)` for the filterable table (FR-023); `(status, due_date)` for the two scheduled sweeps
(research.md item 4) to find due-tomorrow/overdue rows efficiently across all buildings at once.

### Triggers

- **`payments` content-immutability trigger**: rejects changes to `amount`, `apartment_id`,
  `building_id`, `available_date`, `due_date` after creation — matching the `tickets`/`packages`/
  `broadcasts` precedent. `status`, `late_fee_amount`, `confirmation_photo_url`, `reviewed_by`,
  `reviewed_at` remain mutable (the legitimate transitions FR-016/017/019/020 describe).

## User Story 3: Visitor apartment column

No schema change — `visitors.apartment_id` already exists (feature 001). `page.tsx` simply adds it
to the existing `.select(...)`.

## User Story 4: Maintenance module

### New enum: `maintenance_frequency`

`once | weekly | monthly | every_n_months`

### New table: `maintenance_tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | |
| `name` | text, NOT NULL | Free-text (FR-033). |
| `frequency` | `maintenance_frequency`, NOT NULL | |
| `interval_months` | smallint, nullable | Only meaningful when `frequency = 'every_n_months'`. |
| `next_due_date` | date, nullable | The next (or only, for `once`) due date. `NULL` once a `once` task is completed — Edge Cases — meaning "nothing further scheduled," not "never had one." |
| `created_by` | uuid, NOT NULL | Unconstrained. |
| `created_at` / `updated_at` | timestamptz | |

**Constraints**: `CHECK (frequency <> 'every_n_months' OR interval_months IS NOT NULL)`.

**Indexes**: `(building_id, next_due_date)` for the due-tasks list.

### New table: `maintenance_completions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_id` | uuid, NOT NULL, FK `maintenance_tasks.id` ON DELETE CASCADE | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | Denormalized for direct RLS scoping, matching `ticket_comments`'/`packages`' precedent of scoping via a join where simple, but here kept direct since completions are frequently listed independent of a specific task. |
| `completed_by` | uuid, NOT NULL | Unconstrained. |
| `completed_at` | timestamptz, NOT NULL, default `now()` | |
| `photo_url` | text, nullable | FR-036. |

Append-only (no `updated_at`, no UPDATE policy) — matches `ticket_comments`.

## User Story 5: Community Polls

### New table: `polls`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | |
| `title` | text, NOT NULL | |
| `description` | text, nullable | |
| `attachment_url` | text, nullable | Storage path (`building-media` or `building-documents`, by mime type — matching announcements' existing dual-bucket pattern). |
| `allow_multiple` | boolean, NOT NULL, default `false` | FR-041. |
| `anonymous` | boolean, NOT NULL, default `false` | FR-041; drives `page.tsx`'s query-shaping (research.md item 5), not an RLS rule. |
| `closes_at` | timestamptz, NOT NULL | FR-044. |
| `created_by` | uuid, NOT NULL | Unconstrained. |
| `created_at` / `updated_at` | timestamptz | |

### New table: `poll_options`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `poll_id` | uuid, NOT NULL, FK `polls.id` ON DELETE CASCADE | |
| `label` | text, NOT NULL | |
| `sort_order` | smallint, NOT NULL, default `0` | Display order. |

### New table: `poll_votes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `poll_id` | uuid, NOT NULL, FK `polls.id` ON DELETE CASCADE | |
| `apartment_id` | uuid, NOT NULL, FK `apartments.id` ON DELETE RESTRICT | The vote is attributed to the apartment, not the voter (FR-042). |
| `option_id` | uuid, NOT NULL, FK `poll_options.id` ON DELETE CASCADE | |
| `voter_id` | uuid, NOT NULL | The resident account that cast/last touched it — always stored (Principle IV), display-restricted per research.md item 5. Unconstrained. |
| `created_at` | timestamptz | |

**Constraints**: `UNIQUE (poll_id, apartment_id, option_id)` — prevents duplicate selection of the
same option twice. Enforcing "exactly one row when `allow_multiple = false`" is an application-layer
check in the vote-casting path (delete-then-insert on every submission for a single-answer poll),
not a DB constraint, since a partial unique index keyed on a sibling table's boolean is more
machinery than this needs (Principle V) — the RLS `WITH CHECK` for `poll_votes` INSERT/UPDATE still
independently verifies the poll hasn't closed and the voter isn't a Renter, regardless.

**Indexes**: `(poll_id, apartment_id)` — "has this apartment already voted."

## User Story 7: Emergency module

### New enum: `emergency_status`

`unhandled | resolved`

### New table: `emergencies`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `building_id` | uuid, NOT NULL, FK `buildings.id` ON DELETE CASCADE | |
| `reported_by` | uuid, NOT NULL | The resident/renter who reported it (mobile app, out of scope — FR-058). Unconstrained. |
| `apartment_id` | uuid, nullable, FK `apartments.id` ON DELETE SET NULL | Denormalized for display, matching `tickets.apartment_id`'s precedent. |
| `description` | text, nullable | What was reported. |
| `status` | `emergency_status`, NOT NULL, default `'unhandled'` | |
| `resolved_by` | uuid, nullable | Unconstrained. |
| `resolved_at` | timestamptz, nullable | |
| `created_at` | timestamptz | |

**Constraints**: `CHECK (status <> 'resolved' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL))`.

**Indexes**: `(building_id, status)` — both the list view and the layout's unhandled-count check
(research.md item 6) use exactly this shape.

## Summary of new scheduled sweeps (research.md item 4)

- `generate_monthly_payments()` — daily, `pg_cron`, `SECURITY DEFINER`, writes `audit_log` rows
  (matching `expire_visitors()`'s precedent).
- `evaluate_payment_due_dates()` — daily, same pattern; handles both the one-day-before reminder
  (FR-021) and the overdue/late-fee transition (FR-020) in one pass over `(status, due_date)`.
