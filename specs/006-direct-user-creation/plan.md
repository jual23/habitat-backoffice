# Implementation Plan: Direct User Creation (Replacing Invitations)

**Branch**: `006-direct-user-creation` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-direct-user-creation/spec.md`

## Summary

Replace the Resident/Staff "invite" flow on Usuarios y roles with direct account creation: a
Building Administrator fills in first name, last name, document ID, email, (apartment, for
Resident), and a temporary password, and submitting immediately provisions a real, sign-in-capable
Supabase Auth account — no pending `invitations` row, no accept step. This requires a genuinely new
capability this app has not used before: server-side creation of an `auth.users` account with an
admin-chosen password, which only the Supabase Auth **Admin API** (service-role privileged) can do.
That elevated call is isolated to one narrow, server-only helper; every other read/write in this
feature (inserting the `staff` `user_roles` row) continues to go through the normal RLS-enforced,
request-scoped client exactly like every other feature in this app.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: `@supabase/supabase-js` (already a dependency) for the service-role Admin
API client — no new package. `zod` for validation, as everywhere else.

**Storage**: Supabase Postgres (Habitat project). Two additive `profiles` columns (`first_name`,
`last_name`, `document_id`) and one modified trigger function (`handle_new_user()`, extended to
populate those plus `building_id`/`apartment_id` from the new Admin API call's `user_metadata` —
see research.md item 2). No new table.

**Testing**: Vitest (`tests/integration/*.test.ts`). This feature's core provisioning logic is
extracted into a plain, DI-style `lib/` function (`createBuildingUser()`, research.md item 3) that
takes its Supabase clients as arguments rather than resolving them from `cookies()` — the same
shape as `writeAuditLog()` — specifically so it's directly callable from Vitest without a Next.js
request context, unlike a `'use server'` action. Per Constitution Principle III this is
**NON-NEGOTIABLE** here: unlike features 004's US3 or 005 (pure display changes), this feature adds
a genuinely new authorization-relevant code path — one that deliberately bypasses RLS for the
`auth.users` insert, meaning the *application code itself*, not Postgres, is the enforcement point
for "this building only." That must have an allow/deny test before it ships.

**Target Platform**: Web (existing Next.js backoffice, `/users` and `/visitors` routes) — same
runtime as every other feature; the Admin API call runs in the Next.js server runtime (Server
Actions execute exclusively server-side already).

**Project Type**: Single Next.js application (existing `app/(backoffice)/users/`,
`app/(backoffice)/visitors/staff-actions.ts`) — no new route.

**Performance Goals**: N/A beyond the existing app's standard — one Admin API call plus at most one
additional table insert per account created, not a hot path.

**Constraints**: A new environment variable, `SUPABASE_SERVICE_ROLE_KEY`, must be present in every
runtime environment this app is deployed to (not just test environments, where it was previously
optional — see research.md item 1). It MUST NOT be prefixed `NEXT_PUBLIC_` and MUST only be read
inside a server-only module never imported by a Client Component (mirrors how `tests/fixtures.ts`
already isolates the same key for tests). The building a new account is scoped to MUST be derived
from the calling admin's own authenticated session (`getUserContext()`), never from a client-
supplied parameter — see research.md item 4 for why this differs from every other action in this
app.

**Scale/Scope**: Same building-scoped Users and Roles page already in the app; no new list, no
pagination change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.5.0:

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS (justified) | The Admin API call bypasses RLS by construction (that's the only way to create an `auth.users` row with a chosen password), so isolation here is enforced by application code deriving `building_id` exclusively from the caller's own `ctx.buildingId` — never a client-supplied value — before it ever reaches the elevated call (research.md item 4). The one RLS-enforced write this feature still makes (`user_roles` staff insert) uses the existing, already-isolated, already-tested `staff role insert by building admins` policy. |
| II. Role-Based Access Control | PASS | No new role. Resident creation stays gated to `building_admin`/`app_admin`, Staff creation stays gated to `building_admin` only — identical to today's `createResident`/`createStaff` gates (FR-009); this feature changes *how* the account is provisioned, not *who* may provision it. |
| III. Test-First for Authorization & Core Workflows (NON-NEGOTIABLE) | PASS (planned) | `createBuildingUser()`'s building-scoping (Constraints above) is new authorization-relevant logic and gets an allow/deny Vitest test before implementation — see Testing above and quickstart.md. |
| IV. Auditability & Data Integrity | PASS (planned) | `resident.create`/`staff.create` audit log actions replace today's `resident.invite`/`staff.invite`, attributed to the acting Building Administrator, matching every other mutating action. |
| V. Simplicity & Incremental Delivery | PASS (justified) | The Admin API is the *only* Supabase-supported way to create a real account with an admin-chosen password — there is no simpler alternative that satisfies FR-005 (see research.md item 1's Alternatives Considered for why a SECURITY DEFINER SQL function or a separate microservice were rejected as respectively unsupported and unnecessary indirection). |
| Security & Access Control Requirements | PASS (justified) | Not a self-registration path (an authenticated Building Administrator acts on someone else's behalf, per FR-009) — consistent with "Staff and Resident accounts MUST be provisioned only by a Building Administrator." Introducing a service-role key into the server runtime is new for this app outside of tests; Complexity Tracking below records the justification and containment. |
| Data Storage | PASS | Same Habitat Supabase project; no alternative datastore. |
| Client Platform Requirements | PASS | No new page; existing `/users` route, existing client-side routing. |
| Development Workflow & Quality Gates | PASS | No new backoffice page or nav link; this plan states the authorization change explicitly per the Development Workflow gate. |

No unresolved violations. See Complexity Tracking for the one deliberate, justified departure from
this app's prior practice (never holding a service-role key outside tests).

## Project Structure

### Documentation (this feature)

```text
specs/006-direct-user-creation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── provisioning.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
lib/
├── supabase/
│   ├── admin.ts                    # NEW: server-only service-role client, mirroring
│   │                                #      tests/fixtures.ts's getServiceClient() but for
│   │                                #      the running app; never imported by a Client Component
│   └── database.types.ts           # MODIFIED: regenerated after the profiles migration
├── user-provisioning.ts            # NEW: createBuildingUser() — the testable, DI-style core
│                                    #      logic (research.md item 3); takes clients as args,
│                                    #      no cookies()/getUserContext() call inside it
└── validation/
    └── users.ts                     # NEW: Zod schemas for the create-user and edit-identity forms
                                     #      (first_name, last_name, document_id, email, password,
                                     #      apartment_id-if-resident)

app/(backoffice)/
├── users/
│   ├── page.tsx                    # MODIFIED: select the new profiles columns for display
│   ├── users-client.tsx            # MODIFIED: replace the "Invitar usuario" form with a
│   │                                #      "Crear usuario" form (new fields); extend the resident
│   │                                #      edit form with first_name/last_name/document_id (US2)
│   └── actions.ts                  # MODIFIED: createResident() calls createBuildingUser() instead
│                                    #      of inserting into `invitations`; updateResident() gains
│                                    #      the new editable fields; cancelResidentInvitation()
│                                    #      unchanged (still needed for pre-existing pending rows)
└── visitors/
    └── staff-actions.ts             # MODIFIED: createStaff() calls createBuildingUser() instead
                                     #      of inserting into `invitations`; cancelStaffInvitation()
                                     #      unchanged (still needed for pre-existing pending rows)

supabase/migrations/
├── 0015_profiles_identity_fields.sql   # NEW: first_name, last_name, document_id columns
└── 0016_handle_new_user_metadata.sql   # NEW: handle_new_user() reads the new metadata keys

tests/
└── integration/
    └── user-provisioning.test.ts   # NEW: createBuildingUser() allow/deny + duplicate-email +
                                     #      weak-password + building-scoping tests
```

**Structure Decision**: No new route. The two existing entry points that already provision
Resident/Staff accounts (`users/actions.ts`, `visitors/staff-actions.ts`) are modified in place, and
their shared provisioning logic is factored into one new, independently-testable `lib/` module —
matching this codebase's existing pattern of thin Server Actions calling testable `lib/` helpers
(`writeAuditLog()`, `uploadBuildingFile()`).

## Complexity Tracking

*Fill only if Constitution Check has violations that must be justified — this entry is not a
violation but records a deliberate architectural decision the Constitution Check above flagged.*

| Decision | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Server runtime now holds `SUPABASE_SERVICE_ROLE_KEY` (previously test-only, per `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`'s "Known limitation") | FR-005 requires an account that can sign in *immediately* with an admin-chosen password. Supabase's only supported way to create an `auth.users` row with a caller-specified password is the Admin API (`auth.admin.createUser`), which requires the service-role key. | Keeping the existing `invitations`-row-only approach (rejected — it's exactly the behavior this feature replaces). A `SECURITY DEFINER` SQL function that writes `auth.users` directly (rejected — inserting into GoTrue-managed `auth.users`/computing its password hash outside the Admin API is unsupported and fragile across Supabase Auth versions). A separate microservice/Edge Function holding the key instead of the Next.js server (rejected — adds a new deployable, secret, and failure mode for one action, when the key is already contained to one server-only module never reachable from a Client Component; revisit only if a second, unrelated feature needs elevated access, per Principle V's "until a real second use case exists"). |
