# Phase 0 Research: Announcement Card UI Fixes

No `[NEEDS CLARIFICATION]` markers were left in spec.md, so this phase documents the decisions
needed to turn the spec's assumptions into a concrete, buildable approach — chiefly, how the
"attach control available at creation time" requirement (FR-002) is actually achievable given the
existing data model.

## Decision 1: Where the attach control moves to

**Decision**: Move the file-picker input and "Adjuntar" button out of the announcement list card
and into the shared create/edit `Modal` in `announcements-client.tsx`, as a new section shown
whenever the modal has a target announcement id to attach to.

**Rationale**: The `Modal` already exists and is already reused for both create and edit (`title`
switches based on `editingId`); adding a section to it is the smallest change that satisfies FR-001
through FR-005 without a new dialog, route, or component.

**Alternatives considered**:
- A separate "manage attachments" dialog, opened from the row — rejected: introduces a second modal
  for a single-file-input feature, which Principle V (Simplicity) argues against when the existing
  modal already covers create/edit for this same record.
- Keeping the control on the row but only rendering it while that row is "expanded"/selected —
  rejected: doesn't match the spec's explicit requirement that these controls belong to the
  create/edit *flow*, not an alternate list-view interaction mode.

## Decision 2 (superseded 2026-09-13): Making the attach control available "at creation time"

**Constraint discovered**: `addAttachment(announcementId, buildingId, file)` in `actions.ts`
requires an existing `announcements.id` — attachments are stored keyed to `announcement_id`
(`announcement_attachments` table), and `uploadBuildingFile` paths them under
`announcements/{announcementId}`. There is no id to attach to until the row has been inserted, so a
brand-new, not-yet-saved announcement cannot literally accept a file before its first save.

**Original decision (implemented, then reverted)**: `createAnnouncement` returned the new row's
`id` on success, and the client kept the modal open post-create (switching into edit-like mode) so
the same attach section editing already shows would appear before the admin dismissed it. This
technically satisfied the original FR-002 wording using the existing `addAttachment` action
unchanged.

**Superseding decision**: Direct product feedback after using the built flow: saving a new
announcement must close the create form immediately, the same way every other create action in
this backoffice already behaves — not stay open in an edit-like state. `createAnnouncement`'s
return type reverts to the plain `ActionResult` (no `id`), and `submit()` closes the modal on
success for both create and update, with no branch difference between them. spec.md's FR-002 was
updated to match: attaching a file to a brand-new announcement is a second step (save, then open
"Editar"), not part of the create flow itself.

**Rationale**: Matching the existing, already-familiar "save closes the form" pattern used
elsewhere in the backoffice outweighs the minor convenience of a same-session attach step for a
just-created announcement — Principle V (Simplicity) favors the smaller, more predictable behavior
over a special-cased "stay open" state that only this one form would have had.

**Alternatives considered**:
- Uploading the file to temporary storage before the record exists, then linking it after create —
  rejected: needs a new temp-storage/cleanup mechanism for a one-file feature; clear
  over-engineering relative to Principle V, and orphaned-temp-file handling is a new failure mode
  the spec never asked for.
- Requiring two separate steps (save, then reopen edit to attach) — rejected: worse UX than the
  single continuous flow above, and not what "available at creation time" implies.

## Decision 3: Thumbtack icon replacement

**Decision**: Replace `IconPin`'s SVG path in `components/icons.tsx` with a thumbtack glyph (a
round/flat head with a short point beneath), keeping the same component name, export, and
`SVGProps<SVGSVGElement>` signature so every call site (`announcements-client.tsx`'s row-title badge
and toggle button) needs no change beyond the icon's internal artwork.

**Rationale**: Every consumer of `IconPin` already passes `width`/`height`/`style`/`className` the
same way other icons in `components/icons.tsx` do (see `IconPaperclip`, `IconPencil` for the
established pattern); changing only the internal `<path>`/shape keeps the change surgical.

**Alternatives considered**: Adding a brand-new `IconThumbtack` component and updating both call
sites to import it instead — rejected: `IconPin`'s only semantic meaning in this codebase is
"pin/unpin an announcement," so renaming or duplicating it adds a migration step (two icon exports
meaning the same thing, or a rename touching two call sites) with no benefit over editing the
existing glyph in place.

## Decision 4: Distinct pinned-state style

**Decision**: Add a `.icon-btn.pinned` modifier in `app/globals.css`, following the same pattern
already used for `.icon-btn.danger` (a state-specific modifier on the existing `.icon-btn` base
class) and reusing the app's existing "active/selected" soft-badge convention
(`background: var(--color-accent-soft); color: var(--color-accent);` — already used by
`.nav-item.active`, `.tab.active`, and other badges in `app/globals.css`) plus a matching
accent-colored border, so a pinned toggle button reads as filled/highlighted rather than merely
recolored. The title-badge `IconPin` (row-title, shown only when `a.pinned` is true) keeps using
`color: var(--color-accent)` as today, since it has no background chip to fill and is inherently
only ever shown in its "pinned" state.

**Rationale**: Reuses an existing, already-proven visual language for "this is active/selected"
instead of inventing a new one, satisfying FR-007's requirement for a highlighted style that is
"not merely a color change" (background + border + icon color together, matching how `.icon-btn.
danger` already differentiates itself from the default `.icon-btn` on hover) while keeping
Principle V's no-new-abstraction preference.

**Alternatives considered**: A tooltip/label-only distinction — rejected, spec explicitly asks for
an at-a-glance visual difference, not one requiring hover/read. A completely new color token —
rejected, `--color-accent`/`--color-accent-soft` already exist and already mean "active/selected"
elsewhere in this app.
