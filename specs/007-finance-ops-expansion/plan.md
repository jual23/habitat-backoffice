# Implementation Plan: Building Operations Expansion (Renter, Finance, Visitor Column, Maintenance, Polls, Emergency)

**Branch**: `007-finance-ops-expansion` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-finance-ops-expansion/spec.md`. **Scope note**:
this plan covers User Stories 1–5 and 7 (Renter role, Finance, Visitor apartment column,
Maintenance, Community Polls, Emergency). **User Story 6 (Broadcast) is explicitly excluded** — it
was already fully planned separately as `specs/008-broadcast-message-persistence/plan.md`, which
supersedes spec 007's Broadcast requirements; re-planning it here would produce a conflicting
second design for the same tables.

## Summary

Six additions to the existing Next.js/Supabase backoffice:

1. **Renter role**: a fifth account type (Constitution v1.7.0), apartment-scoped like Resident,
   distinguished by a new `profiles.tenant_type` column (`'resident' | 'renter'`) rather than a
   `user_roles` row — mirroring how Resident itself is already represented. Provisioned through
   feature 006's `createBuildingUser()`, extended with a third `role` option.
2. **Finance module**: per-apartment monthly fees (individual or bulk CSV, merge semantics),
   building-wide payment-cycle/late-fee settings, generated `payments` rows reviewed/approved by a
   Building Administrator, apartment payment history, filtering/export. Building-Administrator-only
   (Constitution Principle II — Finance is not in Staff's six modules).
3. **Visitor apartment column**: a pure display change — `visitors.apartment_id` already exists and
   is simply not yet selected/shown.
4. **Maintenance module**: recurring/one-time tasks a Building Administrator schedules, Staff (per
   Constitution v1.6.0) marks done with a photo, next-due-date advancing per frequency.
5. **Community Polls**: Building-Administrator-created, apartment-scoped (not per-user) voting,
   single/multiple-answer and anonymous options, an accordion status view — Renter accounts can view
   but never vote (enforced via `profiles.tenant_type`, User Story 1).
6. **Emergency module**: a new `emergencies` table (mobile-app-reported, out of this plan's UI
   scope to build the reporting side of) plus a Staff/Building-Administrator (Constitution v1.6.0)
   viewing/acknowledging surface, a persistent unhandled-emergency indicator, and a blinking nav
   link — the first feature in this app needing a layout-level (not just per-page) UI element, since
   no top-right/header area currently exists in `app/(backoffice)/layout.tsx`.

All follow the codebase's existing pattern: Server Components fetch with the request-scoped
Supabase client, Client Components handle interaction, `'use server'` Server Actions validate with
Zod and mutate, RLS is the authorization boundary, `writeAuditLog()` records mutations, and two
scheduled Postgres sweeps (matching the existing `expire_visitors()`/`purge_discarded_feedback()`
precedent) handle Finance's payment generation/late-fee/reminder timing.

## Technical Context

**Language/Version**: TypeScript 5.6, Next.js 14 (App Router), React 18

**Primary Dependencies**: `@supabase/ssr` + `@supabase/supabase-js`, `zod` — no new dependency. CSV
parsing/generation for Finance is hand-rolled (a fixed two-column shape needs no library, per
research.md item 3) rather than adding a CSV package.

**Storage**: Supabase Postgres (Habitat project). New tables: `payments`, `maintenance_tasks`,
`maintenance_completions`, `polls`, `poll_options`, `poll_votes`, `emergencies`. New columns:
`profiles.tenant_type`, `apartments.monthly_fee`, and several `buildings` payment/late-fee settings
columns (matching the established "building-level settings live directly on `buildings`" pattern
from spec 008's research.md item 5). Reuses `building-media`/`building-documents` Storage buckets
for payment-confirmation photos, maintenance-completion photos, and poll attachments. Reuses the
`notifications` table and the existing push pattern for payment-received/reminder/maintenance
notifications.

**Testing**: Vitest, one allow-case and one deny-case per new RLS policy (Principle III,
NON-NEGOTIABLE) — this feature introduces substantial new authorization surface across five
modules, including this app's first Renter-vs-Resident distinction, which needs its own dedicated
test per module that excludes Renter (Finance, Polls voting).

**Target Platform**: Web (existing Next.js backoffice) for everything Building Administrators/Staff
do; the mobile app (fee payment submission, poll voting, emergency reporting) is an external,
out-of-scope consumer per spec.md's Assumptions — this plan's job ends at the data/RLS those
interactions need.

**Project Type**: Single Next.js application. Four new route folders: `finance/`, `maintenance/`,
`polls/`, `emergency/`. No new route for Renter (it's a role option within the existing
`users/`/`visitors` provisioning UI from feature 006).

**Performance Goals**: No new target beyond this app's standard — Finance's `payments` table is the
one genuinely growing-over-time list in this app (one row per apartment per month, indefinitely);
still client-side filterable at this app's current scale (a few hundred apartments × however many
months), matching every other list, but flagged in research.md as the one place to revisit
server-side pagination first if this app's scale changes materially.

**Constraints**: Multi-tenant isolation (Principle I) unchanged — every new table carries
`building_id`. Finance and Community Polls stay Building-Administrator-only (Constitution v1.7.0
explicitly keeps Staff out of both even as its scope grows elsewhere). Maintenance's mark-done and
Emergency's view/acknowledge are Staff-accessible per the same amendment.

**Scale/Scope**: Single building's worth of data per view, consistent with every other module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.7.0 (amended twice this session specifically to unblock this
plan — Staff's Maintenance/Broadcast/Emergency scope, then the Renter role):

| Principle / Requirement | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS | Every new table carries `building_id`; RLS scopes every SELECT/INSERT/UPDATE to the caller's building, per contracts/rls-policies.md. |
| II. Role-Based Access Control | PASS (post-amendment) | Renter (v1.7.0) and Staff's Maintenance/Emergency scope (v1.6.0) are both now constitutional. Finance and Polls remain Building-Administrator-only, unchanged, per the same amendments' explicit carve-outs. |
| III. Test-First for Authorization & Core Workflows | PASS (planned) | Each new RLS policy — including the Renter-exclusion policies on Finance/poll-voting, this feature's newest authorization shape — gets an allow+deny Vitest test before implementation. |
| IV. Auditability & Data Integrity | PASS (planned) | Fee changes, payment approval, maintenance completion, poll create, emergency acknowledge all call `writeAuditLog()`. |
| V. Simplicity & Incremental Delivery | PASS | Reuses existing patterns throughout (Server Actions, Zod, `notifications`, Storage buckets, the scheduled-sweep precedent, `createBuildingUser()`) — no new dependency; CSV handled without a library; the one new structural piece (a layout-level emergency indicator) is a single small addition, not a generic notification-center framework. |
| Security & Access Control Requirements | PASS | All authorization server-side via RLS; Renter/Resident provisioning both go through the existing Building-Administrator-only, non-self-registration path (feature 006). |
| Data Storage | PASS | Same Habitat Supabase project. |
| Client Platform Requirements | PASS (planned) | Four new pages use `next/link`/`next/navigation`, consistent with the existing pattern. |
| Development Workflow & Quality Gates | PASS (planned) | This plan states role access per module up front, matching the gate's requirement. |

No unresolved violations. See Complexity Tracking for the two deliberate new patterns this plan
introduces (a layout-level UI element; two new scheduled sweeps) and why each is the minimum
needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-finance-ops-expansion/
├── plan.md              # This file — covers US1-US5, US7 (US6 Broadcast: see spec 008)
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rls-policies.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks output — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
app/(backoffice)/
├── layout.tsx                       # MODIFIED: add the persistent unhandled-emergency indicator
│                                     #   (top-right of the main content area — no topbar exists
│                                     #   today, research.md item 6)
├── sidebar-nav.tsx                   # MODIFIED: add Finance/Maintenance/Polls/Emergency nav items
│                                     #   (Emergency link blinks when unhandled emergencies exist);
│                                     #   extend staffOnly filter for Maintenance + Emergency
├── users/
│   ├── users-client.tsx              # MODIFIED: role selector gains "Renter" (feature 006's form)
│   └── actions.ts                    # MODIFIED: createResident()-equivalent gains role: 'renter'
├── finance/                          # NEW
│   ├── page.tsx
│   ├── finance-client.tsx            # fee editor, CSV upload/template, payments table
│   │                                 #   (filter/export), settings (cycle days, late fee)
│   ├── actions.ts                    # setApartmentFee, bulkSetFees (CSV), approvePayment,
│   │                                 #   setFinanceSettings
│   └── template/route.ts             # Route Handler: streams the fee-CSV-template download
│                                     #   (Server Actions can't return a file download — research.md
│                                     #   item 2)
├── maintenance/                      # NEW
│   ├── page.tsx
│   ├── maintenance-client.tsx        # task list, create/reschedule form, mark-done (photo)
│   └── actions.ts                    # createTask, rescheduleTask, completeTask
├── polls/                            # NEW
│   ├── page.tsx
│   ├── polls-client.tsx              # accordion list (active expanded/closed collapsed), create
│   │                                 #   form, results view (aggregate or per-apartment)
│   └── actions.ts                    # createPoll
└── emergency/                        # NEW
    ├── page.tsx
    ├── emergency-client.tsx          # list + acknowledge/resolve action
    └── actions.ts                    # acknowledgeEmergency

lib/
├── session.ts                        # MODIFIED: getUserContext() reads profiles.tenant_type to
│                                     #   return role: 'resident' | 'renter' instead of a hardcoded
│                                     #   'resident' (research.md item 1)
├── user-provisioning.ts              # MODIFIED: createBuildingUser() accepts role: 'renter',
│                                     #   passing tenant_type through the same metadata path
│                                     #   feature 006 already built
├── csv.ts                            # NEW: tiny hand-rolled two-column CSV parse/generate helpers
│                                     #   (research.md item 3)
├── supabase/
│   ├── database.types.ts             # MODIFIED: regenerated after every new table/column lands
│   └── middleware.ts                 # MODIFIED: staff route allow-list gains /maintenance,
│                                     #   /emergency (not /finance or /polls)
└── validation/
    ├── finance.ts                    # NEW
    ├── maintenance.ts                # NEW
    ├── polls.ts                      # NEW
    └── emergency.ts                  # NEW

app/(backoffice)/visitors/
└── page.tsx                          # MODIFIED: select + display apartment_id (US3)

tests/
├── fixtures.ts                       # MODIFIED: createTestPayment, createTestMaintenanceTask,
│                                     #   createTestPoll, createTestEmergency, and a `renter` role
│                                     #   option on createTestUser
└── integration/
    ├── rls-payments.test.ts          # NEW
    ├── rls-maintenance.test.ts       # NEW
    ├── rls-polls.test.ts             # NEW
    ├── rls-emergencies.test.ts       # NEW
    ├── finance-late-fee-sweep.test.ts   # NEW
    └── renter-exclusion.test.ts      # NEW: the Renter-can't-see-Finance/can't-vote tests, spanning
                                       #   both modules in one file since they share the same
                                       #   underlying tenant_type mechanism
```

**Structure Decision**: Single Next.js application, four new route folders following the existing
`page.tsx`/`*-client.tsx`/`actions.ts` split. One new Route Handler (`finance/template/route.ts`)
for the one thing a Server Action can't do (stream a file download). One layout-level change
(`layout.tsx`) — the first feature in this app to need one.

## Complexity Tracking

*Fill only if Constitution Check has violations that must be justified — these two entries
document new patterns, not violations.*

| Decision | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A layout-level (`app/(backoffice)/layout.tsx`) UI element — the first feature to modify the shared shell rather than only its own page | Spec 007's FR-060 requires a persistent indicator visible from *any* backoffice page, not just the Emergency page itself, and today's `layout.tsx` has no header/topbar at all to hook into | Polling/checking only from the Emergency page (rejected — defeats the purpose; an admin on Finance would never see an active emergency). Building a full generic topbar/notification-center framework (rejected — spec asks for exactly one indicator for exactly one condition; a generic framework is speculative ahead of a second real consumer, per Principle V). |
| Two new scheduled Postgres sweeps (payment generation + due-date evaluation, alongside the existing `expire_visitors()`/`purge_discarded_feedback()`) | Spec 007 requires payments to appear automatically on a configured day, and late fees/reminders to apply without a human trigger — nothing in this request is manually initiated | A real-time trigger firing exactly at midnight of the relevant day (rejected — this app already established the "periodic sweep, evaluated whenever it next runs" pattern for exactly this class of requirement — visitor expiry, feedback cleanup — introducing a different mechanism for Finance alone would be inconsistent, not simpler). |
