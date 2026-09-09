# Contract: Row Level Security Policies

Same approach as every prior feature's `contracts/rls-policies.md`: with a direct Supabase client
and no custom backend, these RLS policies **are** the enforcement point for Constitution
Principle I (isolation) and Principle II (roles) — including this feature's one new dimension, the
building-level Staff broadcast toggle. Policies use the live project's actual helper function
argument order, confirmed in feature 004's own session (`_user_id` first):
`can_admin_building(_user_id, _building)`, `has_building_role(_user_id, _role, _building)`,
`is_building_member(_user_id, _building)`. **Not re-verified against the live schema this session**
— see research.md item 7; confirm before writing the actual migration.

Per Principle III, a Vitest integration test for **both** the allow case and the deny case of each
row below MUST exist (and fail against an unimplemented policy) before that policy is written.

## `broadcasts`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | Any building member — `building_admin`/`staff`/`app_admin` of the building, and every resident/renter of it (the mobile app reads this table directly to show currently-active broadcasts, per spec 008) | Other buildings' members |
| INSERT | `building_admin`/`app_admin` of the building always; `staff` of the building only when `buildings.staff_broadcast_enabled` is true for it | `resident`, other buildings, `staff` when the toggle is off |
| UPDATE (`status → deactivated`, `deactivated_at`, `deactivated_by`) | Same as INSERT — `building_admin`/`app_admin` always, `staff` only when the toggle is on — and only while the row's current `status = 'active'` | `resident`, other buildings, `staff` when the toggle is off, any change away from `deactivated` |
| UPDATE (`message`, `icon`, `building_id`, `template_id`) | Nobody — a broadcast's content is immutable once sent | Everyone |
| DELETE | Nobody — no delete requirement in either spec | Everyone |

**Mechanism note**: the UPDATE policy above is a row-level grant — it can't itself distinguish
"changed `status`" from "changed `message`." Content immutability is enforced by a separate
`BEFORE UPDATE` trigger (data-model.md's Triggers section), not by this policy, matching every
prior content-immutability precedent in this app.

Example `WITH CHECK` shape for the Staff-conditional INSERT/UPDATE (the toggle-gated part):

```sql
can_admin_building(auth.uid(), building_id)
or (
  has_building_role(auth.uid(), 'staff'::app_role, building_id)
  and exists (
    select 1 from public.buildings b
    where b.id = broadcasts.building_id and b.staff_broadcast_enabled
  )
)
```

## `broadcast_templates`

| Operation | Allowed to | Denied to |
|---|---|---|
| SELECT | `building_admin`/`app_admin`/`staff` of the building — templates are an internal composition tool, never shown to residents/renters directly | `resident`, other buildings |
| INSERT / UPDATE / DELETE | `building_admin`/`app_admin` of the building only — spec 007's FR-052 scopes template management to Building Administrator, not Staff, regardless of the broadcast-send toggle | `staff` (even with the toggle on — the toggle only gates *sending*, not *managing templates*), `resident`, other buildings |

## `buildings` (existing table — assumption to confirm, not a new policy)

| Operation | Allowed to | Denied to |
|---|---|---|
| UPDATE (`staff_broadcast_enabled`) | `building_admin`/`app_admin` of that building, via whatever existing `buildings` UPDATE policy already lets them edit `accent_color`/`logo_url` (Customization, feature 001) | Everyone else |

If that existing policy turns out not to exist or not to cover this column for some reason
(confirm during the first implementation task, per research.md item 7), a narrowly-scoped new
policy for this one column would be added then — not assumed here.

## `notifications` / `push_tokens` (existing tables — no policy change)

No RLS change. The `notify_broadcast_sent()` trigger (data-model.md) is `SECURITY DEFINER` and
writes `notifications` directly, the same way `notify_reservation_decision()`/
`notify_visitor_arrival()` already do — it does not go through the generic
`"notifications insert by staff or admin for their building"` policy (feature 004), so that policy
needs no widening for this feature. `push_tokens` is only ever read by this trigger, never written.
