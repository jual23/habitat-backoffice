# Feature Specification: Announcement Card UI Fixes

**Feature Branch**: `015-announcement-card-ui-fixes`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "En el módulo de noticias y avisos, al final de la tarjeta aparece un
boton para buscar un archivo y otro para adjuntar un archivo. estos no deben estar visibles en la
vista previa, unicamente en el momento de creación (ya aparece) y cuando el usuario presiona en
editar (ya aparece). El ícono de fijar las noticias y avisos actualmente usa un pin comunmente
utilizado para ubicación, deemos usar un ícono similar a una tachuela, y al momento de estar fijada
mostrarlo en otro estilo que resalte y permita diferenciar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean announcement cards in the list view (Priority: P1)

As a Building Administrator browsing the list of published announcements, each card shows the
banner, title, body, and any attachments already uploaded — without a file picker and "Adjuntar"
button sitting at the bottom of every card. Those controls only belong to the moment an
announcement is being created or edited, not to the read-only list a coworker later scrolls
through.

**Why this priority**: This is the main complaint — the file controls currently persist
permanently on every card, cluttering the list view that is otherwise a preview/read surface.

**Independent Test**: Open the Noticias y avisos list with at least one existing announcement and
confirm no file-picker input or "Adjuntar" button appears on its card while the create/edit modal
is closed. Then open that announcement for editing and confirm the same controls are available
there instead.

**Acceptance Scenarios**:

1. **Given** the Noticias y avisos list with one or more published announcements, **When** the
   administrator views a card without opening create or edit, **Then** no file-search ("Choose
   file") input or "Adjuntar" button is visible on that card.
2. **Given** an announcement's existing attachments, **When** the administrator views its card in
   the list, **Then** the already-uploaded attachments remain visible and openable exactly as
   before — only the controls for adding a new attachment move out of the list view.
3. **Given** the administrator is creating a new announcement, **When** they save it, **Then** the
   announcement is created and the create form closes immediately (no file-search/attach controls
   are shown during creation); if an attachment is needed, the administrator adds it afterward by
   opening the newly created announcement for editing.
4. **Given** the administrator clicks "Editar" on an existing announcement, **When** the edit form
   opens, **Then** the file-search and attach controls are available so an attachment can be added
   while editing.
5. **Given** the administrator closes the create/edit form (cancel or save), **When** the form
   closes, **Then** the file-search and attach controls disappear again from the list view.

---

### User Story 2 - Distinguishable pin icon and state (Priority: P2)

As a Building Administrator scanning the announcements list, the "pin to top" control uses an icon
that reads as a thumbtack (matching the "pin this to the top" action) rather than a map/location
marker, and a pinned announcement's icon is visually distinct from an unpinned one at a glance —
not just distinguishable by a subtle color change on an otherwise identical shape.

**Why this priority**: A secondary but explicit request — the current icon is misleading (it reads
as "location", not "pin/keep at top"), and pinned vs. unpinned state is hard to tell apart quickly.

**Independent Test**: Open the Noticias y avisos list with both a pinned and an unpinned
announcement and confirm the pin control renders as a thumbtack shape in both the row action button
and the title badge, and that the pinned state is visually distinct (e.g., filled/highlighted style)
from the unpinned state at a glance.

**Acceptance Scenarios**:

1. **Given** the Noticias y avisos list, **When** the administrator views the pin toggle button on
   any card, **Then** it renders as a thumbtack-style icon instead of the current
   location-marker/teardrop-shaped pin icon.
2. **Given** an announcement that is currently pinned, **When** the administrator views its card,
   **Then** the pin icon (both the title badge and the toggle button) is shown in a visually
   distinct, highlighted style that clearly reads as "active/pinned".
3. **Given** an announcement that is not pinned, **When** the administrator views its card, **Then**
   the pin icon is shown in its normal, non-highlighted style.
4. **Given** the administrator toggles pin on or off, **When** the action completes, **Then** the
   icon's shape and highlighted/non-highlighted style update immediately to reflect the new state,
   consistent with the existing toggle behavior.

---

### Edge Cases

- An announcement with zero attachments and the create/edit form closed shows no file controls and
  no "no attachments" placeholder beyond what already exists today — only previously uploaded
  attachments and the title/body/banner render.
- Selecting a file in the create/edit form's attach control but closing the form without pressing
  "Adjuntar" must not upload it and must not leave a stale file selection behind the next time that
  same announcement is opened for editing.
- The pin icon's highlighted style must remain distinguishable regardless of whether the
  announcement is also showing a banner image behind/near it, and must work for a user who cannot
  rely on color alone (e.g., an additional shape/fill difference, not a hue change only).
- The thumbtack icon change and its pinned-state styling apply consistently everywhere the pin icon
  appears (the row's toggle button and the title badge shown on pinned items).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The announcement list (preview) view MUST NOT display a file-search/browse input or
  an "Adjuntar" (attach) button on any card while that announcement is not being created or edited.
- **FR-002**: Saving a new announcement (create flow) MUST close the create form immediately once
  the save completes — the create flow itself does not offer a file-search/browse input or
  "Adjuntar" control; attaching a file to a brand-new announcement is done afterward via the edit
  flow (FR-003).
- **FR-003**: The system MUST provide the file-search/browse input and "Adjuntar" control as part of
  the edit-announcement flow, so an attachment can be added while editing an existing announcement.
- **FR-004**: Attachments already uploaded to an announcement MUST remain visible and openable from
  the list view regardless of this change — only the controls for adding a *new* attachment are
  removed from the plain list view.
- **FR-005**: Closing the create/edit flow (cancel, save, or navigating away) MUST hide the
  file-search/browse input and "Adjuntar" button from view again.
- **FR-006**: The "pin to top" control MUST use a thumbtack-style icon in place of the current
  location/map-pin-style icon, in every place that icon appears (row toggle button and pinned-item
  title badge).
- **FR-007**: When an announcement is pinned, its pin icon MUST render in a visually distinct,
  highlighted style (e.g., filled and/or accent-colored) that differs from the style used when it
  is not pinned, so pinned/unpinned state is recognizable at a glance.
- **FR-008**: Toggling an announcement's pinned state MUST update the icon's style immediately to
  reflect the new state, using the same underlying pin/unpin action already in place today.

### Key Entities

- **Announcement**: An existing entity (title, body, banner, pinned flag, attachments). This
  feature changes only how its card is rendered (which controls show, and how the pinned state is
  iconified) — it introduces no new fields or attributes.
- **Attachment**: An existing file linked to an announcement. This feature changes only where the
  control to add one is surfaced, not how attachments are stored, listed, or opened.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of announcement cards in the list view show zero file-picker/attach controls
  when the create/edit form is closed.
- **SC-002**: 100% of announcements being edited offer a working file-picker/attach control in that
  flow, with no loss of the ability to attach a file (attaching at creation time is done by saving
  first, then editing).
- **SC-003**: A person viewing the announcements list can correctly identify which announcements
  are pinned, at a glance, without reading tooltips or labels, in a quick informal review.
- **SC-004**: 100% of existing pin/unpin and attachment-viewing functionality continues to work
  exactly as before this change (no regression), verified by exercising both actions after the
  update.

## Assumptions

- "Vista previa" refers to the read-only announcements list card (outside of the create/edit
  form), as that is the only place in the module where the file-search and "Adjuntar" controls
  currently render unconditionally.
- The existing create/edit form (modal) is the correct home for the file-search/attach controls;
  this feature moves those controls into that flow rather than inventing a new interaction surface.
- Saving a new announcement always closes its create form immediately, matching the existing save
  behavior for every other create flow in the backoffice — an admin who wants to attach a file to a
  brand-new announcement does so in a second step, by opening it for editing right after creating
  it, rather than the create form staying open post-save to offer it in one continuous session.
- "Un ícono similar a una tachuela" is satisfied by any thumbtack-style glyph (e.g., a pin viewed
  from above or at an angle with a round head and a point) as opposed to the current teardrop
  map-marker shape — the exact glyph artwork is an implementation detail.
- The highlighted "pinned" style should reuse the app's existing conventions for indicating an
  active/selected state (e.g., an accent fill or background) rather than introducing a new visual
  language, consistent with how other toggle/active states already look in the backoffice.
- This is a UI-only change: no changes to the pin/unpin data model, attachment storage, upload
  validation, or authorization rules are in scope.
