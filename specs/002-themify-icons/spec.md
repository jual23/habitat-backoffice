# Feature Specification: Themify Icons for a Friendlier Look

**Feature Branch**: `002-themify-icons`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "I want to replace existing icons with the Themify icons to provide a friendlier look."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Friendlier navigation icons (Priority: P1)

As a Building Administrator or Staff member using the backoffice, when I look at the sidebar
navigation (Panel, Instalaciones, Noticias y avisos, Actividades, Visitas, Documentos, Quejas y
sugerencias, Apartamentos, Usuarios y roles, Personalización), I see warmer, friendlier icons next
to each item instead of the current plain outline icons, so the app feels more approachable while
still being easy to scan.

**Why this priority**: The sidebar is visible on every screen of the backoffice — it's the single
highest-impact place to change the app's visual tone, and doing it first validates the new icon
set works well at a glance before rolling it out everywhere else.

**Independent Test**: Open any backoffice page and view the sidebar; every navigation item shows a
recognizable, friendly icon matching its label, and the currently-active item is still clearly
distinguishable from the rest.

**Acceptance Scenarios**:

1. **Given** a Building Administrator is signed in, **When** they view the sidebar, **Then** every
   navigation item (Panel through Personalización) displays a Themify icon appropriate to its
   meaning.
2. **Given** a Staff member is signed in, **When** they view their single-item sidebar (Visitas
   only), **Then** that item shows its Themify icon consistent with the same icon used for
   Building Administrators.
3. **Given** a user is on a given page, **When** they look at the sidebar, **Then** the active
   navigation item remains visually distinguished from inactive items (e.g., background/color
   highlight), independent of the icon change.

---

### User Story 2 - Friendlier action icons (Priority: P2)

As a Building Administrator, when I look at action controls throughout the backoffice — add,
edit, delete, pin, attach, sign out, and similar buttons on Instalaciones, Noticias y avisos,
Actividades, Apartamentos, Usuarios y roles, Visitas, Documentos, and Quejas y sugerencias — I see
the same friendlier Themify icon style instead of the current outline icons, so the whole app
feels visually consistent rather than having the sidebar look different from the content area.

**Why this priority**: Once the icon language is established in the sidebar (P1), the biggest
remaining inconsistency is the action buttons scattered across every list/card view; matching
their style completes the "friendlier look" goal for the parts of the app administrators interact
with most.

**Independent Test**: Open Instalaciones (or any other module with add/edit/delete controls);
every such icon button shows a Themify icon, and every action still performs exactly what it did
before (creating, editing, deleting, pinning, attaching, signing out).

**Acceptance Scenarios**:

1. **Given** a list or card view with add/edit/delete controls (e.g., Apartamentos, Instalaciones),
   **When** the Building Administrator views it, **Then** each control shows a Themify icon and
   remains fully functional.
2. **Given** the Noticias y avisos view, **When** the Building Administrator views a pinned
   announcement or an attachment control, **Then** the pin and paperclip-style icons are rendered
   using the Themify set.
3. **Given** the sidebar footer, **When** any signed-in user views it, **Then** the "Cerrar sesión"
   control shows a Themify icon.

---

### User Story 3 - Friendlier building/status icon accents (Priority: P3)

As a Building Administrator, when I look at places that use a decorative or status icon rather
than a navigation/action icon — the sidebar's building logo placeholder (shown when no logo is
uploaded), the login page's brand mark, and per-item icon avatars on cards without a photo (e.g.,
a facility or activity with no image) — I see the same Themify icon language applied there too, so
no corner of the app looks visually out of place.

**Why this priority**: Lowest priority because these are the least-frequently-seen icons (only
shown as fallbacks/decoration), but completing them avoids an inconsistent "some icons changed,
some didn't" impression.

**Independent Test**: View the sidebar/login page for a building with no logo uploaded, and view a
facility or activity card with no photo; all show a Themify icon in place of the current fallback
icon.

**Acceptance Scenarios**:

1. **Given** a building has no logo uploaded, **When** a Building Administrator views the sidebar
   header or the login page, **Then** the fallback brand icon is rendered using the Themify set.
2. **Given** a facility or activity has no photo/banner, **When** the Building Administrator views
   its card, **Then** the fallback icon avatar shown on the card is rendered using the Themify set.

---

### Edge Cases

- What happens when a specific existing icon (e.g., the walking-person icon used for Visitas) has
  no direct one-to-one equivalent in the Themify set? The closest reasonable Themify icon for the
  same meaning is used; no navigation item or action is left without an icon.
- How does the icon rendering behave when a page is used on a slow connection? Icons must not
  block the page's text/functionality from being usable — if icons load after the rest of the
  page, labels and controls remain fully readable and clickable in the meantime.
- How do icons behave when placed on a colored background (e.g., the active sidebar item's dark
  green highlight, or a solid-colored button)? Icons must remain clearly visible (adequate
  contrast) in every such context they currently appear in today.
- What happens to icons that don't have an established meaning in Themify's set at all (none
  expected, but if found during implementation)? The closest visual match is chosen and the choice
  is documented, rather than leaving a blank/broken icon.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a Themify-style icon for every backoffice sidebar navigation
  item (Panel, Instalaciones, Noticias y avisos, Actividades, Visitas, Documentos, Quejas y
  sugerencias, Apartamentos, Usuarios y roles, Personalización), replacing the current icon set.
- **FR-002**: The system MUST display a Themify-style icon for every action control currently
  shown with an icon, including but not limited to: create/new, edit, delete, pin/unpin, attach
  file, and sign out — across Apartamentos, Instalaciones, Noticias y avisos, Actividades, Visitas,
  Documentos, Quejas y sugerencias, and Usuarios y roles.
- **FR-003**: The system MUST display a Themify-style icon for decorative/fallback icons,
  including the sidebar/login building-brand placeholder and the no-photo icon avatar shown on
  facility/activity cards.
- **FR-004**: Replacing an icon MUST NOT change what the underlying navigation link or action
  button does — every existing click behavior, keyboard accessibility label, and confirmation
  dialog continues to work exactly as before.
- **FR-005**: Icons MUST remain legible against every background color they currently appear on
  (the sidebar's active-item highlight, button backgrounds, plain white/light card backgrounds),
  matching or exceeding the current icon set's visibility.
- **FR-006**: The system MUST use one consistent icon set (Themify) across the entire backoffice
  after this change — no page or module may be left showing the old icon set once the change is
  complete.
- **FR-007**: Every navigation item and action control that previously showed an icon MUST
  continue to show an icon after this change (no icon may be silently dropped).

### Key Entities

*(This feature changes only visual presentation; it introduces no new data entities.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the ten sidebar navigation items display a Themify icon (verified by visual
  review of the sidebar for both a Building Administrator and a Staff session).
- **SC-002**: 100% of existing icon-bearing action controls across all backoffice modules display
  a Themify icon, with zero regressions in what each control does when clicked.
- **SC-003**: Zero navigation items or action controls are left showing the previous icon set or
  no icon at all, across every backoffice page, once the change is complete.
- **SC-004**: A person unfamiliar with the change can look at the sidebar and correctly guess the
  purpose of at least 8 of the 10 navigation items from their icon alone (a rough proxy for
  "friendlier/more recognizable").

## Assumptions

- "Themify icons" refers to the Themify Icons open-source icon set (the well-known `ti-*` icon
  font/set), the only icon set the user named.
- "Existing icons" refers to the custom inline icon set introduced earlier in the backoffice
  redesign (sidebar navigation, action buttons, badges, and decorative fallbacks) — this feature
  replaces that set, not any icons outside the backoffice (e.g., none exist on the login page
  besides the brand mark already covered in User Story 3).
- This is a like-for-like visual swap: every place an icon appears today continues to show an
  icon (of the same approximate size/role) after the change — no navigation items, buttons, or
  cards are added, removed, or restructured as part of this feature.
- Icon color/contrast behavior (e.g., white icon on a colored active nav item, currentColor
  inheriting a button's text color) is expected to work the same way it does today; no new color
  scheme is introduced by this feature.
- No new build/runtime dependency approval process is needed beyond what the implementation plan
  will determine — how the icon set is delivered (e.g., icon font vs. individual icon
  files) is an implementation decision for `/speckit-plan`, not part of this specification.
