# Feature Specification: Single Facility Status Indicator

**Feature Branch**: `005-facility-status-badge`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "The facilities cards currently show a badge if it's available for
reservations, on top of it there is a dot indicating if the facility is open or closed. There
should only be 1 indicator to know if it's open or closed, it should take place of the existing
reservable, including the sme format, green with "open" text when open and red with "closed" when
closed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One glance tells you if a facility is open (Priority: P1)

As a Building Administrator viewing Instalaciones (Facilities), I see exactly one status
indicator per facility card — a colored pill telling me whether the facility is currently open or
closed — instead of today's two separate indicators (a "Reservable"/"No reservable" badge and a
small open/closed dot) that can be looked at together and are redundant with each other.

**Why this priority**: This is the entire scope of the feature. Two indicators on the same card
answering related-but-different questions is visual clutter and has caused confusion about which
one reflects "can I use this facility right now." Consolidating to a single, clearly-labeled
indicator is a small, self-contained change that is fully delivered or not at all.

**Independent Test**: Open the Instalaciones page and inspect any facility card. Confirm it shows
exactly one status pill (not a pill plus a separate dot), that the pill is green and reads
"Abierto" during the facility's configured open hours, and red and reads "Cerrado" outside them.

**Acceptance Scenarios**:

1. **Given** a facility currently within its configured open days/hours, **When** a Building
   Administrator views the Instalaciones page, **Then** that facility's card shows a single green
   pill reading "Abierto" in the position the "Reservable"/"No reservable" badge previously
   occupied, and no separate dot appears anywhere on the card.
2. **Given** a facility currently outside its configured open days/hours, **When** a Building
   Administrator views the Instalaciones page, **Then** that facility's card shows a single red
   pill reading "Cerrado" in that same position, and no separate dot appears anywhere on the card.
3. **Given** a facility card that displays a photo (where the old badge appeared as an overlay on
   the image), **When** viewing the card, **Then** the open/closed pill appears as that same
   overlay, in the same visual format (size, shape, placement) the reservable badge used.
4. **Given** a facility card that has no photo (where the old badge appeared in a header row),
   **When** viewing the card, **Then** the open/closed pill appears in that same header-row
   position, in the same visual format.
5. **Given** a facility marked reservable or not reservable, **When** viewing its card, **Then**
   that reservable/not-reservable state is still visible and adjustable elsewhere on the card (the
   existing "Reservable" toggle control) — only the redundant badge/dot pairing is removed, not the
   underlying capability.

---

### Edge Cases

- A facility whose open/closed status changes while the page is open (e.g., the viewer leaves the
  page open across the closing time) is not required to update live — the existing page reflects
  status as of when it was loaded, matching how the rest of this page already behaves (no
  requirement here changes that).
- A facility with a schedule that makes it open every day, all day, or never (a zero-width or
  full-day window) still shows exactly one indicator (Abierto or Cerrado), computed the same way
  as any other schedule — this feature does not change how "open" is computed, only how it is
  displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display exactly one status indicator per facility card that
  communicates whether the facility is currently open or closed.
- **FR-002**: The open/closed indicator MUST use the same visual format (a pill-shaped badge, same
  size and placement) as the "Reservable"/"No reservable" badge it replaces — appearing as an
  overlay on the facility's photo when one exists, or in the card's header row when it doesn't.
- **FR-003**: The system MUST remove the small colored dot previously used to show open/closed
  status, since that information now lives in the single pill indicator.
- **FR-004**: The system MUST remove the "Reservable"/"No reservable" badge in its previous form,
  since the open/closed pill takes its place.
- **FR-005**: When a facility is currently open, the indicator MUST render with a green tone and
  the text "Abierto".
- **FR-006**: When a facility is currently closed, the indicator MUST render with a red tone and
  the text "Cerrado".
- **FR-007**: The system MUST continue to show whether a facility is reservable or not, and MUST
  continue to let a Building Administrator toggle that setting, using the existing control
  elsewhere on the card — this feature only consolidates the redundant status display, it does not
  remove the reservable capability.
- **FR-008**: The determination of whether a facility is "currently open" (based on its configured
  schedule and the building's timezone) MUST be unchanged by this feature — only how that result is
  displayed changes.

### Key Entities

- **Facility** *(existing entity, unchanged)*: Its open/closed status (derived from existing
  schedule fields and the building's timezone) and its reservable flag are both still shown on its
  card, but the open/closed status now occupies the single indicator position this feature
  introduces, and the reservable flag is only shown via the existing toggle control (no longer via
  its own badge).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of facility cards on the Instalaciones page show exactly one status indicator
  (down from two today).
- **SC-002**: A Building Administrator can determine whether a facility is open or closed by
  reading a single visual element per card, with no need to interpret a separate dot alongside a
  badge.
- **SC-003**: 100% of facilities' reservable/not-reservable state remains visible and adjustable on
  their card after this change — no information or capability is lost, only the redundant display.

## Assumptions

- The indicator's label text is Spanish ("Abierto" / "Cerrado"), matching every other status label
  already on this page and across the backoffice (e.g., "Reservable", "Pendiente", "Resuelto"). The
  user's request used the English words "open"/"closed" to describe the two states, not to request
  English-language UI text.
- "Same format" means the existing `Badge` pill component and its green/red tone options — the same
  visual language already used for every other status pill in the backoffice (tickets, packages,
  visitors) — not a new visual style.
- This feature only touches the Instalaciones (Facilities) list view for Building
  Administrator/App Administrator. No other page or role is affected, since only those two roles
  can view this page today.
- No new data or schema is needed: the open/closed computation already exists (introduced by the
  facility open/closed bubble in feature 004) and is reused as-is; this feature is UI-only.
