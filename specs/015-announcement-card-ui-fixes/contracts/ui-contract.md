# UI Contract: Announcement Card UI Fixes

This is a single-page backoffice UI change, not a network API — the "contract" below is the render
and state contract that `announcements-client.tsx`, `components/icons.tsx`, and `app/globals.css`
must satisfy, so the acceptance scenarios in spec.md are mechanically checkable.

## 1. Attach controls: render condition

| Location | Before this feature | After |
|---|---|---|
| List card (per announcement row, modal closed) | File input + "Adjuntar" button always rendered | Neither rendered. Only the existing already-uploaded attachment chips (`att.file_name` buttons) remain, unchanged. |
| Create/edit `Modal` | No attachment UI at all | File input + "Adjuntar" section rendered **iff** `editingId !== null` — i.e., only while editing an existing announcement. |
| Create/edit `Modal`, brand-new announcement | N/A | Attach section never appears during the create flow — saving closes the modal immediately (see section 3). To attach a file to a just-created announcement, reopen it via "Editar". |

## 2. `createAnnouncement` Server Action return contract

Unchanged from before this feature — `createAnnouncement` keeps returning the original
`ActionResult`:

```ts
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createAnnouncement(...): Promise<ActionResult> { ... }
```

*(An earlier pass of this feature added a `CreateAnnouncementResult` with an `id` field so the
client could switch into an "attach" mode after create — that was reverted per direct feedback: a
new announcement's create form must close on save, the same as every other create flow in this
backoffice. See research.md Decision 2's superseding note.)*

## 3. Client submit-flow contract

```text
submit():
  result = editingId
    ? updateAnnouncement(editingId, ...)
    : createAnnouncement(...)
  on success -> close modal (both branches, identical — no special-casing between create and edit)
  on failure -> show error, keep modal open
```

The modal's "Cancelar"/close affordance and the automatic close-on-save above are the only two ways
the modal dismisses. An admin who wants to attach a file to a brand-new announcement does so as a
second step: save (modal closes) → click "Editar" on the newly created card (attach section from
section 1 appears) → attach → close.

## 4. Pin icon contract

| Element | Class(es) | Icon shape | Style when `pinned === false` | Style when `pinned === true` |
|---|---|---|---|---|
| Row toggle button | `.icon-btn` (+ new `.icon-btn.pinned` when pinned) | Thumbtack (both states — same glyph, only style differs) | Existing default `.icon-btn` look (neutral border/background, muted icon color) | `.icon-btn.pinned`: accent border + `--color-accent-soft` background + `--color-accent` icon color |
| Title badge (`row-title`) | rendered only when `a.pinned` | Thumbtack | N/A — not rendered when unpinned | `color: var(--color-accent)` (unchanged existing treatment — already sufficiently distinct since it only ever appears in the pinned state) |

`aria-label`/`title` text ("Fijar arriba" / "Desfijar") on the toggle button is unchanged — this
contract only governs the icon's shape and the toggle button's visual style.

## 5. Non-goals (explicitly unchanged)

- `addAttachment`, `togglePin`, `deleteAnnouncement` signatures and authorization guards.
- The list card's already-uploaded attachment chips (rendering, click-to-open behavior).
- `announcement_attachments` / `announcements` schema, RLS policies.
- Any role/permission gate on the Announcements page.
