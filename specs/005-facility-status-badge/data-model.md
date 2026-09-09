# Phase 1 Data Model: Single Facility Status Indicator

No schema, table, column, or RLS change. This feature is a display-only consolidation within
`facilities-client.tsx`.

## Facility (existing entity — read, not modified)

The client component already receives every field it needs from `page.tsx`:

| Field | Used for |
|---|---|
| `reservable` | Previously drove the badge being replaced; now read only by the footer `Toggle` (unchanged). |
| `opens_at`, `closes_at`, `open_days` | Already consumed by `isFacilityOpen()` (feature 004) to compute the `open` boolean this feature's badge now displays instead of the dot. |
| `buildingTimezone` (prop, from `buildings.timezone`) | Already passed to `isFacilityOpen()`; unchanged. |

## Derived display value

- `open: boolean` — already computed per card via `isFacilityOpen(f, buildingTimezone)`
  (feature 004). This feature adds no new derivation; it changes only which two DOM elements read
  that existing value (one `Badge`, replacing the dot `<span>` and the reservable `Badge`) rather
  than three.

No state transitions, constraints, or indexes are affected.
