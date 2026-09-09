# Phase 1 Data Model: Uploaded Content Displays Correctly

No tables, columns, or Storage RLS policies change. This feature reinterprets already-existing
columns correctly (as Storage *paths*, not URLs) and adds one derived, request-scoped value at
read time. Documented here for traceability, per data-model.md's usual role — there is no
migration to accompany this feature.

## Existing columns reused (unchanged)

All from feature 001's data-model.md / SCHEMA-ADAPTATION.md — listed here only to make explicit
which are in scope for this fix:

| Table | Column | Bucket |
|---|---|---|
| `facilities` | `image_url` | `building-media` |
| `activities` | `banner_url` | `building-media` |
| `announcements` | `banner_url` | `building-media` |
| `announcement_attachments` | `file_path` | `building-documents` |
| `buildings` | `logo_url` | `building-media` |
| `documents` | `file_path` | `building-documents` |

**Naming note carried forward, not changed by this feature**: these columns are named `*_url` in
several tables (`image_url`, `banner_url`, `logo_url`) but have always stored a Storage *path*, not
a URL — that mismatch between name and actual content is exactly what made the bug easy to
introduce. Renaming the columns is out of scope for this fix (would require a migration touching
tables shared with other in-progress work); the Assumptions in spec.md scope this feature to
"what happens after upload," not the column-naming.

## New derived value: signed URL (not persisted)

A **signed URL** is computed at read time from a stored path — it is never written to the
database. Two shapes, matching research.md item 2:

| Shape | Where computed | Lifetime | Used for |
|---|---|---|---|
| Eager signed URL | Server Component data fetch (`page.tsx`), one `signedUrlFor()` call per row, batched with `Promise.all` | 24h (research.md item 4) | `facilities.image_url`, `activities.banner_url`, `announcements.banner_url`, `buildings.logo_url` |
| On-demand signed URL | A server action (`getDocumentUrl()`, `getAttachmentUrl()`), called when the administrator clicks to open/download | 1h (`signedUrlFor()`'s existing default) | `documents.file_path`, `announcement_attachments.file_path` |

**Validation rule**: if `signedUrlFor()` fails for a given path (object missing, transient error),
the derived value is `null`, not a thrown error that fails the whole page — see contracts/file-access.md.

**Relationships**: none new — the derived signed URL belongs 1:1 to the row it was computed from
for the duration of one request/action call; it is not stored or associated with the row beyond
that.
