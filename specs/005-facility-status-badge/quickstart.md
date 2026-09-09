# Quickstart: Validating the Single Facility Status Indicator

## Prerequisites

- `.env.local` populated per `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- `npm install` run once.
- A Building Administrator (or App Administrator) account for a building with at least one
  facility whose `opens_at`/`closes_at`/`open_days` are configured — the same fixtures feature
  004's facilities-bubble story used.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run build
```

No new Vitest test is added (see plan.md's Testing section) — this is a display-only change with
no authorization surface, matching the precedent set by feature 004's own facilities-bubble story.

## Manual validation — User Story 1: One indicator per card (P1)

1. Sign in as the Building Administrator (or App Administrator), open `/facilities`.
2. Pick a facility currently within its configured open hours/days (check against the building's
   timezone, not your own local time if different).
   - **Expect**: the card shows exactly one status pill, green, reading "Abierto" — in the spot the
     "Reservable"/"No reservable" badge used to occupy (overlaid on the photo if the facility has
     one, otherwise in the header row next to the icon). No small dot appears anywhere on the card
     (Acceptance Scenario 1).
3. Pick (or temporarily edit the hours of) a facility currently outside its open hours/days.
   - **Expect**: the card shows exactly one status pill, red, reading "Cerrado", same position, no
     dot (Acceptance Scenario 2).
4. Compare a facility card that has a photo against one that doesn't.
   - **Expect**: the pill appears as an image overlay on the first, and in the header row on the
     second — matching exactly where the old reservable badge appeared in each case (Acceptance
     Scenarios 3–4).
5. On any facility card, check the footer.
   - **Expect**: the "Reservable" toggle is still present and still reflects/controls the
     facility's reservable state — unaffected by the badge/dot consolidation (Acceptance
     Scenario 5).
6. Toggle a facility's reservable state via that footer control.
   - **Expect**: the toggle updates as it did before this change; the open/closed pill is
     unaffected (reservable and open/closed are independent).

## Cross-cutting checks

- Confirm no visual regression on facility cards with no image at all (empty state / icon avatar
  path) — the header-row layout should show the icon avatar and the single pill, nothing else new.
- Confirm the create/edit facility form is unchanged (this feature does not touch the form).
