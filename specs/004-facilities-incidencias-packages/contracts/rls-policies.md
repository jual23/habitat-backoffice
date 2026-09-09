# Contract: Row Level Security Policies

Same approach as `specs/001-building-backoffice/contracts/rls-policies.md`: with a direct Supabase
client and no custom backend, these RLS policies **are** the enforcement point for Constitution
Principle I (isolation) and Principle II (roles). Policies reuse the live project's existing helper
functions (see `lib/supabase/database.types.ts`'s `Functions` section):

- `is_app_admin(_user_id uuid)` — true if that user is an App Administrator.
- `is_building_member(_building uuid, _user_id uuid)` — true if that user belongs to `_building`
  (as `building_admin`/`staff` via `user_roles`, or as `resident` via `profiles.building_id`).
- `has_building_role(_building uuid, _role app_role, _user_id uuid)` — true if that user holds
  `_role` specifically in `_building`.

Per Principle III, a Vitest integration test for **both** the allow case and the deny case of each
row below MUST exist (and fail against an unimplemented policy) before that policy is written.

## `tickets`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `staff`/`building_admin` of the ticket's `building_id`; the `resident` in `reported_by`; `app_admin` | Other residents, other buildings' staff/admin |
| INSERT | Out of scope for this feature (spec.md Assumptions — ticket creation happens outside this feature) — a policy allowing the reporting `resident` to insert their own ticket (`reported_by = auth.uid()`, `building_id` matching their own) exists so a future/external resident-facing surface can rely on it | `staff`, other residents inserting on someone else's behalf, other buildings |
| UPDATE (`status`, `rejection_reason`, `duplicate_of_ticket_id`) | `staff`/`building_admin` of the ticket's `building_id` (FR-006–FR-010) | `resident` (residents never edit their own ticket's status/fields), other buildings |
| UPDATE (`title`, `description`, `apartment_id`, `reported_by`) | Nobody via this feature — a ticket's original content is immutable once filed | Everyone |
| DELETE | Nobody — no delete requirement in spec.md | Everyone |

**Mechanism note**: the UPDATE policy above is a row-level grant — it cannot itself distinguish
"changed `status`" from "changed `title`." The `title`/`description`/`apartment_id`/`reported_by`
immutability row is enforced by a separate `BEFORE UPDATE` trigger (data-model.md's Triggers
section), matching the existing `feedback_content_immutable_trigger` precedent, **not** by the RLS
policy alone.

`duplicate_of_ticket_id`, when set, MUST reference a ticket that (a) has the same `building_id`
(cross-building duplicate links would otherwise leak a building-scoped ticket's existence to
another building's staff via the link) and (b) is currently `status IN ('pending', 'in_progress')`
(FR-009 — a ticket already `resolved`, `rejected`, or itself `duplicate` cannot be selected as a
duplicate target). Both are enforced together by the UPDATE policy's `WITH CHECK`, e.g.:

```sql
duplicate_of_ticket_id IS NULL OR EXISTS (
  SELECT 1 FROM tickets t
  WHERE t.id = duplicate_of_ticket_id
    AND t.building_id = tickets.building_id
    AND t.status IN ('pending', 'in_progress')
)
```

Separately, `status → 'resolved'` MUST only be permitted when the row's current (`OLD`) `status` is
`'in_progress'` (FR-010) — this is an `OLD`-vs-`NEW` comparison, which a `WITH CHECK` clause (which
only sees the proposed `NEW` row) cannot express cleanly, so it is enforced by the
`tickets_status_transition_guard` trigger instead (data-model.md's Triggers section), not by this
policy.

## `ticket_comments`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `staff`/`building_admin` of the parent ticket's `building_id`; the `resident` in the parent ticket's `reported_by` (FR-007 — "visible to the resident"); `app_admin` | Other residents, other buildings |
| INSERT | `staff`/`building_admin` of the parent ticket's `building_id`, only while the parent ticket's `status = 'in_progress'` (FR-007) | `resident`, other buildings, insert against a ticket not currently `in_progress` |
| UPDATE / DELETE | Nobody — comments are an append-only log (data-model.md) | Everyone |

## `packages`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `staff`/`building_admin` of the package's `building_id`; every `resident` of the package's `apartment_id` (so a future resident-facing surface can show "your packages"); `app_admin` | Other residents, other buildings |
| INSERT | `staff`/`building_admin` of the target `building_id`, where `apartment_id` belongs to that same building (FR-013/FR-014) | `resident`, other buildings, an `apartment_id` from a different building |
| UPDATE (`status → picked_up`, `picked_up_at`) | `staff`/`building_admin` of the package's `building_id`, only when current `status = 'pending'` (FR-018) | `resident`, other buildings, any change away from `picked_up` |
| UPDATE (`description`, `photo_url`, `apartment_id`) | Nobody via this feature — a package's registered details don't get edited, only its pickup status | Everyone |
| DELETE | Nobody — no delete requirement in spec.md | Everyone |

**Mechanism note**: same caveat as `tickets` above — the `description`/`photo_url`/`apartment_id`
immutability row is enforced by a `BEFORE UPDATE` trigger (data-model.md's Triggers section), not
by the RLS UPDATE policy itself.

## `notifications` (existing table — new write pattern, no policy change expected)

| Operation | Allowed to | Denied to |
|---|---|---|
| INSERT (package-arrival notification) | `staff`/`building_admin` registering a package, on behalf of each resident of the target apartment (`user_id` set to that resident, not the inserting Staff/Admin) | Anything the existing `notifications` INSERT policy already denies |

If the live `notifications` table's existing INSERT policy is scoped to `user_id = auth.uid()`
(self-only), it MUST be widened (or a `SECURITY DEFINER` RPC introduced, matching the existing
`log_audit()` precedent) to let a Staff/Admin insert a notification addressed to a resident in
their own building — this is a real policy change this feature depends on, to be confirmed against
the live schema during implementation (see quickstart.md's verification step) rather than assumed
here.

## `facilities` (existing table — no policy change)

No RLS change. The open/closed bubble and capacity removal are read/UI-only; `facilities` SELECT
policy already allows anyone in the building to read `opens_at`/`closes_at`/`open_days`.
