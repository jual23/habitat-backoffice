# Phase 0 Research: Direct User Creation (Replacing Invitations)

## 1. How to create a real, immediately-usable account with an admin-chosen password

**Decision**: Use the Supabase Auth **Admin API** — `supabase.auth.admin.createUser({ email,
password, email_confirm: true, user_metadata: {...} })` — from a service-role client, invoked from
one narrow server-only module (`lib/supabase/admin.ts`). `email_confirm: true` is required so the
account is sign-in-capable immediately, with no email-verification link to click (this app sends no
email as part of provisioning — spec.md's Assumptions).

**Rationale**: This is the only Supabase-supported way to create an `auth.users` row with a
password value the caller specifies (rather than one the user sets themselves via a magic
link/OTP/self-signup flow, all of which the constitution's Security & Access Control Requirements
rule out here anyway — "Self-registration directly into any of the four roles is prohibited").

**Alternatives considered**: A `SECURITY DEFINER` Postgres function that inserts directly into
`auth.users` (rejected — GoTrue's `auth.users` schema, including how `encrypted_password` must be
hashed, is not a supported public contract; writing to it directly outside the Admin API risks
breaking silently on a Supabase Auth upgrade). A separate microservice/Edge Function holding the
service-role key instead of the Next.js app (rejected in plan.md's Complexity Tracking — adds a new
deployable/secret for a single action when containment is already achievable in-process).

## 2. Where the new profile fields get set, given the isolation gap this creates

**Decision**: Add `first_name`, `last_name`, `document_id` columns to `profiles` (all nullable —
existing rows from before this feature predate them). Extend the existing `handle_new_user()`
trigger (`AFTER INSERT ON auth.users`, already `SECURITY DEFINER`) to also read
`first_name`/`last_name`/`document_id`/`building_id`/`apartment_id` out of
`new.raw_user_meta_data` and set them on the `profiles` row it creates, in the same statement that
already sets `full_name`/`email` from metadata today. The Admin API call's `user_metadata` carries
all of these.

**Rationale**: The existing `"profiles managed by admins"` RLS policy
(`building_id IS NOT NULL AND can_admin_building(auth.uid(), building_id)`) evaluates its `USING`
clause against the **current** row. A profile created by `handle_new_user()` today gets
`building_id = NULL` (the trigger never sets it), so if this feature instead tried to set
`building_id`/`apartment_id` via a *second*, normal RLS-enforced UPDATE right after creation, that
UPDATE would be silently rejected — the calling admin can't satisfy `building_id IS NOT NULL` on a
row that doesn't have a building yet. Setting every field in the *one* `SECURITY DEFINER` trigger
invocation (already elevated, already firing exactly once per account) avoids ever having a
half-provisioned row that RLS then locks out of further edits, and avoids a second elevated write.

**Alternatives considered**: A follow-up service-role UPDATE to set `building_id`/`apartment_id`
after `handle_new_user()` runs (rejected — needlessly widens where the service-role client is used,
for no benefit over doing it in the trigger that already runs once per creation). A new RLS policy
letting a building_admin claim a `building_id IS NULL` profile into their own building (rejected —
a real, permanent RLS change to work around a timing gap the trigger can close directly; more
complexity for the same outcome, against Principle V).

## 3. Keeping the provisioning logic testable outside a Next.js request

**Decision**: Extract the account-creation logic into `lib/user-provisioning.ts`'s
`createBuildingUser()`, taking its Supabase clients (a service-role client for the Admin API call,
a normal request-scoped client for the `staff` `user_roles` insert) and the acting admin's
already-resolved `buildingId`/`role` as plain arguments — it never calls `cookies()` or
`getUserContext()` itself. `app/(backoffice)/users/actions.ts`'s `createResident()` and
`app/(backoffice)/visitors/staff-actions.ts`'s `createStaff()` become thin wrappers: resolve
`ctx`/clients, call `createBuildingUser()`, write the audit log, `revalidatePath()`.

**Rationale**: Matches the existing `writeAuditLog(supabase, {...})`/`uploadBuildingFile(supabase,
{...})` shape already used throughout this app — dependency-injected clients, not
request-context-coupled. Per plan.md's Testing section this is **required**, not just nice-to-have:
a `'use server'` action that reads `cookies()` cannot be invoked directly from Vitest (established
in features 004/005's own testing notes), and Constitution Principle III requires an automated
allow/deny test for this feature's genuinely new authorization-relevant logic (item 4 below) before
it ships. A plain function taking a real service-role client (`tests/fixtures.ts`'s pattern) and a
real signed-in client (`tests/setup.ts`'s `signInAs()`) is directly callable from a Vitest test —
no framework request context needed.

**Alternatives considered**: Testing only the Zod validation schema in isolation, as features
004/005 accepted for their app-validation-layer checks (rejected here — those features' skipped
DB-level checks were already independently covered by RLS policy tests; this feature's key risk
*is* the DB-bypassing code path itself, which only an integration test exercising the real
`createBuildingUser()` function actually verifies).

## 4. Why the target building must come from the session, not a parameter

**Decision**: `createBuildingUser()` takes `buildingId` from the caller having already resolved it
via `getUserContext(supabase)` server-side — the Server Action wrappers never accept a client-
supplied `buildingId` for this call (unlike, e.g., `deleteFacility(facilityId, buildingId)`
elsewhere in this app, where a client-supplied `buildingId` is safe only because the subsequent RLS
`WITH CHECK` independently re-validates it against the caller's own role membership before the row
is written).

**Rationale**: The Admin API call is deliberately RLS-bypassing — that's the entire reason it needs
a service-role client. If a malicious or buggy caller could influence which `building_id` ends up
in `user_metadata`, `handle_new_user()`'s `SECURITY DEFINER` insert would write it into `profiles`
with **no RLS check at all**, unlike every other write in this app where RLS is the actual
enforcement point regardless of what a client claims. This is exactly the scenario Constitution
Principle I ("no query, mutation, view, or API response may expose or allow cross-building access")
and Principle III (test authorization before it ships) exist for — so the fix here is structural
(there is no `building_id` parameter to tamper with; it's resolved once from the authenticated
session, server-side, per request) rather than a runtime check, and is covered by
`tests/integration/user-provisioning.test.ts`.

**Alternatives considered**: Accepting `buildingId` as a parameter and re-validating it against
`ctx.buildingId` inside the action before calling `createBuildingUser()` (rejected — strictly more
code for the same guarantee; removing the parameter removes the bug class entirely rather than
requiring every future caller to remember the check).

## 5. Minimum password strength for the temporary password

**Decision**: A `lib/validation/users.ts` Zod schema requires the temporary password to be at least
8 characters, checked before ever calling the Admin API. Supabase Auth's own project-level minimum
(configured independently of this app's code) is the authoritative backstop regardless — if a
password somehow passes the 8-character check but fails Supabase's own policy, the Admin API's
error is surfaced as the rejection message (FR-008).

**Rationale**: No password policy exists anywhere in this codebase today to reuse (grep of
`app/`/`lib/` for "password" turns up only the sign-in field in `login-form.tsx`, which has no
validation of its own — Supabase Auth's hosted sign-in enforces its own policy already). Since
spec.md's Assumptions defer to "whatever standard the system already applies... elsewhere," and no
such standard exists in this app's own code, 8 characters is adopted here as this feature's own
reasonable floor — a fail-fast client/server validation ahead of the network round-trip to Supabase
Auth, not a competing source of truth.

**Alternatives considered**: Skipping app-level validation entirely and relying solely on whatever
error the Admin API returns (rejected — worse UX, since the admin would only learn the password was
rejected after already submitting the whole form; Supabase's own minimum, 6 characters by default,
is also arguably too permissive for an admin-facing tool per general security practice, so this
feature's own floor is set slightly higher).

## Summary

Two additive `profiles` columns and one modified trigger function are the only schema changes; no
new table, no new RLS policy (the one RLS-enforced write this feature makes — the `staff`
`user_roles` insert — reuses an existing, already-tested policy). All Technical Context unknowns
are resolved; no `NEEDS CLARIFICATION` markers remain.
