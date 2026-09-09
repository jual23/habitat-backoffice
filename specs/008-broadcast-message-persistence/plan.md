# Implementation Plan: Broadcast Module (Send, Persist, Deactivate)

**Branch**: `008-broadcast-message-persistence` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-broadcast-message-persistence/spec.md`, read
together with `specs/007-finance-ops-expansion/spec.md`'s User Story 6 (FR-051–FR-056), which this
spec explicitly extends rather than repeats. This plan covers the **complete** Broadcast module —
composing/sending, predetermined messages, the Staff-permission toggle, and this spec's own
persistence/multi-active/deactivation behavior — because none of those pieces can be sensibly built
or tested in isolation from each other.

## Summary

Building Administrators (and, only when explicitly enabled per building, Staff) send urgent
broadcast alerts to every resident of a building. Unlike a normal one-time notification, a
broadcast has a persistent **active** state: residents who open the mobile app at any later point
still see it, and more than one broadcast can be active at once, each independently deactivated.
Administrators may also save reusable predetermined messages (with an icon) for one-action resend.
Sending fires both an in-app `notifications` row per resident (matching the existing
packages/tickets pattern) and a push notification via the existing `push_tokens`/Expo pattern
already used for visitor-arrival and reservation-decision alerts — broadcasts use both channels
since no per-resident notification-preference system exists in this app to bypass yet (research.md
item 4). This became plannable only after Constitution v1.6.0 added Broadcast (Staff, gated) to
Principle II's enumerated Staff modules.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js` (data/auth/realtime — no
Storage needed, see below), `zod` — same stack as every existing backoffice module; no new
dependency.

**Storage**: Supabase Postgres (Habitat project). Two new tables (`broadcasts`,
`broadcast_templates`), one new column on `buildings` (`staff_broadcast_enabled`), and reuse of the
existing `notifications` table and `push_tokens`-driven push pattern. No Storage bucket is needed —
a broadcast's optional icon is a reference into this app's existing built-in icon set (a short key,
like `facility`/`icon-fire`), not an uploaded file, avoiding both a new bucket and an emoji-input
dependency (research.md item 2).

**Testing**: Vitest (`tests/integration/*.test.ts`), one allow-case and one deny-case RLS
integration test per new policy (Principle III), plus a test for the Staff-broadcast-toggle gate
specifically, since that's this feature's one genuinely new authorization dimension (a
building-level, admin-controlled permission gate — a new shape not yet used elsewhere in this app).

**Target Platform**: Web (existing Next.js backoffice) for the admin-facing module this plan builds;
the mobile app (which displays active broadcasts to residents) is an external consumer, out of
scope per spec 007/008's own Assumptions — this plan's job ends at the data these apps expose
(the `broadcasts` rows and the notifications/push already fired).

**Project Type**: Single Next.js application (new `app/(backoffice)/broadcast/` route group) —
matches the existing repo structure.

**Performance Goals**: No new performance target — a broadcast send fans out to at most a
building's resident count (tens to low hundreds), the same scale packages' per-apartment fan-out
already handles.

**Constraints**: Multi-tenant isolation (Principle I) — `broadcasts`/`broadcast_templates` carry
`building_id`, scoped by RLS the same way every other building-scoped table is. Staff's send/
deactivate capability is gated by `buildings.staff_broadcast_enabled`, defaulting to `false`
(Constitution v1.6.0, off by default). Building Administrator access is unconditional.

**Scale/Scope**: Single building's worth of broadcasts/templates per view — same scale as every
other list in this app; client-side filtering only, no pagination infrastructure introduced.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.6.0 (amended earlier in this session specifically to unblock this
plan — see the Sync Impact Report at the top of `.specify/memory/constitution.md`):

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS | `broadcasts`/`broadcast_templates` carry `building_id`; RLS scopes every SELECT/INSERT/UPDATE to the caller's building, per contracts/rls-policies.md. The notifications fan-out reuses the existing building-scoped `notifications insert by staff or admin for their building` policy (feature 004) unchanged. |
| II. Role-Based Access Control | PASS (post-amendment) | Staff's scope now explicitly includes Broadcast, conditional on `buildings.staff_broadcast_enabled` (Constitution v1.6.0). Building Administrator retains unconditional access. Finance and Community Polls are untouched by this plan. |
| III. Test-First for Authorization & Core Workflows | PASS (planned) | Each new RLS policy — including the Staff-toggle-conditional one, this feature's one genuinely novel authorization shape — gets an allow+deny Vitest integration test before implementation. |
| IV. Auditability & Data Integrity | PASS (planned) | Send, deactivate, and template create/update/delete all call `writeAuditLog()`, matching every existing mutating action. |
| V. Simplicity & Incremental Delivery | PASS | Reuses existing patterns (Server Actions, Zod, `notifications` table, `push_tokens` push pattern, Toggle component, built-in icon set) — no new Storage bucket, no emoji-picker dependency, no new notification-delivery infrastructure. |
| Security & Access Control Requirements | PASS | All authorization server-side via RLS + the building-level toggle; no client-only gating. |
| Data Storage | PASS | Same Habitat Supabase project. |
| Client Platform Requirements | PASS (planned) | New `/broadcast` page uses `next/link`/`next/navigation`, consistent with the existing sidebar/route pattern. |
| Development Workflow & Quality Gates | PASS (planned) | This plan states role access up front (Building Administrator always; Staff conditional on the toggle); new nav entry uses client-side routing per the existing `SidebarNav` pattern. |

No unresolved violations. See Complexity Tracking for the one new pattern this plan introduces
(a building-level, admin-toggled permission gate) and why it doesn't warrant a generic permissions
framework.

## Project Structure

### Documentation (this feature)

```text
specs/008-broadcast-message-persistence/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── rls-policies.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/(backoffice)/
├── broadcast/                       # NEW
│   ├── page.tsx                     # Server Component: loads active/inactive broadcasts +
│   │                                 #   templates for the building, guards role, passes
│   │                                 #   staff_broadcast_enabled to the client
│   ├── broadcast-client.tsx         # Client Component: send form (message, optional icon,
│   │                                 #   optional "save as template"), active-broadcasts list
│   │                                 #   with per-row deactivate, templates list with
│   │                                 #   send/edit/delete, Staff-permission Toggle (admin only)
│   └── actions.ts                    # 'use server': sendBroadcast, deactivateBroadcast,
│                                     #   saveTemplate, updateTemplate, deleteTemplate,
│                                     #   setStaffBroadcastPermission
├── sidebar-nav.tsx                   # MODIFIED: add Broadcast nav item; extend staffOnly filter
└── reservations/                     # UNCHANGED (referenced only for prior-art on the existing
                                       #   push-notification trigger pattern this feature reuses)

lib/
├── supabase/
│   ├── database.types.ts             # MODIFIED: regenerated after new tables/column land
│   └── middleware.ts                 # MODIFIED: staff route guard allow-list gains /broadcast
└── validation/
    └── broadcast.ts                  # NEW: Zod schemas (send message, template CRUD)

components/
├── Badge.tsx                         # UNCHANGED (reused for active/deactivated pills)
└── Toggle.tsx                        # UNCHANGED (reused for the Staff-permission setting)

tests/
├── fixtures.ts                       # MODIFIED: add createTestBroadcast/createTestBroadcastTemplate
└── integration/
    ├── rls-broadcasts.test.ts        # NEW
    ├── rls-broadcast-templates.test.ts  # NEW
    └── broadcast-staff-toggle.test.ts   # NEW: the toggle-conditional authorization test
```

**Structure Decision**: Single Next.js application (existing `app/(backoffice)/` route-group
structure). One new route folder (`broadcast/`) follows the exact
`page.tsx`/`*-client.tsx`/`actions.ts` split already used by `facilities/`, `incidencias/`,
`packages/`. No new project, package, or service.

## Complexity Tracking

*Fill only if Constitution Check has violations that must be justified — this entry documents a
new pattern, not a violation.*

| Decision | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A building-level, admin-toggled permission gate (`buildings.staff_broadcast_enabled`) — the first of its kind in this app; every prior Staff-scope decision has been a fixed, constitution-level yes/no per module | Constitution v1.6.0 and spec 007's FR-053 explicitly require Staff broadcast permission to be *building-specific* and *admin-controlled at runtime*, not a fixed constitutional grant like Visitors/Incidencias/Package Receipt/Maintenance/Emergency | A constitution-level "Staff can always send broadcasts" grant (rejected — spec 007 explicitly requires a default-off, per-building, admin-controlled toggle, which a constitutional grant can't express). A generic per-building feature-flag table for arbitrary future toggles (rejected — exactly one flag exists today; introducing a generic mechanism for a single consumer is the kind of speculative abstraction Principle V rules out until a second real use case exists). |
