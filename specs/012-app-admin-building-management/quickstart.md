# Quickstart: Validating App Administrator Building Management

## Prerequisites

- `npm install` (if not already), `.env.local` configured per the repo README (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for tests and for `lib/supabase/admin.ts`'s runtime use).
- Test/seed accounts for all three backoffice-eligible roles: **App Administrator**, **Building Administrator**, **Staff** (`tests/fixtures.ts`'s `createTestUser` is the reference for seeding these manually if needed).
- Before writing any code: confirm against the live Supabase project whether the RLS policies research.md §6 lists (`buildings` INSERT/UPDATE, `user_roles` INSERT/DELETE for `role='building_admin'`, both scoped to `app_admin`) already exist. Add an additive migration only for whichever are missing.

## Run

```bash
npm run dev
```

## Automated checks first

```bash
npm run typecheck
npm run test
```

`npm run test` MUST include the Constitution Principle III gate coverage (plan.md → Constitution Check): tests proving only App Administrator can create a building or assign/reassign its administrator, that a newly assigned Building Administrator's access is scoped to exactly that one building, and that reassignment immediately revokes the previous administrator's access to that building.

## Manual validation checklist

### Navigation (User Story 1 / FR-001, FR-002)

- [ ] Sign in as **App Administrator**: the navigation shows only Users — no Panel, Facilities, Incidencias, Packages, Finance, Maintenance, Polls, Emergency, Broadcast, Documentation, Suggestions/Complaints, Apartments, Activities, Announcements, Reservations, Customization, or Visitors links.
- [ ] Sign in as **Building Administrator**: navigation is unchanged from before this feature — every module link still present.
- [ ] Sign in as **Staff**: navigation is unchanged from before this feature.
- [ ] As App Administrator, navigate directly to `/facilities` (or any other excluded module) by URL: no real content is shown — the existing "manage this per-building elsewhere" fallback appears (research.md §5), not an error page.

### Users module content (User Story 1 Scenario, FR-003)

- [ ] As App Administrator, open Users: see the buildings list and building-creation entry point, not any resident/staff content.
- [ ] As Building Administrator, open Users: see exactly today's resident/staff/admin tabs, unchanged.

### Building creation (User Story 2 / FR-004–FR-006, FR-011, FR-012)

- [ ] Create a new building with a name only (no logo): it appears in the buildings list immediately.
- [ ] Create a new building with a name and a logo: the logo is visible on the building's entry, stored the same way Customization stores one.
- [ ] Try to submit the creation form without a name: rejected, no building created.
- [ ] Complete the flow choosing "create a new account" and filling in the new Building Administrator's details: the account can sign in immediately (no separate invite/confirmation step) and, once signed in, sees only that one new building's data — the same experience any other Building Administrator has today.
- [ ] Try creating a Building Administrator account with an email that's already registered: rejected with a friendly "an account with this email already exists" message (matching the existing pattern), and no building is left behind without an administrator (research.md §8's rollback).
- [ ] Complete the flow choosing "select an existing Building Administrator" from the dropdown instead: no new account is created; that person now administers the new building in addition to whichever one(s) they already did.
- [ ] Open the existing-administrator dropdown and confirm no App Administrator account ever appears in it (FR-013).

### Editing & reassignment (User Story 3 / FR-007–FR-011)

- [ ] Edit an existing building's name and/or logo: the change is reflected immediately.
- [ ] View an existing building's details: the current Building Administrator is shown.
- [ ] Reassign a building's Building Administrator to a different user, via the dropdown or a new account: the new user has Building Administrator access to that building; the previous administrator signs in and confirms they no longer have access to it.
- [ ] Reassign a building's administrator to a user who already administers a different building: allowed, both assignments remain valid independently.
- [ ] Find (or create, for this check) a building with no Building Administrator: confirm it's clearly flagged as having none in the buildings list, then assign one via the same dropdown-or-new-account action; confirm it now shows that administrator like any other building (FR-011, SC-003).

### No regression (SC-005, Constitution Principle I–III)

- [ ] Building Administrator's and Staff's existing workflows (residents, staff, facilities, incidencias, finance, etc.) behave identically to before this feature, for every module.
- [ ] A Building Administrator of Building A still cannot see Building B's data anywhere, including via the Users module (cross-building isolation, Principle I) — unaffected by this feature since their code path is untouched.
- [ ] Re-run `npm run test` (full suite) and confirm no regressions.

## Done when

Every checkbox above is checked, `npm run typecheck`/`npm run lint`/`npm run build` are clean, and the automated Principle III gate tests pass.
