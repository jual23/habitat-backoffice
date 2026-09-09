# Contract: `createBuildingUser()` — Direct Account Provisioning

Unlike a normal Supabase-client call, this is not enforced by an RLS policy on the write that
matters most (the `auth.users` insert is inherently RLS-bypassing — that's why it needs the Admin
API at all). Per Constitution Principle III, this contract **is** the authorization boundary for
that one write, and MUST have an automated allow/deny test before implementation, same as an RLS
policy would.

## Inputs (all resolved server-side before this function is called — see research.md item 4)

| Input | Source | Notes |
|---|---|---|
| `actorId` | `getUserContext(supabase).user.id` | For the audit log; never client-supplied. |
| `buildingId` | `getUserContext(supabase).buildingId` | **MUST** come from the caller's own authenticated session, never a client-supplied parameter — this is the field the elevated Admin API call would otherwise write with no RLS check at all. |
| `role` | `'resident' \| 'staff'` | Determines whether an `apartment_id` is required and whether a `user_roles` row is inserted. |
| `email`, `password`, `firstName`, `lastName`, `documentId` | Validated by `lib/validation/users.ts` before this function is called | See data-model.md for where each lands. |
| `apartmentId` | Required when `role === 'resident'`; absent for `'staff'` | Additionally checked to belong to `buildingId` (defense in depth, matching the existing pattern in `packages`' apartment-scoping — feature 004's `contracts/rls-policies.md`). |

## Behavior contract

| Scenario | Allowed | Denied |
|---|---|---|
| A `building_admin` (or, for Resident only, an `app_admin`) creates an account, `buildingId` resolved from their own session | ✅ Account created, scoped to that building | — |
| A `staff` or `resident` session attempts to invoke account creation | — | ❌ Rejected before `createBuildingUser()` is ever called — the existing `requireBuildingAdmin()`/staff-only gate in `users/actions.ts`/`staff-actions.ts` is unchanged (FR-009) |
| The given `apartmentId` belongs to a different building than `buildingId` | — | ❌ Rejected: "apartment not found in this building" style error, no account created |
| The given `email` already has an account | — | ❌ Rejected with the Admin API's duplicate-email error, surfaced as a friendly message (FR-007); no account created |
| The given `password` is shorter than this feature's minimum (research.md item 5) | — | ❌ Rejected by the Zod schema before any network call (FR-008); no account created |
| `role === 'staff'`: the resulting `user_roles` insert | Uses the existing `"staff role insert by building admins"` RLS policy — allowed because `buildingId` is the caller's own | Denied by that same policy if `buildingId` were ever anything else (defense in depth; should be unreachable given `buildingId`'s source) |

## What this contract deliberately does NOT cover

- Building Administrator account creation — out of scope (spec.md's Assumptions; handled by an App
  Administrator elsewhere, unaffected by this feature).
- Anything about the `invitations` table — unchanged (data-model.md).
- Rate limiting / abuse prevention on repeated account creation — no requirement in spec.md; not
  introduced here (Principle V).
