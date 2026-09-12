# Internal Contract: `/users` Content by Role

Not a public API — the internal rule for what the single `/users` navigation entry renders, since it now shows fundamentally different content depending on who's viewing it (spec.md Edge Cases). Reviewers should check `users/page.tsx` changes against this contract the same way authorization changes are checked against Principle I/III (constitution → Development Workflow & Quality Gates).

## Role branch contract

1. **MUST** determine which content to render from `ctx.role` alone (server-side, in `page.tsx`), never from a client-side toggle or URL parameter — consistent with every other role gate in this app.
2. **App Administrator (`ctx.role === 'app_admin'`) MUST** see: the buildings list (data-model.md §4, with a clear "no administrator" indicator for any building that has none), a way to create a new building with its first Building Administrator (choosing an existing one from a dropdown or creating a new account), and — per building — a way to edit its name/logo and reassign (or first-assign) its administrator the same way. **MUST NOT** see any resident, staff, invitation, or apartment data — none of that is scoped to a single building App Administrator is "in," since they aren't scoped to any building at all.
3. **Building Administrator (`ctx.role === 'building_admin'`) MUST** see exactly what they see today — the existing resident/staff/admin-listing tabs (`users-client.tsx`), completely unchanged, driven by the completely unchanged `building_admin` branch of `page.tsx`. **MUST NOT** see the buildings list or any other building's data — this is unrelated to and unaffected by App Administrator's new content.
4. **Staff** — unaffected; Staff never had access to `/users` before this feature and does not gain it now (unchanged from today).

## Server Action contract

1. Every new Server Action in `buildings-actions.ts` (`createBuilding`, `updateBuilding`, `reassignBuildingAdministrator`) **MUST** independently verify `ctx.role === 'app_admin'` — **MUST NOT** rely on the UI/navigation restriction (FR-001) as its only gate, matching every existing action's `requireBuildingAdmin()`-style pattern in this app (Constitution Principle III: server-side enforcement, not a UI-only control). There is no separate `assignBuildingAdministrator` function — `createBuilding` handles first-assignment inline, and `reassignBuildingAdministrator` handles every later change, including assigning one to a building that currently has none.
2. Every one of those actions **MUST** call `writeAuditLog()` after a successful mutation: `action: 'building.create'` (covers the building row and, whichever path was chosen, its first administrator), `action: 'building.update'`, or `action: 'building_admin.reassign'` — matching the existing pattern in `users/actions.ts` and `customization/actions.ts`.
3. `createBuilding` **MUST** follow the ordering in research.md §8 (building row first, administrator assignment last — whether a new account or an existing-user `user_roles` insert — rollback on that failure) so a request that completes MUST NEVER leave a `buildings` row with zero corresponding `role = 'building_admin'` rows.
4. `reassignBuildingAdministrator` **MUST** insert the new `user_roles` row before deleting any outgoing one (research.md §8) — for the same zero-administrator-window reason; deleting zero rows (a building that had none) is an expected no-op, not an error.
5. Both `createBuilding` and `reassignBuildingAdministrator`'s "select an existing Building Administrator" path **MUST** source candidates only from existing `role = 'building_admin'` rows — **MUST NOT** offer App Administrator accounts (FR-013, research.md §10's role-resolution-precedence reasoning).

## Out of scope for this contract

- Building deletion — not part of this feature (spec.md Assumptions).
- Anything about how Customization, Facilities, or any other building-operational module renders for `building_admin`/`staff` — entirely unaffected and out of scope here.
