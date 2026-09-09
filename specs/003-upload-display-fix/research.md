# Phase 0 Research: Uploaded Content Displays Correctly

No `NEEDS CLARIFICATION` markers remain in Technical Context — this is a scoped fix within an
existing, already-researched architecture (feature 001), so research here is narrowly about how
to wire in the fix correctly rather than architecture-level decisions.

## 1. Root cause confirmation

**Finding**: `lib/supabase/storage.ts`'s `uploadBuildingFile()` returns the Storage *object path*
(e.g. `{buildingId}/facilities/{timestamp}-{filename}`), by design — buckets are private, so there
is no public URL to return. Every server action that uploads a file (`createFacility`,
`updateFacility`, `createActivity`, `updateActivity`, `createAnnouncement`, `updateAnnouncement`,
`updateCustomization`, `uploadDocument`, `addAttachment`) correctly stores that path in the
relevant column (`image_url`, `banner_url`, `logo_url`, `file_path`). The same file also already
exports `signedUrlFor()`, which turns a path into a working, time-limited URL via
`supabase.storage.from(bucket).createSignedUrl()`. **The bug is that no page.tsx or client
component ever calls `signedUrlFor()`** — every `<img src={row.image_url}>` (and every "open
document" link) uses the raw path directly, which is not a URL a browser can load.

**Rationale for fix approach**: Since the correct primitive already exists and works (it wraps a
standard, well-documented Supabase Storage API), the fix is entirely about *calling it in the
right places* — no new library, no bucket policy change, no schema change.

## 2. Eager vs. on-demand signed URL generation

**Decision**: Generate signed URLs **eagerly, server-side, at page-render time** (in each
`page.tsx` Server Component, alongside the existing data fetch) for content that must render as
part of the page itself — facility/activity/announcement images, the building logo. Generate
signed URLs **on-demand, via a server action triggered by a click**, for documents (Documentos
files, announcement attachments), which are not rendered inline.

**Rationale**: Images are visual elements — the page is incomplete/broken-looking without them, so
there's no good reason to defer generating their URL past the initial render (and every affected
page already fetches these rows in a Server Component, so adding one `Promise.all` of
`signedUrlFor()` calls alongside the existing query is a small, localized change). Documents,
conversely, may number in the dozens per folder and are typically opened rarely relative to how
often the list is viewed — generating a signed URL for every document on every page load would be
wasted work; generating one only when the administrator actually clicks to open/download is
simpler and cheaper, and matches the pattern of a normal "download" button.

**Alternatives considered**:
- *Signed URLs for everything, eagerly* — rejected for documents specifically: unnecessary Storage
  API calls for files nobody opens in a given session, with no user-visible benefit over
  on-demand generation (the click-to-open interaction has no perceptible added latency from one
  extra server round-trip).
- *A public, unauthenticated CDN/proxy layer in front of Storage* — rejected: this is exactly the
  "make buckets public to fix display" shortcut FR-004 and the Constitution's Principle I forbid;
  it would leak cross-building and unauthenticated access as a side effect of fixing a display bug.
- *Client-side signed URL generation (browser calls Supabase directly)* — viable in principle
  (the browser already holds a session and could call `createSignedUrl` itself via the publishable
  key), but rejected in favor of server-side generation for images specifically: Server Components
  already fetch these rows server-side, so generating the URL there avoids an extra
  client-side round trip and an extra `'use client'` boundary per image. For documents, the
  on-demand action is already a server action for consistency with the rest of feature 001's
  action-based mutation pattern.

## 3. Why Storage RLS is sufficient for User Story 3 (no new policy needed)

**Finding**: Feature 001 already created Storage RLS policies (`media readable by building
members`, etc.) scoping SELECT on `storage.objects` to `is_building_member(auth.uid(),
storage_building_id(name))`. `createSignedUrl()` is a Storage API call made *as the calling user*
when invoked through the request-scoped `createClient()` (from `lib/supabase/server.ts`, which
uses the session cookie + publishable key) — Supabase enforces the same Storage RLS for signed-URL
issuance as for direct downloads. Calling it as a different building's administrator, or as an
unauthenticated request, is denied by the existing policy with no new SQL needed.

**Rationale**: This is why the plan's Constraints section requires "the requesting user's own
session-scoped Supabase client, not a service-role client" — a service-role client bypasses RLS
entirely and would silently defeat this guarantee. The one thing this feature must get right,
code-wise, is *always* calling `signedUrlFor()` through the per-request `createClient()`, never
through `tests/fixtures.ts`'s service-role client (that helper remains test-setup-only, as it
already is in feature 001).

**Alternatives considered**:
- *A new Storage RLS policy specific to signed-URL issuance* — unnecessary: Supabase does not
  distinguish "issue a signed URL" from "read the object" at the policy level; the existing SELECT
  policy already covers both.

## 4. Signed URL expiry and the "long-lived session" edge case

**Decision**: Use a 24-hour expiry (vs. `signedUrlFor()`'s current 3600-second/1-hour default) for
URLs generated for page-rendered images, passed explicitly per call site; keep the 1-hour default
for the on-demand document-open action (a URL used within seconds of being generated doesn't need
a long lifetime).

**Rationale**: Next.js Server Components re-run their data fetch (and therefore regenerate signed
URLs) on every navigation and on every `revalidatePath()` (already called by every mutating server
action in feature 001) — so a stale URL only becomes visible if an administrator leaves a single
page open, without navigating away or triggering any mutation, for longer than the URL's lifetime.
A 24-hour expiry comfortably covers a full admin working session left open in a background tab,
while still being a bounded-lifetime credential rather than an effectively-permanent one — a
reasonable middle ground for spec.md's "normal working session" success criterion (SC-003) without
over-engineering a client-side refresh mechanism this admin tool doesn't need yet.

**Alternatives considered**:
- *Keep the 1-hour default everywhere* — rejected: risks exactly the "broken image after leaving
  the tab open" experience SC-003 is meant to rule out, for no real security benefit (the
  isolation guarantee comes from RLS gating *who can generate* a URL, not from how quickly a
  successfully-generated one expires).
- *Client-side auto-refresh of expiring image URLs* — rejected as unnecessary complexity
  (Principle V) for a low-traffic admin tool; revisit only if real usage shows sessions regularly
  exceeding 24 hours without navigation.

## 5. Fallback rendering when a signed URL can't be generated (FR-005)

**Decision**: Each eager signed-URL generation call is wrapped so a failure (object deleted,
transient Storage error) yields `null` rather than throwing and breaking the whole page; every
call site already has (from feature 001) a "no image" fallback UI (the icon-avatar placeholder on
facility/activity tiles, no `<img>` at all on the sidebar/login logo) — `null` simply routes to
that same existing fallback rather than needing new UI.

**Rationale**: Reuses UI that already exists for the "no file uploaded at all" case, so there is
no new fallback component to design — a signed-URL failure and "nothing was ever uploaded" become
the same rendering path, which is both simpler and consistent with how the rest of feature 001's
UI already handles the "optional image" case.

**Alternatives considered**:
- *A distinct "broken image" error state, different from "no image uploaded"* — rejected: not
  meaningfully more useful to an administrator, and doubles the fallback UI to build/maintain for
  a rare edge case (Principle V).
