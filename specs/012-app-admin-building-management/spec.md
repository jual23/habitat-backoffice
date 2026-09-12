# Feature Specification: App Administrator Building Management

**Feature Branch**: `012-app-admin-building-management`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "The App Administrator role does not need to see the features that the building admin and the staff see. The exception should be the Users module, because here they can create new Building Administrators. They also need the option to create new \"buildings\" and give them a name and logo, the same fields that go into the customization tab, but from a creation perspective. They can also assign and edit the Building Administrator user for that building."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Administrator sees only what applies to them (Priority: P1)

An App Administrator signs in and sees a navigation limited to what their role actually does — managing buildings and Building Administrators — instead of the full set of day-to-day building modules (Facilities, Incidencias, Finance, and so on) that belong to Building Administrators and Staff.

**Why this priority**: This is the foundational fix — every other capability in this feature lives inside the one module App Administrators keep. Today's broader navigation is actively misleading: an App Administrator can click into modules like Facilities or Finance and land on a "not available" message, because none of those modules apply without a specific building selected. Narrowing the navigation removes that confusion immediately, independent of any new capability being built.

**Independent Test**: Can be fully tested by signing in as an App Administrator and confirming the navigation shows only the Users module — no Panel, Facilities, Incidencias, Packages, Finance, Maintenance, Polls, Emergency, Broadcast, Documentation, Suggestions/Complaints, Apartments, Activities, Announcements, Reservations, Customization, or Visitors links — while a Building Administrator or Staff account signed in separately still sees their existing, unchanged navigation.

**Acceptance Scenarios**:

1. **Given** an App Administrator is signed in, **When** they view the backoffice navigation, **Then** the only module link shown is Users.
2. **Given** a Building Administrator or Staff account is signed in, **When** they view the backoffice navigation, **Then** it is unchanged from today — this feature does not remove or alter anything for those two roles.
3. **Given** an App Administrator navigates directly to a building-operational module's address (e.g., Facilities), **When** the page loads, **Then** they do not see that module's real content — they see the same "not available for this role" fallback that already exists today, or are guided back to Users.

---

### User Story 2 - App Administrator onboards a new building (Priority: P2)

An App Administrator creates a new building in the system — giving it a name and, optionally, a logo — and creates the account for the person who will administer it, all as one guided flow, so a new building is ready to use without any direct database work.

**Why this priority**: This is the core new capability this feature exists to deliver — bringing a new customer building into the system is currently only possible outside the app entirely. It depends on User Story 1's simplified navigation existing first (the Users module is where this flow lives), but is independently valuable and testable once that's in place.

**Independent Test**: Can be fully tested by signing in as an App Administrator, creating a new building with a name (and optionally a logo), creating its Building Administrator's account in the same flow, and then confirming that new Building Administrator can sign in and see only their own building's data.

**Acceptance Scenarios**:

1. **Given** an App Administrator is on the Users module, **When** they start creating a new building and provide at least a name, **Then** the building is created and appears in the list of buildings.
2. **Given** an App Administrator is creating a new building, **When** they also provide a logo, **Then** the logo is stored the same way a Building Administrator's logo upload is stored via Customization, and is visible once the building is created.
3. **Given** an App Administrator is creating a new building, **When** they choose to create a brand-new Building Administrator account and provide its details, **Then** a working account is created that can sign in and is scoped to that new building only, with no other building or module access beyond what a Building Administrator already has today.
4. **Given** an App Administrator is creating a new building, **When** they instead choose an existing Building Administrator from a dropdown list (someone who already administers a different building), **Then** that person gains Building Administrator access to the new building too, in addition to whatever building(s) they already administer — no new account is created.
5. **Given** an App Administrator submits the new-building form without a name, **When** they try to continue, **Then** the system rejects the submission and no building is created.

---

### User Story 3 - App Administrator manages existing buildings and their administrators (Priority: P3)

An App Administrator looks up an existing building, updates its name or logo, sees who its current Building Administrator is, and — when needed — reassigns that role to a different person.

**Why this priority**: This rounds out the lifecycle after User Story 2's creation flow — buildings and their administrators inevitably need updates (a rename, a logo change, staff turnover). It's lower priority than creation because a system with no way to fix a mistake or handle turnover is incomplete, but the initial onboarding capability (User Story 2) delivers value on its own first.

**Independent Test**: Can be fully tested by signing in as an App Administrator, opening an existing building, changing its name or logo, confirming the change is visible, then reassigning its Building Administrator to a different user and confirming the previous administrator no longer has that building's access while the new one does.

**Acceptance Scenarios**:

1. **Given** an App Administrator is viewing an existing building, **When** they update its name or logo and save, **Then** the change is reflected immediately wherever that building's name/logo is shown.
2. **Given** an App Administrator is viewing an existing building, **When** they look at its administration details, **Then** they can see which user currently holds the Building Administrator role for it.
3. **Given** an App Administrator reassigns a building's Building Administrator, **When** they choose either an existing Building Administrator from the dropdown or create a brand-new account and save, **Then** the new user has Building Administrator access to that building and the previous holder no longer does.
4. **Given** an App Administrator opens a building that has no Building Administrator (e.g., one that predates this feature), **When** they view it, **Then** it is clearly flagged as having no administrator, and they can assign one — from the existing-administrator dropdown or by creating a new account — in the same single action used for reassignment.

---

### Edge Cases

- What happens when an App Administrator tries to create a Building Administrator account with an email that's already registered? The system must reject it with a clear, friendly message (matching the existing "an account with this email already exists" pattern used for other account-creation flows) — no duplicate or partial account is created.
- What happens when a reassignment is attempted but the new Building Administrator's account creation/selection fails partway through? The building's existing Building Administrator (if any) must remain unchanged — a failed reassignment must not leave a building without an administrator.
- What happens if an App Administrator reassigns a building to a user who already administers a different building? This is allowed and is, in fact, the exact purpose of the existing-administrator dropdown — nothing in this feature restricts one person from administering more than one building.
- What happens if an App Administrator opens the existing-administrator dropdown while an App Administrator account exists in the system? App Administrator accounts never appear in that dropdown — only users who already hold the Building Administrator role somewhere are listed (see Assumptions for why).
- What happens to a building's existing residents, staff, facilities, and other data when its Building Administrator is reassigned? Nothing about that data changes — only the identity of who administers the building changes.
- What happens when an App Administrator opens the Users module while signed in? They see building/administrator-management content (this feature), not the resident/staff list a Building Administrator sees there today — the same navigation entry shows different content depending on which of these two roles is viewing it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST limit an App Administrator's visible backoffice navigation to the Users module only — every other module (Panel, Facilities, Incidencias, Packages, Finance, Maintenance, Polls, Emergency, Broadcast, Documentation, Suggestions/Complaints, Apartments, Activities, Announcements, Reservations, Customization, Visitors) MUST NOT appear in their navigation.
- **FR-002**: The system MUST leave Building Administrator's and Staff's navigation and module access completely unchanged by this feature.
- **FR-003**: When an App Administrator opens the Users module, the system MUST show building- and Building-Administrator-management content, distinct from the resident/staff-management content a Building Administrator sees at that same navigation entry.
- **FR-004**: The system MUST let an App Administrator view a list of all buildings in the system.
- **FR-005**: The system MUST let an App Administrator create a new building, requiring at minimum a name; a logo MAY optionally be provided at creation time, using the same upload behavior as the existing Customization module's logo field.
- **FR-006**: The system MUST let an App Administrator assign that new building's Building Administrator as part of the same building-creation flow, either by (a) creating a brand-new account, or (b) selecting an existing Building Administrator (someone who already administers a different building) from a dropdown list — a building is never left without an administrator once creation completes.
- **FR-007**: The system MUST let an App Administrator edit an existing building's name and logo after creation.
- **FR-008**: The system MUST let an App Administrator see which user currently holds the Building Administrator role for a given building.
- **FR-009**: The system MUST let an App Administrator reassign a building's Building Administrator — including a building that currently has none — to a different user, either a newly created account or an existing Building Administrator selected from a dropdown list (the same choice offered at creation, FR-006), replacing whoever previously held that role for that building, if anyone.
- **FR-010**: When a building's Building Administrator is reassigned, the previous holder's Building Administrator access to that specific building MUST end immediately.
- **FR-011**: The system MUST NOT allow a building to exist without exactly one designated Building Administrator at any given time, from the moment the building is created onward. A building that already lacks one (e.g., one that predates this feature) MUST be clearly flagged as such, and MUST be assignable one via the same single action used for reassignment (FR-009) — closing the gap rather than only preventing new ones.
- **FR-012**: Creating a Building Administrator account MUST follow the same account-safety behavior already used for other account-creation flows in the system (e.g., rejecting duplicate emails with a friendly message, and never leaving a partially-created account behind on failure).
- **FR-013**: The existing-Building-Administrator dropdown (FR-006, FR-009) MUST list only users who currently hold the Building Administrator role for at least one building — it MUST NOT include App Administrator accounts, even though App Administrator is technically also an administrative role.

### Key Entities

- **Building**: Represents a single property/customer the system manages. Key attributes relevant to this feature: name, logo, and exactly one associated Building Administrator (its current administrator). Already exists in the system; this feature adds the ability to create and edit it through the app rather than requiring direct database access.
- **Building Administrator (assignment)**: The relationship between one user account and the one building they administer. A building has exactly one at a time; this feature adds the ability to establish and change that relationship through the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of an App Administrator's visible navigation entries are the Users module — zero building-operational modules appear for that role.
- **SC-002**: An App Administrator can take a brand-new building from nonexistent to fully usable — created, named, with a working Building Administrator account — in one guided flow, without any direct database or developer intervention.
- **SC-003**: Every building created through this feature starts with exactly one identifiable Building Administrator, and any building found without one — including one that predates this feature — can be given one in a single self-service action, with no building ever silently staying administrator-less.
- **SC-004**: An App Administrator can reassign a building's administrator as a single self-service action, without contacting technical support.
- **SC-005**: Building Administrator and Staff accounts show no change in navigation, module access, or day-to-day behavior after this feature ships.

## Assumptions

- "The features that the building admin and the staff see" refers to the operational, building-scoped modules (Facilities, Incidencias, Packages, Finance, and so on) — not the Users module itself, which App Administrators keep with different, role-appropriate content (FR-003).
- The building creation/edit fields are name (required, new) and logo (optional, reusing the existing Customization module's logo upload behavior). Other Customization-tab fields (e.g., accent color) are not part of this feature's creation/edit form — a newly created building keeps Customization's existing default until its Building Administrator changes it themselves via Customization, exactly as happens today.
- A building has exactly one Building Administrator at a time (FR-011); the same person may administer more than one building — this feature does not restrict that.
- Reassigning a building's Building Administrator takes effect immediately and does not require the previous administrator's confirmation or involve a transition/overlap period.
- Deleting a building entirely is out of scope for this feature — only creating and editing buildings and their administrator assignment are covered. Building deletion, if needed later, is a separate feature (the constitution already treats it as a high-impact, audit-logged operation warranting its own care).
- Creating a Building Administrator account follows the same technical pattern already used for creating Staff/Resident accounts elsewhere in the system (an immediately-usable account with admin-set credentials, not a self-service invite/signup).
- This feature does not change what a Building Administrator or Staff account can do — it only changes what an App Administrator sees and can do, and adds the building/administrator data those other roles' buildings depend on.
- App Administrator accounts are deliberately excluded from the existing-administrator dropdown (FR-013), not just as a scope choice but because the system already resolves a signed-in user's role by checking for App Administrator first — a person who held both roles would always be treated as App Administrator and could never actually use the Building Administrator access a dropdown selection would otherwise grant them for that building. This feature does not change that role-resolution behavior.

