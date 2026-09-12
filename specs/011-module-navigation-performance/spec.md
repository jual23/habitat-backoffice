# Feature Specification: Module Navigation Performance

**Feature Branch**: `011-module-navigation-performance`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "The loading time between one module and the next should be around 1 second, right now it's taking over two to switch. Content and routes should as as optimized as possible."

## Clarifications

### Session 2026-09-11

- Q: Does the requested loading indicator apply only to the module-to-module navigation transition, or also to other in-page loading states (form saves, filters, button actions)? → A: Only the module-to-module navigation transition (this feature's existing loading state, FR-003/User Story 3) — other in-page loading states are out of scope for this feature.
- Q: Should the specified loading indicator (the `blocks-shuffle-4.svg` icon, in `#354c5c`) replace the previously-planned per-module skeleton design entirely, or be combined with it? → A: **Corrected later in this session** — neither: module-to-module navigation keeps the original per-module skeleton design (no spinner). The `blocks-shuffle-4.svg` icon in `#354c5c` is instead reserved for brief, transient in-page loading elsewhere (e.g., a modal that submits data and closes) — a case already out of scope for this feature per the clarification above.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switching modules feels instant during daily work (Priority: P1)

A Building Administrator working through their day clicks from one backoffice module to another (e.g., from Facilities to Incidencias, or from Users to Finance) and the destination module's content appears almost immediately, instead of the noticeable pause it takes today.

**Why this priority**: This is the entire point of the request — the backoffice is used repeatedly throughout a working day, and every extra second per switch compounds into real lost time and a sluggish feel across dozens of daily transitions.

**Independent Test**: Can be fully tested by, while already signed in, clicking through a representative set of module-to-module transitions and timing how long each takes from click to the destination module's content being visible and usable.

**Acceptance Scenarios**:

1. **Given** a Building Administrator is viewing any backoffice module, **When** they navigate to a different module via the app's navigation, **Then** the destination module's primary content is visible and usable in around 1 second, not the 2+ seconds currently observed.
2. **Given** a Building Administrator navigates between two modules they have already visited earlier in the same session, **When** they switch back and forth between them, **Then** each switch is at least as fast as the first visit, not slower.

---

### User Story 2 - Fast switching holds for every role and every module (Priority: P2)

A Staff account (with access limited to a handful of modules, e.g., Visitors, Incidencias, Packages) and an App Administrator (with access to many buildings and modules) both experience the same fast switching — the improvement isn't limited to one role or a couple of "showcase" modules while others stay slow.

**Why this priority**: A fix that only speeds up the modules someone happened to test would leave the day-to-day experience for other roles (Staff, who use the app for quick, repeated front-desk tasks) just as slow as before.

**Independent Test**: Can be fully tested by signing in as each role and timing module-to-module transitions across every module that role can access, confirming the same target is met everywhere, not just for a subset.

**Acceptance Scenarios**:

1. **Given** a Staff account signed in with access to its permitted modules, **When** they switch between any two of those modules, **Then** the transition meets the same ~1 second target as any other role.
2. **Given** any backoffice module (not just the most-used ones), **When** a user navigates into it from another module, **Then** it meets the same ~1 second target — no module is exempt.

---

### User Story 3 - Slower conditions never look like the app froze (Priority: P3)

Even when a transition can't be instantaneous — a large dataset, a busy network, or the very first visit to a module in a session — the user sees an immediate visual response (a loading state) rather than a blank or frozen screen, so the app never appears to have stalled or broken.

**Why this priority**: This is a safety net for the cases the primary speed work can't fully eliminate; it protects the perceived quality of the app even under worse-than-typical conditions, but the app is still valuable without it as long as User Stories 1–2 hold in the common case.

**Independent Test**: Can be fully tested by throttling the network or navigating into a module with an unusually large dataset and confirming a visible loading indicator appears almost immediately, well before the destination content itself is ready.

**Acceptance Scenarios**:

1. **Given** a user navigates to a module while on a slow or throttled connection, **When** the destination content takes longer than a brief moment to become ready, **Then** a module-shaped skeleton loading indicator is already visible so the screen never appears blank or frozen.
2. **Given** a user navigates into a module with an unusually large amount of data (e.g., a building with many apartments, or a finance module with many records), **When** the module loads, **Then** it fetches and displays only an initial batch of about 25 records instead of the full set, so the primary content still appears on target.

---

### Edge Cases

- What happens when a user clicks two or more different modules in quick succession (e.g., double-clicks or changes their mind mid-navigation)? The final module the user lands on must show only its own correct content — no stale content from an earlier, abandoned navigation, and no duplicate/stacked loading work.
- What happens the very first time a module is opened in a session (nothing about it has been loaded yet)? It should still meet the target as closely as possible; if a first visit is unavoidably slower than later visits to the same module, that gap itself should be minimized.
- What happens when a module's underlying data set is unusually large (many records, many buildings for an App Administrator)? The module fetches only an initial batch of about 25 records rather than the full set, so the visible/interactive content still appears on target; the remaining records are only fetched if the user requests more (pagination/"load more"), where that module offers it.
- What happens if a user's network connection is genuinely slow (not just the app being unoptimized)? The app must still respond immediately with a loading indicator, even if the full content necessarily takes longer to arrive in that case.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a destination module's primary content within approximately 1 second of a user initiating navigation to it from another module, under typical working conditions (signed-in session, ordinary broadband, module already visited earlier in the session).
- **FR-002**: Navigating between modules MUST continue to use in-app client-side navigation with no full-page reload, consistent with existing app behavior.
- **FR-003**: If a module's content is not yet ready, the system MUST show a visible loading indicator almost immediately (well under 1 second) after navigation is initiated, so the screen is never blank or apparently frozen while waiting. This loading indicator applies specifically to the module-to-module navigation transition; other in-page loading states (e.g., form submission, filtering, button actions, a modal submitting and closing) are out of scope for this feature.
- **FR-003a**: The loading indicator for the module-to-module navigation transition MUST be a skeleton that approximates the destination module's general layout (e.g., a list/card-shaped placeholder), consistent with the original design intent — not a generic spinner icon. (The `blocks-shuffle-4.svg` icon in `#354c5c` is a separate, existing app asset intended for brief/transient in-page loading elsewhere, such as a modal submitting and closing; it is explicitly not used for this feature's navigation loading state.)
- **FR-004**: The system MUST avoid unnecessary repeated loading of content/data that has not changed since it was last loaded earlier in the same session, so that returning to a previously visited module is no slower than the first visit.
- **FR-005**: The ~1 second target MUST apply across all backoffice modules the current user can access (e.g., Facilities, Incidencias, Packages, Maintenance, Broadcast, Emergency, Finance, Polls, Visitors, Users, Apartments, Activities, Announcements, Reservations, Suggestions/Complaints, Customization, Documentation, Panel) — not only a subset chosen for a demo.
- **FR-006**: When a user navigates away from a module before its content finishes loading, the system MUST discard or ignore that abandoned load so it cannot later overwrite or interfere with the module the user actually lands on.
- **FR-007**: Performance improvements MUST NOT change or weaken which users can see or do in a given module — existing role-based access and per-building data isolation MUST behave exactly as before.
- **FR-008**: If a module's underlying data set is large, the system MUST fetch and display only an initial batch of approximately 25 records rather than the full data set, so the module's primary content is not delayed by loading everything at once. Where feasible for that module's content, the system SHOULD offer a way to view additional records beyond the initial batch (e.g., pagination or "load more") rather than permanently capping the view at the first 25.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching from any backoffice module to any other takes around 1 second (down from the 2+ seconds observed today) under typical working conditions.
- **SC-002**: At least 95% of module-to-module transitions during a normal working session complete (destination content visible and usable) in under 1.2 seconds.
- **SC-003**: No module-to-module transition takes longer than 2 seconds under typical working conditions — today's slow case becomes the new worst case, not the new normal.
- **SC-004**: A visible loading indicator or the destination content itself appears within 300ms of a user initiating navigation, on 100% of transitions — the app never appears to have frozen.
- **SC-005**: The improved switching speed is observed consistently across every backoffice module and every user role, not only a subset used to demonstrate the fix.
- **SC-006**: Every existing role-based access and per-building data-isolation behavior continues to pass its current checks after the optimization — no unintended access change is introduced while pursuing speed.

## Assumptions

- "Module" refers to a top-level backoffice section (Facilities, Incidencias, Packages, Finance, Users, and so on), matching the sections already defined in the application — not every individual sub-page or record-detail view within a module. Almost all modules are reachable from the app's main sidebar navigation; Reservations is the one exception (FR-005) — it has its own dedicated page but isn't a sidebar link, and is included anyway because reservations is a feature residents use from the mobile app, making the backoffice's own reservations view real, user-facing surface for administrators managing it, not an internal sub-page.
- "Loading time" is measured from the moment a user initiates navigation (e.g., clicks a navigation item) to the moment the destination module's primary content is visible and usable — not full completion of every secondary/background data request that module may also make.
- Typical working conditions means a user already signed in, on an ordinary broadband connection, not a cold first-ever load of the entire application (e.g., first sign-in of the day) or an artificially throttled/offline network — those slower cases are addressed separately by the loading-indicator requirement (FR-003, User Story 3) rather than by the 1-second target itself.
- The ~1 second figure is treated as a target for the typical case (see SC-002's 95% threshold) rather than an absolute guarantee on every single transition under every possible condition; SC-003 sets the hard upper bound that must never be exceeded under typical conditions.
- This feature is about the speed and responsiveness of navigating between already-implemented modules; it does not add, remove, or change what any module does functionally, and does not alter existing authorization rules (FR-007) — with one deliberate, narrow exception: FR-008's initial ~25-record batch means a module that previously showed its entire list by default now shows an initial page of it (with more available via pagination/"load more" where offered). This is a visible UX change, scoped specifically to protecting the navigation-speed target for large data sets, not a broader functional change to the module.
- The `blocks-shuffle-4.svg` asset (at the root of the app's source folder, in `#354c5c`) exists in the codebase but is reserved for brief/transient in-page loading elsewhere (e.g., a modal submitting and closing) — a use case out of scope for this feature. This feature's own module-to-module navigation loading indicator (FR-003a) is a module-shaped skeleton, not that icon.
- 25 records is a starting default for the initial batch size (FR-008), not a fixed universal constant — a module MAY use a different batch size if its content naturally warrants one (e.g., a module whose rows are visually larger), as long as it stays in the same "small batch, not the full set" spirit. Pagination/"load more" beyond the initial batch is a per-module judgment call (SHOULD, not MUST) — some modules may reasonably always fit within one batch and need no further paging.
