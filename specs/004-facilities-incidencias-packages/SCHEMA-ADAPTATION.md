# Schema Adaptation Note

**Read this before comparing the implementation against `data-model.md`/`contracts/rls-policies.md`/`tasks.md`.**

Following the precedent set in `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`, this file
records where the live Habitat Supabase project's actual conventions diverged from what this
feature's design docs assumed, and how the implementation adapted.

## RLS helper function argument order

`contracts/rls-policies.md` and `lib/supabase/database.types.ts`'s `Functions` section describe
`is_building_member`, `has_building_role`, and `is_app_admin` as taking `(_building, _user_id[, _role])`.
The live functions actually take `(_user_id, _building[, _role])` — confirmed via
`pg_get_function_arguments()` against the live project before writing any policy. Every new policy
in `supabase/migrations/0012_tickets_rls.sql` and `0014_packages_rls.sql` uses the live signatures
(e.g. `has_building_role(auth.uid(), 'staff'::app_role, building_id)`), matching every pre-existing
policy in the project (`visitors`, `feedback`, `facilities`).

The live schema also has a `can_admin_building(_user_id, _building)` helper
(`is_app_admin(_user_id) OR has_building_role(_user_id, 'building_admin', _building)`) that
contracts/rls-policies.md never mentions, but which every existing admin-scoped policy in the
project already uses instead of spelling out the OR each time. The new policies use it too, for
consistency.

## `notifications` INSERT policy was net-new, not a widening

contracts/rls-policies.md speculated the existing `notifications` INSERT policy "may currently be
self-only (`user_id = auth.uid()`)" and would need widening. In fact `notifications` had **no
INSERT policy at all** before this feature (only `notifications read own` and `notifications update
own`) — confirmed via `pg_policies`. `0014_packages_rls.sql` adds
`"notifications insert by staff or admin for their building"` as a wholly new grant, scoped to
`staff`/`building_admin` of the notification's `building_id`, with a check that the addressed
`user_id` is actually a resident of that same building.

## "Who did this" columns are not foreign-keyed

`data-model.md` describes `tickets.reported_by`, `ticket_comments.author_id`, and
`packages.registered_by` as `FK profiles.id`. The live schema's own precedent for this shape of
column — `visitors.created_by`, `feedback.user_id` — carries **no** FK constraint at all (confirmed
via `pg_constraint`); only `audit_log.actor_id` and `push_tokens.user_id` are FK'd to
`auth.users`. This feature's three new columns follow the established (unconstrained) convention
rather than introducing a new one, to stay consistent with the rest of the schema.

## `packages.apartment_id` uses `ON DELETE RESTRICT`, not `SET NULL`

data-model.md doesn't specify an `ON DELETE` action for this FK. Since the column is `NOT NULL`
(unlike `tickets.apartment_id`, which is nullable and uses `ON DELETE SET NULL` like
`visitors.apartment_id`), `SET NULL` isn't valid. `RESTRICT` was chosen to match the schema's own
precedent for a `NOT NULL` apartment reference (`profiles.apartment_id`, hardened to `RESTRICT` in
001's `apartments_restrict_delete_with_residents` migration) rather than `CASCADE`, which would
silently delete package history when an apartment is removed.

## `open_days` weekday-convention spot-check was inconclusive

T033 asked to spot-check a live `facilities.open_days` value against real-world hours to confirm
the `0 = Sunday … 6 = Saturday` convention research.md assumed. Every facility in the live project
is currently configured with `open_days = [0,1,2,3,4,5,6]` (open every day), which is convention-
agnostic — it can't distinguish a Sunday-first from a Monday-first encoding. The implementation
proceeds with research.md's stated convention (matching JS `Date#getDay()`) since nothing in the
live data contradicts it; revisit if a facility is ever configured with a partial week and the
bubble's day-of-week appears off by one.

## Testing constraint: no `SUPABASE_SERVICE_ROLE_KEY` in this session

Same constraint as feature 001: `.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` line is present but has
no value, so `tests/fixtures.ts`'s service-role client (needed by every RLS/notification
integration test added in this feature — `rls-tickets`, `rls-ticket-comments`, `rls-packages`,
`packages-notify`) throws immediately. Per Constitution Principle III these tests were written
before the corresponding schema/RLS existed and confirmed to fail at that point (initially with
"relation does not exist", then — once the schema landed — with the same missing-credentials error
every other integration test in this repo already exhibits without a service-role key). They were
never run to green.

What **was** verified in this session, against the live project, to build confidence the DB layer
behaves as designed:
- `tickets_status_transition_guard` blocks `pending → resolved` and allows `in_progress → resolved`
  (direct SQL, `DO` block with a nested `EXCEPTION` check).
- `tickets_content_immutable` blocks a `title` change on an UPDATE.
- `packages_content_immutable` blocks a `description` change on an UPDATE, while a `status` update
  on the same row still succeeds.
- `npm run typecheck`, `npm run lint`, and `npm run build` are all clean with every change in this
  feature applied; `npm run test` fails in exactly the same way (missing service-role credentials)
  it already did on this branch before this feature's changes, with no new category of failure.
- `lib/validation/tickets.ts`'s Zod schemas and pure transition-eligibility functions
  (`canResolveFromStatus`, `canMarkDuplicateTarget`, `canAddComment`) — the friendly-error layer the
  Server Actions call ahead of the DB backstop — are unit-tested directly in
  `tests/integration/tickets-workflow.test.ts` and pass (these don't need a DB connection).

**Whoever runs `npm run test` next with a real `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` should
treat that as the first real (red/green) execution of this feature's RLS suite**, and should also
complete `tasks.md`'s T036 (the full interactive quickstart.md walkthrough), which this session
could not do without either that key (to mint disposable auth users) or a browser-automation tool.
