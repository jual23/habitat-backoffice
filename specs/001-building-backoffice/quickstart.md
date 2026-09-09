# Quickstart: Validating the Building Administrator Backoffice

This guide proves each user story from [spec.md](./spec.md) works end-to-end. It assumes the
feature has been implemented per [plan.md](./plan.md), [data-model.md](./data-model.md), and
[contracts/](./contracts/) — it is a validation script, not an implementation guide.

## Prerequisites

- Supabase CLI installed; local stack running (`supabase start`), migrations applied
  (`supabase db reset` to apply `supabase/migrations/` + `supabase/seed.sql`).
- Seed data (`supabase/seed.sql`) includes: one `app_admin`, two buildings ("Building A",
  "Building B") each with one `building_admin`, one `staff`, two `apartments`, and one `resident`
  per apartment — the two-building split is what makes cross-tenant isolation checks (SC-008)
  possible.
- Next.js dev server running against the local Supabase instance (`npm run dev`), env vars
  pointing at the local Supabase URL/anon key per the constitution's Data Storage section.
- Test suite runnable via `npm run test` (Vitest against the same local Supabase stack).
- `tests/fixtures.ts` (built in T017, extended by later stories) provides service-role helper
  functions — `createTestReservation()`, `createTestVisitor()`, `createTestSuggestionComplaint()`,
  etc. — for creating rows that no UI role can insert directly in this feature (see spec.md
  Assumptions). Steps below that say "using a seeded/fixture X" mean: call the matching
  `tests/fixtures.ts` helper (a one-off Node/tsx script wrapping it is fine for manual runs).

## Automated checks (run first)

```bash
npm run test
```

Expect: every RLS allow/deny pair in [contracts/rls-policies.md](./contracts/rls-policies.md) and
every acceptance scenario below has a passing integration test, per Principle III. If this fails,
stop — do not proceed to manual validation until it's green.

## Manual validation per user story

### 1. Apartments & Residents (P1)
1. Log in as Building A's `building_admin`.
2. Create apartment "9C" → appears in the apartment list.
3. Create a resident user in "9C" with an email → appears under "9C"'s residents.
4. Add a second resident to "9C" → both are listed (multi-resident apartments, FR-003).
5. Edit the first resident's email → change is reflected immediately.
6. Move the first resident to a different apartment → they disappear from "9C", appear on the
   new one.
7. Delete the second resident → no longer listed anywhere.
8. Try to delete an apartment that still has a resident → rejected (Edge Cases).

### 2. Facilities & Reservations (P2)
1. As Building A's `building_admin`, create facility "Pool" with an image, opening hours, marked
   reservable. Time it — target under 2 minutes (SC-001).
2. Using `createTestReservation()` to seed two "Requested" reservations for "Pool", approve one
   → status becomes "Approved"; decline the other → "Declined". Time each approve/decline action
   — target under 30 seconds per request (SC-002).
3. Edit "Pool"'s opening hours → reflected on the facility page.
4. Delete "Pool" → it disappears; any of its still-"Requested" reservations are now "Declined"
   (FR-009).

### 3. Announcements (P3)
1. Create an announcement with a title/body, one attachment, and a banner image.
2. Pin it → it sorts above existing unpinned announcements.
3. Unpin it → returns to chronological order.

### 4. Activities (P4)
1. Create an activity with a date, a banner, and `max_participants = 20` → saved and displayed.
2. Create a second activity with no `max_participants` → displayed as unlimited.
3. Attempt to create one with `max_participants = 0` → rejected (FR-020).

### 5. Visitors (P5, Staff) & Staff Provisioning
1. As Building A's `building_admin`, create a Staff account (FR-039) → it appears, and can log in.
2. Log in as that new Staff account.
3. Confirm the visitor list is visible but no other backoffice module (facilities, announcements,
   etc.) is reachable (FR-037, SC-006).
4. Using `createTestVisitor()` to seed an "Expected" visitor, mark them "Arrived" as Staff →
   status updates, arrival time recorded.
5. Using `createTestVisitor()` with `created_at` set more than 8 hours in the past, run/await
   the `visitor-expiry` sweep → status becomes "Expired" (FR-024).
6. Confirm a fixture "Arrived" visitor with an old `created_at` is unaffected by the sweep
   (FR-025).
7. Back as `building_admin`, remove the Staff account (FR-040) → it can no longer log in.

### 6. Documentation (P6)
1. As `building_admin`, create a folder "Bylaws", then a subfolder "2026" inside it.
2. Upload a document into "2026" → listed, downloadable. From the documentation home, count the
   steps to open it — target 3 or fewer (SC-005).
3. Delete "Bylaws" → "2026" and its document are gone too (FR-029).

### 7. Suggestions & Complaints (P7)
1. Using `createTestSuggestionComplaint()` to seed resident-submitted suggestions and complaints,
   open the view as `building_admin` → confirm two tabs, correctly split by type.
2. Favorite one entry → flagged; unfavorite → flag cleared.
3. Discard another entry → disappears from the active list.
4. Using a fixture row with `discarded_at` set > 24h ago, run the `discard-cleanup` sweep → the
   row is permanently gone (FR-033).

### 8. Customization (P8)
1. As `building_admin`, set an accent color and upload a square logo. Time the whole flow —
   target under 2 minutes (SC-007).
2. Confirm both are saved and displayed.
3. Attempt to upload a non-square image as the logo → rejected with a clear message (FR-035).

## Cross-tenant isolation check (SC-008)

1. Log in as Building A's `building_admin`.
2. Attempt to query/view any of Building B's apartments, facilities, announcements, activities,
   visitors, documents, suggestions/complaints, or customization (e.g., by guessing an id from
   Building B's seed data) → every attempt MUST be denied by RLS, not merely hidden in the UI.
3. Repeat as Building A's `staff` account for the visitor list specifically.
4. Log in as the seeded `app_admin` → confirm they CAN see both buildings' data, per Principle I's
   explicit exception.
