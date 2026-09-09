# Feature Specification: Uploaded Content Displays Correctly

**Feature Branch**: `003-upload-display-fix`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "I want administrators to be able to upload their files to the
existing Supabase buckets so the content they upload displays correctly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uploaded images appear right away (Priority: P1)

As a Building Administrator, when I upload a facility photo, an activity or announcement banner,
or my building's logo, I see that image displayed on the page immediately — I don't have to guess
whether the upload worked or take any extra step to make it visible.

**Why this priority**: Images are the most visible and most frequently uploaded content type
across the backoffice (Instalaciones, Actividades, Noticias y avisos, Personalización all have
image uploads). An upload that "succeeds" but shows nothing looks broken and undermines trust in
the whole app.

**Independent Test**: Upload a photo to a facility (or any other image field), and confirm the
image renders on the page without a reload, a broken-image icon, or any manual action beyond the
upload itself.

**Acceptance Scenarios**:

1. **Given** a Building Administrator creates or edits a facility with a photo, **When** the save
   completes, **Then** the photo is visible on the facility's card.
2. **Given** a Building Administrator uploads a building logo, **When** the save completes,
   **Then** the logo is visible in the sidebar. (The login page is pre-authentication and has no
   building context, so it is not in scope for this scenario — see Assumptions.)
3. **Given** a Building Administrator uploads an activity or announcement banner, **When** the
   save completes, **Then** the banner is visible on that activity's or announcement's entry.
4. **Given** an image was uploaded previously, **When** the Building Administrator reloads the
   page or returns later in the same session, **Then** the image still displays correctly (not
   just immediately after the upload).

---

### User Story 2 - Uploaded documents can be opened (Priority: P2)

As a Building Administrator, when I upload a document (in Documentos, or as an announcement
attachment), I can open or download that exact file afterward and confirm it's the one I uploaded.

**Why this priority**: Documents are uploaded less often than images but the failure mode is worse
— a document an administrator can't retrieve is functionally useless, even if the "upload
succeeded" message appeared.

**Independent Test**: Upload a document to a folder in Documentos, then open/download it and
confirm its contents match the uploaded file.

**Acceptance Scenarios**:

1. **Given** a Building Administrator uploads a document to Documentos, **When** they attempt to
   open or download it afterward, **Then** they receive the exact file they uploaded.
2. **Given** a Building Administrator attaches a file to an announcement, **When** they (or another
   administrator of the same building) attempt to open it, **Then** they receive the exact file
   that was attached.

---

### User Story 3 - Uploaded content stays private to the right building (Priority: P3)

As a Building Administrator, I expect that the images and documents I upload are visible to
members of my own building only — never to administrators of other buildings, and never to
anyone without an account, even if they somehow obtain a direct link.

**Why this priority**: Lower priority than "does it display at all" (P1/P2) only because it's a
correctness/security property rather than a visible break, but it's non-negotiable per this
project's multi-tenant isolation requirement — the fix for P1/P2 must not be achieved by making
uploaded content publicly accessible.

**Independent Test**: As a Building Administrator of Building A, attempt to view or download a
file uploaded by Building B (e.g., by reusing a link) and confirm access is denied.

**Acceptance Scenarios**:

1. **Given** an image or document uploaded by Building A, **When** a Building Administrator of
   Building B attempts to view or download it, **Then** access is denied.
2. **Given** an image or document uploaded by any building, **When** someone without a signed-in
   session attempts to view or download it directly, **Then** access is denied.

---

### Edge Cases

- What happens when an administrator replaces an existing image (e.g., re-uploads a facility
  photo)? The new image displays in place of the old one; the old image is no longer shown.
- What happens when a reference to an uploaded file exists but the underlying file is missing or
  inaccessible (e.g., deleted directly from storage outside the app)? The page shows a clear
  fallback/placeholder in that spot rather than a broken-looking blank or an error that blocks the
  rest of the page.
- What happens during a long-lived session (administrator leaves a page open for hours)? Images
  and document links continue to work when the administrator interacts with the page again,
  without requiring a full sign-out/sign-in.
- What happens if an upload is interrupted or fails partway through? The administrator sees a
  clear error and no broken/partial reference is left behind for them to encounter later as an
  unexplained missing image.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display an uploaded image (facility photo, activity banner,
  announcement banner, building logo) on the relevant page immediately after the upload completes,
  with no additional action required from the administrator.
- **FR-002**: The system MUST continue to correctly display previously-uploaded images on
  subsequent page loads and later in the same or a future session, not only immediately after
  upload.
- **FR-003**: The system MUST allow an administrator to open or download an uploaded document
  (Documentos, or an announcement attachment) and receive the exact file that was uploaded.
- **FR-004**: The system MUST restrict viewing and downloading of uploaded content to authorized
  members of the building it belongs to — administrators of other buildings and unauthenticated
  visitors MUST be denied access, consistent with this project's existing multi-tenant isolation
  requirement (no relaxation of bucket privacy as a way to "fix" display).
- **FR-005**: The system MUST show a clear fallback/placeholder wherever an image reference exists
  but the underlying file cannot be retrieved, instead of a broken or blank appearance.
- **FR-006**: The system MUST NOT leave a stale or broken file reference behind when an upload
  fails partway through.

### Key Entities

*(This feature fixes the display/retrieval of files already covered by existing entities —
Facility, Activity, Announcement, Document, and Building logo — in the existing Supabase storage
buckets; it introduces no new data entities.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of images uploaded through Instalaciones, Actividades, Noticias y avisos, and
  Personalización are visible immediately after upload and remain visible after a page reload.
- **SC-002**: 100% of documents uploaded through Documentos or as announcement attachments can be
  successfully opened/downloaded afterward, with content matching the original file.
- **SC-003**: Zero instances, across a normal administrator working session, of an authorized user
  seeing a broken-image indicator for content they have permission to view.
- **SC-004**: 100% of cross-building access attempts (another building's administrator, or an
  unauthenticated visitor, trying to view or download a file that isn't theirs) are denied.

## Assumptions

- "The existing Supabase buckets" refers to the two private storage buckets already in use by the
  backoffice for images/banners/logos and for documents — this feature does not introduce a new
  bucket or change what may be uploaded (file types/size limits already in place are unaffected).
- The buckets remain private (not made publicly readable) — the fix for display achieves
  visibility for authorized users without weakening the project's per-building data isolation
  requirement, which takes precedence over the simplest possible display mechanism.
- Upload actions themselves (choosing a file, size/type validation, the "upload succeeded" record
  being saved) are already working correctly; this feature is scoped to what happens *after* a
  successful upload — making the result actually viewable/retrievable.
- "Immediately after upload" means within the same page interaction that triggered the upload — no
  manual refresh, no separate step, no waiting for a background process.
- **Descope discovered during implementation (T012)**: Acceptance Scenario 2 under User Story 1
  originally described the building logo as visible "in the sidebar and on the login page." The
  login page has no building context before authentication (it is one shared page for every
  building, not a per-building URL), so there is no logo to select at that point — this scenario
  is descoped to the sidebar only; the login page keeps its generic brand mark. This does not
  affect FR-001–FR-007 or any success criterion, which all reference "the relevant page," not the
  login page specifically.
