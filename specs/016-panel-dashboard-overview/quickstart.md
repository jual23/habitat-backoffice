# Quickstart: Validating the Panel Dashboard Overview

## Prerequisites

- Local Supabase project running against the **Habitat** project (per
  Constitution "Data Storage"), migrations applied through
  `0049_feedback_viewed_at.sql`.
- `npm install` done once; dev server startable via `npm run dev`.
- Test users available (or creatable via `tests/fixtures.ts` helpers) for at
  least one building: one `building_admin` and one `staff`.
- A handful of seed rows so counts aren't all zero: an apartment with a
  resident and one with a renter, one ticket, one package, one visitor pass,
  one emergency, one suggestion, one complaint, one reservation request —
  all `created_at` today.

## Automated checks

```sh
npm run typecheck
npm run lint
npm run test        # vitest run — includes the new/updated RLS and
                     # cross-tenant-isolation cases from data-model.md /
                     # contracts/panel-view-contract.md
```

Specifically confirm before implementation is considered done:
- `tests/integration/rls-suggestions-complaints.test.ts` — building_admin can
  set `viewed_at`; staff and resident/renter cannot; a different building's
  building_admin cannot set it on this building's row.
- `tests/integration/cross-tenant-isolation.test.ts` — a building_admin/staff
  of Building A never sees Building B's counts or feed entries when loading
  `/panel`.

## Manual / end-to-end validation

1. **Building Administrator — top cards (User Story 1)**
   - Sign in as the building_admin.
   - Open `/panel`.
   - Confirm "Residentes" equals owner-occupied + rented apartments' resident
     count for that building (cross-check against `/apartments` or `/users`).
   - Confirm "Incidencias", "Paquetería", "Visitas" show only *today's*
     counts (create one of each *yesterday* via direct insert/fixture and
     confirm it is not counted).

2. **Recent activity feed (User Story 2)**
   - With the seed data above (6+ qualifying events across types), reload
     `/panel` and confirm exactly 5 appear, newest first, each labeled with
     its type.
   - Delete all seed events for the building and reload; confirm an
     empty-state message appears (no error).

3. **Pending-items summary (User Story 3)**
   - Confirm "Incidencias" (open) matches `/incidencias` filtered to
     pending+in_progress.
   - Confirm "Paquetería por entregar" matches `/packages` filtered to
     pending.
   - Confirm "Quejas y sugerencias" matches the count of `feedback` rows with
     `viewed_at is null and discarded_at is null`.
   - Open `/suggestions-complaints` as the building_admin, reload `/panel`,
     and confirm the unread count dropped by the number of rows that were
     visible on that page.
   - Confirm "Reservas de instalaciones" matches `/reservations` filtered to
     `requested`.
   - Click each row; confirm navigation lands on the right module without a
     full page reload (check the browser doesn't show a full navigation/flash
     — Client Platform Requirements).

4. **Staff role scoping (User Story 4)**
   - Sign in as staff for the same building.
   - Confirm `/panel` is reachable (previously redirected to `/login`).
   - Confirm the Residentes card, the suggestion/complaint feed entries, and
     the "Quejas y sugerencias" / "Reservas de instalaciones" summary rows
     are all absent.
   - Confirm Incidencias/Paquetería/Visitas cards, the remaining feed entry
     types, and the two remaining summary rows are present and correct.

5. **Edge cases**
   - A brand-new building with zero data: all cards show 0, feed shows
     empty-state, all visible summary rows show 0 — no errors.
   - Two events with identical `created_at` (or within the same second):
     feed order is stable across repeated loads.
