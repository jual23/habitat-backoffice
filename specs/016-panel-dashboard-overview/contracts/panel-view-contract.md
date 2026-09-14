# Contract: Panel view (`/panel`)

This is a server-rendered page, not an API — the "contract" here is the
shape of data it reads, the role-based visibility rules it must enforce
server-side, and the navigation targets each element commits to.

## Access

| Role | Access |
|---|---|
| `building_admin` | Full panel (all 4 cards, full feed, full summary) |
| `staff` | Scoped panel (see data-model.md role-scoped visibility table) — previously redirected to `/login`; now allowed |
| `app_admin` | Unchanged: sees the existing "Panel no disponible para Administradores de la app" message |
| `resident` / `renter` | No access (already blocked at `layout.tsx`/middleware level — unaffected by this feature) |

Enforcement points (both required — defense in depth, per Client Platform /
Security requirements):
1. `lib/supabase/middleware.ts` — Staff route allowlist gains `/panel`.
2. `app/(backoffice)/panel/page.tsx` — computes which cards/feed
   types/summary rows to include based on `ctx.role`, *before* rendering;
   a Staff request never even queries `profiles` (Residents),
   `reservations`, or `feedback` counts/rows.

## Top stat cards

| Card | Value | Click target |
|---|---|---|
| Residentes | count, per data-model.md | `/apartments` or `/users` (existing Residents card behavior — reuse current target) |
| Incidencias | count, today | `/incidencias` |
| Paquetería | count, today | `/packages` |
| Visitas | count, today | `/visitors` |

Each card MUST render `0` (not blank, not omitted) when its count is zero.
Staff sees Incidencias/Paquetería/Visitas only (no Residentes card — table in
data-model.md).

## Recent activity feed (left column)

- Exactly the 5 most recent qualifying events, newest first (ties broken by a
  stable secondary key, e.g., `id`, so ordering doesn't visibly shuffle
  between loads).
- Each entry: a type label (Visita / Paquete / Incidencia / Emergencia /
  Queja or Sugerencia), a short human-readable description, a relative
  timestamp, and a click target of the corresponding module (optionally deep
  linking to the specific record where the module supports it; falling back
  to the module's list view otherwise).
- Empty state: a message, not an error or blank area, when zero qualifying
  events exist for the building.
- For Staff, suggestion/complaint-type entries are excluded from the
  candidate pool entirely (not merely hidden after the fact) — see
  research.md §4.

## Pending-items summary (right column)

| Row | Value | Click target | Staff visibility |
|---|---|---|---|
| Incidencias (open) | count, per data-model.md | `/incidencias` | shown |
| Paquetería por entregar | count, per data-model.md | `/packages` | shown |
| Quejas y sugerencias (unread) | count, per data-model.md | `/suggestions-complaints` | **hidden** |
| Reservas de instalaciones (en progreso) | count, per data-model.md | `/reservations` | **hidden** |

Every visible row MUST render even at `0`.

## Side effect: marking feedback viewed (not a card on this page)

Triggered by rendering `app/(backoffice)/suggestions-complaints/page.tsx` for
a `building_admin` (or `app_admin`) session:

- **Input**: the set of `feedback` row ids about to be shown to the viewer
  (i.e., that page's normal data fetch for its building) that currently have
  `viewed_at is null`.
- **Effect**: those rows' `viewed_at` is set to the current time (if still
  `null` — no-op if another concurrent request already set it).
- **Not triggered by**: a Staff session (no route access to this page at
  all), a resident/renter session (no backoffice access), or the Panel page
  itself (the Panel only *reads* the unread count, it never marks rows
  viewed).
- **Authorization**: enforced by the `viewed_at` RLS UPDATE policy
  (data-model.md) — only `building_admin`/`app_admin` for the row's own
  building can succeed; this must be covered by
  `tests/integration/rls-suggestions-complaints.test.ts` before being relied
  upon by the page (Principle III).
