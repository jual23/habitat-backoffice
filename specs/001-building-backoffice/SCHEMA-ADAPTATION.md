# Schema Adaptation Note

**Read this before comparing the implementation against `data-model.md`/`tasks.md`.**

When `/speckit-implement` started, the constitutionally-pinned Supabase project
**Habitat** (`.mcp.json` → project ref `nqvsotoqnbgyzjmsvfov`) already contained a
complete, working schema, RLS policy set, and helper/trigger functions for almost
this entire feature — built independently of this spec-kit flow, under different
names than `data-model.md` assumes. The user chose (2026-09-03) to **adapt the
implementation to the existing schema** rather than replace it. This file records
the mapping so future work (and `/speckit-analyze`) doesn't mistake the divergence
for drift.

## Table name / shape mapping

| data-model.md | Live schema | Notes |
|---|---|---|
| `profiles.role` enum | `user_roles` table (`user_id`, `role`, `building_id`) | Separate table, not a `profiles` column. `resident` is the one role *not* represented here — see below. |
| `profiles` (role/building/apartment) | `profiles` (`building_id`, `apartment_id` set directly for residents) + `user_roles` (for app_admin/building_admin/staff) | A user is a resident iff they have no `user_roles` row and `profiles.apartment_id` is set. `lib/session.ts`'s `getUserContext()` encodes this. |
| `apartments.unit_label` | `apartments.tower` (nullable) + `apartments.unit_number` | Unique per `(building_id, tower, unit_number)`. |
| `building_customization` table | `buildings.accent_color` / `buildings.logo_url` | Folded directly into `buildings` — one row per building already. |
| `suggestions_complaints` | `feedback` (`type`, `subject`, `body`, `starred`, `discarded_at`) | Same shape/semantics as FR-030–033; `starred` = `favorited`. |
| 5 Storage buckets | 2 buckets: `building-media` (images/banners/logos), `building-documents` | Same `{building_id}/...` path-prefix isolation via `storage_building_id()`. |
| `log_audit()` RPC / `audit_log` | **Did not exist — added by this implementation** (`audit_log_and_log_audit_rpc` migration). | Principle IV was otherwise unimplemented. |
| Reservation/resident/visitor/feedback out-of-band creation | Already has an `invitations` table for resident provisioning (not in data-model.md at all) | `createResident` uses it rather than a direct `profiles` insert (a `profiles.id` must be a real `auth.users.id`). |

## Additive migrations applied to the live project

1. `audit_log_and_log_audit_rpc` — the `audit_log` table + `log_audit()` SECURITY
   DEFINER RPC (research.md item 7), which genuinely did not exist.
2. `apartments_restrict_delete_with_residents` — changed
   `profiles.apartment_id`'s FK from `ON DELETE SET NULL` to `ON DELETE RESTRICT`,
   which the spec's Edge Cases require ("cannot delete an apartment with
   residents") and the live schema did not yet enforce.
3. `user_roles_staff_provisioning_policies` — added INSERT/DELETE RLS policies
   letting a `building_admin` provision/remove `role = 'staff'` rows scoped to
   their own `building_id` only (FR-039/040); no such policy existed before.
4. `activities_max_participants_check` — added the FR-020 `CHECK` constraint
   (`max_participants IS NULL OR max_participants > 0`), which didn't exist.
5. `facilities_soft_delete_cascade` — added `facilities.deleted_at` plus a
   trigger that declines still-`requested` reservations when it's set (FR-009).
   Facilities previously had no soft-delete column at all; a hard delete would
   have cascade-deleted (not declined) their reservations, since
   `reservations_facility_id_fkey` is `ON DELETE CASCADE`.
6. `documents_folder_cascade_delete` — changed `documents.folder_id`'s FK from
   `ON DELETE SET NULL` to `ON DELETE CASCADE` (FR-029: deleting a folder must
   delete its documents' rows, not orphan them).
7. `feedback_content_immutable_trigger` — a trigger blocking changes to
   `subject`/`body`/`type`/`user_id`/`building_id` on `feedback`, so the
   pre-existing "feedback managed by admins" `ALL` RLS policy (which grants
   full-row UPDATE) can't be used to edit resident-submitted content — only
   `starred`/`discarded_at` are meant to change (contracts/rls-policies.md).
8. `audit_log_from_scheduled_functions` — redefined `expire_visitors()` and
   `purge_discarded_feedback()` (which already existed) to also write one
   `audit_log` row per row they change/delete, per
   contracts/edge-functions.md's Output sections (previously they made no
   audit trail at all).
9. `invitations_role_scoping_policies` — replaced the single blanket
   "invitations managed by admins" `ALL` policy (which let a `building_admin`
   insert an invitation for *any* role, including `app_admin`/`building_admin`
   — a privilege-escalation gap unrelated to this feature but directly adjacent
   to the Staff-provisioning work here) with INSERT/UPDATE policies that
   restrict a `building_admin` to `role IN ('resident', 'staff')`.
10. `fix_trigger_function_hardening` — pinned `search_path` on the new feedback
    trigger function and revoked direct RPC callability on the two new
    trigger-only functions (lint cleanup on migrations 5/7 above).

**pg_cron scheduling** (not a migration, but a live change): enabled the
`pg_cron` extension and scheduled `expire_visitors()` and
`purge_discarded_feedback()` every 10 minutes (`cron.schedule('visitor-expiry', ...)`
/ `cron.schedule('discard-cleanup', ...)`), realizing
contracts/edge-functions.md's two scheduled sweeps as SQL functions on a cron
schedule rather than as separate Deno Edge Functions — the SQL functions
already existed and now write their own audit log rows directly (item 8
above), so a separate Edge Function layer calling them would add nothing
(Principle V).

No destructive changes were made; no existing table, column, or row was dropped.

## Known limitation: resident email is not synced to `auth.users`

`updateResident()` updates `profiles.email` (the display record used throughout
the backoffice) but does not change the resident's actual sign-in email in
`auth.users`, which requires the service-role Admin API. This app never holds a
service-role key (constitution: no service-role key in client/server-action code
paths). Revisit if/when an admin-API-backed server route is introduced.

## Testing constraint: no local Supabase stack

The dev environment this feature was built in has no Docker/Supabase CLI, so
research.md item 6's "local stack" testing approach was replaced with: Vitest
integration tests run against the **same live Habitat project**, using
`tests/fixtures.ts`'s service-role helpers (`createTestUser`, `createTestBuilding`,
etc., which create and tear down real throwaway rows per test run — safe to run
repeatedly against a shared project) and `tests/setup.ts`'s `signInAs()` to
exercise RLS exactly as the real app does. Running them requires
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, which was not available in the
session that wrote this code — the suite was verified to compile and fail with a
clear "missing credentials" error, not run to green. Whoever runs
`npm run test` next with real credentials configured should treat that as the
first real execution of Phase 3's Tests sub-phase.
