# Feature Specification: Building Operations Expansion (Renter Role, Finance, Maintenance, Polls, Broadcast, Emergency)

**Feature Branch**: `007-finance-ops-expansion`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "New role should be incorporated: A rentor [renter], this user can
see most of what the resident sees except the finance module... Finance Module: There should be a
new module to keep track of building payments... Visitor module: The table should also show the
apartment that made the visitor announcement. Maintenance module: The building administrator
should be able to create tasks... Community polls: building administrator should be able to
create and view polls... Broadcast module: The user administrator or staff should be able to send
a message as a custom notification... Emergency module: There should be a view available to both
staff and building admin, this view shows emergencies reported by residents from the mobile app..."
(full text preserved in conversation history — condensed here per module below).

## User Scenarios & Testing *(mandatory)*

<!--
  This request bundles seven largely-independent additions in one description. Each is written
  below as its own prioritized, independently-testable user story per this template's guidance —
  together they form one feature, but nothing prevents planning/implementing them one at a time,
  in the priority order below.
-->

### User Story 1 - Provision a Renter account with restricted access (Priority: P1)

As a Building Administrator, I create a Renter account for an apartment (the same way I create a
Resident account today), and that person can use the mobile app to see most of what a Resident
sees — except the Finance module, which is hidden from them entirely, and Community Polls, which
they can view but not vote in.

**Why this priority**: Every other new module below (Finance, Polls) needs to know whether the
person looking at it is a Resident or a Renter before it can enforce the right access — this is the
foundation the rest of this feature is built on.

**Independent Test**: Create a Renter account for a test apartment from Usuarios y roles, sign in
as that account from the mobile app (or an equivalent direct check), and confirm the Finance module
is entirely inaccessible, Polls are visible but voting is blocked, and everything else a Resident
can see is likewise visible.

**Acceptance Scenarios**:

1. **Given** a Building Administrator on Usuarios y roles, **When** they create a new account and
   choose "Renter" as the role (alongside the existing Resident/Staff choices), **Then** the same
   creation form (first name, last name, document ID, email, apartment, temporary password) applies,
   and the account is immediately usable exactly like a directly-created Resident account.
2. **Given** a Renter account, **When** that person opens the mobile app, **Then** they see the same
   modules/content a Resident of their apartment would see, with the Finance module absent entirely
   from their view.
3. **Given** a Renter account viewing an open Community Poll, **When** they attempt to submit a
   vote, **Then** the system blocks it — voting is not available to Renter accounts.
4. **Given** an apartment with both a Resident and a Renter account, **When** a poll vote is cast by
   the Resident, **Then** it counts normally (Renters simply have no voting capability of their own;
   this does not change how a Resident's vote works).

---

### User Story 2 - Manage building payments (Finance module) (Priority: P2)

As a Building Administrator, I set each apartment's monthly fee (individually or in bulk via a CSV
upload), configure when each month's payment becomes due and what happens if it's paid late, review
and approve payment confirmations residents submit from the mobile app, and look up any apartment's
payment history — with the whole payments table filterable and exportable.

**Why this priority**: This is the single largest, most-detailed module in the request and, based on
the level of detail provided, the primary business driver for this feature.

**Independent Test**: Set a fee for an apartment, confirm a payment record is generated on the
configured availability date with the correct due date, submit a payment confirmation for it
(simulating the mobile app), approve it from the backoffice, and confirm the apartment's residents
receive a notification. Separately, let a due date pass unattended and confirm the late fee is
applied to the amount due.

**Acceptance Scenarios**:

1. **Given** a Building Administrator on the Finance module, **When** they set a monthly fee for a
   single apartment, **Then** that apartment's configured fee updates and is reflected the next time
   a payment is generated for it.
2. **Given** the Building Administrator wants to update many apartments' fees at once, **When** they
   download the fee template, **Then** they receive a file with every apartment in the building
   listed in the first column, and the second column pre-filled with that apartment's currently
   configured fee wherever one exists (blank otherwise).
3. **Given** a Building Administrator has filled in and uploaded that CSV, **When** the upload
   completes, **Then** every apartment listed in the file has its fee set to the uploaded amount.
4. **Given** the Building Administrator has configured a "payment available" day and a "due" day of
   the month, **When** that available day arrives, **Then** a new payment record is created for
   every apartment with a configured fee, due on the configured due day.
5. **Given** a resident (via the mobile app, out of scope here) has uploaded a payment confirmation
   photo for a pending payment, **When** a Building Administrator reviews it on the Finance module
   and approves/marks it received, **Then** the payment's status updates to received/approved and
   every resident of that apartment gets a notification.
6. **Given** a payment's due date has passed without it being marked received, **When** the system
   next evaluates it, **Then** the configured late fee (a flat amount or a percentage, per the
   building's setting) is added to the amount due for that payment.
7. **Given** a Building Administrator opens a specific apartment's payment history, **When** the
   view loads, **Then** they see every past payment for that apartment with its amount, status, and
   dates.
8. **Given** the Building Administrator is viewing the payments table, **When** they filter by
   apartment, by date, or by status, **Then** only matching payments are shown, and an export of the
   current (filtered) view is available.
9. **Given** a payment's due date is one day away, **When** that day arrives, **Then** the
   apartment's residents receive a reminder notification.

---

### User Story 3 - See which apartment reported a visitor (Priority: P3)

As a Building Administrator or Staff member on the Visitas (Visitors) module, I can see which
apartment each visitor entry belongs to directly in the table, without opening each row.

**Why this priority**: A small, self-contained, immediately useful addition to an existing table —
no dependency on anything else in this feature.

**Independent Test**: Open Visitas and confirm every row shows its associated apartment.

**Acceptance Scenarios**:

1. **Given** the Visitas table listing expected/arrived visitors, **When** a Building Administrator
   or Staff member views it, **Then** each row displays the apartment that registered that visitor.

---

### User Story 4 - Schedule and track recurring maintenance tasks (Priority: P4)

As a Building Administrator, I create maintenance tasks (like "Elevator inspection") with a name, a
date, and how often they repeat (weekly, monthly, every N months, or a one-time date), and I can
reschedule a task's date whenever needed. Staff can mark a task done and attach a photo of the
completed work (from their device's storage or camera).

**Why this priority**: Valuable operationally but self-contained — doesn't depend on Finance,
Renter, or any other module in this feature.

**Independent Test**: Create a recurring maintenance task, mark its current occurrence done as
Staff with a photo attached, and confirm the task's next due date advances according to its
configured frequency. Separately, reschedule a task's date as admin and confirm it updates.

**Acceptance Scenarios**:

1. **Given** a Building Administrator on the Maintenance module, **When** they create a task with a
   name, a starting date, and a frequency (weekly, monthly, every N months, or one-time/no repeat),
   **Then** the task is saved and shows as due on that date.
2. **Given** an existing maintenance task, **When** the Building Administrator changes its scheduled
   date, **Then** the task reflects the new date.
3. **Given** a maintenance task that is currently due, **When** a Staff member marks it done and
   attaches a photo (choosing from device storage or capturing one with the camera, where
   available), **Then** the task records who completed it, when, and the attached photo.
4. **Given** a recurring task was just marked done, **When** the completion is recorded, **Then** the
   task's next due date is recalculated according to its configured frequency (e.g., a
   monthly task marked done becomes due again roughly a month later).

---

### User Story 5 - Create and monitor community polls (Priority: P5)

As a Building Administrator, I create polls (optionally with a description and an attachment),
choose whether residents can pick one answer or multiple, choose whether the poll is anonymous, and
set a closing date after which no more votes are accepted. I can see all my polls in one view —
active ones expanded by default showing live results, closed ones collapsed showing just their name
and final result until I open them.

**Why this priority**: A meaningful but self-contained module — depends on User Story 1 only for the
Renter-can't-vote rule; everything else about creating/monitoring a poll stands alone.

**Independent Test**: Create a poll with a closing date, cast votes from more than one apartment
(simulating the mobile app), confirm results tally correctly, let the closing date pass, and confirm
further votes are rejected and the poll now displays collapsed with just its name and result.

**Acceptance Scenarios**:

1. **Given** a Building Administrator creating a poll, **When** they fill in a title, optional
   description, optional attachment, answer choices, whether one or multiple answers are allowed,
   whether the poll is anonymous, and a closing date, **Then** the poll is created and immediately
   visible to residents.
2. **Given** an open poll, **When** a resident of an apartment (that hasn't already voted from that
   apartment) submits a vote, **Then** it's recorded against that apartment, not that individual
   person.
3. **Given** an apartment has already voted in a poll, **When** any resident of that same apartment
   submits again before the poll closes, **Then** the apartment's vote is updated to the new
   submission (one live vote per apartment, not one per person).
4. **Given** a poll's closing date has passed, **When** anyone attempts to vote, **Then** the
   submission is rejected.
5. **Given** a non-anonymous poll, **When** a Building Administrator reviews its results, **Then**
   they can see which apartment voted for which option(s).
6. **Given** an anonymous poll, **When** a Building Administrator reviews its results, **Then** they
   see the aggregate tally only — never which apartment cast which vote.
7. **Given** the Building Administrator's poll list, **When** it loads, **Then** active polls appear
   expanded by default (showing title and live results), and closed polls appear collapsed by
   default (showing only their name and final result) until clicked open.

---

### User Story 6 - Send broadcast alerts (Priority: P6)

As a Building Administrator, I send an urgent custom message (like "fire reported - emergency
evacuation") to everyone in the building, optionally from a set of predetermined messages I've
saved (each with an icon), and I can allow Staff to send these too (off by default).

**Why this priority**: High-impact when needed but rarely used day-to-day, and depends on nothing
else in this feature except the Staff-permission toggle being a deliberate, explicit setting.

**Independent Test**: As Building Administrator, send a broadcast and confirm every resident of the
building receives it. Save a predetermined message with an icon, send it, and confirm it sends
identically to a one-off message. Toggle Staff permission on, and confirm a Staff account can then
send a broadcast; with it off, confirm Staff cannot.

**Acceptance Scenarios**:

1. **Given** a Building Administrator on the Broadcast module, **When** they type a message and
   send it, **Then** every resident (and Renter) of the building receives it as a notification.
2. **Given** the Building Administrator wants to reuse a message, **When** they save it as a
   predetermined message with an associated icon, **Then** it appears in a list they can send from
   again later with one action.
3. **Given** Staff broadcast permission is off (the default), **When** a Staff account attempts to
   send a broadcast, **Then** it is blocked.
4. **Given** the Building Administrator turns Staff broadcast permission on, **When** a Staff
   account then sends a broadcast, **Then** it sends the same way an admin-sent one does.
5. **Given** a resident has notification preferences that would normally mute or filter
   notifications, **When** a broadcast is sent, **Then** it reaches them regardless, to the extent
   the platform allows overriding those preferences.

---

### User Story 7 - View resident-reported emergencies (Priority: P7)

As Staff or a Building Administrator, I can open an Emergency view that lists emergencies residents
have reported from the mobile app, and I'm visibly alerted (an icon, and the nav link to this view
blinking) whenever a new, unhandled one comes in.

**Why this priority**: Explicitly scoped narrowly for this pass — the request asks only to lay the
data foundation and a basic viewing/alerting experience now, with the mobile reporting experience to
follow later and adapt to whatever this defines.

**Independent Test**: Insert a test emergency report (simulating the mobile app, which is out of
scope here) and confirm it appears in the Emergency view for both Staff and Building Admin, that
the top-right indicator and the nav link's blinking both activate, and that acknowledging/resolving
it from the view clears both.

**Acceptance Scenarios**:

1. **Given** Staff or a Building Administrator signed in, **When** a new emergency has been
   reported and not yet handled, **Then** an indicator appears in the top-right of the backoffice
   and the Emergency nav link visibly blinks.
2. **Given** that same signed-in user, **When** they open the Emergency view, **Then** they see the
   reported emergency's details (who reported it, their apartment, when, and what was reported).
3. **Given** an emergency in the list, **When** Staff or a Building Administrator marks it
   acknowledged/resolved, **Then** it no longer counts toward the top-right indicator or the
   blinking nav link (unless another unhandled emergency still exists).
4. **Given** no unhandled emergency exists, **When** any signed-in Staff or Building Administrator
   views the backoffice, **Then** neither the indicator nor the blinking link appear.

---

### Edge Cases

- **Renter**: an apartment with a Renter but no Resident account at all — the Renter still can't see
  Finance or vote; nothing in this feature requires an apartment to have a Resident.
- **Finance**: an apartment with no fee configured is skipped when payment records are generated for
  a given month (no payment appears until a fee is set). A CSV upload row referencing an apartment
  that doesn't exist in the building is rejected (that row only) with a clear error, without
  discarding the rest of the file's valid rows. Marking a payment received after its due date has
  already added a late fee still records it as received — the late fee already applied is not
  automatically reversed.
- **Maintenance**: a one-time (non-recurring) task marked done does not generate a next occurrence.
- **Polls**: a poll with only one answer option is still valid (effectively an acknowledgment/RSVP).
  An apartment where nobody has an account yet cannot vote (nothing to attribute the vote to).
- **Broadcast**: sending a broadcast with no residents currently in the building (a newly created,
  empty building) succeeds but reaches no one.
- **Emergency**: multiple simultaneous unhandled emergencies still show a single indicator/blink
  state (on), not a count-specific animation — the Emergency view itself is where the count/detail
  lives.

## Requirements *(mandatory)*

### Functional Requirements

**Renter role**

- **FR-001**: The system MUST support a Renter account type, provisioned the same way a Resident
  account is (Users and Roles, by a Building Administrator, scoped to one apartment).
- **FR-002**: A Renter account MUST see the same mobile app content a Resident of their apartment
  sees, with the Finance module fully excluded from their view.
- **FR-003**: A Renter account MUST be able to view Community Polls but MUST NOT be able to submit
  or change a vote.
- **FR-004**: Provisioning, editing, and removing a Renter account MUST be restricted the same way
  Resident account management already is (Building Administrator only, scoped to their own
  building).

**Finance module**

- **FR-010**: The system MUST let a Building Administrator set a monthly fee for an individual
  apartment.
- **FR-011**: The system MUST let a Building Administrator update many apartments' fees at once via
  a CSV upload (one column identifying the apartment, one column with the fee amount).
- **FR-012**: The system MUST provide a downloadable CSV template pre-filled with every apartment in
  the building in the first column, and each apartment's currently configured fee (if any) in the
  second column.
- **FR-013**: Uploading a fee CSV MUST update only the apartments listed in the file — every other
  apartment's existing fee MUST remain untouched (a merge, not a full replace).
- **FR-014**: The system MUST let a Building Administrator configure, per building: which day of the
  month a new payment becomes available, and which day of the month it's due.
- **FR-015**: On the configured availability day, the system MUST generate a new payment record for
  every apartment that has a configured fee, due on the configured due day.
- **FR-016**: The system MUST let a resident (via a channel outside this feature's scope — the
  mobile app) attach a payment-confirmation photo to a pending payment.
- **FR-017**: The system MUST let a Building Administrator review a payment's submitted confirmation
  and mark it received/approved.
- **FR-018**: Marking a payment received MUST notify every resident of that apartment.
- **FR-019**: The system MUST let a Building Administrator configure a building-wide late fee (a
  flat amount or a percentage of the amount due) applied when a payment's due date passes without
  it being marked received.
- **FR-020**: The late fee MUST be applied exactly once, at the moment a payment's due date first
  passes unreceived — it MUST NOT be re-applied again for that same payment no matter how much
  longer it remains outstanding.
- **FR-021**: The system MUST notify an apartment's residents one day before a pending payment's due
  date.
- **FR-022**: The system MUST let a Building Administrator view the full payment history for a
  specific apartment.
- **FR-023**: The system MUST let a Building Administrator filter the payments table by apartment,
  by date, and by status.
- **FR-024**: The system MUST let a Building Administrator export the (optionally filtered)
  payments table.
- **FR-025**: The Finance module MUST be accessible only to Building Administrators — not Staff, not
  Residents, not Renters (consistent with today's constitution, which scopes Staff to Visitors,
  Incidencias, and Package Receipt only, and residents/renters interact with Finance only via the
  mobile app's payment-submission flow, not this module).

**Visitor module**

- **FR-030**: The Visitas table MUST display the apartment associated with each visitor entry.

**Maintenance module**

- **FR-033**: The system MUST let a Building Administrator create a maintenance task with a
  free-text name, a scheduled date, and a frequency: one-time, every week, every month, or every N
  months.
- **FR-034**: The system MUST let a Building Administrator change an existing maintenance task's
  scheduled date.
- **FR-035**: The system MUST let a Staff member (or Building Administrator) mark a due maintenance
  task done, recording who completed it and when.
- **FR-036**: Marking a maintenance task done MUST let the completing user attach a photo, sourced
  either from device storage or the device camera where available.
- **FR-037**: Marking a recurring maintenance task done MUST advance its next due date according to
  its configured frequency; a one-time task MUST NOT generate a further occurrence.
- **FR-038**: The Maintenance module MUST be accessible to Building Administrators (full management)
  and Staff (mark-done capability), extending Staff's currently-constitutional module scope — see
  Assumptions.

**Community polls**

- **FR-041**: The system MUST let a Building Administrator create a poll with a title, an optional
  description, an optional attachment, one or more answer options, whether one or multiple answers
  may be selected, whether results are anonymous, and a closing date.
- **FR-042**: The system MUST record poll votes per apartment, not per individual account — one live
  vote per apartment per poll.
- **FR-043**: Any resident (not Renter, per FR-003) of an apartment that has already voted in a poll
  MUST be able to change that apartment's vote up until the poll closes.
- **FR-044**: The system MUST reject any vote submitted after a poll's closing date.
- **FR-045**: For a non-anonymous poll, the system MUST let a Building Administrator see each
  apartment's chosen option(s).
- **FR-046**: For an anonymous poll, the system MUST show only aggregate results to the Building
  Administrator — never which apartment cast which vote.
- **FR-047**: The Building Administrator's poll list MUST show active polls expanded by default
  (title and live results visible) and closed polls collapsed by default (name and final result
  only, expandable on demand).
- **FR-048**: Poll creation and management MUST be restricted to Building Administrators.

**Broadcast module**

- **FR-051**: The system MUST let a Building Administrator send a custom text message as a
  building-wide broadcast notification.
- **FR-052**: The system MUST let a Building Administrator save a message as a reusable
  predetermined broadcast, with an associated icon, for one-action reuse later.
- **FR-053**: The system MUST let a Building Administrator toggle whether Staff may also send
  broadcasts; this MUST default to off.
- **FR-054**: When Staff broadcast permission is off, the system MUST reject a broadcast-send
  attempt by a Staff account.
- **FR-055**: A broadcast notification MUST reach residents regardless of their individual
  notification preferences, to the extent the platform allows a notification to override them.
- **FR-056**: Broadcast send capability MUST be accessible to Building Administrators always, and to
  Staff only when explicitly enabled — another extension of Staff's constitutional module scope, see
  Assumptions.

**Emergency module**

- **FR-058**: The system MUST record emergencies reported by residents, including who reported it,
  their apartment, when, and what was reported — the reporting mechanism itself (mobile app) is out
  of this feature's scope; this feature defines and exposes the data it's stored as.
- **FR-059**: The Emergency view MUST be accessible to both Staff and Building Administrators.
- **FR-060**: The system MUST show a visible indicator in the backoffice's top-right corner and make
  the Emergency nav link blink whenever an unhandled emergency exists.
- **FR-061**: An emergency's "new/unhandled" state MUST only be cleared by an explicit
  acknowledge/resolve action taken from the Emergency view (by Staff or a Building Administrator) —
  merely opening or viewing the list MUST NOT clear it on its own.
- **FR-062**: Once every reported emergency has been cleared per FR-061, the top-right indicator and
  the nav link's blinking MUST both stop.

### Key Entities

- **Renter**: A person with mobile-app access scoped to exactly one apartment, provisioned the same
  way as a Resident, distinguished from a Resident by reduced access (no Finance, view-only Polls).
- **Apartment Fee**: The current monthly amount owed by a specific apartment; individually or bulk
  (CSV) settable by a Building Administrator.
- **Payment**: One month's amount due for one apartment — amount, availability date, due date,
  status (pending / confirmation submitted / received / overdue), an optional confirmation photo,
  and, once overdue, the late fee applied.
- **Late Fee Setting**: A building-wide configuration — flat amount or percentage — applied to a
  payment once its due date passes unreceived.
- **Maintenance Task**: A named, schedulable, optionally-recurring unit of building upkeep — name,
  next due date, frequency, and a log of completions (who, when, optional photo).
- **Poll**: A building-scoped question with one or more answer options, a closing date, an
  anonymous/non-anonymous setting, a single/multiple-answer setting, and one recorded vote per
  apartment.
- **Broadcast Message**: A one-off or saved-and-reused (predetermined) urgent notification sent to
  every resident/renter of a building, optionally paired with an icon.
- **Emergency Report**: An incident reported by a resident from the mobile app — reporter, apartment,
  timestamp, description, and a handled/unhandled state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Building Administrator can create a Renter account in the same amount of time it
  takes to create a Resident account today (no added steps beyond selecting the role).
- **SC-002**: 100% of Finance module views and actions are inaccessible to Renter accounts.
- **SC-003**: A Building Administrator can set fees for an entire building's worth of apartments in
  under 5 minutes using the bulk CSV upload, versus one-by-one entry.
- **SC-004**: 100% of payments generated on the configured availability date carry the correct due
  date and, where applicable, the correct fee amount for their apartment.
- **SC-005**: 100% of payments marked received trigger a notification to every resident of that
  apartment.
- **SC-006**: 100% of payments that pass their due date unreceived have the configured late fee
  applied before a Building Administrator next views them.
- **SC-007**: A Building Administrator can find any single apartment's full payment history in
  under 3 clicks from the Finance module.
- **SC-008**: 100% of Visitas rows display their associated apartment.
- **SC-009**: A recurring maintenance task's next due date is always visible and accurate
  immediately after being marked done.
- **SC-010**: 100% of poll votes are attributable to exactly one apartment, never to zero or more
  than one.
- **SC-011**: A Building Administrator can distinguish active from closed polls, and see a closed
  poll's final result, without opening every poll individually (accordion default states alone
  convey this).
- **SC-012**: 100% of broadcasts sent by a Building Administrator reach every resident/renter
  account in the building.
- **SC-013**: A new, unhandled emergency becomes visible (indicator + blinking link) to every
  signed-in Staff/Building Administrator session within the same page-load cycle that would show
  any other real-time-ish signal in this app (i.e., no manual refresh required beyond what the app
  already does elsewhere).

## Assumptions

- **Constitutional scope changes required before planning**: this feature cannot be planned as
  written without amending the project constitution twice over:
  1. **A fifth role (Renter)** — Principle II currently defines "exactly four roles" and requires an
     explicit amendment to introduce a new one. This spec assumes that amendment will be sought
     (via `/speckit-constitution`) before `/speckit-plan` runs for User Story 1, the same way
     feature 004 amended Principle II to grow Staff's scope before it was planned.
  2. **Staff's module scope grows again** — Maintenance (mark-done) and Broadcast (send, when
     enabled) both explicitly involve Staff, beyond the three modules (Visitors, Incidencias,
     Package Receipt) the constitution currently enumerates for them. This spec assumes a further
     Principle II amendment covers both additions (likely in one amendment, alongside Emergency
     view access, which is also Staff-facing).
  This is called out here, in Assumptions, rather than as a `[NEEDS CLARIFICATION]` marker, because
  it isn't an ambiguity in what the user asked for — the request is explicit that Staff gets these
  capabilities — it's a governance prerequisite this spec can't resolve on its own.
- **Mobile app work is out of scope**: every place a resident/renter interacts with these modules
  (submitting a payment confirmation, voting, reporting an emergency) happens in the separate mobile
  app, which this feature does not build — consistent with how ticket/visitor/package creation are
  already handled as out-of-band in this backoffice. This feature's scope is: the data model each of
  those interactions needs, and the Building Administrator/Staff-facing management surface for it.
- **Notification delivery** reuses this product's existing in-app notification mechanism (the same
  one packages/tickets already use) — no email/SMS integration exists in this app today, and none is
  introduced here. "Bypass notification preferences when possible" (broadcast) is scoped to however
  far the existing in-app + push mechanism can be prioritized; it does not imply a new delivery
  channel.
- **Payment confirmation photos and maintenance completion photos** reuse the existing private
  Storage pattern (`building-media`-bucket-equivalent) already used for facility/ticket/package
  photos in this app.
- **CSV format** (delimiter, header row, exact column names) is left as an implementation detail for
  planning — this spec only fixes the two-column shape (apartment, amount) and the template's
  pre-fill behavior.
- **Late fee and reminder timing** run on the same kind of scheduled/periodic sweep this app already
  uses for visitor-expiry and feedback-cleanup, not a real-time trigger — "one day before due" and
  "once the due date passes" are evaluated whenever that sweep next runs, not to-the-second.
- **This is one feature spec covering seven independently-deliverable user stories** because the
  user described them together in one request; nothing prevents `/speckit-plan`/`/speckit-tasks`
  from being run and shipped one user story at a time, in the priority order above, the same way
  feature 004 (three modules) was delivered story-by-story.
