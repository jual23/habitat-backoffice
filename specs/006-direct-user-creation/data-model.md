# Phase 1 Data Model: Direct User Creation (Replacing Invitations)

This extends the live Habitat Supabase schema. See `specs/001-building-backoffice/SCHEMA-ADAPTATION.md`
for this project's naming conventions and `specs/004-facilities-incidencias-packages/SCHEMA-ADAPTATION.md`
for the live RLS helper functions' actual argument order — both apply to the migrations below.

## Modified table: `profiles`

| Column | Type | Notes |
|---|---|---|
| `first_name` | text, nullable | **NEW**. FR-002. Nullable because rows created before this feature (via the old `invitations`-accept path, whenever that existed, or seed data) predate it. Required at the application/Zod layer for every *new* creation, never enforced by a DB `NOT NULL` (would break existing rows). |
| `last_name` | text, nullable | **NEW**. FR-002. Same nullability rationale as `first_name`. |
| `document_id` | text, nullable | **NEW**. FR-003. Free-form text (not a fixed-format numeric field — see spec.md's Assumptions: no country-specific format or uniqueness is enforced), matching the existing `visitors.document_id` column's shape/precedent. |
| `full_name` | text, NOT NULL, default `''` | **UNCHANGED**. Every existing call site that reads `full_name` (audit log metadata, list displays, join lookups across tickets/packages/visitors) keeps working unmodified. `handle_new_user()` continues to populate it (now from `first_name`/`last_name` when the caller provides them — see Triggers below) so it remains a reliable "display name" without every existing `.select('full_name')` needing to change. |
| `building_id`, `apartment_id` | uuid, nullable, unchanged FK shape | **UNCHANGED column definitions.** What changes is *when* they get set for an account created through this feature — see Triggers below (research.md item 2). |

No column is removed. No index changes (neither new column is queried/filtered on by this
feature — the Users and Roles page already loads all of a building's residents/staff and filters
client-side, matching every other list in this app).

## Trigger: `handle_new_user()` (modified, not new)

`AFTER INSERT ON auth.users`, `SECURITY DEFINER` — already exists (feature 001). Extended to read
additional keys out of `new.raw_user_meta_data`, all of which are optional/`NULL`-safe so every
existing caller of `auth.users` insertion (if any exists outside this feature) is unaffected:

```text
insert into public.profiles (id, full_name, first_name, last_name, document_id, email,
                              building_id, apartment_id)
values (
  new.id,
  coalesce(new.raw_user_meta_data->>'full_name', ''),
  new.raw_user_meta_data->>'first_name',
  new.raw_user_meta_data->>'last_name',
  new.raw_user_meta_data->>'document_id',
  new.email,
  nullif(new.raw_user_meta_data->>'building_id', '')::uuid,
  nullif(new.raw_user_meta_data->>'apartment_id', '')::uuid
)
on conflict (id) do nothing;
```

**Why in the trigger, not a follow-up UPDATE**: research.md item 2 — the existing
`"profiles managed by admins"` RLS policy requires `building_id IS NOT NULL` on the *current* row
before a building_admin can update it, so a profile created with `building_id = NULL` could never
be claimed into a building afterward through the normal RLS-enforced client. Setting it inside the
same `SECURITY DEFINER` trigger invocation that already runs exactly once per `auth.users` row
avoids that gap entirely.

## New/reused write: `user_roles` (Staff only — no schema change)

Creating a **Staff** account additionally inserts one `user_roles` row
(`user_id`, `role = 'staff'`, `building_id`) through the normal RLS-enforced, request-scoped
client — reusing the existing `"staff role insert by building admins"` policy
(`role = 'staff' AND building_id IS NOT NULL AND can_admin_building(auth.uid(), building_id)`,
added by feature 001, already covered by `tests/integration/rls-staff-provisioning.test.ts`).
**Resident** accounts need no `user_roles` row — `getUserContext()` already treats "no `user_roles`
row + `profiles.apartment_id` set" as a resident (`lib/session.ts`).

## `invitations` table — unchanged, narrowed usage

No schema or policy change. `createResident()`/`createStaff()` stop *inserting* new rows here
(FR-001); `cancelResidentInvitation()`/`cancelStaffInvitation()` and the pending-invitation list
queries on `/users` stay exactly as they are today, so any invitation rows that already existed
before this feature shipped remain fully manageable (spec.md's Edge Cases).

## Key entity summary (spec.md's Key Entities, made concrete)

- **Resident / Staff account** = a `profiles` row (`first_name`, `last_name`, `document_id`,
  `email`, `building_id`, and — for residents — `apartment_id`, all set at creation time by the
  trigger above) plus, for Staff only, one `user_roles` row. Before this feature, the same concept
  was represented pre-acceptance only by an `invitations` row; that intermediate representation no
  longer exists for accounts created going forward.
