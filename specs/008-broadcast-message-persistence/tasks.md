---

description: "Task list template for feature implementation"
---

# Tasks: Broadcast Module (Send, Persist, Deactivate)

**Input**: Design documents from `/specs/008-broadcast-message-persistence/`, read together with
`specs/007-finance-ops-expansion/spec.md`'s User Story 6 (FR-051–FR-056) — plan.md covers the
**complete** Broadcast module, not just spec 008's own persistence refinement, since sending and
persisting can't be sensibly built or shipped apart.

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[../007-finance-ops-expansion/spec.md](../007-finance-ops-expansion/spec.md)'s User Story 6,
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/rls-policies.md](./contracts/rls-policies.md), [quickstart.md](./quickstart.md)

**Tests**: NOT optional. Constitution Principle III (NON-NEGOTIABLE) requires an automated
allow-case and deny-case test for every new RLS policy, written and failing before that policy
exists — `broadcasts` and `broadcast_templates` are new authorization surface, and the
Staff-broadcast-toggle is this feature's one genuinely new authorization *shape* (a building-level,
admin-controlled runtime gate, not a fixed constitutional grant) and gets its own dedicated test.

**Organization**: This feature has one cohesive user story — spec 008 explicitly says its
persistence requirements aren't independently shippable from spec 007's send/template/toggle
requirements, so both are implemented and tested together as US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1)
- Every task includes its exact file path

## Path Conventions

Single Next.js project, same as every prior feature — `app/`, `components/`, `lib/`, `tests/` at
the repository root. This repo has no local `supabase/migrations/` directory (see
`specs/001-building-backoffice/SCHEMA-ADAPTATION.md`); migration tasks below still name a
`supabase/migrations/NNNN_*.sql` path as the canonical record of the change, applied to the live
project the same way (SQL editor/MCP) prior features' additive migrations were, with
`lib/supabase/database.types.ts` regenerated immediately after.

**Note on Supabase MCP access**: this plan was authored while this session's Supabase MCP
connection was disconnected (research.md item 7) — T002 below requires it. If it's still
disconnected when implementation starts, re-authorize it (`/mcp` or `claude mcp`) before
proceeding; nothing in Phase 3 can be verified against the live schema without it.

**Migration numbering correction**: this file originally claimed `0017`–`0021`, aspirational at
planning time. `007-finance-ops-expansion` was implemented first (in this same session) and
actually consumed `0022`–`0035` (plus `0027b`/`0027c`) — confirmed against `supabase/migrations/`
on disk. This feature's migrations are renumbered to `0036`–`0040` below, the true next-available
range, per `SCHEMA-ADAPTATION.md`'s renumber-when-drifted precedent.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline this feature builds on is intact before changing anything

- [X] T001 Verify `npm run typecheck`, `npm run lint`, and `npm run test` are clean on the current branch before this feature's changes begin, and that `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` set per quickstart.md's Prerequisites

**Checkpoint**: Baseline confirmed working; safe to start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the one live-schema assumption this feature's design depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Confirm against the live Habitat Supabase project (Supabase MCP — re-authorize first if disconnected): (a) `buildings` already has an UPDATE policy letting a `building_admin` edit their own building's settings (Customization, feature 001, already edits `accent_color`/`logo_url` — confirm it or an equivalent covers a new column too, per data-model.md's flagged assumption and research.md item 7); (b) the exact current definitions of `notify_reservation_decision()`/`notify_visitor_arrival()` (to mirror their shape for the new `notify_broadcast_sent()` trigger — data-model.md's Triggers section); (c) `push_tokens`'s current column shape. No code change — this only confirms T007–T011 can rely on these as designed

**Checkpoint**: Confirmed; User Story 1 can proceed as specified (or adapt to any live-schema divergence found, per SCHEMA-ADAPTATION.md's precedent).

---

## Phase 3: User Story 1 - Send, persist, and deactivate building-wide broadcasts (Priority: P1) 🎯 MVP

**Goal**: A Building Administrator (or Staff, only when explicitly enabled per building) sends a
custom or predetermined-template broadcast message; it becomes active and stays visible to every
resident/renter of the building — multiple can be active at once — until explicitly deactivated;
sending also fires an in-app notification and push to every resident.

**Independent Test**: Per quickstart.md — send a custom broadcast and a template-sourced one
without deactivating either (confirm both stay active simultaneously), confirm every resident gets
a notification, deactivate one and confirm only it disappears from the active view, and confirm
Staff can't send/deactivate until the Building Administrator turns the permission toggle on.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T003 [P] [US1] Extend `tests/fixtures.ts` with `createTestBroadcast(buildingId, sentBy, overrides?)` and `createTestBroadcastTemplate(buildingId, createdBy, overrides?)` (service-role insert, bypassing RLS, matching the `createTestTicket`/`createTestPackage` pattern)
- [X] T004 [P] [US1] RLS allow/deny test for `broadcasts` in `tests/integration/rls-broadcasts.test.ts`, covering: SELECT allowed to every building member including a resident (not just staff/admin); the cross-building deny case; INSERT/UPDATE(deactivate) allowed to `building_admin` regardless of the toggle; denied to `resident`; that two broadcasts in the same building can both be `status = 'active'` simultaneously (no uniqueness conflict); and — per data-model.md's Triggers section — that a `building_admin` UPDATE changing `message`/`icon`/`building_id`/`template_id` is rejected by the content-immutability trigger even though that same role's `status` update on the same row succeeds (depends on T003)
- [X] T005 [P] [US1] RLS allow/deny test for `broadcast_templates` in `tests/integration/rls-broadcast-templates.test.ts`, covering: SELECT allowed to `staff`/`building_admin` of the building, denied to `resident` and other buildings; INSERT/UPDATE/DELETE allowed to `building_admin` only — denied to `staff` even when `buildings.staff_broadcast_enabled` is true (template management is never toggle-gated, per contracts/rls-policies.md) (depends on T003)
- [X] T006 [P] [US1] Staff-broadcast-toggle authorization test in `tests/integration/broadcast-staff-toggle.test.ts`: with `buildings.staff_broadcast_enabled = false` (the default), a `staff` INSERT into `broadcasts` and a `staff` UPDATE (deactivate) on an existing active broadcast are both denied; after setting it `true` on that building, the same two operations succeed for that `staff` user, and remain denied for `staff` of a *different* building whose toggle is still `false` (depends on T003)

### Implementation for User Story 1

- [X] T007 [US1] Migration: `broadcast_status` enum (`active`, `deactivated`) and `buildings.staff_broadcast_enabled boolean not null default false` in `supabase/migrations/0036_broadcast_schema_prep.sql` (depends on T002; depends on T004, T005, T006 failing)
- [X] T008 [US1] Migration: `broadcast_templates` table per data-model.md (`building_id`, `message`, `icon`, `created_by`, timestamps, `(building_id)` index) in `supabase/migrations/0037_broadcast_templates.sql` (depends on T007) — **ordering fix**: created before `broadcasts` because `broadcasts.template_id` FK-references it; the original task list had this backwards
- [X] T009 [US1] Migration: `broadcasts` table per data-model.md (`building_id`, `message`, `icon`, `template_id` FK → `broadcast_templates.id` ON DELETE SET NULL, `status`, `sent_by`, `deactivated_by`, `deactivated_at`, timestamps, the two status/deactivation `CHECK` constraints, the `(building_id, status)` index) in `supabase/migrations/0038_broadcasts.sql` (depends on T008)
- [X] T010 [US1] Migration: RLS policies for `broadcasts` and `broadcast_templates` per contracts/rls-policies.md — including the toggle-conditional `WITH CHECK` for Staff INSERT/UPDATE on `broadcasts` (`can_admin_building(...) OR (has_building_role(..., 'staff', ...) AND exists(select 1 from buildings b where b.id = broadcasts.building_id and b.staff_broadcast_enabled))`) — **plus** the `broadcasts` content-immutability `BEFORE UPDATE` trigger (rejecting changes to `message`/`icon`/`building_id`/`template_id`, matching the `tickets_content_immutable`/`packages_content_immutable` precedent) in `supabase/migrations/0039_broadcast_rls.sql` (depends on T009)
- [X] T011 [US1] Migration: `notify_broadcast_sent()` — an `AFTER INSERT ON broadcasts`, `SECURITY DEFINER` trigger mirroring `notify_reservation_decision()`/`notify_visitor_arrival()`'s shape (confirmed in T002): for every `profiles` row with `building_id = NEW.building_id AND apartment_id IS NOT NULL`, insert one `notifications` row (title/body from the broadcast, `link` to the mobile app's active-broadcasts view) and loop that resident's `push_tokens` calling `net.http_post` to Expo's endpoint, per data-model.md's Triggers section — in `supabase/migrations/0040_broadcast_notify_trigger.sql` (depends on T010)
- [X] T012 [US1] Regenerate `lib/supabase/database.types.ts` from the live schema after T007–T011 are applied (depends on T011)
- [X] T013 [P] [US1] `lib/validation/broadcast.ts`: Zod schemas — `broadcastIconSchema` (a `z.enum` of the curated icon keys from T014), `sendBroadcastSchema` (`message` min-length, optional `template_id` uuid), `saveTemplateSchema`/`updateTemplateSchema` (`message` min-length, optional icon), `setStaffBroadcastPermissionSchema` (`enabled` boolean) (depends on T012)
- [X] T014 [P] [US1] Add curated alert icon components to `components/icons.tsx` — `IconFire`, `IconWaterDrop`, `IconWarningTriangle` (reuse the existing `IconMegaphone` for the nav item and as the default/no-icon fallback) — matching the existing hand-drawn outline `base()` pattern (depends on T012)
- [X] T015 [US1] Server Actions in `app/(backoffice)/broadcast/actions.ts`: `sendBroadcast(buildingId, input)` — validates with T013's schema, resolves `ctx` via `getUserContext()`, checks `staff` callers against `buildings.staff_broadcast_enabled` first as a friendly pre-check ahead of the RLS `WITH CHECK` (ticket/package precedent), inserts a `broadcasts` row (copying `icon` from the template when `template_id` is given), calls `writeAuditLog()` (`broadcast.send`), `revalidatePath('/broadcast')`; `deactivateBroadcast(broadcastId, buildingId)` — same authorization shape, updates `status`/`deactivated_at`/`deactivated_by`, audit `broadcast.deactivate`; `saveTemplate`/`updateTemplate`/`deleteTemplate(...)` — `building_admin` only, audit `broadcast_template.create`/`update`/`delete`; `setStaffBroadcastPermission(buildingId, enabled)` — `building_admin` only, updates `buildings.staff_broadcast_enabled`, audit `broadcast.staff_permission_change` (depends on T010, T013)
- [X] T016 [US1] `app/(backoffice)/broadcast/page.tsx`: Server Component — redirect to `/login` unless `ctx.role` is `staff`/`building_admin`/`app_admin`; load all `broadcasts` for `ctx.buildingId` (active and deactivated), all `broadcast_templates`, and `buildings.staff_broadcast_enabled`; pass to the client component (depends on T012)
- [X] T017 [US1] `app/(backoffice)/broadcast/broadcast-client.tsx`: Client Component — send form (message textarea, a template picker that pre-fills message + icon, a "save as template" checkbox with T014's icon picker); an active-broadcasts list (using `Badge` for `active`/`deactivated`) with a per-row "Desactivar" action calling T015's `deactivateBroadcast`; a templates list (Building Administrator: edit/delete/send-from-template actions); a Staff-permission `Toggle` (Building Administrator only, calling `setStaffBroadcastPermission`) — Staff sees the send form and active list but not the toggle, and the send/deactivate controls are hidden/disabled for Staff when the toggle is off (defense-in-depth alongside the RLS gate) (depends on T015, T016)
- [X] T018 [P] [US1] `app/(backoffice)/sidebar-nav.tsx`: add `{ href: '/broadcast', label: 'Difusión', icon: IconMegaphone }` to `NAV_ITEMS` (reusing the existing megaphone icon already used elsewhere) and extend the `staffOnly` filter's condition to also match `/broadcast` (depends on T016)
- [X] T019 [P] [US1] `lib/supabase/middleware.ts`: extend the staff-only redirect allow-list to also permit `/broadcast` (same shape as the existing `/visitors`/`/incidencias`/`/packages` entries) (depends on T016)

**Checkpoint**: User Story 1 is fully functional and independently testable — the complete
Broadcast module (send, templates, persistence, multi-active, deactivation, the Staff toggle) works
end-to-end.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verification that spans the user story

- [X] T020 [P] Run `npm run typecheck && npm run lint && npm run test && npm run build` and confirm all are clean with every change from T002–T019 applied
- [ ] T021 Run quickstart.md's full manual validation script (sending/persisting/multi-active/deactivating, the Staff toggle on/off walkthrough, and the Cross-cutting checks section) and record results
- [X] T022 [P] Re-read plan.md's Constitution Check and Complexity Tracking table and confirm they still hold with the actual implementation; if the live schema diverged from data-model.md's assumptions (especially the `buildings` admin-UPDATE-policy assumption T002 was meant to confirm), add a `SCHEMA-ADAPTATION.md`-style note to this feature's directory

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup. Confirms the one live-schema assumption everything
  else depends on — genuinely blocking, since T007's migration shape and T011's trigger both
  hinge on what T002 confirms
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **Polish (Phase 4)**: Depends on User Story 1 being complete

### Within User Story 1

- Fixture (T003) before its tests (T004–T006); tests before the migrations they gate
  (T007–T011); migrations before type regen (T012); type regen before validation/icons (T013,
  T014) and before the page (T016); validation before actions (T015); actions and page before the
  client (T017); nav (T018) and middleware (T019) last, independent of each other and of T017's
  exact contents (only need the route to exist)

### Parallel Opportunities

- Setup: single task
- Foundational: single verification task
- US1: T004, T005, T006 can run in parallel once T003 lands (three different test files); T013
  and T014 can run in parallel with each other once T012 lands; T018 and T019 can run in parallel
  with each other once T016 lands
- Nothing in this feature is parallel with anything outside it — it's one self-contained module
  touching no file any other in-flight feature in this repo also touches

---

## Parallel Example: User Story 1

```bash
# After T003 (fixtures) lands, launch all three test files together:
Task: "RLS allow/deny test for broadcasts in tests/integration/rls-broadcasts.test.ts"
Task: "RLS allow/deny test for broadcast_templates in tests/integration/rls-broadcast-templates.test.ts"
Task: "Staff-broadcast-toggle authorization test in tests/integration/broadcast-staff-toggle.test.ts"

# Once schema + types land, these two can run in parallel:
Task: "Zod schemas in lib/validation/broadcast.ts"
Task: "Curated alert icons in components/icons.tsx"
```

---

## Implementation Strategy

### MVP First (and Only) User Story

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (the entire Broadcast module)
4. **STOP and VALIDATE**: run quickstart.md's full manual validation script
5. This alone delivers 100% of this feature's scope — spec 008 has one user story, and it isn't
   separable from spec 007's Broadcast requirements (plan.md's Summary)

### Incremental Delivery

Not meaningfully separable into smaller increments — sending without persistence would contradict
spec 008's explicit purpose (correcting that gap before it ever shipped), and persistence without
sending has nothing to persist. Ship Phase 3 as one unit.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency
- This feature has no shared-file friction with any other in-flight feature in this repo
- Per SCHEMA-ADAPTATION.md's precedent (specs/001, specs/004, specs/006), if the live Habitat
  schema's `buildings`/notification-trigger shape has drifted from data-model.md's assumptions by
  the time T002/T007–T011 run, adapt to the live definition and record the mapping rather than
  assuming data-model.md is authoritative (T022)
- Commit after each task or logical group
- Stop at the checkpoint to validate the story before moving to Polish
