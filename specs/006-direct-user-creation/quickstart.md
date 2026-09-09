# Quickstart: Validating Direct User Creation

## Prerequisites

- `.env.local` populated per `.env.example` — `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (new for this feature's *production* runtime, not just
  tests) `SUPABASE_SERVICE_ROLE_KEY` — see plan.md's Constraints. Without it, the create-user action
  will fail for every caller, not just tests.
- The schema additions in [data-model.md](data-model.md) applied to the live Habitat project
  (`profiles.first_name`/`last_name`/`document_id`, the modified `handle_new_user()` trigger) —
  applied directly to the live project (SQL editor/MCP), per this repo's established convention
  (no local `supabase/migrations/` runner — see `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`).
  Regenerate `lib/supabase/database.types.ts` immediately after.
- A Building Administrator test account for a building with at least one apartment.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run test        # vitest run — includes the new user-provisioning integration test
```

Per Constitution Principle III, `tests/integration/user-provisioning.test.ts` (contracts/provisioning.md's
allow/deny table) must exist and fail before `createBuildingUser()` is implemented, then pass after.

## Manual validation — User Story 1: Direct creation (P1)

1. Sign in as a Building Administrator, open Usuarios y roles.
   - **Expect**: the "Invitar usuario" card is now a "Crear usuario" card asking for first name,
     last name, document ID, email, role, apartment (Resident only), and a temporary password.
2. Fill in all fields for a Resident and submit.
   - **Expect**: the person appears immediately in the Residente list — not as a "pendiente" row
     (Acceptance Scenario 2).
3. Using the email and temporary password from step 2, sign in from the mobile app (or via a
   direct `supabase.auth.signInWithPassword()` call, if the mobile app isn't available for this
   check).
   - **Expect**: sign-in succeeds immediately — no invitation-acceptance step exists (Scenario 3).
4. Repeat steps 2–3 selecting "Personal" (Staff) instead, with no apartment field.
   - **Expect**: same outcome — immediate account, immediate sign-in (Scenario 4).
5. Attempt to create a second account reusing the email from step 2.
   - **Expect**: rejected with a clear "already registered"-style message; no duplicate created
     (Scenario 5).
6. Attempt to create an account with a password shorter than this feature's minimum.
   - **Expect**: rejected before submission completes, with a clear message (Scenario 6).

## Manual validation — User Story 2: Editing identity fields (P2)

1. Edit an existing resident's first name, last name, or document ID.
   - **Expect**: the Residente list reflects the update afterward.
2. Attempt to clear the first name, last name, or document ID entirely and save.
   - **Expect**: rejected, previous value retained.

## Cross-cutting checks

- Sign in as Staff or a Resident and attempt to call the create-user action directly (bypassing the
  UI) — **expect**: denied, exactly as today's `createResident`/`createStaff` already deny non-admins.
- As a Building Administrator of Building A, attempt to create an account using an apartment id
  that belongs to Building B — **expect**: denied, no account created (contracts/provisioning.md).
- Confirm a pending invitation created *before* this feature shipped (if any exist in your test
  data) is still visible and cancelable on the Users and Roles page, unaffected by this change.
