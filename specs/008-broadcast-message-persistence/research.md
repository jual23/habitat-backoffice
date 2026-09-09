# Phase 0 Research: Broadcast Module (Send, Persist, Deactivate)

## 1. Notification delivery: both in-app and push, via a trigger — matching the existing precedent

**Decision**: A single `AFTER INSERT ON broadcasts` `SECURITY DEFINER` trigger
(`notify_broadcast_sent()`) fans out to every resident of the building in one pass: it inserts one
`notifications` row per resident directly (bypassing RLS, since it's `SECURITY DEFINER`, the same
way `notify_reservation_decision()`/`notify_visitor_arrival()` already do), then loops that same set
of residents' `push_tokens` rows and calls `net.http_post` to Expo's push endpoint, exactly like
those two existing triggers.

**Rationale**: Two of this app's three existing notification integrations
(`notify_reservation_decision`, `notify_visitor_arrival`) already use exactly this shape — a
`SECURITY DEFINER` trigger doing both the in-app insert and the push loop in one atomic pass. Only
`packages`' registration notification (feature 004) used a Server-Action loop instead, because it
targets a handful of apartment residents and the action was already touching `profiles` for other
reasons. Broadcast fans out to an entire building (tens to low hundreds of residents), closer in
shape to what the trigger-based precedent already handles, and keeps the fan-out atomic with the
`broadcasts` row's own creation rather than spread across two separate write paths.

**"Bypass notification preferences when possible" (spec 007 FR-055)**: this app has no
notification-preference system today (confirmed — no such table/column/UI anywhere in the
codebase). This requirement is therefore satisfied vacuously as of this feature (there is nothing
to bypass yet) by using the same two channels — in-app row + push — every other notification in
this app already uses; no new delivery channel (SMS/email) is introduced, and nothing here
precludes a future preference system from special-casing broadcasts to still get through.

**Alternatives considered**: A Server-Action loop inserting `notifications` rows via the existing
generic `"notifications insert by staff or admin for their building"` RLS policy (feature 004),
mirroring packages (rejected — works, but splits one logical fan-out across two write paths for no
benefit at building-wide scale, and the generic policy would need every resident to already exist
as a `profiles` row the request-scoped client can see, which the trigger's `SECURITY DEFINER`
context handles more directly). A queue/job-based fan-out (rejected — no such infrastructure exists
in this app; Principle V).

## 2. Icon representation: a key into this app's existing built-in icon set, not a file or emoji picker

**Decision**: `broadcasts.icon` and `broadcast_templates.icon` are nullable short text keys (e.g.
`'fire'`, `'water'`, `'megaphone'`, `'warning'`) resolved client-side to one of a small, curated set
of this app's existing hand-drawn SVG icons (`components/icons.tsx`'s `base()` pattern) — a few new
icon components are added there for alert-relevant glyphs (fire, water drop, warning triangle),
matching the existing style. No Storage bucket, upload, or emoji-input library is introduced.

**Rationale**: Principle V — this app has no emoji-picker dependency and no precedent for
free-typed emoji storage; introducing either for a "nice to have" visual aid ("ideally... an
emergency emoji... the admin can also choose the appropriate icon" — spec 007) is more than the
requirement needs. A short enum-like key reusing the existing icon component library is the
simplest thing that lets an admin visually distinguish alert types, consistent with every other
status/type indicator already in this app.

**Alternatives considered**: A free-text emoji field (rejected — inconsistent with this app's
icon-only visual language everywhere else, and introduces unvalidated user input for something
purely decorative). An uploaded custom icon image per template (rejected — Storage bucket +
upload flow for a cosmetic field spec 007 itself calls "ideally," not required).

## 3. Icon scope: tied to predetermined templates; ad-hoc sends have none

**Decision**: Only `broadcast_templates` carries an admin-chosen icon at creation time. Sending a
broadcast **from** a template copies that icon onto the resulting `broadcasts` row; sending an
ad-hoc, one-off custom message leaves `broadcasts.icon` `NULL` (the mobile app renders a generic
default alert glyph for those).

**Rationale**: Spec 007's FR-052 ties the icon specifically to "save it as a reusable predetermined
message... with an associated icon" — it does not ask for icon selection on every ad-hoc send. This
is the narrowest reading that satisfies the stated requirement without adding an icon-picker step
to the fast, ad-hoc "something's wrong right now, alert everyone" path — which is exactly when an
admin is least likely to want an extra decision to make.

**Alternatives considered**: Letting every send (ad-hoc or templated) choose an icon (rejected — an
extra step on the path that most needs to be fast, for a requirement spec 007 only stated for
templates).

## 4. Multi-active broadcasts and the deactivate action

**Decision**: `broadcasts.status` is a `broadcast_status` enum (`active | deactivated`), not a plain
boolean — matching this codebase's existing convention (`ticket_status`, `package_status`,
`visitor_status`, `reservation_status`) of a small Postgres enum per lifecycle rather than a
boolean, for consistency and headroom (e.g., if a third state is ever needed). No column caps how
many `active` rows one building may have — spec 008's FR-006 requires multiple simultaneous active
broadcasts to be fully supported, so there's no uniqueness constraint here, just an index on
`(building_id, status)` for the active-list query, matching every other status-scoped list in this
app.

**Rationale**: Directly satisfies spec 008's resolved FR-006 (multiple broadcasts can be active at
once, sending a new one never auto-deactivates another). An enum keeps `deactivated_at`/
`deactivated_by` meaningfully paired with a `deactivated` status rather than inferred from a
boolean's `false` value plus nullable timestamp columns whose meaning would be less explicit.

**Alternatives considered**: A boolean `active` column (rejected — inconsistent with this
codebase's established enum-per-lifecycle pattern, and less legible than a named status).

## 5. Staff broadcast permission: a column on `buildings`, not a new generic settings table

**Decision**: `buildings.staff_broadcast_enabled boolean not null default false` — a single new
column on the existing `buildings` table, alongside `accent_color`/`logo_url`/`timezone`, which
already holds other per-building settings.

**Rationale**: Exactly one such toggle exists today (Constitution v1.6.0, spec 007 FR-053). Adding
it as a plain column matches how every other building-level setting already lives directly on
`buildings` — no new table, no generic key-value settings mechanism for a single consumer
(Principle V; also this plan's Complexity Tracking entry, which explains why a generic
feature-flag table was rejected).

**Alternatives considered**: A generic `building_settings` key-value table (rejected — speculative
generality for one flag; revisit only if a second, unrelated per-building toggle is proposed).

## 6. Renter role forward-compatibility (no special-casing needed)

**Decision**: The broadcast audience query is simply "every `profiles` row scoped to this
building" (`building_id = X AND apartment_id IS NOT NULL`), the same shape `users/page.tsx`'s
residents query already uses. No Broadcast-specific logic distinguishes Resident from the
not-yet-implemented Renter role.

**Rationale**: Spec 007 describes Renter as "provisioned the same way as a Resident" — a
`profiles` row scoped to a building/apartment. Once that role ships (via its own, still-pending
constitution amendment and feature), Renter accounts automatically receive broadcasts through this
same query with zero change to this feature. Building Broadcast to already assume Renter's
existence today would depend on a role that doesn't exist in the schema yet — unnecessary coupling
Principle V argues against.

**Alternatives considered**: Deferring Broadcast until after Renter ships (rejected — spec 008 was
explicitly requested and prioritized now; the audience query's building-scoped shape is
Renter-agnostic by construction, so there's no real dependency to wait on).

## 7. This plan was authored without live database verification

**Decision**: Unlike features 004/006 (which confirmed exact RLS policy/trigger shapes against the
live Habitat Supabase project before designing new migrations), this plan's Supabase MCP connection
was unavailable for the entire planning session — it disconnected earlier and requires the user to
re-authorize it. Every RLS/trigger/helper-function reference in data-model.md and
contracts/rls-policies.md below is written from this codebase's established conventions (confirmed
directly in features 004/006: `can_admin_building(_user_id, _building)`,
`has_building_role(_user_id, _role, _building)`, `is_building_member(_user_id, _building)`, the
enum-per-lifecycle pattern, content-immutability triggers, etc.) rather than freshly re-verified.

**Rationale**: Blocking this plan entirely on MCP access being restored would stop
`/speckit-plan` from finishing something the user explicitly asked to unblock (via the constitution
amendment) in this same session. The conventions this plan relies on are well-established (used
identically across three prior features) and low-risk to assume; the one place a real unknown
exists — whether `buildings` already has a building-scoped admin UPDATE policy to reuse for the new
`staff_broadcast_enabled` toggle (Customization, feature 001, already edits `accent_color`/
`logo_url` on `buildings`, strongly suggesting one exists) — is called out explicitly in
data-model.md rather than silently assumed, matching the "confirm existing artifacts" step
(features 004/006's own T002) that should be the first implementation task here too.

**Alternatives considered**: Halting `/speckit-plan` until MCP access is restored (rejected — the
user's request was to come back and plan now; nothing here is destructive or irreversible, and the
first implementation task already re-confirms the one real assumption before any migration runs).

## Summary

Two new tables (`broadcasts`, `broadcast_templates`), one new `buildings` column
(`staff_broadcast_enabled`), one new trigger (`notify_broadcast_sent()`), and a handful of new
built-in icon components — no new dependency, Storage bucket, or generic infrastructure. All
Technical Context unknowns are resolved; no `NEEDS CLARIFICATION` markers remain.
