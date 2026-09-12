# Quickstart: Validating Module Navigation Performance

## Prerequisites

- `npm install` (if not already), then `.env.local` configured per the repo README (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc.) — a working connection to the Habitat Supabase project, as required by the constitution's Data Storage section.
- A seeded test account for at least: an **App Administrator**, a **Building Administrator**, and a **Staff** user (to cover User Story 2's "every role" requirement). `tests/fixtures.ts` already creates these for integration tests and can be a reference for manual seeding.
- Browser DevTools open to the **Network** and **Performance** tabs (Chrome/Edge DevTools recommended for the clearest waterfall view).

## Run

```bash
npm run dev
```

Sign in, and keep DevTools open throughout.

## Automated checks first

Before any manual timing, confirm the behavior-preserving refactor didn't change anything it shouldn't:

```bash
npm run typecheck
npm run test
```

`npm run test` MUST include the new/updated `getUserContext()` coverage required by the Constitution Principle III gate (plan.md → Constitution Check) — all five `UserContext` shapes (app_admin, building_admin, staff, resident, renter, no-role, signed-out) must still resolve identically to before the memoization change. If this suite doesn't yet cover that, add it before proceeding (see tasks.md).

## Manual validation checklist

Map each check back to the spec section it verifies. Perform this once per role that has meaningfully different module access (Building Administrator, Staff, App Administrator) per User Story 2.

### Baseline (before/after comparison)

- [ ] Before making any code change, time 5–6 representative module-to-module transitions using DevTools (click → destination content visible) and note the results, to have a real "before" number rather than relying on the reported "2+ seconds."

Suggested representative transitions (cover both list-heavy and simple modules):

| From | To | Why this pair |
|---|---|---|
| Panel | Facilities | Facilities has the known serial-query + signed-URL pattern (research.md §1.3) |
| Facilities | Incidencias | Two data-heavy modules back-to-back |
| Incidencias | Finance | Finance already parallelizes queries — isolates the `getUserContext()` fix's impact alone |
| Finance | Users | Different data shape entirely |
| Users | Facilities (repeat visit) | Tests User Story 1 Scenario 2 — a repeat visit should be no slower than the first |
| Panel | Announcements | Another image-bearing module (signed URLs) |

### Loading feedback (User Story 3 / FR-003 / SC-004)

- [ ] For every module, confirm a `loading.tsx` skeleton/spinner appears well under 300ms after clicking its nav link — even if the real content then arrives almost immediately after.
- [ ] Confirm the sidebar/header (from `layout.tsx`) stays visible and interactive while a module's `loading.tsx` is showing — only the main content area should show the loading state.

### Speed target (User Story 1 / FR-001 / SC-001–SC-003)

- [ ] Re-time the same representative transitions from the baseline table. Each should now land at ~1 second, with none exceeding 2 seconds.
- [ ] Time at least 15–20 total transitions across the session (mixing modules/order) and confirm at least 95% land under 1.2 seconds (SC-002).
- [ ] Repeat-visit a module already opened earlier in the session (e.g., go back to Facilities a second time) and confirm it is no slower than the first visit (User Story 1 Scenario 2, FR-004).

### Consistency across roles and modules (User Story 2 / FR-005 / SC-005)

- [ ] Sign in as Staff (limited module set) and time transitions between its accessible modules (Visitors, Incidencias, Packages, Maintenance, Emergency, Broadcast) — same target applies.
- [ ] Sign in as App Administrator and confirm modules behave the same way (note: App Administrator has `buildingId: null` for some modules — confirm those still hit the target, not just building-scoped roles).
- [ ] Spot-check at least 3 modules not covered in the baseline table above to confirm the fix isn't limited to the "showcase" set.

### No functional or authorization regression (FR-007 / SC-006 / Constitution Principle I–III)

- [ ] Confirm each module still shows the same data it did before the change (spot-check a couple of records per module).
- [ ] Confirm a Staff account still cannot navigate to (or see nav links for) admin-only modules (Finance, Polls, Apartments, Users, Customization) — unchanged from before.
- [ ] Confirm a Building Administrator for Building A still cannot see Building B's data in any module (cross-building isolation, Principle I) — unchanged from before.
- [ ] Re-run `npm run test` (including any RLS/integration tests) at the end and confirm the full suite still passes.

### Abandoned navigation (Edge Case)

- [ ] Click into one module, then immediately click into a different one before the first finishes loading. Confirm the screen ends up showing only the second module's correct content — no flash of the first module's stale data, no duplicate/stacked network requests left hanging (check the Network tab for canceled vs. completed requests).

## Done when

Every checkbox above is checked, the automated suite passes, and the "after" timings from the speed-target section show a clear, consistent improvement over the recorded baseline — landing at or near the ~1 second target across roles and modules.
