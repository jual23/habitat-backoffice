# Quickstart: Validating Facility Status, Incidencias & Package Receipt

## Prerequisites

- `.env.local` populated per `.env.example`, pointing at the Habitat Supabase project
  (Constitution's Data Storage requirement) — `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (the last is test-only, used by
  `tests/fixtures.ts`).
- `npm install` run once.
- The schema additions in [data-model.md](data-model.md) applied to the live Habitat project
  (`tickets`, `ticket_comments`, `packages` tables; `ticket_status`/`package_status` enums; the RLS
  policies in [contracts/rls-policies.md](contracts/rls-policies.md)), the same way prior features'
  additive migrations were applied directly to the live project rather than via a local migrations
  folder (see `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`) — this repo has no
  `supabase/migrations/` directory, so apply via the Supabase SQL editor/MCP as done previously, then
  regenerate `lib/supabase/database.types.ts`.
- At least one test building with: a Building Administrator account, a Staff account, one resident
  account tied to an apartment, and one facility with `opens_at`/`closes_at`/`open_days` set.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run test        # vitest run — includes the new rls-tickets/rls-ticket-comments/rls-packages,
                     # tickets-workflow, and packages-notify integration tests once implemented
```

Per Constitution Principle III, the new RLS/workflow tests should exist and fail before the
corresponding policy/action code is written, then pass after.

## Manual validation — User Story 1: Incidencias (P1)

1. Seed at least one `pending` ticket for the test building (out-of-band insert via the service-role
   client, per spec.md's Assumption that ticket creation is out of this feature's scope — see
   `tests/fixtures.ts` conventions for the pattern to follow, e.g. a new `createTestTicket()`).
2. Sign in as the Staff or Building Admin test user, open `/incidencias`.
   - **Expect**: a table listing title, creation date, and status for every ticket in this building
     only (spec.md Acceptance Scenario 1).
3. Click the "Title", "Date", and "Status" column headers.
   - **Expect**: the table re-sorts each time; clicking the same header again reverses order
     (Scenario 2).
4. Apply the status filter to "Pending".
   - **Expect**: only Pending tickets show (Scenario 3).
5. Move a Pending ticket to "In Progress", add a comment.
   - **Expect**: status updates; comment is stored (verify via a direct query as the reporting
     resident, or a service-role read, that the comment is visible per the `ticket_comments` SELECT
     policy) (Scenarios 4–5).
6. On a second ticket, choose "Rejected" without typing a reason.
   - **Expect**: blocked with a validation message; providing a reason then succeeds (Scenario 6,
     Edge Case).
7. On a third ticket, choose "Duplicate" and select the first ticket.
   - **Expect**: status becomes Duplicate, a link to the first ticket is shown and resolves to it
     (Scenario 7). Attempt to select the ticket itself as its own duplicate — **expect**: blocked
     (Edge Case).
8. Move the in-progress ticket to "Resolved".
   - **Expect**: status updates (Scenario 8).

## Manual validation — User Story 2: Package receipt (P2)

1. Sign in as Staff, open `/packages`, click the register-package button.
   - **Expect**: a form with an Apartment dropdown (populated from the building's `apartments.unit_number`),
     a description field, and an optional photo upload (Scenario 1).
2. Submit without a photo.
   - **Expect**: the package saves and appears with a "pending pickup" indicator (Scenario 3).
3. As the resident of that apartment (or via a direct `notifications` query), confirm a notification
   row now exists addressed to them (Scenario 2). If the apartment has more than one resident,
   confirm every resident received one (Edge Case).
4. Submit again with a photo attached.
   - **Expect**: package saves; photo is retrievable via a signed URL the same way facility images
     are (data-model.md).
5. Mark a pending package "Recogido".
   - **Expect**: it now shows as collected, distinguishable from packages still pending (Scenario 4).

## Manual validation — User Story 3: Facility status bubble & capacity removal (P3)

1. Open `/facilities` at a time within a facility's configured open days/hours (check against the
   building's `timezone`, not your own local time if different).
   - **Expect**: a green bubble in the card's upper-right corner (Scenario 1).
2. Open the same view outside those hours (or temporarily edit the facility's hours to force this).
   - **Expect**: a red bubble (Scenario 2).
3. Open the facility create/edit form.
   - **Expect**: no capacity field present (Scenario 3).
4. View any facility card.
   - **Expect**: no "Cupo"/capacity value shown (Scenario 4).

## Cross-cutting checks

- Sign in as a `staff`-only user and attempt to navigate to any backoffice route other than
  `/visitors`, `/incidencias`, or `/packages` (e.g. `/facilities`, `/apartments`).
  - **Expect**: redirected away, per the extended Staff route guard (research.md item 6) — this is
    the Principle II gate this feature's constitution amendment (v1.5.0) depends on holding.
- Sign in as staff/admin from a **different** building and attempt to read or act on the first
  building's tickets/packages (directly via the Supabase client, bypassing the UI).
  - **Expect**: denied by RLS (Principle I) — this is the deny-case half of every
    contracts/rls-policies.md row.
- Signed in as Staff/Admin, attempt to change a ticket's `title`/`description` (or a package's
  `description`/`photo_url`) directly via the Supabase client, bypassing the UI — e.g.
  `supabase.from('tickets').update({ title: 'x' }).eq('id', ticketId)` from the browser console.
  - **Expect**: rejected by the content-immutability trigger (data-model.md's Triggers section),
    even though that same user's `status` update on the same row succeeds. This confirms the
    immutability contract holds at the database layer, not just because the UI never offers the
    field — see the discussion in this feature's development notes on why UI-only restriction
    isn't sufficient in this architecture.
