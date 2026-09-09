# Contract: Signed URL Access for Uploaded Content

This is the contract `/speckit-tasks` writes tests against for User Stories 1–3. It supplements
(does not replace) feature 001's [contracts/rls-policies.md](../../001-building-backoffice/contracts/rls-policies.md)
Storage bucket policies section, which already defines who may read a given object — this contract
specifies how that read is turned into a URL the UI can actually use, and what the caller gets
back in every case.

## `signedUrlFor(supabase, bucket, path, expiresInSeconds?)` — existing helper, reused as-is

Already implemented in `lib/supabase/storage.ts` (feature 001). Contract restated here for
reference; this feature does not change its signature or implementation:

| Input | Requirement |
|---|---|
| `supabase` | MUST be a request-scoped client from `lib/supabase/server.ts`'s `createClient()` (session cookie + publishable key) — NEVER `tests/fixtures.ts`'s service-role client, which would bypass Storage RLS and defeat User Story 3. |
| `bucket` | One of `STORAGE_BUCKETS.media` / `STORAGE_BUCKETS.documents`. |
| `path` | The stored value from `image_url`/`banner_url`/`logo_url`/`file_path` (a Storage object path, per data-model.md). |
| `expiresInSeconds` | 24h (`86400`) for eager image generation; omitted (1h default) for on-demand document generation. |

| Outcome | Behavior |
|---|---|
| Caller is a member of the object's building (`is_building_member`) | Returns a working signed URL. |
| Caller is a member of a *different* building | Storage RLS denies the underlying read; `signedUrlFor()` throws `UploadValidationError`. |
| Caller is unauthenticated | Same as above — denied by RLS, throws. |
| The object no longer exists in Storage | Throws (Supabase Storage error). |

## New call sites (this feature) — each MUST catch the throw case

Every call site below MUST wrap its `signedUrlFor()` call so a throw becomes `null` for that one
row, not a failure of the whole page/action (FR-005, FR-006):

| Surface | Field | Mode | Fallback on `null` |
|---|---|---|---|
| `app/(backoffice)/facilities/page.tsx` | `facilities.image_url` | Eager | Existing icon-avatar tile (no-image state, feature 001) |
| `app/(backoffice)/activities/page.tsx` | `activities.banner_url` | Eager | Existing icon-avatar tile |
| `app/(backoffice)/announcements/page.tsx` | `announcements.banner_url` | Eager | No banner rendered (existing conditional) |
| `app/(backoffice)/customization/page.tsx`, `app/(backoffice)/layout.tsx`, `app/login/page.tsx` | `buildings.logo_url` | Eager | Existing `IconShield` fallback |
| `app/(backoffice)/documentation/actions.ts` (new `getDocumentUrl()`) | `documents.file_path` | On-demand | Action returns `{ ok: false, error }`; UI shows the existing inline error text pattern |
| `app/(backoffice)/announcements/actions.ts` (new `getAttachmentUrl()`) | `announcement_attachments.file_path` | On-demand | Same as above |

## New server actions (on-demand mode)

Both follow the exact `ActionResult` pattern already established by every other server action in
feature 001 (`{ ok: true, url: string } | { ok: false; error: string }`), require the caller to be
signed in and a member of the row's building (checked implicitly by Storage RLS via
`signedUrlFor()`, same as every other action's data access), and perform no write — they are the
first read-only server actions in the app, which is a natural, minimal extension of the existing
action pattern rather than a new one (Principle V).

- `getDocumentUrl(documentId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>`
- `getAttachmentUrl(attachmentId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>`

Each looks up the row's `file_path`/`building_id` first (a normal RLS-scoped `select`, which
itself already denies cross-building reads per feature 001's table RLS — see rls-policies.md), then
calls `signedUrlFor()` for that path.
