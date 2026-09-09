# Feature Specification: Building Administrator Backoffice

**Feature Branch**: `001-building-backoffice`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "The backoffice should allow users to work with: Facilities: Building Administrators should be able to create/edit facilities such as gymnasium, pool, etc. Add an image, establish opening hours and indicate if the facility is available for users to make a reservation. These reservations need to be manually approved or declined by the administrator. They will be in a requested status before this. Announcements: Building administrator should be able to manage this, every announcement should allow for attachments and a banner and should allow to be pinned at the top. Activities: Allow building administrator to manage different activities indicating date, maximum number of participants (optional) and a banner image. Visitors: Staff should be able to view a list of visitors that are being expected, with the ability to mark them as arrived. If a visitor does not arrive within 8 hours of being created it should mark itself as expired. Documentation: Building administrator can manage folders and upload documents. Suggestions and complaints: The building administrator can read a list of suggestions and complaints that residents have created. The view should be separated by some sort of tab at the top to check either suggestions of complaints. The building administrator can star/save as favorite these and be able to discard them. Discarded elements should delete themselves after 24hrs. Apartments: Building administrator will be able to create a list of apartments, when a new user is created it has to be associated with an apartment. Users: Building administrator should be able to manage users, they can delete a user, modify email, and change associated apartment unit. Customization: The building administrator should be able to select a main accent color and upload a small square logo to be shown alongside."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Apartments and Residents (Priority: P1)

A Building Administrator maintains the roster of apartments in their building and the resident
user accounts tied to each unit, so that every other backoffice module has a defined set of
residents and units to work with.

**Why this priority**: This is the foundational data set. Facilities, activities, and every other
module ultimately reference apartments and residents; without this, the rest of the backoffice has
no residents to serve.

**Independent Test**: Can be fully tested by creating an apartment, creating a user account
associated with it, editing that user's email, reassigning them to a different apartment, and
deleting a user — all verifiable without any other module existing yet.

**Acceptance Scenarios**:

1. **Given** a building with no apartments, **When** the Building Administrator creates a new
   apartment (e.g., unit "4B"), **Then** it appears in the apartment list and is available for
   user association.
2. **Given** an apartment exists, **When** the Building Administrator creates a new user and
   assigns them to that apartment, **Then** the user appears in that apartment's resident list.
3. **Given** an apartment already has one resident, **When** the Building Administrator adds a
   second user to the same apartment, **Then** both users appear as residents of that apartment.
4. **Given** a user exists, **When** the Building Administrator edits their email address,
   **Then** the change is saved and reflected immediately.
5. **Given** a user exists, **When** the Building Administrator changes their associated
   apartment, **Then** the user is moved to the new apartment's resident list and removed from
   the old one's.
6. **Given** a user exists, **When** the Building Administrator deletes the user, **Then** the
   user no longer appears in any list and loses access to the system.

---

### User Story 2 - Manage Facilities and Approve Reservations (Priority: P2)

A Building Administrator creates and maintains shared facilities (gym, pool, etc.) and reviews
reservation requests for the ones that accept them, approving or declining each one.

**Why this priority**: Facility management with a manual approval workflow is a core operational
feature and a primary differentiator of the product.

**Independent Test**: Can be fully tested by creating a reservable facility, then approving one
pending reservation request and declining another, verifying their statuses change accordingly —
independent of announcements, activities, or any other module.

**Acceptance Scenarios**:

1. **Given** the Building Administrator is on the facilities page, **When** they create a facility
   with a name, image, and opening hours, **Then** it is listed with those details.
2. **Given** a facility, **When** the Building Administrator marks it as available for
   reservation, **Then** it accepts reservation requests; when not marked, it does not.
3. **Given** a reservation request in "Requested" status, **When** the Building Administrator
   approves it, **Then** its status changes to "Approved".
4. **Given** a reservation request in "Requested" status, **When** the Building Administrator
   declines it, **Then** its status changes to "Declined".
5. **Given** the Building Administrator edits a facility's opening hours or image, **When**
   saved, **Then** the updated information is reflected wherever the facility is shown.
6. **Given** the Building Administrator deletes a facility, **When** the deletion is confirmed,
   **Then** the facility no longer appears and its pending reservation requests are declined.

---

### User Story 3 - Publish Announcements (Priority: P3)

A Building Administrator creates and manages announcements for residents, optionally attaching
files, adding a banner image, and pinning important ones to the top of the list.

**Why this priority**: Announcements are the simplest, highest-frequency communication tool and
deliver value on their own from day one.

**Independent Test**: Can be fully tested by creating an announcement with an attachment and a
banner, pinning it, and confirming it sorts above unpinned announcements — independent of every
other module.

**Acceptance Scenarios**:

1. **Given** the Building Administrator creates an announcement with a title and body, **When**
   saved, **Then** it appears in the announcement list.
2. **Given** an announcement, **When** the Building Administrator attaches one or more files,
   **Then** those attachments are retrievable from the announcement.
3. **Given** an announcement, **When** the Building Administrator adds a banner image, **Then**
   the banner is displayed with the announcement.
4. **Given** an unpinned announcement, **When** the Building Administrator pins it, **Then** it
   appears above all unpinned announcements.
5. **Given** a pinned announcement, **When** the Building Administrator unpins it, **Then** it
   returns to normal chronological order among unpinned announcements.
6. **Given** an announcement, **When** the Building Administrator edits or deletes it, **Then**
   the change is reflected in the list.

---

### User Story 4 - Manage Activities (Priority: P4)

A Building Administrator creates and manages activities (e.g., yoga class, community event) with
a date, an optional maximum number of participants, and a banner image.

**Why this priority**: Activity management extends resident engagement but depends on less urgent
scheduling logic than facility reservations.

**Independent Test**: Can be fully tested by creating an activity with a date and banner, one with
a participant cap and one without, and editing/deleting an activity — independent of every other
module.

**Acceptance Scenarios**:

1. **Given** the Building Administrator creates an activity with a date and a banner image,
   **When** saved, **Then** it appears in the activity list with those details.
2. **Given** the Building Administrator sets a maximum number of participants, **When** saved,
   **Then** that limit is stored and displayed with the activity.
3. **Given** the Building Administrator leaves the maximum participants field blank, **When**
   saved, **Then** the activity is stored as having no participant limit.
4. **Given** an activity exists, **When** the Building Administrator edits or deletes it, **Then**
   the change is reflected in the list.

---

### User Story 5 - Track Expected Visitors (Priority: P5)

Staff view the list of visitors expected at the building and mark each one as arrived when they
show up. A visitor that never arrives expires automatically.

**Why this priority**: This is a narrower, operational front-desk function that depends on
apartments/residents existing but not on any other backoffice module.

**Independent Test**: Can be fully tested by (with an expected visitor record already present)
marking it as arrived, and separately confirming a different expected visitor record
automatically becomes "Expired" once 8 hours pass without arrival.

**Acceptance Scenarios**:

1. **Given** expected visitor records exist for the building, **When** Staff open the visitor
   list, **Then** they see each visitor's name and current status.
2. **Given** a visitor in "Expected" status, **When** Staff mark them as arrived, **Then** the
   visitor's status changes to "Arrived" and the arrival time is recorded.
3. **Given** a visitor in "Expected" status created more than 8 hours ago with no arrival marked,
   **When** the 8-hour threshold passes, **Then** the system automatically changes its status to
   "Expired".
4. **Given** a visitor already marked "Arrived", **When** more than 8 hours have passed since
   creation, **Then** the visitor's status remains "Arrived" and does not become "Expired".
5. **Given** no Staff account exists yet for their building, **When** the Building Administrator
   creates one (with an email), **Then** a Staff account scoped to that building is created and
   can access the Visitors list.
6. **Given** a Staff account exists, **When** the Building Administrator removes it, **Then** it
   can no longer access the system.

---

### User Story 6 - Manage Documentation (Priority: P6)

A Building Administrator organizes shared documents into folders and uploads files for residents
to access.

**Why this priority**: Useful reference functionality, but lower urgency than communication and
operational modules above it.

**Independent Test**: Can be fully tested by creating a folder, uploading a document into it, and
deleting both — independent of every other module.

**Acceptance Scenarios**:

1. **Given** the Building Administrator creates a folder, **When** saved, **Then** it appears in
   the documentation structure.
2. **Given** a folder, **When** the Building Administrator uploads a document into it, **Then**
   the document is listed under that folder and can be downloaded.
3. **Given** a folder, **When** the Building Administrator creates a subfolder inside it, **Then**
   the nested folder is shown within its parent.
4. **Given** a folder or document, **When** the Building Administrator renames or deletes it,
   **Then** the change is reflected in the structure.

---

### User Story 7 - Review Suggestions and Complaints (Priority: P7)

A Building Administrator reviews resident-submitted suggestions and complaints, separated into two
tabs, and can favorite or discard each entry.

**Why this priority**: Valuable for resident relations but does not block day-to-day building
operations the way facilities or announcements do.

**Independent Test**: Can be fully tested by (with existing suggestion and complaint records)
switching between the two tabs, favoriting an entry, discarding another, and confirming the
discarded entry disappears permanently after 24 hours.

**Acceptance Scenarios**:

1. **Given** suggestions and complaints exist, **When** the Building Administrator opens the
   view, **Then** suggestions and complaints are shown in two separate tabs.
2. **Given** an entry, **When** the Building Administrator marks it as a favorite, **Then** it is
   flagged as a favorite and stays visible as such.
3. **Given** a favorited entry, **When** the Building Administrator removes the favorite, **Then**
   the flag is cleared.
4. **Given** an entry, **When** the Building Administrator discards it, **Then** it is removed
   from the active list.
5. **Given** a discarded entry, **When** 24 hours have passed since it was discarded, **Then**
   the system permanently deletes it without manual action.

---

### User Story 8 - Customize Building Branding (Priority: P8)

A Building Administrator sets a main accent color and uploads a square logo used to represent the
building throughout the app.

**Why this priority**: Cosmetic and independent of every operational module; nice-to-have polish
rather than a functional dependency for anything else.

**Independent Test**: Can be fully tested by setting an accent color and uploading a logo, and
confirming both are saved and retrievable — independent of every other module.

**Acceptance Scenarios**:

1. **Given** the Building Administrator selects a main accent color, **When** saved, **Then** it
   is stored as the building's accent color.
2. **Given** the Building Administrator uploads a square logo image, **When** saved, **Then** it
   is stored and displayed alongside the building's branding.
3. **Given** the Building Administrator uploads a non-square logo image, **When** they attempt to
   save it, **Then** the system rejects it with a clear validation message.

---

### Edge Cases

- What happens when the Building Administrator deletes an apartment that still has associated
  users? (Users of a deleted apartment must be reassigned or removed first — deletion of an
  apartment with residents still attached MUST be blocked.)
- What happens when the Building Administrator deletes a facility that has pending ("Requested")
  reservations? (Pending requests MUST be automatically declined as part of the deletion.)
- What happens when two "Requested" reservations for the same facility overlap in time and the
  Building Administrator approves both? (The system allows it — conflict prevention is a manual
  administrator judgment call in this version; see Assumptions.)
- What happens when Staff attempt to access any module other than Visitors? (Access MUST be
  denied — Staff is scoped to the Visitors module only.)
- What happens when a visitor's 8-hour expiration threshold is reached at the exact moment Staff
  are marking them as arrived? (Whichever action completes first wins; if already "Arrived" the
  automatic expiration MUST NOT override it.)
- What happens when the Building Administrator tries to discard an entry that is already
  discarded? (The action MUST be a no-op — it does not restart the 24-hour deletion timer.)
- What happens when a folder that contains subfolders or documents is deleted? (All nested
  subfolders and documents MUST be deleted along with it, after explicit confirmation.)
- What happens when a user is deleted while they still have suggestions, complaints, or
  reservations on record? (Their historical records MUST be retained for audit purposes, no
  longer attributable to an active account.)
- What happens when an activity's maximum participants value is set to zero or a negative number?
  (The system MUST reject the value as invalid.)
- What happens when a Building Administrator or Staff account attempts to view or modify data
  belonging to a different building? (The request MUST be denied, per the multi-tenant isolation
  principle.)

## Requirements *(mandatory)*

### Functional Requirements

**Apartments & Users**

- **FR-001**: Building Administrators MUST be able to create, edit, and delete apartments within
  their building, each identified by a unit label.
- **FR-002**: Building Administrators MUST be able to create a new user account and associate it
  with exactly one apartment at creation time; the system MUST NOT allow a user to be created
  without an associated apartment.
- **FR-003**: The system MUST allow multiple user accounts to be associated with the same
  apartment.
- **FR-004**: Building Administrators MUST be able to edit a user's email address.
- **FR-005**: Building Administrators MUST be able to change a user's associated apartment.
- **FR-006**: Building Administrators MUST be able to delete a user account.
- **FR-007**: The system MUST prevent deleting an apartment that still has users associated with
  it.

**Facilities & Reservations**

- **FR-008**: Building Administrators MUST be able to create and edit facilities with a name,
  image, opening hours, and a flag indicating whether the facility accepts reservations.
- **FR-009**: Building Administrators MUST be able to delete a facility; deleting a facility MUST
  automatically decline any of its reservation requests still in "Requested" status.
- **FR-010**: The system MUST support reservation records with a status of "Requested",
  "Approved", or "Declined", starting in "Requested" status when first created.
- **FR-011**: Building Administrators MUST be able to approve a reservation request, changing its
  status to "Approved".
- **FR-012**: Building Administrators MUST be able to decline a reservation request, changing its
  status to "Declined".
- **FR-013**: Building Administrators MUST be able to view all reservation requests for their
  building's facilities, filterable by status.

**Announcements**

- **FR-014**: Building Administrators MUST be able to create, edit, and delete announcements with
  a title and body text.
- **FR-015**: Building Administrators MUST be able to attach one or more files to an announcement.
- **FR-016**: Building Administrators MUST be able to add a banner image to an announcement.
- **FR-017**: Building Administrators MUST be able to pin an announcement so that it is displayed
  above all unpinned announcements.
- **FR-018**: Building Administrators MUST be able to unpin a previously pinned announcement.

**Activities**

- **FR-019**: Building Administrators MUST be able to create, edit, and delete activities with a
  date, an optional maximum number of participants, and a banner image.
- **FR-020**: The system MUST allow an activity to be created with no maximum participant limit,
  and MUST reject a maximum participant value that is zero or negative when one is provided.

**Visitors**

- **FR-021**: The system MUST support visitor records with a status of "Expected", "Arrived", or
  "Expired", each scoped to a single building.
- **FR-022**: Staff MUST be able to view the list of expected visitors for their building.
- **FR-023**: Staff MUST be able to mark an "Expected" visitor as "Arrived", recording the arrival
  time.
- **FR-024**: The system MUST automatically change a visitor's status from "Expected" to
  "Expired" once 8 hours have elapsed since its creation without an arrival being recorded.
- **FR-025**: The system MUST NOT change a visitor's status to "Expired" once it has been marked
  "Arrived".

**Documentation**

- **FR-026**: Building Administrators MUST be able to create, rename, and delete folders, and
  documents.
- **FR-027**: Building Administrators MUST be able to upload and download documents within a
  folder.
- **FR-028**: The system MUST support nested subfolders within a folder.
- **FR-029**: Deleting a folder MUST delete all of its nested subfolders and documents.

**Suggestions & Complaints**

- **FR-030**: Building Administrators MUST be able to view suggestions and complaints in two
  separate tabs.
- **FR-031**: Building Administrators MUST be able to mark a suggestion or complaint as a
  favorite, and remove that designation.
- **FR-032**: Building Administrators MUST be able to discard a suggestion or complaint, removing
  it from the active list.
- **FR-033**: The system MUST automatically and permanently delete a discarded suggestion or
  complaint 24 hours after it was discarded.

**Customization**

- **FR-034**: Building Administrators MUST be able to set a main accent color for their building.
- **FR-035**: Building Administrators MUST be able to upload a square logo image for their
  building; the system MUST reject a non-square image with a validation message.

**Cross-cutting**

- **FR-036**: Every entity introduced by this feature (apartments, users, facilities,
  reservations, announcements, activities, visitors, documents, folders, suggestions, complaints,
  and branding) MUST be scoped to a single building, and no Building Administrator or Staff
  account may view or modify another building's data.
- **FR-037**: The Staff role MUST be restricted to the Visitors module; Staff MUST NOT be able to
  access facilities, announcements, activities, documentation, suggestions/complaints, apartments,
  users, or customization.
- **FR-038**: The system MUST record which Building Administrator or Staff user performed each
  create, edit, delete, approve, decline, or discard action introduced by this feature, along with
  a timestamp.

**Staff Provisioning**

- **FR-039**: Building Administrators MUST be able to create a Staff account scoped to their own
  building.
- **FR-040**: Building Administrators MUST be able to remove a Staff account from their building.

### Key Entities

- **Apartment**: A unit within a building, identified by a unit label; has zero or more associated
  Users.
- **User (Resident)**: A resident account with an email address, associated with exactly one
  Apartment.
- **Staff**: An account scoped to a single building with access limited to the Visitors module.
- **Facility**: A shared amenity (e.g., gymnasium, pool) with a name, image, opening hours, and a
  flag indicating whether it accepts reservations.
- **Reservation**: A resident's request to use a reservable Facility during a given time; has a
  status of Requested, Approved, or Declined.
- **Announcement**: A message to residents with a title, body, optional attachments, an optional
  banner image, and a pinned flag.
- **Activity**: A scheduled event with a date, an optional maximum number of participants, and a
  banner image.
- **Visitor**: A person expected at the building, with a name, a status of Expected, Arrived, or
  Expired, a creation time, and an arrival time once marked arrived.
- **Folder**: A container for Documents and other (nested) Folders.
- **Document**: An uploaded file stored within a Folder.
- **Suggestion/Complaint**: Resident-submitted feedback of one of two types (Suggestion or
  Complaint), with a favorite flag and a discarded flag/timestamp.
- **Building Customization**: A building's accent color and square logo image.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Building Administrator can create a new facility with all its details in under 2
  minutes.
- **SC-002**: A Building Administrator can act on (approve or decline) a pending reservation
  request in under 30 seconds per request.
- **SC-003**: 100% of visitor records left unactioned for 8 hours automatically move to "Expired"
  status without any manual intervention.
- **SC-004**: 100% of discarded suggestions and complaints are permanently removed within 24-25
  hours of being discarded, without any manual intervention.
- **SC-005**: A Building Administrator can locate and open any uploaded document in 3 steps or
  fewer from the documentation home view.
- **SC-006**: Staff can view the visitor list and mark a visitor as arrived without being able to
  see or reach any other backoffice module.
- **SC-007**: A Building Administrator can complete branding customization (accent color and
  logo) in under 2 minutes.
- **SC-008**: In testing, Building Administrators and Staff never see or modify data belonging to
  a building other than their own — zero cross-building data exposure.

## Assumptions

- Resident-facing creation of reservation requests, visitor pre-registration, and suggestions or
  complaints is out of scope for this feature and is expected to be covered by a separate,
  not-yet-specified resident-facing feature. This spec assumes such records can already exist and
  focuses on how Building Administrators and Staff manage them.
- Staff is a role distinct from Building Administrator, limited to the Visitors module, and
  Resident is a distinct non-administrative account type — both are now formally defined in the
  project constitution (Principle II, v1.3.0) alongside App Administrator and Building
  Administrator, so no further constitution amendment is needed for this feature.
- A resident User is associated with exactly one Apartment at a time; an Apartment may have
  multiple associated Users (e.g., household members).
- Building creation and the assignment of a Building Administrator to a building are handled by a
  separate feature (per the project constitution) and are a prerequisite for this one, not part of
  it.
- Reservation time-slot conflicts (e.g., two approved reservations overlapping) are left to the
  Building Administrator's manual judgment during approval; the system does not automatically
  detect or block overlapping approvals in this version.
- A facility's opening hours apply uniformly every day; per-day scheduling is out of scope for
  this version.
- Building Administrators can read, favorite, and discard suggestions/complaints but cannot edit
  the resident-submitted content itself.
- Discarding a suggestion or complaint that is already discarded has no effect and does not reset
  its 24-hour deletion timer.
