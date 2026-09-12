# Phase 1 Data Model: App Administrator Building Management

No new tables. This feature adds write paths (and one read path — a cross-building SELECT) to two existing tables, `buildings` and `user_roles`, both already defined in the live schema (`lib/supabase/database.types.ts`).

## 1. `buildings` (existing table — no schema change)

| Field this feature touches | Type | Notes |
|---|---|---|
| `id` | `string` (uuid, generated) | Referenced by the new Building Administrator's `user_roles.building_id` (research.md §8) |
| `name` | `string`, required | The only required field on creation (FR-005) |
| `logo_url` | `string \| null` | Set via the existing `uploadBuildingFile()` path (research.md §9) — optional at creation |
| `accent_color`, `address`, `timezone`, `payment_*`, `late_fee_*`, `staff_broadcast_enabled` | various, all already have defaults or are nullable | **Not** part of this feature's create/edit form (research.md §9) — left at their existing defaults, changeable later by the building's own Building Administrator via Customization/Finance, unchanged from today's behavior |

**Validation rules**:
- `name` MUST be non-empty (FR-005's "at minimum a name").
- A logo, if provided, MUST be a square image (reuses `updateCustomization()`'s existing check — research.md §9).

## 2. `user_roles` (existing table — no schema change)

The relationship between one user and the one building they administer, for `role = 'building_admin'` rows specifically (this feature does not touch `app_admin` or `staff` rows).

| Field | Type | Notes |
|---|---|---|
| `user_id` | `string` (uuid) | The Building Administrator's `auth.users.id` |
| `role` | enum, `'building_admin'` for this feature's purposes | Existing enum value, already used elsewhere in the app (e.g., `users/page.tsx`'s existing admin-listing query) |
| `building_id` | `string` (uuid) | The building this administrator is scoped to |

**Validation rules** (FR-011, application-enforced — research.md §8, no new DB constraint):
- Every `buildings` row created through this feature MUST have exactly one corresponding `user_roles` row with `role = 'building_admin'` and matching `building_id`, from the moment it's created onward.
- A `buildings` row that predates this feature and has zero matching `role = 'building_admin'` rows is a valid, expected state the buildings list MUST surface clearly (data-model.md §4's "no administrator" state) rather than treat as an error — and MUST be resolvable via the same reassign action used for any other building (FR-011's updated wording, research.md §10).
- On reassignment (or first assignment to a building with none), the new row is inserted before any old one is deleted (never a zero-administrator window when one already existed); on creation, if the administrator account/assignment fails, the just-created `buildings` row is deleted (never a *new* administrator-less building left behind).

## 3. Relationships

```text
buildings (1) ──── (1) user_roles WHERE role = 'building_admin'
   │                     │
   │ id                  │ building_id
   └─────────────────────┘

buildings (1) ──── (1) auth.users  [via user_roles.user_id]
                         (the Building Administrator's account)
```

## 4. Content model: what App Administrator sees at `/users` (not a DB table — page content, per contracts/app-admin-users-content.md)

| Field | Source | Notes |
|---|---|---|
| Buildings list | `buildings` SELECT, all rows (no `building_id` filter — App Administrator spans all buildings) | FR-004 |
| Each building's current administrator | `user_roles` WHERE `role = 'building_admin'` AND `building_id = <that building>`, joined to that user's display info (matches the existing pattern `users/page.tsx`'s `building_admin` branch already uses for its own admin-listing query) | FR-008 |
| Create-building form | `name` (required text), `logo` (optional file) | FR-005, data model §1 |
| Existing-Building-Administrator dropdown | All `user_roles` rows where `role = 'building_admin'`, joined to each user's display profile, deduplicated by user — **excludes** App Administrator accounts (FR-013, research.md §10) | FR-006, FR-009 |
| New-administrator-account form (shown when the App Administrator skips the dropdown) | Same base account fields as Staff creation (email, password, first name, last name, document ID) — same shape as `lib/validation/users.ts`'s existing base account fields, duplicated in `lib/validation/buildings.ts` rather than imported (research.md §9) | FR-006, FR-009 |
| Reassign-administrator action | Choose from the dropdown above, or the new-account form — works identically whether the building currently has an administrator or none at all | FR-009, FR-011 |

## 5. What does *not* change

- `profiles`, `apartments`, `invitations`, and every other Building-Administrator/Staff/Resident-facing table and query — completely untouched by this feature (FR-002).
- The existing `building_admin` branch of `users/page.tsx` and all of `users-client.tsx`/`actions.ts` — read and write paths identical to today (research.md §3).
