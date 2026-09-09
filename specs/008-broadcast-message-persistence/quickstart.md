# Quickstart: Validating the Broadcast Module

## Prerequisites

- `.env.local` populated per `.env.example` — `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (test-only, used by
  `tests/fixtures.ts`).
- `npm install` run once.
- The schema in [data-model.md](data-model.md) applied to the live Habitat project (`broadcasts`,
  `broadcast_templates` tables; `broadcast_status` enum; `buildings.staff_broadcast_enabled`
  column; the RLS policies in [contracts/rls-policies.md](contracts/rls-policies.md); the
  `notify_broadcast_sent()` trigger) — applied directly to the live project (SQL editor/MCP), per
  this repo's established convention. **Before writing that migration**, confirm the `buildings`
  UPDATE-policy assumption in data-model.md/contracts/rls-policies.md against the live schema
  (research.md item 7 — this plan was authored without live DB access this session). Regenerate
  `lib/supabase/database.types.ts` immediately after.
- At least one test building with a Building Administrator, a Staff account, and one resident
  account with a registered `push_tokens` row (to observe the push fan-out, optional).

## Automated validation

```bash
npm run typecheck
npm run lint
npm run test        # vitest run — includes rls-broadcasts, rls-broadcast-templates, and
                     # broadcast-staff-toggle once implemented
```

Per Constitution Principle III, the new RLS/toggle tests should exist and fail before the
corresponding policy/action code is written, then pass after.

## Manual validation — Sending, persisting, and deactivating

1. Sign in as the Building Administrator, open the Broadcast module.
   - **Expect**: a form to send a custom message, a list of saved templates (initially empty), and
     a list of currently active broadcasts (initially empty).
2. Send a custom message (e.g., "Water outage in Tower A, 2–4pm").
   - **Expect**: it appears immediately in the active-broadcasts list; every resident of the
     building gets a `notifications` row (and a push, if they have a registered token) — spec 007
     Acceptance Scenario 1.
3. As a resident (or via a direct query as the signed-in resident), confirm the broadcast is
   readable from `broadcasts` with `status = 'active'` — this is what the mobile app would query.
4. Without deactivating the first broadcast, send a second, unrelated one.
   - **Expect**: both remain active simultaneously — spec 008 Acceptance Scenario 5/6.
5. Save a message as a predetermined template with an icon, then send from that template.
   - **Expect**: the resulting broadcast carries the template's icon and persists the same way a
     custom one does — spec 007 Acceptance Scenario 2 / spec 008 Acceptance Scenario 4.
6. Deactivate one of the active broadcasts.
   - **Expect**: it disappears from the active list / from what a resident would query as active,
     while the other broadcast(s) remain unaffected — spec 008 Acceptance Scenario 2/5.
7. Confirm the deactivated broadcast's record still exists (not deleted) with `deactivated_at`/
   `deactivated_by` set.

## Manual validation — Staff permission toggle

1. As the Building Administrator, confirm the Staff broadcast toggle is off by default.
2. Sign in as Staff, attempt to send a broadcast.
   - **Expect**: denied (button hidden/disabled in the UI; the underlying action also rejects it).
3. As the Building Administrator, enable the toggle for the building.
4. Sign in as Staff again, send a broadcast.
   - **Expect**: succeeds, persists, and notifies residents the same way an admin-sent one does.
5. As Staff (toggle on), deactivate a broadcast — including one originally sent by the admin.
   - **Expect**: succeeds (the toggle gates the *action*, not authorship of the specific row).
6. Turn the toggle back off and confirm Staff can no longer send or deactivate, while still being
   able to view the active-broadcasts list (contracts/rls-policies.md's SELECT row).

## Cross-cutting checks

- Sign in as a Resident/Renter and attempt to send or deactivate a broadcast directly via the
  Supabase client, bypassing the UI — **expect**: denied by RLS.
- Sign in as staff/admin from a **different** building and attempt to read, send, or deactivate the
  first building's broadcasts — **expect**: denied by RLS (Principle I).
- Attempt to change a broadcast's `message`/`icon` directly via the Supabase client after it's been
  sent — **expect**: rejected by the content-immutability trigger, even though that same user's
  `status` update on the same row succeeds.
- Confirm a Building Administrator can still manage templates when the Staff toggle is off *and*
  when it's on (template management is never gated by the toggle — contracts/rls-policies.md).
