# Feature Specification: Broadcast Message Persistence

**Feature Branch**: `008-broadcast-message-persistence`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "In the broadcast module, the resident app will show the message for
as long as it's active, so the message should persist (stay 'active' or 'on') until deactivated"

**Relationship to other specs**: This refines the Broadcast module described in
`specs/007-finance-ops-expansion/spec.md`'s User Story 6 (not yet planned/implemented). That spec
described sending a broadcast as producing a one-time notification; this spec adds that a
broadcast also has a persistent, visible **active state** on top of that notification, lasting
until explicitly turned off. Whoever plans Broadcast should read both specs together — this one
does not repeat 007's requirements for composing/sending a message, saving predetermined messages,
or the Staff-permission toggle, all of which are unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A broadcast stays visible until someone turns it off (Priority: P1)

As a resident or renter using the mobile app, once a Building Administrator (or permitted Staff)
sends a broadcast alert, I keep seeing that message displayed in the app for as long as it's
active — not only as a one-time notification I could easily miss — until an administrator
explicitly deactivates it.

**Why this priority**: This is the entire scope of this spec. Without it, a resident who was
offline, had the app closed, or simply dismissed the initial notification for an active emergency
like "fire reported - emergency evacuation" would have no way to see that the alert is still in
effect.

**Independent Test**: Send a broadcast, close and reopen the mobile app (or sign in fresh) well
after the original notification would have disappeared, and confirm the message is still shown.
Then deactivate it from the backoffice and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a Building Administrator sends a broadcast, **When** a resident opens the mobile app
   at any later point while it's still active, **Then** they see the broadcast message displayed,
   even if they missed the original notification entirely.
2. **Given** an active broadcast, **When** a Building Administrator (or Staff, where broadcast
   permission is enabled) deactivates it, **Then** it no longer appears to residents/renters from
   that point forward.
3. **Given** an active broadcast that no one has deactivated, **When** any amount of time passes,
   **Then** it remains visible — the system never expires or hides it automatically on its own.
4. **Given** a Building Administrator sends a broadcast from a saved predetermined message, **When**
   it's sent, **Then** it becomes active and persists the same way a custom one-off message does.
5. **Given** one broadcast is already active, **When** a Building Administrator sends a second,
   unrelated broadcast, **Then** both remain active and visible at once, and deactivating either one
   independently does not affect the other.
6. **Given** several broadcasts are active at once, **When** a Building Administrator opens the
   Broadcast module, **Then** they see all of them listed, each individually deactivatable.

---

### Edge Cases

- Deactivating a broadcast MUST NOT delete its record — only end its live visibility (consistent
  with spec 007's existing pattern of status changes rather than deletion for tickets/packages).
- A broadcast sent to a building with no residents/renters currently in it still becomes active (as
  spec 007 already assumes for the send itself) — there's simply no one to display it to yet.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each broadcast MUST have an explicit active/deactivated state, in addition to (not
  instead of) the one-time notification sent when it's created (spec 007's FR-051).
- **FR-002**: While a broadcast is active, it MUST remain visible in the mobile app to every
  resident/renter of the building, regardless of when they open the app relative to when it was
  sent.
- **FR-003**: A Building Administrator — or Staff, where broadcast-send permission is enabled per
  spec 007's FR-053 — MUST be able to explicitly deactivate an active broadcast.
- **FR-004**: Deactivating a broadcast MUST remove it from residents'/renters' active view without
  deleting its record.
- **FR-005**: The system MUST NOT automatically deactivate or expire a broadcast on its own — it
  stays active until an authorized user explicitly turns it off.
- **FR-006**: More than one broadcast MUST be able to be active at the same time (e.g., a fire
  evacuation notice and a separate, unrelated water-outage notice both showing at once) — sending a
  new broadcast MUST NOT automatically deactivate any other broadcast that is still active.
- **FR-007**: Sending a saved predetermined message (spec 007's FR-052) MUST create an active
  broadcast the same way sending a custom one-off message does — this persistence behavior applies
  uniformly to both.
- **FR-008**: The backoffice MUST let a Building Administrator (or permitted Staff) see every
  currently active broadcast at once, so that when several are active simultaneously, each can be
  individually reviewed and deactivated without affecting the others.

### Key Entities

- **Broadcast Message** *(extends spec 007's Broadcast Message entity)*: gains an active/deactivated
  state, when it was activated, and when/by whom it was deactivated (if it has been).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of residents/renters who open the mobile app while a broadcast is active see it,
  regardless of whether they were using the app at the moment it was originally sent.
- **SC-002**: A Building Administrator (or permitted Staff) can end an active broadcast's visibility
  to residents in a single action.
- **SC-003**: A broadcast that is never explicitly deactivated remains visible indefinitely — still
  showing correctly no matter how much time has passed since it was sent.

## Assumptions

- Deactivation is an admin/staff-controlled action (mirroring who may send, per spec 007's FR-053) —
  not something an individual resident can dismiss only for themselves; a deactivated broadcast
  disappears for everyone at once.
- "The resident app" refers to the same mobile app spec 007 already treats as this feature's
  external, out-of-scope consumer — this spec defines the data/state the backoffice must expose and
  let admins control; it does not build the mobile-side display itself.
- No automatic time-based expiration exists or is introduced — spec 007's Assumptions already note
  this app has no scheduled-sweep behavior beyond visitor-expiry/feedback-cleanup, and this feature
  deliberately does not add a broadcast-expiry sweep, per the user's explicit "persist... until
  deactivated."
