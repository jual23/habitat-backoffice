# Feature Specification: Facility Status, Incidencias & Package Receipt

**Feature Branch**: `[004-facilities-incidencias-packages]`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "In the facilites view, the card shows a bubble in the upper right corner, this bubble should indicate if the space is open (green) or closed (red). The facilities table also has a capacity, although when there is a reservation the full capacity is used so it's redundant and not needed. Staff and Building Admin should have a view where they can see and manage maintenance/service requests called Incidencias. This view should load tickets from the supabase database and display as a table. The table should show the title, the date it was created, and the current status. Should able to sort by each column, and also filter by status. The status should be Pending when it's new. In progress when staff is working on it, rejected and resolved. If the ticket is rejected the user has to input a reason as to why it's not going to be worked on. It should also have the option to be marked as a duplicate, which case the user can select another ticket to refer. Duplicate would be it's status and should link to the open ticket. 'in progress' tickets should allow to user to leave a comment as an update that the resident can see. The backoffice should have a package receipt module. The Staff user has a button to register a new package, this opens a small form where they fill Apartment (Should be a dropdown with the preexisting apartments unit_number), a text input for a short description and optional field to upload a photo. This sends a notification to the residents of the selected apartment. Once the package is retrieved by the resident the Staff user can mark it as Picked Up (Recogido, in spanish)"

**Access**: Staff and Building Administrator can access all capabilities described below (facility status indicator, Incidencias management, package receipt module), scoped to their assigned building(s) per the multi-tenant isolation rule. App Administrator retains its cross-building oversight by existing convention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Triage and resolve maintenance requests (Incidencias) (Priority: P1)

Staff and Building Administrators need a single place to see every maintenance/service request ("Incidencia") raised for their building, understand which ones are new, which are being worked on, and which are closed out — and to move each one through its lifecycle (start work, reject with a reason, flag as a duplicate of another request, resolve) while keeping the resident who filed it informed.

**Why this priority**: This is the core operational workflow — without it, requests have no visible queue or resolution path. It delivers value on its own even before the facility-card tweak or the package module exist.

**Independent Test**: Can be fully tested by opening the Incidencias view, confirming existing tickets load from the database into a sortable/filterable table, and walking one ticket through Pending → In Progress (with a resident-visible comment) → Resolved, and a second ticket through Pending → Rejected (with a required reason) and a third through Pending → Duplicate (linked to another ticket).

**Acceptance Scenarios**:

1. **Given** a building has maintenance tickets in various statuses, **When** a Staff or Building Admin user opens the Incidencias view, **Then** they see a table listing each ticket's title, creation date, and current status, scoped only to their building.
2. **Given** the Incidencias table is showing multiple tickets, **When** the user clicks the "Title", "Date", or "Status" column header, **Then** the table re-sorts by that column, and clicking the same header again reverses the sort direction.
3. **Given** the Incidencias table is showing tickets of every status, **When** the user selects a status filter (e.g., "Pending"), **Then** only tickets currently in that status are shown.
4. **Given** a ticket is in "Pending" status, **When** a Staff/Admin user begins work on it, **Then** its status changes to "In Progress".
5. **Given** a ticket is "In Progress", **When** the Staff/Admin user adds a comment, **Then** the comment is saved as an update visible to the resident who filed the ticket.
6. **Given** a Staff/Admin user decides not to work on a ticket, **When** they choose to reject it, **Then** they must enter a rejection reason before the status can be set to "Rejected", and that reason is visible to the resident.
7. **Given** a ticket duplicates an existing Pending or In Progress ticket, **When** the Staff/Admin user marks it as a duplicate and selects that other ticket, **Then** its status becomes "Duplicate" and it displays a link to the referenced ticket.
8. **Given** a ticket is currently "In Progress" and work on it is complete, **When** the Staff/Admin user marks it resolved, **Then** its status changes to "Resolved". A ticket cannot be marked "Resolved" directly from "Pending" — it must pass through "In Progress" first.

---

### User Story 2 - Register and track package receipt (Priority: P2)

Staff need to log packages that arrive for residents, notify the right household immediately, and later mark the package as collected once the resident picks it up, so there is a clear record of what has arrived and what is still waiting at the front desk/office.

**Why this priority**: Package handling is a distinct, self-contained front-desk workflow that adds day-to-day value independent of the Incidencias queue or the facilities card, and can be built and validated on its own.

**Independent Test**: Can be fully tested by registering a new package for a chosen apartment (with and without a photo), confirming the residents of that apartment receive a notification, then marking the package "Recogido" and confirming its status updates.

**Acceptance Scenarios**:

1. **Given** a Staff user is on the package receipt module, **When** they click the button to register a new package, **Then** a form opens asking for Apartment (a dropdown of existing apartment unit numbers), a short description, and an optional photo.
2. **Given** the Staff user submits the form with a valid apartment and description, **When** the package is saved, **Then** it appears in the package list with a "Pending pickup" status, and every resident associated with that apartment receives a notification that a package has arrived.
3. **Given** the Staff user submits the form without a photo, **When** the package is saved, **Then** it is still recorded successfully — the photo is optional.
4. **Given** a package is awaiting pickup, **When** the resident retrieves it and the Staff user marks it "Recogido" (Picked Up), **Then** the package's status updates to reflect it has been collected and it can be distinguished from packages still pending.

---

### User Story 3 - See facility open/closed status at a glance and a simpler facility form (Priority: P3)

Staff/Admins and anyone browsing the facilities view need to tell, without opening each facility, whether it is currently open or closed for use, via a colored status bubble on the facility card. Additionally, the capacity field is removed from the facility form and card since a reservation always occupies the facility's entire capacity, making a separate capacity number redundant.

**Why this priority**: This is a smaller, presentation-layer refinement to an existing module. It improves usability but does not block the higher-value ticket and package workflows above, so it is the lowest priority of the three.

**Independent Test**: Can be fully tested by viewing the facilities grid at a time when a facility is within its open hours/days (bubble shows green) and at a time when it is outside them (bubble shows red), and by confirming the facility create/edit form and card no longer show or ask for a capacity value.

**Acceptance Scenarios**:

1. **Given** the current day and time fall within a facility's configured open days and hours, **When** the facilities view is displayed, **Then** that facility's card shows a green status bubble in its upper-right corner.
2. **Given** the current day and time fall outside a facility's configured open days and hours, **When** the facilities view is displayed, **Then** that facility's card shows a red status bubble in its upper-right corner.
3. **Given** a Staff/Admin user opens the facility create or edit form, **When** the form is displayed, **Then** there is no capacity field to fill in.
4. **Given** an existing facility card, **When** it is displayed, **Then** it no longer shows a capacity/"Cupo" value.

---

### Edge Cases

- A facility whose open hours span midnight (e.g., opens 22:00, closes 02:00) — the open/closed bubble must still evaluate correctly at hours past midnight.
- A facility with no open days configured is always shown as closed (red).
- A ticket is marked "Duplicate" and referenced against a ticket that is itself later rejected, resolved, or also marked duplicate — the link should still resolve to whatever ticket was selected, even if that ticket's own status later changes (this only affects tickets that were already validly linked; see below for restrictions at the moment a link is created).
- A ticket cannot be marked as a duplicate of itself.
- The duplicate-ticket picker only offers tickets currently "Pending" or "In Progress" as a valid target — a ticket that is already "Resolved", "Rejected", or itself "Duplicate" cannot be selected as the ticket being duplicated.
- Rejecting a ticket without entering a reason must be blocked until a reason is provided.
- Attempting to mark a ticket "Resolved" while it is still "Pending" (i.e., skipping "In Progress") must be blocked — a ticket must be moved to "In Progress" first.
- An apartment has more than one resident account — all residents of that apartment receive the package-arrival notification, not just one.
- An apartment has zero resident accounts at the time a package is registered for it — the package is still recorded, simply with no one to notify.
- A photo upload for a package fails or is too large — the package registration should still be completable without the photo, or the user should see a clear error naming the problem.
- Two Staff/Admin users act on the same ticket or package at nearly the same time — the second action should not silently overwrite the first without the second user seeing the current state.
- Sorting and filtering the Incidencias table are used together (e.g., filter to "Rejected" then sort by date) — both should apply at once.

## Requirements *(mandatory)*

### Functional Requirements

**Incidencias (maintenance/service request management)**

- **FR-001**: System MUST provide a view, accessible to Staff and Building Administrator roles, listing maintenance/service request tickets ("Incidencias") loaded from the database, scoped to the user's building(s) per the multi-tenant isolation rule.
- **FR-002**: The Incidencias table MUST display, at minimum, each ticket's title, creation date, and current status.
- **FR-003**: Users MUST be able to sort the table by title, creation date, or status, in ascending or descending order.
- **FR-004**: Users MUST be able to filter the table by status.
- **FR-005**: Every new ticket MUST start in "Pending" status.
- **FR-006**: A Staff/Admin user MUST be able to move a ticket from "Pending" to "In Progress" to indicate work has started.
- **FR-007**: While a ticket is "In Progress", a Staff/Admin user MUST be able to add a comment that is visible to the resident who filed the ticket, as a status update.
- **FR-008**: A Staff/Admin user MUST be able to set a ticket's status to "Rejected", and MUST be required to enter a rejection reason before the rejection is saved; the reason MUST be visible to the resident who filed the ticket.
- **FR-009**: A Staff/Admin user MUST be able to mark a ticket as "Duplicate" and, when doing so, MUST select another existing ticket it duplicates, limited to tickets currently "Pending" or "In Progress" (a ticket already "Resolved", "Rejected", or itself "Duplicate" MUST NOT be selectable as the target); the duplicate ticket MUST display a link to the referenced ticket.
- **FR-010**: A Staff/Admin user MUST be able to set a ticket's status to "Resolved" once work is complete, but only when the ticket is currently "In Progress" — a direct "Pending" → "Resolved" transition MUST be blocked.
- **FR-011**: The set of ticket statuses is exactly: Pending, In Progress, Rejected, Resolved, Duplicate.
- **FR-012**: The Incidencias view MUST NOT show tickets belonging to a different building than the acting Staff/Admin user's assigned building(s).

**Package receipt module**

- **FR-013**: The backoffice MUST provide a package receipt module accessible to the Staff role (and Building Administrator, consistent with their broader access) for registering and tracking packages.
- **FR-014**: The module MUST provide a control to register a new package that opens a form capturing: Apartment (selected from a dropdown of the building's existing apartment unit numbers), a short text description, and an optional photo.
- **FR-015**: Submitting the form without a photo MUST still successfully register the package.
- **FR-016**: Registering a package MUST send a notification to every resident associated with the selected apartment.
- **FR-017**: A registered package MUST default to a "pending pickup" state, distinguishable in the module from packages already collected.
- **FR-018**: A Staff/Admin user MUST be able to mark a pending package as "Recogido" (Picked Up) once the resident has retrieved it, after which it is shown as collected.

**Facilities view**

- **FR-019**: Each facility card in the facilities view MUST display a status bubble in its upper-right corner indicating whether the facility is currently open (green) or closed (red), based on the facility's configured open days and hours.
- **FR-020**: The facility create/edit form MUST NOT include a capacity field.
- **FR-021**: The facility card and any other facility display MUST NOT show a capacity value.

### Key Entities

- **Incidencia (Maintenance Ticket)**: A maintenance/service request tied to a building and to the resident/apartment that raised it. Key attributes: title, description, creation date, current status (Pending, In Progress, Rejected, Resolved, Duplicate), rejection reason (present only when Rejected), and a reference to another ticket (present only when Duplicate).
- **Ticket Update/Comment**: A timestamped comment left by Staff/Admin on a ticket while it is In Progress, visible to the resident who filed the ticket.
- **Package**: A parcel logged at the front desk for a specific apartment. Key attributes: apartment reference, short description, optional photo, pickup status (pending / picked up "Recogido"), who registered it, and when.
- **Facility** *(existing entity, modified)*: A bookable common area. Its capacity attribute is removed from the creation/edit experience and from display; its existing open-days/open-hours schedule is used to derive the open/closed status bubble.
- **Apartment / Resident** *(existing entities, referenced)*: Apartments provide the unit-number list for the package form's dropdown; residents associated with an apartment are the recipients of package-arrival notifications and the viewers of ticket comments/rejection reasons for tickets they filed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff/Admin users can determine the status of any maintenance request (Pending, In Progress, Rejected, Resolved, Duplicate) within a single view without opening each ticket individually.
- **SC-002**: 100% of tickets shown in the Incidencias view reflect the current data stored in the database at the time the view is loaded.
- **SC-003**: A rejected ticket always carries a visible reason; 0% of rejected tickets have a missing or blank reason.
- **SC-004**: Every duplicate-marked ticket links to exactly one other ticket, resolvable with a single click/tap.
- **SC-005**: Residents of an apartment receive a package-arrival notification for 100% of packages registered against their apartment.
- **SC-006**: Staff can register a new package by filling in only three inputs (apartment, description, optional photo), with no additional steps or lookups required.
- **SC-007**: A facility's open/closed bubble matches its configured schedule 100% of the time it is displayed, without requiring the viewer to look up the facility's hours separately.
- **SC-008**: Creating or editing a facility requires one fewer field (no capacity entry) than before, with no loss of information residents or staff relied on.

## Assumptions

- Maintenance tickets ("Incidencias") are created by residents through an existing or separate resident-facing channel outside this feature's scope; this feature covers only the Staff/Building Administrator view for triaging and managing tickets that already exist in the database.
- The Incidencias status filter allows narrowing to one status at a time (plus an "all statuses" default view); multi-status filtering is not required for this feature.
- Resident-visible ticket comments and rejection reasons are surfaced to residents through whatever existing resident-facing surface they already use to track their own tickets; this feature is responsible for capturing and storing that content, not for building a new resident-facing screen.
- Package-arrival notifications use the product's existing in-app notification mechanism (the same one used elsewhere in the system), not email, SMS, or push notifications.
- "Residents of the selected apartment" means every resident account currently associated with that apartment, which may be more than one.
- A facility's open/closed status is derived automatically from its existing configured open days and open/close hours (no new manual "temporarily closed" override is introduced by this feature).
- Removing the capacity field applies to the facility creation/edit form and to every place a facility's capacity was previously displayed; historical reservation records are unaffected.
- Both Staff and Building Administrator have identical capabilities within the Incidencias and package-receipt modules described here; no additional approval step separates the two roles for these actions.
