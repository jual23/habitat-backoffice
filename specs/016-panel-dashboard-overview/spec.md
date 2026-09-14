# Feature Specification: Panel Dashboard Overview

**Feature Branch**: `016-panel-dashboard-overview`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "The welcome panel of the app should provide more useful information. The attached image is a reference, but not definitive. The top has to show main stats in small card format. Total number of Residents (Sum of owner + rented). Number of 'Incidencias' received today. Number of 'Paqueteria' received today. Number of 'Visitas' of today. Below we will split the layout in 2 columns. The left block will show the latest 5 activities such as new visit, new package, new emergency, new suggestion, etc. And the right side should show a summary of the open incidents, packages received but not handed over to owner. Number of complaints/suggestions that haven't been read. Reservation requests in progress. When the admin or staff clicks on these it should open the appropriate module."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - At-a-glance daily snapshot (Priority: P1)

A Building Administrator opens the Panel (the app's landing/welcome screen) at the start of the day and immediately sees, without navigating anywhere, how many residents live in the building, how many incidencias, packages, and visits came in today.

**Why this priority**: This is the core value of the feature — turning the welcome screen from a generic navigation shortcut list into a real operational snapshot. Without it, the rest of the feature (activity feed, pending-items summary) has nothing to anchor to.

**Independent Test**: Can be fully tested by seeding a building with a known number of residents and today's incidencias/packages/visits, opening the Panel, and confirming each of the four stat cards shows the correct count.

**Acceptance Scenarios**:

1. **Given** a building with 120 owner-occupied apartments and 30 rented apartments each having one resident/renter profile, **When** the Building Administrator opens the Panel, **Then** the "Residentes" card shows 150 (owners + renters combined).
2. **Given** 3 incidencias were reported today and 12 more remain open from previous days, **When** the Panel loads, **Then** the "Incidencias" card shows 3 (today's count only).
3. **Given** 2 packages were logged today, **When** the Panel loads, **Then** the "Paquetería" card shows 2.
4. **Given** 1 visitor pass was registered for today, **When** the Panel loads, **Then** the "Visitas" card shows 1.
5. **Given** no incidencias, packages, or visits were recorded today, **When** the Panel loads, **Then** each respective card shows 0 rather than an error or blank state.

---

### User Story 2 - Recent activity feed (Priority: P2)

A Building Administrator or Staff member wants to know what has just happened in the building without opening every module one by one, so they scan a single chronological list of the 5 most recent operational events.

**Why this priority**: Gives situational awareness beyond the day's totals (User Story 1) — it shows *what* happened, not just *how many*. It depends on the panel layout established in User Story 1 but is independently valuable and testable on its own.

**Independent Test**: Can be fully tested by creating events of different types (a visit, a package, an incidencia, an emergency, a suggestion) at different times, opening the Panel, and confirming the 5 most recent appear in correct chronological order (newest first), each identifying its type.

**Acceptance Scenarios**:

1. **Given** more than 5 qualifying events exist across all tracked types, **When** the Panel loads, **Then** exactly the 5 most recent are shown, newest first.
2. **Given** fewer than 5 qualifying events exist in the building's history, **When** the Panel loads, **Then** only those events are shown (no placeholders for missing ones).
3. **Given** a new package was just registered, **When** the Panel loads, **Then** the feed shows an entry identifying it as a package event with a relative timestamp (e.g., "hace 10 min").
4. **Given** no qualifying events have ever occurred in the building, **When** the Panel loads, **Then** the feed shows an empty-state message instead of an error.

---

### User Story 3 - Pending-items summary with direct navigation (Priority: P2)

A Building Administrator or Staff member wants to know how much unfinished work is waiting across modules, and jump straight into the relevant module to act on it, instead of checking each module's page individually to find out if anything needs attention.

**Why this priority**: Converts awareness into action. Equally important as the activity feed (User Story 2) for making the Panel a genuine daily-work starting point, and is independently testable.

**Independent Test**: Can be fully tested by seeding open incidencias, undelivered packages, unread suggestions/complaints, and in-progress reservation requests, opening the Panel, confirming each summary row shows the correct count, and confirming clicking a row navigates to that row's module.

**Acceptance Scenarios**:

1. **Given** 8 incidencias are currently open (pending or in progress), **When** the Panel loads, **Then** the summary shows "Incidencias: 8".
2. **Given** 6 packages have been logged but not yet picked up by their resident, **When** the Panel loads, **Then** the summary shows "Paquetería por entregar: 6".
3. **Given** 3 suggestions/complaints have not yet been reviewed, **When** the Panel loads, **Then** the summary shows "Quejas y sugerencias: 3".
4. **Given** 5 reservation requests are awaiting a decision, **When** the Panel loads, **Then** the summary shows "Reservas de instalaciones: 5".
5. **Given** the Building Administrator clicks the "Incidencias" summary row, **When** the click is registered, **Then** they are taken to the Incidencias module.
6. **Given** any pending-item count is zero, **When** the Panel loads, **Then** that row still displays with a value of 0 rather than being hidden.
7. **Given** a suggestion/complaint has never been opened by any Building Administrator or Staff member, **When** the Panel loads, **Then** it counts toward the unread total; once someone opens it in the Quejas y sugerencias module, it no longer counts.

---

### User Story 4 - Role-appropriate panel for Staff (Priority: P3)

A Staff member (who today cannot open the Panel at all) opens the app and sees a version of the same dashboard, but limited to the stats, activity types, and pending-item summaries for the modules Staff is allowed to use (Visitantes, Incidencias, Paquetería, Emergencias).

**Why this priority**: Extends the value of User Stories 1–3 to Staff, who were previously excluded from the Panel entirely. Lower priority than the Building Administrator experience because Staff is a narrower, secondary audience, but still required by the feature request ("admin or staff").

**Independent Test**: Can be fully tested by logging in as Staff, opening the Panel, and confirming only stat cards, activity entries, and summary rows for Staff's permitted modules appear (no Residents count, no Reservations, no Suggestions/Complaints), each still linking to its module.

**Acceptance Scenarios**:

1. **Given** a Staff member logs in, **When** they land on the Panel, **Then** they are no longer redirected away and instead see the dashboard.
2. **Given** the Staff member views the Panel, **When** the stat cards render, **Then** the "Residentes" card is not shown (Staff has no Residents/Users access).
3. **Given** the Staff member views the pending-items summary, **When** it renders, **Then** it does not include "Reservas de instalaciones" or "Quejas y sugerencias" rows (outside Staff's module access).
4. **Given** an incidencia was reported today, **When** the Staff member views the activity feed, **Then** it appears the same way it would for a Building Administrator.

---

### Edge Cases

- What happens when a building has zero apartments/residents at all (a newly created building)? All four top stat cards and both columns must render with 0 / empty-state, not errors.
- What happens at the exact boundary of "today" (e.g., an incidencia reported at 11:59 PM vs. 12:01 AM)? Each event counts toward "today" based on the calendar day it was created in, consistent with how the rest of the system already resolves day boundaries.
- What happens when the Building Administrator or Staff member has no permission to one of the underlying modules (e.g., a future role variant)? That stat card, activity type, or summary row is simply omitted rather than shown with an error or a locked icon.
- What happens if an activity's source record is deleted after being registered but before the Panel is viewed? It is simply excluded from the feed (feed always reflects current data, not a permanent log).
- What happens when two or more events happen at the exact same timestamp? Ties are broken consistently (e.g., stable secondary ordering) so the feed does not visibly reorder itself between loads.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Panel MUST display four summary cards at the top: total Residents, Incidencias received today, Paquetería received today, and Visitas registered for today.
- **FR-002**: The "Residentes" card MUST count every occupant profile in the building regardless of whether they are the apartment's owner or a renter.
- **FR-003**: The "Incidencias" card MUST count incidencias created on the current calendar day, regardless of their current status.
- **FR-004**: The "Paquetería" card MUST count packages logged on the current calendar day, regardless of whether they have since been picked up.
- **FR-005**: The "Visitas" card MUST count visitor passes registered for the current calendar day, regardless of arrival status.
- **FR-006**: Below the stat cards, the Panel MUST present two side-by-side sections: a recent-activity feed (left) and a pending-items summary (right).
- **FR-007**: The recent-activity feed MUST show the 5 most recent operational events across visits, packages, incidencias, emergencies, and suggestions/complaints, ordered newest first, each labeled with its type and a relative timestamp.
- **FR-008**: When fewer than 5 qualifying events exist, the feed MUST show only the events that exist; when none exist, it MUST show an empty-state message.
- **FR-009**: The pending-items summary MUST show: the count of currently open incidencias (pending or in progress), the count of packages logged but not yet picked up, the count of unreviewed suggestions/complaints, and the count of reservation requests awaiting a decision.
- **FR-010**: Every pending-item summary row MUST display even when its count is 0.
- **FR-011**: Clicking any stat card, activity feed entry, or pending-items summary row MUST navigate the user to the corresponding module (Residents/Users, Incidencias, Paquetería, Visitantes, Emergencias, Quejas y sugerencias, or Reservas, as applicable).
- **FR-012**: The Panel MUST be reachable by both the Building Administrator and Staff roles (Staff was previously unable to open it).
- **FR-013**: For Staff, the Panel MUST omit any stat card, activity type, or pending-item row belonging to a module Staff does not have access to (per the system's existing role permissions), while still functioning correctly for the modules Staff can use.
- **FR-014**: All counts and activity entries MUST be scoped to the viewer's own building, consistent with the system's existing multi-tenant data isolation.
- **FR-015**: A complaint or suggestion MUST be tracked as "unread" from the moment it is submitted until a Building Administrator or Staff member opens/views it in the Quejas y sugerencias module, at which point it becomes "read." The Panel's unread count reflects entries that have not yet been opened by anyone.

### Key Entities

- **Resident/Renter profile**: An occupant account tied to exactly one apartment; contributes to the Residents count regardless of owner/renter distinction.
- **Incidencia (ticket)**: A maintenance/service request; has a status (open states: pending, in progress; closed states: resolved, rejected, duplicate) and a creation time used for "today" and for the open-incidents summary.
- **Package**: A delivery logged at the building; has a status (logged/pending vs. picked up) and a creation time used for "today" and for the not-yet-delivered summary.
- **Visit (visitor pass)**: A pre-authorized or logged visitor entry; has a creation/registration time used for "today."
- **Emergency report**: A resident-reported emergency; contributes to the activity feed only (not a top stat card).
- **Suggestion/Complaint**: Resident feedback of type suggestion or complaint; has a read/unread state (unread until first opened by a Building Administrator or Staff member) used for the unread-count summary, and contributes to the activity feed.
- **Reservation request**: A facility booking request; has a status (requested, approved, declined, cancelled) used for the in-progress summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Building Administrator or Staff member can determine the day's incidencia, package, and visit volumes within 5 seconds of opening the Panel, without visiting any other screen.
- **SC-002**: 100% of the pending-item summary rows and activity feed entries navigate to the correct module when clicked.
- **SC-003**: The Panel correctly reflects a newly created building with no activity yet (all zero/empty states, no errors) in 100% of cases.
- **SC-004**: Staff members gain the ability to view a working Panel (previously 0% could access it) scoped strictly to their permitted modules.
- **SC-005**: The four top-level counts and the pending-items summary match the counts a user would get by manually opening each corresponding module and counting/filtering there, in 100% of spot checks.

## Assumptions

- "Today" is resolved using the same calendar-day boundary convention already used elsewhere in the system (e.g., the existing day-boundary handling used for scheduled/overdue processing), scoped to the building.
- The recent-activity feed covers exactly five event types — visits, packages, incidencias, emergencies, and suggestions/complaints — reflecting the types the request named plus incidencias (since it is also a headline stat); reservations, broadcasts, polls, maintenance, and announcements are out of scope for the feed in this iteration.
- "Reservation requests in progress" means requests with a status of "requested" (i.e., awaiting an administrator's approval/decline decision), matching the status already used by the Reservations module.
- "Open incidencias" means incidencias with a status of "pending" or "in progress," matching the definition already used by the Incidencias module.
- "Packages not yet handed over" means packages with a status of "pending" (not yet picked up), matching the definition already used by the Paquetería module.
- App Administrators (who are not scoped to a single building) continue to see the existing message indicating the Panel is unavailable to them; this feature does not add a cross-building or multi-building variant of the dashboard.
- The activity feed reflects live data at the time the Panel is loaded (it is not a permanent, un-editable audit trail); if a source record is later removed, it no longer appears.
- Visual layout (card styling, colors, exact spacing) follows the existing Panel/app design system; the attached reference image informs general structure (stat cards on top, two columns below) but not exact colors, fonts, or spacing.
