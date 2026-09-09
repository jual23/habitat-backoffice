# Quickstart: Validating Uploaded Content Displays Correctly

This guide proves each user story from [spec.md](./spec.md) works end-to-end. It assumes the fix
has been implemented per [plan.md](./plan.md), [data-model.md](./data-model.md), and
[contracts/file-access.md](./contracts/file-access.md) — it is a validation script, not an
implementation guide.

## Prerequisites

- The app running against the live Habitat project (`npm run dev`, `.env.local` configured), same
  as feature 001's quickstart.
- Two Building Administrator accounts in two different buildings (see feature 001's quickstart for
  how to create one via Supabase Studio + granting `user_roles`) — needed for User Story 3's
  cross-tenant check.
- `SUPABASE_SERVICE_ROLE_KEY` set for `npm run test` (feature 001's existing requirement).

## Automated checks (run first)

```bash
npm run test
```

Expect: `tests/integration/signed-url-cross-tenant.test.ts` passes (denies a cross-building
signed-URL attempt), alongside every existing feature 001 test. If this fails, stop — do not
proceed to manual validation until it's green.

## Manual validation per user story

### 1. Images display immediately (P1)

1. Log in as a Building Administrator. Go to Instalaciones → create a facility with a photo.
2. Confirm the photo appears on the facility's card immediately — no reload needed.
3. Go to Personalización → upload a building logo. Confirm it appears in the sidebar right away.
4. Reload the page (full browser refresh). Confirm the facility photo and the sidebar logo are
   still visible — not just immediately after upload (this is the part that was broken before the
   fix: a raw storage path only "worked" for approximately zero page loads).
5. Repeat for an activity banner (Actividades) and an announcement banner (Noticias y avisos).

### 2. Documents can be opened (P2)

1. Go to Documentos → upload a document into any folder.
2. Click to open/download it. Confirm the file that opens matches what was uploaded (not a broken
   link, not an error).
3. Go to Noticias y avisos → attach a file to an announcement. Click it. Confirm it opens
   correctly.

### 3. Cross-building isolation holds (P3)

1. As Building A's administrator, upload a facility photo. Open the browser's network tab (or
   inspect the rendered `<img src>`) and copy the resulting signed URL.
2. Log out. Log in as Building B's administrator (a different building).
3. Attempt to open the copied URL directly. Expect: denied (the URL either fails outright, or —
   because it's time-limited — even if copied while valid, direct navigation as a session with no
   membership in Building A must not succeed via the app's own signed-URL-issuing action; the
   automated cross-tenant test above is the authoritative check for this, since a raw copied URL
   itself, once issued, is only as safe as its short/moderate lifetime — the real guarantee is that
   *issuing* a new signed URL for another building's object always fails, which is what the
   automated test proves programmatically).
4. As Building B's administrator, attempt to trigger `getDocumentUrl()`/`getAttachmentUrl()` for a
   document id known to belong to Building A (e.g., one seen in Building A's session). Expect: the
   action returns `{ ok: false }`, not a working URL.

## Edge cases to spot-check

- Delete an uploaded facility photo's underlying Storage object directly in Supabase Studio
  (leaving `facilities.image_url` pointing at a now-missing path). Reload the facility page.
  Expect: the icon-avatar fallback is shown, not a broken-image icon or a page error (FR-005).
- Leave a page with an uploaded image open in a background tab for the length of the automated
  test suite's run (a few minutes is enough to sanity-check nothing errors immediately); full 24h
  expiry behavior is verified by code review of the `expiresInSeconds` argument per
  contracts/file-access.md, not by an actual day-long manual wait.
