# Implementation Plan: Uploaded Content Displays Correctly

**Branch**: `003-upload-display-fix` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-upload-display-fix/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Every image and document uploaded through the backoffice (feature 001) is stored in one of two
**private** Supabase Storage buckets (`building-media`, `building-documents`), but the pages that
display that content currently render the raw storage *path* (e.g.
`11111111-.../facilities/167-photo.jpg`) directly as an `<img src>` or download link instead of a
usable URL — so nothing uploaded actually displays. The fix is not a new architecture: a
`signedUrlFor()` helper that generates a short-lived, RLS-scoped signed URL already exists
(`lib/supabase/storage.ts`, built in feature 001) but was never wired into the pages that render
these fields. This feature wires it in everywhere a stored path is displayed — eagerly, at
server-render time, for images that must appear as part of the page (facility/activity/
announcement images, building logo), and on-demand, via a small server action triggered by a
click, for documents (Documentos, announcement attachments) — while leaving the buckets private so
Principle I's isolation guarantee is preserved rather than worked around.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (unchanged from feature 001 — same
codebase, no new stack).

**Primary Dependencies**: Next.js 14 (App Router), `@supabase/supabase-js` / `@supabase/ssr`
(unchanged). No new dependency is introduced — `supabase.storage.from(bucket).createSignedUrl()`
is already available via the existing `@supabase/supabase-js` client and already wrapped by
`signedUrlFor()`.

**Storage**: Supabase Storage, project **Habitat** — the same two private buckets from feature 001
(`building-media`, `building-documents`). No new bucket, no bucket-policy change (Storage RLS
already scopes read access to `is_building_member`; see research.md item 3).

**Testing**: Vitest, same conventions as feature 001 (integration tests against the live Habitat
project via `tests/fixtures.ts`'s service-role helpers + `tests/setup.ts`'s `signInAs()`).

**Target Platform**: Same as feature 001 — web, evergreen browsers, backoffice route group.

**Project Type**: Web application — this is a fix within the existing single Next.js project from
feature 001, not a new project.

**Performance Goals**: Signed URL generation adds one `createSignedUrl` Storage API call per
displayed image per page render (batched via `Promise.all`); acceptable for this admin tool's
low-concurrency, small-per-page-image-count profile (see research.md item 1 for why eager
generation was chosen over alternatives).

**Constraints**: Buckets MUST remain private — Principle I forbids achieving "content displays"
by relaxing multi-tenant isolation (spec.md Assumptions, FR-004). Signed URLs MUST be generated
using the requesting user's own session-scoped Supabase client (not a service-role client), so
Storage RLS is what actually enforces who can obtain a working URL — not application logic alone.

**Scale/Scope**: Touches every page from feature 001 that renders a stored file reference:
facilities, activities, announcements (banner + attachments), customization (logo), documentation
(documents), plus the backoffice sidebar/login (logo fallback). No new pages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | How this plan satisfies it |
|------|--------|------------------------------|
| I. Multi-Tenant Data Isolation (NON-NEGOTIABLE) | PASS | Buckets stay private; every signed URL is generated through the caller's own session-scoped client, so Storage RLS (`is_building_member`/`can_admin_building`, already in place per feature 001) is the actual enforcement point for who can obtain a working URL — not merely which URL the UI chooses to render. |
| II. Role-Based Access Control | PASS | No role or permission model changes; this feature only fixes how already-authorized reads are turned into a renderable/downloadable URL. |
| III. Test-First for Authorization & Core Workflows (NON-NEGOTIABLE) | PASS (process gate) | A cross-building signed-URL-denial test (User Story 3 / FR-004) MUST be written and failing before the fix lands, extending feature 001's existing Storage RLS coverage rather than trusting it by assertion; `/speckit-tasks` orders it before the corresponding implementation task. |
| IV. Auditability & Data Integrity | PASS | No new create/update/delete action is introduced (upload actions and their `writeAuditLog()` calls are unchanged); this feature only affects reading back already-audited uploads. |
| V. Simplicity & Incremental Delivery | PASS | Reuses the existing `signedUrlFor()` helper and existing Storage RLS policies verbatim; no new dependency, bucket, or abstraction layer is introduced. |
| Data Storage | PASS | Same Habitat Supabase project; no storage location change. |

No violations — Complexity Tracking is empty.

**Post-Phase 1 re-check**: All gates above still PASS after design. [data-model.md](./data-model.md)
confirms no schema changes are needed (existing `image_url`/`banner_url`/`logo_url`/`file_path`
columns are reinterpreted as *storage paths*, which is what they already were — the bug was only
in how they were rendered). [contracts/file-access.md](./contracts/file-access.md) specifies the
signed-URL contract precisely enough for Principle III's test to be written against it. No new
complexity was introduced.

## Project Structure

### Documentation (this feature)

```text
specs/003-upload-display-fix/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── file-access.md   # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
habitat/
├── lib/
│   └── supabase/
│       └── storage.ts                  # signedUrlFor() already exists here — reused, not rewritten
├── app/(backoffice)/
│   ├── facilities/page.tsx             # + eager signed URL for image_url
│   ├── activities/page.tsx             # + eager signed URL for banner_url
│   ├── announcements/
│   │   ├── page.tsx                    # + eager signed URL for banner_url
│   │   └── actions.ts                  # + getAttachmentUrl() on-demand action
│   ├── customization/page.tsx          # + eager signed URL for logo_url
│   ├── documentation/
│   │   ├── page.tsx
│   │   └── actions.ts                  # + getDocumentUrl() on-demand action
│   └── layout.tsx                      # + eager signed URL for sidebar logo
├── app/login/page.tsx                  # + eager signed URL for login-page logo (if building known)
└── tests/integration/
    └── signed-url-cross-tenant.test.ts # new — User Story 3 / FR-004
```

**Structure Decision**: No new top-level structure — this feature edits existing pages/actions
from feature 001 in place, plus adds one new test file. No separate frontend/backend split (same
reasoning as feature 001's plan.md).

## Complexity Tracking

*No entries — Constitution Check passed without needing to justify any deviation.*
