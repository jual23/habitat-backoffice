# Feature Specification: Polls Checkbox Styling

**Feature Branch**: `009-polls-checkbox-styling`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "In the polls module, the checkboxes should better match the overall
aesthetic of the application."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent on/off controls when creating a poll (Priority: P1)

As a Building Administrator creating a poll, the "allow multiple answers" and "anonymous" options
look and behave like every other on/off control in the backoffice — not like a plain, unstyled
browser checkbox that stands out from the rest of the page.

**Why this priority**: This is the entire scope of this request — a single, self-contained visual
consistency fix to one form.

**Independent Test**: Open the poll creation form on the Polls page and confirm both boolean
options render as the same toggle-switch control used elsewhere in the backoffice (e.g., building
settings), rather than a native checkbox square.

**Acceptance Scenarios**:

1. **Given** the poll creation form, **When** a Building Administrator views the "Permitir
   múltiples respuestas" and "Anónima" options, **Then** each renders as the app's standard
   toggle-switch control (the same visual pattern used by every other on/off setting in the
   backoffice), not a browser-default checkbox.
2. **Given** the poll creation form with both toggles off, **When** the administrator turns one
   on, **Then** the control visually reflects the "on" state the same way every other toggle in
   the app does, and the poll is created with that option enabled.
3. **Given** the poll creation form, **When** the administrator uses the keyboard (Tab and
   Space/Enter) to focus and activate a toggle, **Then** it responds the same way the app's other
   toggle controls do.

---

### Edge Cases

- Enabling or disabling a toggle must continue to update exactly the same underlying value it does
  today — this is a visual change only, with no change to what gets submitted when the poll is
  created.
- The toggle label text ("Permitir múltiples respuestas", "Anónima") must remain fully readable if
  the form is viewed at a narrow width, matching how other labeled toggles in the app already wrap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The poll creation form MUST present "Permitir múltiples respuestas" and "Anónima" as
  toggle-switch controls, visually matching the on/off control style already used elsewhere in the
  backoffice, instead of native browser checkboxes.
- **FR-002**: Switching either control MUST continue to update the same underlying setting
  (`allow_multiple`, `anonymous`) that creating a poll already uses today — no behavior change.
- **FR-003**: The toggle controls MUST remain operable by keyboard and MUST present a clearly
  distinguishable checked/unchecked visual state, consistent with the app's existing toggle
  affordance (not merely a color change with no other visual cue).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the on/off controls in the Polls creation form share the same visual style as
  every other on/off setting already present in the backoffice.
- **SC-002**: A Building Administrator can identify a toggle's checked vs. unchecked state at a
  glance, without relying on reading the label text alone.
- **SC-003**: Creating a poll with any combination of the two settings (both off, one on, both on)
  continues to produce the same result as before this change, with no regression in existing
  functionality or its test coverage.

## Assumptions

- The app's existing reusable toggle-switch control (already used for other on/off settings in the
  backoffice) is the correct reference for "the overall aesthetic" this request asks to match —
  it's the only established on/off UI pattern already in use elsewhere in the app.
- This request is scoped to the Polls module only, as explicitly stated — no other native
  checkboxes exist elsewhere in the backoffice today, so there is no broader consistency sweep
  implied here.
- This is a visual/consistency change only: no change to poll creation validation, the data model,
  or authorization rules.
