# Schema Adaptation Note

**Read this before comparing the implementation against `data-model.md`/`contracts/rls-policies.md`/`tasks.md`.**

Following the precedent set in `specs/001-building-backoffice/SCHEMA-ADAPTATION.md` and
`specs/007-finance-ops-expansion/SCHEMA-ADAPTATION.md`, this file records where reality diverged
from what tasks.md assumed at planning time, and how the implementation adapted.

## Migration numbering was renumbered from `0017`–`0021` to `0036`–`0040`

tasks.md originally claimed `0017`–`0021`, aspirational at the time both this feature and
007-finance-ops-expansion were planned in the same session. 007 was implemented first and actually
consumed `0022`–`0035` (plus `0027b`/`0027c`). This feature's migrations were renumbered to
`0036`–`0040` before implementation began, confirmed against `supabase/migrations/` on disk as the
true next-available range.

## Task ordering bug: `broadcasts` was listed before `broadcast_templates`, but FK-references it

tasks.md's original T008/T009 created `broadcasts` (with a `template_id` FK to
`broadcast_templates.id`) *before* `broadcast_templates` existed — a forward-reference that would
have failed outright. Fixed by swapping the order: `broadcast_templates` is `0037`, `broadcasts` is
`0038`. tasks.md has been corrected in place to reflect the working order.

## Live-schema assumptions confirmed (no drift)

Per T002, all three flagged assumptions held exactly as designed, using facts already confirmed
live earlier in this same session (during 007's implementation):

- `buildings` already has an admin-scoped `UPDATE` policy (`"buildings update admins"`, using
  `can_admin_building(auth.uid(), id)`) that covers the new `staff_broadcast_enabled` column with
  no widening needed — Postgres RLS `UPDATE` policies apply per-row, not per-column.
- `notify_reservation_decision()`/`notify_visitor_arrival()`'s exact shape (insert one
  `notifications` row, then loop `push_tokens` calling `net.http_post` to
  `https://exp.host/--/api/v2/push/send`) was mirrored exactly for `notify_broadcast_sent()`.
- `push_tokens`'s column shape (`id`, `user_id`, `token`, `platform`, `created_at`, `updated_at`)
  matched what the trigger needed.

## Verified this session

- All three new test files (`rls-broadcasts`, `rls-broadcast-templates`, `broadcast-staff-toggle`
  — 10 tests total) pass against the live schema.
- `notify_broadcast_sent()` was additionally verified with a direct SQL check (inserting a
  broadcast for a building with one resident profile and confirming exactly one `notifications`
  row appears with the broadcast's message) — this path isn't exercised by the RLS test suite
  itself, since the trigger's fan-out isn't something an RLS allow/deny assertion observes.
- `npm run typecheck`, `npm run lint`, and `npm run build` are all clean with every change in this
  feature applied — the new `/broadcast` route builds successfully.

## Not performed this session: the interactive quickstart.md walkthrough

T021 (composing/sending a custom and a template-sourced broadcast, confirming both stay active
simultaneously, deactivating one, and the Staff-permission toggle on/off walkthrough) was not
performed — no browser-automation tool was available this session, same limitation noted in
007's SCHEMA-ADAPTATION.md and 009's task list.
