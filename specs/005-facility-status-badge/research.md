# Phase 0 Research: Single Facility Status Indicator

## 1. How to consolidate the two indicators into one

**Decision**: Replace the `Badge` currently showing `f.reservable ? 'Reservable' : 'No reservable'`
(in both the image-overlay and header-row positions) with a `Badge` showing
`open ? 'Abierto' : 'Cerrado'` with `tone={open ? 'success' : 'danger'}`, reusing the `open` boolean
already computed once per card via the existing `isFacilityOpen(f, buildingTimezone)` call. Delete
the separate absolutely-positioned `<span>` dot entirely. No change to the reservable `Toggle` in
the card footer — it remains the single place reservable/not-reservable is shown and changed.

**Rationale**: `spec.md` FR-002 requires the same visual format/position the reservable badge used;
the `Badge` component already supports the `success`/`danger` tones needed (used elsewhere for
ticket/package/visitor status pills), so no new component or styling is needed. `open` is already
computed for the dot today, so reusing it for the badge's label/tone is a pure substitution with no
new logic.

**Alternatives considered**: Keep the dot and change only the badge to show reservable status in a
different position (rejected — spec.md explicitly requires exactly one indicator, not a
repositioned second one); introduce a new "status pill" component distinct from `Badge` (rejected —
`Badge` already does exactly this job elsewhere in the app; a second component for the same visual
role would violate Principle V).

## 2. What happens to the reservable badge's information

**Decision**: Nothing new is built — the reservable `Toggle` control already present in the card's
footer (`tile-footer`) already shows and lets a Building Administrator change reservable status. No
new UI element is added to compensate for the removed badge.

**Rationale**: spec.md FR-007/SC-003 require the reservable capability to remain visible and
adjustable, not that it keep a second, redundant display. The footer `Toggle` already satisfies
"visible and adjustable" on its own.

**Alternatives considered**: Show reservable status as small text near the title (rejected — adds a
new display element the spec doesn't ask for, when the existing Toggle already shows it via its own
checked/unchecked state and label).

## Summary

No new dependency, schema, RLS policy, or Server Action is introduced. All Technical Context
unknowns are resolved; no `NEEDS CLARIFICATION` markers remain.
