# Phase 1 Data Model: Announcement Card UI Fixes

No new entities, fields, tables, or columns. This feature is a UI-surface and glyph/style change
only. Documented here for the record, per the existing entities this feature touches without
altering.

## Announcement (existing — `announcements` table)

Unchanged. Relevant existing fields used by this feature:

| Field | Used for |
|---|---|
| `id` | Target for `addAttachment` once the attach section is shown (edit, or post-create) |
| `pinned` | Drives the pin icon's shape (thumbtack, per Decision 3) and highlighted style (per Decision 4) |
| `title`, `body`, `banner_url`, `banner_signed_url` | Unchanged rendering, still in the list card |

No new field is introduced to distinguish "just created, attach section open" from "editing an
existing announcement" — both states are represented by the same existing `editingId` client-state
variable already used today to switch the modal between create and edit.

## Attachment (existing — `announcement_attachments` table, via `Attachment` client type)

Unchanged shape (`{ id: string; file_name: string }`). This feature changes only *where* the control
to create a new one is rendered (moving from the list card into the modal) — it does not add,
remove, or rename any attachment field, and does not change how already-uploaded attachments are
listed or opened from the card.

## Client-side state (existing, in `announcements-client.tsx`)

| State | Change |
|---|---|
| `editingId: string \| null` | No shape or source change from before this feature — still set only by `openEdit()`, and still `null` throughout the create flow (including after a successful save; see research.md Decision 2's superseding note). |
| `attachmentTargets: Record<string, File \| null>` | Replaced by a single `File \| null` scoped to the modal's current target id, since only one announcement (the one being edited) can have its attach control visible at a time — the per-row `Record` existed only because the control used to live on every row simultaneously. |

No RLS, migration, or Server Action signature changes — `createAnnouncement` keeps its original
`ActionResult` return type (see contracts/ui-contract.md).
