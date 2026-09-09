<!--
Sync Impact Report
Version change: 1.6.0 → 1.7.0
Rationale: MINOR bump. Principle II (Role-Based Access Control) is materially
expanded a third time: a fifth role, Renter, is added, driven by
specs/007-finance-ops-expansion/spec.md's User Story 1 (FR-001–FR-004).
Renter is provisioned exactly like Resident (Building Administrator only,
scoped to one apartment, via Users and Roles — not self-registration) and
gets the same mobile-app access a Resident of that apartment has, minus two
specific things: no Finance module access at all, and view-only access to
Community Polls (Renter cannot submit or change a vote — polls are voted by
apartment, and a Renter is not that apartment's resident/owner of record).
This does not touch Staff's module list (amended earlier this session to
v1.6.0) or grant Renter any backoffice access (Renter, like Resident, does
not use this web admin app at all). Not a MAJOR change (no principle removed
or redefined, still a small enumerated role set); not a PATCH (a genuinely
new role, not a wording fix) — matching the same MINOR category as the two
amendments before it.

Modified principles:
  - II. Role-Based Access Control — role count changed from "exactly four" to
    "exactly five," adding Renter (defined as Resident's access minus Finance
    and minus poll-voting); the amendment-required clause updated to match
    ("beyond these five"). Staff's six-module enumeration (v1.6.0) and all
    other roles/rules in this principle are unchanged.

Added sections: none.

Removed sections: none.

Other touch-ups for consistency: none — no other section referenced the role
count or enumerated Resident/Renter by name.

Deferred / TODO placeholders: none.

Templates requiring follow-up:
  - specs/007-finance-ops-expansion/plan.md is the feature driving this
    amendment (its User Story 1); not yet planned — once `/speckit-plan` runs
    for it, its Constitution Check should read Principle II as satisfied for
    Renter rather than blocked. Not retroactively created by this command
    (scope: constitution only).
  - specs/007-finance-ops-expansion/spec.md's User Story 5 (Community Polls)
    depends on this amendment too, for the "Renter can view but not vote"
    rule (FR-003) to be buildable against a real, distinguishable role rather
    than deferred — also unblocked by this amendment.
  - lib/session.ts's getUserContext() currently derives `role: 'resident'`
    from "no user_roles row + profiles.apartment_id set"; distinguishing
    Renter from Resident will need its own signal (e.g. a `profiles` column
    or a `user_roles`-style row) — a schema/session-logic decision for
    007's plan.md, not this command (scope: constitution only).
  - specs/001 through specs/006, and specs/008 (Broadcast, already planned
    separately) predate or are unaffected by this amendment (none of them
    reference Renter) — not edited here.
  - No other runtime guidance file (e.g., CLAUDE.md) present yet to sync.
-->

# Habitat Constitution

## Core Principles

### I. Multi-Tenant Data Isolation (NON-NEGOTIABLE)
Every building's data (facilities, activities, announcements, residents, and any
other building-scoped content) MUST be strictly isolated to that building. No query,
mutation, view, or API response may expose or allow cross-building access except
for the App Administrator, whose role spans all buildings by design. Building
Administrators MUST be restricted at the data-access layer — not merely hidden in
the UI — to only the building(s) they are assigned to.
**Rationale**: Habitat manages physically and legally distinct properties for
different administrators. A cross-tenant data leak or write is a critical failure
of the system's core promise, not a cosmetic bug, and must be prevented
structurally rather than by convention.

### II. Role-Based Access Control
The system defines exactly five roles: **App Administrator** (creates and
manages buildings, and assigns Building Administrators); **Building
Administrator** (creates, edits, and deletes facilities, activities,
announcements, and other content scoped to their assigned building(s), and
provisions Staff, Resident, and Renter accounts for their building); **Staff** (a
narrowly-scoped role, provisioned only by a Building Administrator for a single
building, restricted to exactly six modules — Visitors (viewing expected
visitors and marking arrivals), Incidencias (viewing and triaging
maintenance/service request tickets: changing status, leaving resident-visible
comments, recording rejection reasons, and linking duplicates), Package
Receipt (registering arrived packages and marking them picked up),
Maintenance (marking a due maintenance task done and attaching a completion
photo — creating a task or changing its schedule remains
Building-Administrator-only), Broadcast (sending and deactivating broadcast
alerts, but only when a Building Administrator has explicitly enabled Staff
broadcast permission for that building; this permission defaults to off), and
Emergency (viewing resident-reported emergencies and marking one
acknowledged/resolved) — with no access to any other module); and
**Resident** (a managed, non-administrative account associated with exactly
one apartment, created and managed by a Building Administrator, scoped only
to their own apartment/building's data — what a Resident can themselves do,
if anything, is defined by the feature that grants it, not by this
principle); and **Renter** (a managed, non-administrative account associated
with exactly one apartment, provisioned, edited, and removed the same way a
Resident account is — by a Building Administrator, scoped to their own
building, never self-registered — and granted the same access a Resident of
that apartment has, with exactly two reductions: no access to the Finance
module at all, and view-only access to Community Polls, since polls are
voted by apartment and a Renter is not that apartment's resident/owner of
record, so a Renter account MUST NOT be able to submit or change a poll
vote). Neither Resident nor Renter has access to this backoffice (web admin)
application itself — both are mobile-app-only account types. Every
capability in the product MUST map to an explicit permission for one or more
of these roles. Authorization MUST be enforced server-side on every request;
client-side UI state (hidden buttons, disabled routes) MUST NOT be treated as
an access control. Introducing a role beyond these five, or expanding Staff's
permissions beyond the Visitors, Incidencias, Package Receipt, Maintenance,
Broadcast, and Emergency modules, requires an explicit constitution
amendment.
**Rationale**: A small, explicit permission model is auditable and keeps
privilege-escalation risk visible as the product grows. Staff's scope is kept
deliberately enumerated — a fixed, small set of front-desk-style operational
modules — so that adding day-to-day operational capacity (logging visitors,
triaging maintenance tickets, handling packages, marking maintenance tasks
done, sending urgent broadcasts when a Building Administrator has switched
that on, and monitoring reported emergencies) does not quietly widen who can
touch resident, financial, or building-configuration data; each addition to
this list is itself a constitution amendment, not a routine feature decision.
Finance and Community Polls are deliberately excluded from Staff's scope even
as other operational modules are added to it — those touch financial records
and building-wide voting outcomes respectively, which this principle keeps
Building-Administrator-only unless a future amendment says otherwise.
Resident is enumerated explicitly (rather than left implicit) precisely because
it is a real, persisted account type with its own provisioning rule and
data-isolation scope — leaving it out of Principle II would mean actual schema
decisions (e.g., a `role` column value) had no constitutional basis, as
happened before an earlier amendment. Renter is enumerated for the same
reason, and its access is defined explicitly as "Resident, minus two named
things" rather than left for a future feature to decide ad hoc — so a later
change can't quietly grant a Renter financial visibility or a stray poll vote
by treating it as interchangeable with Resident; any further reduction or
expansion of Renter's access is itself a constitution amendment, the same as
any change to Staff's module list.

### III. Test-First for Authorization & Core Workflows (NON-NEGOTIABLE)
Authorization rules — who can create, edit, delete, or view a given resource, and
cross-building isolation specifically — MUST have automated tests written before
the corresponding implementation, covering both allowed and denied cases. Core CRUD
workflows for buildings, building-administrator assignment, facilities,
activities, and announcements MUST have tests before being marked complete. A change that
touches access control without a corresponding new or updated test MUST NOT be
merged.
**Rationale**: Access-control regressions are the highest-risk, hardest-to-notice
failure mode in a multi-tenant admin application; tests are the primary guardrail
against silently granting the wrong administrator access to the wrong building.

### IV. Auditability & Data Integrity
Create, update, and delete actions on buildings, building-administrator
assignments, facilities, activities, and announcements MUST be attributable to the acting
user and timestamped. Destructive or high-impact operations — deleting a building,
reassigning or removing a building administrator — SHOULD prefer soft-delete or
otherwise reversible patterns over irreversible hard deletes where practical, and
MUST be logged.
**Rationale**: Administrators manage shared community resources on behalf of
residents; disputes, mistakes, and abuse must be traceable after the fact and
recoverable where possible.

### V. Simplicity & Incremental Delivery
Build the minimum needed to satisfy the current spec. Avoid speculative
abstractions — generic plugin systems, configurability with no current consumer,
premature multi-tenancy features beyond "building" as the tenant boundary — until
a real second use case exists. Prefer standard framework conventions and
straightforward CRUD over custom infrastructure.
**Rationale**: Habitat is early-stage; premature complexity slows delivery and
enlarges the surface area for the authorization bugs Principle I and III exist to
prevent.

## Security & Access Control Requirements

- All authentication and authorization decisions MUST be enforced server-side;
  the client is never a trust boundary.
- Building Administrator accounts MUST be provisioned only by an App
  Administrator. Staff, Resident, and Renter accounts MUST be provisioned
  only by a Building Administrator — Staff for a single building, Resident
  and Renter each for a single apartment within that building.
  Self-registration directly into any of the five roles is prohibited.
- Sensitive actions — deleting a building, reassigning or removing a building
  administrator — MUST require explicit confirmation and MUST produce an audit
  log entry per Principle IV.
- Technology stack, hosting, and deployment target are otherwise unconstrained
  by this document — see Data Storage and Client Platform Requirements below
  for the pinned exceptions; all other choices belong in each feature's
  plan.md Technical Context, not in governance.

## Data Storage

- The system's database MUST be the project's Supabase project, **Habitat**.
  Introducing an alternative or additional primary datastore requires a
  constitution amendment.
- A working connection to the Habitat Supabase project MUST be configured and
  verified as available in every environment — local development, CI, and any
  deployed environment — before a feature that depends on persistence is
  considered mergeable.
- Connection credentials MUST be supplied via environment configuration and
  MUST NOT be committed to source control.

## Client Platform Requirements

- The backoffice MUST be installable as a Progressive Web App: a web app
  manifest and a service worker MUST be present and registered, enabling
  "Add to Home Screen" / browser install prompts and caching of the app shell
  and static assets for faster repeat loads. Offline data access is explicitly
  out of scope for this version — the service worker's job is installability
  and load performance, not functioning without a network connection; revisit
  this scoping via a constitution amendment if a real offline requirement
  emerges.
- Navigating between backoffice pages MUST NOT trigger a full page reload.
  This MUST be achieved through the application's own framework-native
  client-side routing (e.g., Next.js's `next/link` and `next/navigation`)
  rather than plain anchor-tag navigation, and MUST NOT be achieved by
  introducing a second, separate client-side routing library layered on top
  of (or in place of) the framework's own router — that would be exactly the
  kind of avoidable, competing complexity Principle V exists to prevent.
- Technology stack, hosting, and deployment target are otherwise unconstrained
  by this document beyond what is stated here and in Data Storage — all other
  choices belong in each feature's plan.md Technical Context, not in
  governance.
**Rationale**: Building Administrators and Staff use this app repeatedly
throughout a working day; a full page reload on every click and the
inability to install it as a focused, app-like surface both work against
that day-to-day usability. Pinning "installable" and "no full reloads" here —
without naming a specific routing library, which would conflict with
whichever framework a given deployment already uses — keeps the requirement
binding on outcome without dictating an implementation that may not fit the
chosen stack.

## Development Workflow & Quality Gates

- Any change touching authorization logic or cross-building data access MUST be
  reviewed explicitly against Principle I and Principle III before merge.
- Every new feature MUST state, before implementation begins, which role(s) —
  App Administrator, Building Administrator, Staff, Resident, and/or Renter —
  can access it; this belongs in the feature's spec, not decided ad hoc
  during coding.
- Every new backoffice page or navigation link MUST use client-side routing
  per Client Platform Requirements, not a plain full-page anchor link; this is
  checked at review time the same way authorization changes are.
- Complexity that appears to violate Principle V (e.g., new abstractions,
  configuration layers) MUST be justified in the plan's Complexity Tracking
  section or simplified before merge.

## Governance

This constitution supersedes ad hoc practices and prior undocumented
assumptions. All specs, plans, and PRs MUST verify compliance with the five
Core Principles above; an unresolved violation MUST either be justified in the
plan's Complexity Tracking section or resolved before merge.

**Amendment procedure**: Amendments are proposed via `/speckit-constitution`,
must state the rationale for the change, and take effect once written to this
file. Dependent templates and commands (plan, spec, tasks) that read this
constitution at runtime are re-checked for alignment after every amendment, per
the Sync Impact Report at the top of this file.

**Versioning policy**: Semantic versioning applies to this document —
MAJOR for backward-incompatible governance or principle removals/redefinitions,
MINOR for a new principle or materially expanded guidance, PATCH for wording
and clarification fixes that don't change requirements.

**Compliance review**: Every feature's plan.md Constitution Check gate is the
enforcement point for this document; a plan that cannot pass the gate without
unjustified complexity must be simplified or the constitution must be amended
first — not silently bypassed.

**Version**: 1.7.0 | **Ratified**: 2026-09-03 | **Last Amended**: 2026-09-07
