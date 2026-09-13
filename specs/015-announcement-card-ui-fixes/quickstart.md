# Quickstart: Validating Announcement Card UI Fixes

## Prerequisites

- Local dev environment configured against the Habitat Supabase project (per the constitution's
  Data Storage requirements), with `.env.local` set up as the rest of this backoffice already
  requires.
- A Building Administrator (or App Administrator) test account, and at least one building with
  one existing announcement that already has an attachment, plus one without.

## Setup

```powershell
npm install
npm run dev
```

Sign in as the Building Administrator test account and navigate to **Noticias y avisos**.

## Validation scenarios

### 1. No attach controls in the list (preview) view — FR-001, FR-004

1. With the create/edit modal closed, look at every card in the list.
2. **Expect**: no file-picker input and no "Adjuntar" button on any card.
3. **Expect**: an announcement that already has an attachment still shows its attachment chip(s)
   (clicking one still opens it, per `getAttachmentUrl`) — unchanged from before this change.

### 2. Creating an announcement closes the form on save — FR-002

1. Click "Nuevo aviso".
2. Fill in Título and Contenido, optionally a banner, and click "Publicar aviso".
3. **Expect**: on success, the create form closes immediately — no file-picker input or "Adjuntar"
   button is ever shown during creation.
4. **Expect**: the new announcement now appears in the list, with no attachments and no
   file-picker/"Adjuntar" controls on its card (per scenario 1's state).
5. To attach a file to it, click "Editar" on that same card — see scenario 3.

### 3. Attach control available while editing — FR-003

1. Click "Editar" on an existing announcement.
2. **Expect**: the modal shows a file-picker input and "Adjuntar" button.
3. Attach a file.
4. **Expect**: it uploads successfully and appears in that announcement's attachment list once the
   modal is closed.

### 4. Controls disappear again after closing — FR-005

1. From either scenario 2 or 3, close the modal (Cancelar or after a successful save/attach).
2. **Expect**: the list view shows no file-picker/"Adjuntar" controls on any card, per scenario 1.

### 5. Thumbtack icon, both states — FR-006, FR-007, FR-008

1. Find (or create, via the "Fijar arriba" toggle in the create/edit form, or the row's pin button)
   one pinned and one unpinned announcement.
2. **Expect**: the pin toggle button on every row renders a thumbtack-shaped icon (not the old
   map/location teardrop marker) in both states.
3. **Expect**: the pinned announcement's toggle button is visually filled/highlighted (accent
   border, soft-accent background, accent icon color) — clearly different from the unpinned
   button's neutral style, at a glance, without reading the tooltip.
4. **Expect**: the pinned announcement's title also shows the thumbtack icon in accent color next
   to its title (unchanged position/behavior from before, new glyph only).
5. Click the toggle to unpin it.
6. **Expect**: the highlighted style is removed immediately and the title badge disappears,
   consistent with existing toggle behavior.

## Automated checks

```powershell
npm run typecheck
npm run lint
npm run build
```

No new automated test suite is introduced (see plan.md Technical Context) — these three commands
staying clean, plus the manual walkthrough above, are this feature's verification gate.
