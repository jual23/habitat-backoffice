# Feature Specification: Button-Beside-Input Sizing

**Feature Branch**: `014-button-input-alignment`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "The primary buttons used in views like finance and maintenace are 34px high. This works fine in some modules because the button is in it's own line, but in these two it is right beside an input which is 41px. The button should match the height to look better, or be placed below. Also the button should have a max width of 150px and the text centered. Same applies to the login screen and any other button that is to the side of an input."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Button height matches the input beside it (Priority: P1)

A Building Administrator sets an apartment's monthly fee in Finance, or creates a new task in Maintenance. In both screens, the primary action button ("Guardar" / "Crear") sits in the same row as the form's input and select fields. Today the button is visibly shorter than those fields, making the row look uneven and unpolished. The button should be the same height as the field(s) beside it.

**Why this priority**: This is the concrete, currently-visible defect the request is about — it affects two screens Building Administrators use routinely, and is purely a visual/proportion problem with an unambiguous fix.

**Independent Test**: Open Finance and set an apartment fee; open Maintenance and fill in the new-task row. In both, confirm the "Guardar"/"Crear" button's height visually matches the height of the input/select fields in the same row.

**Acceptance Scenarios**:

1. **Given** the Finance screen's "Cuota por apartamento" row (apartment select, amount input, "Guardar" button), **When** the row is rendered, **Then** the button's height equals the height of the select/input beside it.
2. **Given** the Maintenance screen's "Nueva tarea" row (name, frequency, date fields, "Crear" button), **When** the row is rendered, **Then** the button's height equals the height of the fields beside it.

---

### User Story 2 - Buttons beside an input have a consistent, contained width (Priority: P2)

Beyond the height mismatch, a button placed beside an input should look proportionate rather than stretching arbitrarily or looking oversized next to a compact field. Its width should be capped at a sensible maximum, and its label should be centered within it, regardless of which screen or form the button appears on — including the login screen's button, if it is ever placed beside a field, and any other place this pattern occurs now or in the future.

**Why this priority**: A refinement on top of User Story 1 — improves visual consistency across the whole backoffice rather than just the two screens where the height problem was first noticed, but doesn't block the core fix from shipping on its own.

**Independent Test**: Inspect every button currently placed beside an input (Finance's "Guardar", Maintenance's "Crear") and confirm each is no wider than the capped maximum and its label is horizontally centered.

**Acceptance Scenarios**:

1. **Given** a button placed beside an input anywhere in the backoffice, **When** it is rendered, **Then** its width does not exceed the defined maximum.
2. **Given** a button placed beside an input, **When** it is rendered, **Then** its label text is horizontally centered within the button.

---

### Edge Cases

- What happens when the row containing the input and button wraps to a stacked (one-per-line) layout on a narrow screen? The height-match and width-cap rules apply only while the button remains in the same row as the field; a button that wraps onto its own line is not required to keep the capped width.
- What happens to buttons that are already on their own line, not beside any input (e.g., most other create/save actions across the app)? They are unaffected by this change — their current height and width stay exactly as they are today.
- What happens if a button's label is long enough that it would feel cramped at the capped width? The button still respects the maximum width; wrapping or truncating that specific label is out of scope for this fix (existing labels in the two known cases — "Guardar", "Crear" — are short and unaffected).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a primary action button is positioned in the same row as a text input, select, or date field, the button MUST render at the same height as that field.
- **FR-002**: A button positioned beside an input MUST have a maximum width of 150px.
- **FR-003**: A button positioned beside an input MUST have its label text horizontally centered.
- **FR-004**: This sizing rule MUST be applied to today's two known occurrences — Finance's apartment-fee "Guardar" button and Maintenance's new-task "Crear" button — and to any other button beside an input anywhere in the backoffice, present or future, including the login screen's button should it ever be positioned beside a field.
- **FR-005**: A button that is not positioned beside an input (already on its own line) MUST NOT be affected by this change — its existing height and width remain exactly as they are today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the Finance and Maintenance screens, the primary button in each input row appears visually the same height as the fields beside it, with no perceptible size mismatch.
- **SC-002**: Every button positioned beside an input across the backoffice is no wider than 150px, with its label centered.
- **SC-003**: No button that is not positioned beside an input changes in appearance as a result of this fix.

## Assumptions

- "Match the height" is the chosen resolution to the mismatch (rather than moving the button to its own line below the input) — inferred from the accompanying width-cap and text-centering requirements, which only make sense for a button that stays in the same row as the field.
- The target height is the current height of the app's standard input/select field (`.field input`, today rendering at ~40-41px); this fix does not change that field height, nor the standalone (already-correct) ~34px button height used elsewhere on its own line.
- The login screen's submit button does not currently sit beside an input (it is on its own full-width line below the form's fields) — this requirement defines the general rule for whenever a button is beside a field, without itself requiring any visible change to login's current layout.
- Responsive behavior when a row wraps to a stacked layout on narrow screens is unchanged by this fix, per the Edge Cases above.
