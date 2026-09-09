# Contract: Row Level Security Policies

Same approach as every prior feature's `contracts/rls-policies.md`. Helper functions use the live
project's confirmed argument order: `can_admin_building(_user_id, _building)`,
`has_building_role(_user_id, _role, _building)`, `is_building_member(_user_id, _building)`. **Not
re-verified against the live schema this session** — confirm before writing the actual migration
(research.md's Summary).

Per Principle III, a Vitest integration test for **both** the allow case and the deny case of each
row below MUST exist (and fail against an unimplemented policy) before that policy is written.

## `profiles.tenant_type` (User Story 1)

No new policy — the existing `"profiles managed by admins"`/`"profiles read own"` policies already
cover this column at the row level.

## `apartments.monthly_fee`, `buildings.*` payment/late-fee columns (User Story 2)

**Assumption to confirm before implementation** (research.md's Summary): both tables already have
an admin-scoped UPDATE policy (`apartments` — core Building Administrator CRUD per Constitution
Principle II; `buildings` — already extended once for `staff_broadcast_enabled`, spec 008). If so,
`setApartmentFee()`/`setFinanceSettings()` reuse those policies unchanged; no new policy is added
unless that assumption is wrong.

## `payments`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`app_admin` of the building; the **Resident** (not Renter) of the payment's apartment | `staff` (Finance is not in Staff's scope), Renter, other buildings |
| INSERT | Nobody via a client — only `generate_monthly_payments()` (`SECURITY DEFINER`, bypasses RLS) | Everyone, including `building_admin` |
| UPDATE (`status: pending → submitted`, `confirmation_photo_url`) | The Resident of the apartment, submitting their own payment confirmation | `staff`, Renter, `building_admin` (admins review, they don't submit on a resident's behalf — this feature doesn't ask for that), other buildings |
| UPDATE (`status: pending/submitted/overdue → received`, `reviewed_by`, `reviewed_at`) | `building_admin`/`app_admin` of the building | `staff`, any resident/renter, other buildings, any status other than `received` |
| UPDATE (`amount`, `apartment_id`, `building_id`, `available_date`, `due_date`) | Nobody — immutable once created | Everyone |
| DELETE | Nobody | Everyone |

**Mechanism note**: the two UPDATE rows above are two separate permissive policies (a resident
submitting a confirmation and an admin approving one are different actors with different legal
transitions on the same table) — content immutability for the remaining columns is enforced by a
`BEFORE UPDATE` trigger, per every prior precedent in this app.

## `maintenance_tasks`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`app_admin`/`staff` of the building | `resident`, Renter, other buildings |
| INSERT | `building_admin`/`app_admin` only (FR-033 names only the Building Administrator as task creator) | `staff`, other buildings |
| UPDATE (`next_due_date`) | `building_admin`/`app_admin` (rescheduling, FR-034) **and** `staff` (advancing on completion) — RLS grants both; the Server Action layer is the actual enforcement point for "staff only advances via completing a task, never arbitrarily reschedules" (FR-034 reserves free rescheduling for admins) — see the mechanism note below | Other buildings |
| UPDATE (`name`, `frequency`, `interval_months`, `building_id`) | Nobody — immutable once created | Everyone |
| DELETE | Nobody — no delete requirement in spec.md | Everyone |

**Mechanism note**: RLS can grant "may update `next_due_date`" but cannot itself distinguish *why*
a Staff caller is updating it (completing a due task vs. freely rescheduling). `completeTask()`
(the only Server Action Staff can call that touches this column) always pairs the update with an
inserted `maintenance_completions` row and computes the new date itself from the task's own
`frequency` — Staff has no separate "reschedule" action in the UI/Server Action layer at all, only
`building_admin`'s `rescheduleTask()` does. This is the same class of app-layer-enforced narrowing
Constitution Principle III's test requirement exists to catch if it's ever wrong.

## `maintenance_completions`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`app_admin`/`staff` of the building | `resident`, other buildings |
| INSERT | `building_admin`/`app_admin`/`staff` of the building, only when the referenced task's `next_due_date <= current_date` (the task must actually be due) | `resident`, other buildings, a not-yet-due task |
| UPDATE / DELETE | Nobody — append-only completion log, matching `ticket_comments` | Everyone |

## `polls`, `poll_options`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Any building member — `building_admin`/`app_admin`/`staff`/Resident/**Renter** (FR-003: Renter can view) | Other buildings |
| INSERT / UPDATE / DELETE | `building_admin`/`app_admin` only (FR-048) | `staff`, `resident`, Renter, other buildings |

`poll_options` has no `building_id` of its own — every policy joins through `poll_id` to `polls` for
building scoping (contracts convention already used by `ticket_comments`→`tickets`).

## `poll_votes`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`app_admin` of the poll's building (full attribution — anonymity is a `page.tsx` query-shaping decision, research.md item 5, not an RLS rule); any resident **or Renter** of the vote's own `apartment_id` (so the mobile app can show "your apartment's current vote," matching FR-003's "Renter can view") | Other apartments' votes, other buildings |
| INSERT / UPDATE (`option_id`) | The **Resident** (not Renter) of `apartment_id`, only while the poll's `closes_at > now()`, `voter_id = auth.uid()` | Renter (FR-003 — cannot submit or change a vote), other apartments, a closed poll |
| DELETE | Same as INSERT/UPDATE — a Resident removing one of their apartment's selections (needed for the multi-answer "change my selections" flow, FR-043) | Renter, other apartments, a closed poll |

Example `WITH CHECK` shape for INSERT (the Renter-exclusion, this feature's central new
authorization rule):

```sql
voter_id = auth.uid()
and exists (
  select 1 from public.profiles pr
  where pr.id = auth.uid()
    and pr.apartment_id = poll_votes.apartment_id
    and pr.tenant_type = 'resident'
)
and exists (
  select 1 from public.polls p
  where p.id = poll_votes.poll_id and p.closes_at > now()
)
```

## `emergencies`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`app_admin`/`staff` of the building (FR-059 — an internal view, not resident-facing) | `resident`, Renter, other buildings |
| INSERT | Any resident **or Renter** of the building, only for `reported_by = auth.uid()` (mobile app reporting, FR-058) | Reporting on someone else's behalf, other buildings |
| UPDATE (`status: unhandled → resolved`, `resolved_by`, `resolved_at`) | `building_admin`/`app_admin`/`staff` of the building (FR-061) | `resident`, Renter, other buildings, any status other than `resolved` |
| UPDATE (`description`, `apartment_id`, `reported_by`, `building_id`) | Nobody — immutable once reported | Everyone |
| DELETE | Nobody | Everyone |

## `notifications` (existing table — reused write patterns, no policy change expected)

Payment-received and payment-reminder notifications are all inserted by `SECURITY DEFINER`
scheduled functions (payments) or reuse the existing
`"notifications insert by staff or admin for their building"` policy (feature 004, for
admin-triggered ones like `approvePayment()`) — no widening needed for either path. (Maintenance
has no notification requirement in spec.md — nothing in this feature notifies anyone when a
maintenance task is completed or rescheduled.)
