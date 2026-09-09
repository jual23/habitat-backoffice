# Schema Adaptation Note

**Read this before comparing the implementation against `data-model.md`/`contracts/provisioning.md`/`tasks.md`.**

## The design held exactly as planned

Unlike feature 004, this feature's actual implementation did **not** diverge from research.md/data-model.md's design — the live schema had exactly the RLS policies and trigger shape research.md assumed (confirmed via T002 before writing any migration). `0015_profiles_identity_fields.sql` and `0016_handle_new_user_metadata.sql` applied cleanly as designed.

## Unrelated concurrent schema changes discovered during type regeneration

Regenerating `lib/supabase/database.types.ts` after this feature's migrations (T005) surfaced six
migrations applied to the shared live Habitat project **by other work, not this feature**, between
feature 004's session and this one (`list_migrations` timestamps ~05:00 vs. this feature's ~21:11):
`tickets_add_photo_url`, `ticket_photo_storage_policy`, `news_comments_table`,
`news_reactions_table`, `package_registered_push_notification`, `tickets_immutable_include_photo`,
`revoke_public_execute_on_package_registered_trigger`. These added a `tickets.photo_url` column and
two new tables (`news_comments`, `news_reactions`) unrelated to this feature's scope.

This is expected and not a conflict: this is a shared, live Supabase project (per the Constitution's
Data Storage requirement — one project, not a disposable per-feature one), and `database.types.ts`
must reflect the *entire* live schema, not just this feature's delta. The regenerated file committed
in this feature includes those tables/columns as returned by the live introspection; this feature's
code does not read or write any of them. No action needed from this feature; noted here only so a
future `/speckit-analyze` doesn't mistake this file's unrelated diff for drift this feature caused.

## Testing constraint: no `SUPABASE_SERVICE_ROLE_KEY` in this session (same as features 001, 004)

`.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` line is present but has no value in this environment, so
`tests/fixtures.ts`'s and `lib/supabase/admin.ts`'s service-role clients both throw immediately.
`tests/integration/user-provisioning.test.ts` (T006) was written before `lib/user-provisioning.ts`
existed and confirmed to fail at that point (module-not-found); after implementation it fails with
the same missing-credentials error every other service-role-dependent integration test in this repo
already exhibits without this key — it was never run to green in this session.

What **was** verified in this session, against the live project, to build confidence the DB layer
behaves as designed:
- The exact `jsonb->>` extraction and `nullif(...)::uuid` casting expressions used inside
  `handle_new_user()`'s extended INSERT were sanity-checked directly via SQL with representative
  metadata (including an empty-string `apartment_id`, which must become `NULL` rather than a cast
  error, and a missing-metadata case) — all produced the expected values with no errors.
- `npm run typecheck`, `npm run lint`, and `npm run build` are all clean with every change in this
  feature applied, including the two rewritten Server Actions and the new/extended UI.
- `npm run test` fails in exactly the same way (missing service-role credentials) it already did on
  this branch before this feature's changes — one additional failing-for-the-same-reason test file,
  no new category of failure.

**This feature's real end-to-end path — a Building Administrator submitting the creation form,
`auth.admin.createUser()` actually firing, `handle_new_user()` actually running as a real trigger,
and a fresh sign-in with the temporary password succeeding — was not exercised in this session.**
Whoever runs `npm run test` next with a real `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` should treat
that as the first real (red/green) execution of `user-provisioning.test.ts`, and should also add that
same key to whatever environment this app is actually deployed to (plan.md's Constraints) — without
it, `createResident()`/`createStaff()` will fail for every real user, not just tests, since
`lib/supabase/admin.ts` throws the same way `tests/fixtures.ts` does when the key is absent.
Completing `tasks.md`'s T018 (the full interactive quickstart.md walkthrough) is the other piece of
follow-up this session could not do without either that key or a live Building Administrator
session in a browser.
