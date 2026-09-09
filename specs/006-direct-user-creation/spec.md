# Feature Specification: Direct User Creation (Replacing Invitations)

**Feature Branch**: `006-direct-user-creation`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Inside of the users and roles view, the administrator, instead of
'inviting' should simply create a user. Name and lastname should be 2 different fields. Should
have a document field for id. And a password field to set a temporary password. This will
register the user in supabase. When the user logs in for the first time from the mobile app they
will need to change their password, this behaviour already happens."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a resident or staff account directly (Priority: P1)

As a Building Administrator on the Usuarios y roles (Users and Roles) page, I create a new
resident or staff account by filling in their first name, last name, document/ID number, email,
and a temporary password — and when I submit, that person has a real account they can sign into
the mobile app with right away, instead of an "invitation" sitting in a pending state until they
accept it themselves.

**Why this priority**: This is the entire behavior change requested — replacing the
invite-and-wait model with immediate account creation is the feature. Everything else (new fields,
account provisioning) exists to serve this one outcome.

**Independent Test**: As a Building Administrator, fill in the creation form for a resident (first
name, last name, document, email, apartment, temporary password) and submit. Confirm the person
now appears in the Residente list as an active resident (not a "pendiente" row), and that signing
in with the email and temporary password succeeds immediately. Repeat for a Staff account (same
fields, minus apartment).

**Acceptance Scenarios**:

1. **Given** a Building Administrator on the Usuarios y roles page, **When** they choose to create
   a new user and select "Residente", **Then** the form asks for first name, last name, document
   ID, email, apartment, and a temporary password (all required) instead of the current
   email-and-optional-name invitation form.
2. **Given** the Building Administrator fills in all required fields with valid values and
   submits, **When** the creation completes, **Then** the new resident appears immediately in the
   Residente list as a full member (not a pending invitation), and no "pendiente" state is shown
   for this person.
3. **Given** the same completed creation, **When** that person opens the mobile app and signs in
   with the email and the temporary password the administrator set, **Then** sign-in succeeds and
   they are prompted to set a permanent password before continuing (existing mobile app behavior,
   unchanged by this feature).
4. **Given** a Building Administrator selects "Personal" (Staff) instead of "Residente", **When**
   they fill in first name, last name, document ID, email, and a temporary password (no apartment
   needed) and submit, **Then** the new Staff account is created immediately and can sign in the
   same way as Scenario 3.
5. **Given** a Building Administrator attempts to create a user with an email address that already
   has an account, **When** they submit, **Then** the system rejects the submission with a clear
   message and creates nothing.
6. **Given** a Building Administrator submits the form with a temporary password that doesn't meet
   the minimum password requirements, **When** they submit, **Then** the system rejects the
   submission with a clear message and creates nothing.

---

### User Story 2 - Correct a resident's identity details after creation (Priority: P2)

As a Building Administrator, I can go back and correct a resident's first name, last name, or
document ID after their account was created (in addition to the apartment and email fields I can
already edit today), since these are now real identity fields captured at creation time and typos
happen.

**Why this priority**: Valuable but not required for the core behavior change to ship — creation
working correctly (User Story 1) delivers the primary value on its own. This closes an obvious gap
that would otherwise leave new required fields permanently uneditable.

**Independent Test**: Edit an existing resident's first name, last name, or document ID and save;
confirm the updated values are reflected in the Residente list afterward.

**Acceptance Scenarios**:

1. **Given** an existing resident, **When** a Building Administrator edits their first name, last
   name, or document ID and saves, **Then** the updated values are reflected in the Residente list.
2. **Given** an edit that would leave the first name, last name, or document ID blank, **When** the
   Building Administrator attempts to save, **Then** the system rejects the change and keeps the
   previous value.

---

### Edge Cases

- Accounts created via invitation before this feature shipped remain visible/cancelable exactly as
  they behave today — this feature changes how *new* accounts are created, it does not retroactively
  convert or remove any already-pending invitation.
- A Building Administrator leaves the document ID, first name, or last name blank: the system
  blocks creation with a clear message identifying the missing field(s), the same way it already
  blocks creation today when the email or apartment is missing.
- Two different people are created with the same document ID: the system does not need to detect
  or block this — document ID is stored for identification/reference, not used as a uniqueness key
  (see Assumptions).
- A Building Administrator creates a Staff account: the document ID and password fields behave
  identically to the Resident flow; only the apartment field is omitted, exactly as today's
  invitation form already omits apartment for Staff.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Users and Roles page MUST replace the current "invite" action (for both Resident
  and Staff roles) with a "create user" action that provisions a real, immediately usable account —
  no pending/invited intermediate state is created for new submissions.
- **FR-002**: The creation form MUST capture first name and last name as two separate inputs (not
  one combined "name" field), and the system MUST retain them as distinguishable values it can
  display separately or combined, rather than merging them into a single value that can't be told
  apart again.
- **FR-003**: The creation form MUST capture a document/ID number for the person being created, in
  addition to the fields already captured today (email, apartment for residents).
- **FR-004**: The creation form MUST capture a temporary password chosen by the Building
  Administrator, which becomes that account's initial sign-in password.
- **FR-005**: Submitting the creation form with valid, complete input MUST immediately create an
  account capable of signing in with the given email and temporary password — the person does not
  need to take any separate "accept" step first.
- **FR-006**: The system MUST require first name, last name, document ID, email, and temporary
  password for every new account, and MUST additionally require an apartment selection when the
  role being created is Resident (matching today's requirement).
- **FR-007**: The system MUST reject creation, with a clear error and no account created, when the
  given email address already belongs to an existing account.
- **FR-008**: The system MUST reject creation, with a clear error and no account created, when the
  temporary password does not meet the minimum password strength the system already enforces
  elsewhere for account passwords.
- **FR-009**: Only a Building Administrator (for their own building) may create Resident or Staff
  accounts this way — this does not change who is authorized, only how the account comes into
  existence, matching the existing restriction that Staff and Resident accounts are provisioned
  only by a Building Administrator.
- **FR-010**: A newly created account MUST require the person to set their own permanent password
  the first time they sign in from the mobile app, exactly as already happens for every account
  today — this feature does not change or duplicate that behavior, it only ensures new accounts
  are created in the same state that already triggers it.
- **FR-011**: The Residente and Personal (Staff) lists on the Users and Roles page MUST show the
  document ID captured at creation, alongside the information already shown today.
- **FR-012**: Building Administrators MUST be able to edit an existing resident's first name, last
  name, and document ID after creation (User Story 2), in addition to the email and apartment
  fields already editable today.

### Key Entities

- **Resident / Staff account** *(existing concept, expanded)*: A person with sign-in access scoped
  to a building (Resident: also scoped to one apartment; Staff: building-wide, limited modules).
  Previously represented, before acceptance, only as a pending invitation record (email, an
  optional single name, a role, an apartment for residents); now created directly with first name,
  last name, a document/ID number, and immediately backed by a real sign-in account — no separate
  "invited but not yet real" state for new creations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Building Administrator can create a resident or staff account, and that person can
  sign in from the mobile app, without any "accept invitation" step ever occurring — 100% of
  accounts created through this flow are immediately sign-in-capable.
- **SC-002**: 100% of new accounts created through this flow require the person to set a permanent
  password on their first mobile sign-in.
- **SC-003**: 100% of newly created accounts have a first name, last name, and document ID visible
  in the Users and Roles page, where previously only a single optional name was ever captured.
- **SC-004**: Attempting to create an account with a duplicate email or an insufficient temporary
  password is rejected before any account is created, 100% of the time, with a message that
  identifies the problem.

## Assumptions

- "Document" refers to a personal identification number (e.g., a national ID/cédula), the same
  general concept this product already captures for visitors (`document_id` on visitor records) —
  this feature extends that same idea to residents and staff, who currently have no equivalent
  field.
- Document ID is stored for identification/reference purposes only; this feature does not require
  enforcing it as unique, formatted to a specific country's ID pattern, or verified against any
  external registry.
- The temporary password is typed directly by the Building Administrator (not
  auto-generated/displayed by the system) and is expected to be communicated to the new user
  through whatever channel the building already uses (in person, phone, etc.) — this feature does
  not add an email or SMS delivery step, consistent with this app not currently sending any email
  as part of user provisioning.
- "This behaviour already happens" (forced password change on first mobile sign-in) is treated as
  an existing, unchanged capability of the mobile app / sign-in flow that this feature depends on
  and must not interfere with — this feature's only obligation is to create new accounts in
  whatever state already triggers that behavior for every other account today. Building this
  forced-change behavior itself is out of scope.
- This feature only changes account creation for Resident and Staff roles from the Users and Roles
  page. Building Administrator account creation (handled by an App Administrator elsewhere in the
  product) is out of scope and unaffected.
- Minimum password strength follows whatever standard the system already applies to account
  passwords elsewhere (e.g., a minimum length) — this feature does not introduce a new or different
  password policy specific to temporary passwords.
- Existing pending invitations created before this feature ships are unaffected: they remain
  listed and cancelable exactly as they behave today. This feature does not add a way to convert an
  old pending invitation into a directly-created account, and does not require deleting or
  migrating old invitation records.
