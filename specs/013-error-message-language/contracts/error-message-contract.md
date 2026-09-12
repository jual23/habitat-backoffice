# Contract: User-Facing Error Message

This isn't a network API contract — it's the internal contract every Server Action in `app/(backoffice)/**/actions.ts` (and `lib/user-provisioning.ts`) must honor when returning a failure to a Client Component.

## Contract

Every failure path MUST return (or `setError(...)` MUST receive) a string that is:

1. **Spanish**, matching the rest of the interface (FR-001, FR-002).
2. **Free of raw technical detail** — no driver error codes, constraint/column names, stack traces, or library-specific wording (FR-004). If the underlying cause wasn't specifically anticipated by the action's own checks, the message MUST come from `toFriendlyMessage(error, fallbackSpanishMessage)` (see [data-model.md](../data-model.md)), never from `error.message` directly.
3. **Faithful to embedded data** — an email, unit number, or file name that is part of the message MUST appear exactly as entered, untranslated (FR-005). Only the surrounding sentence is Spanish.
4. **Consistent regardless of failure category** — a business-rule violation (User Story 1), an unanticipated/technical failure (User Story 2), and a permission/not-found rejection (User Story 3) are all held to the same standard; none get a pass to remain in English.

## Non-goals

- This contract does not require a locale parameter, a translation key, or any mechanism for a second language — the app has exactly one interface language (Spanish) today (research.md Decision 1).
- This contract does not change the `{ ok: boolean; error?: string }` success/failure shape itself, nor any action's control flow, validation rule, or authorization check — only the language and safety of the message text.

## Verification

Grep audit (must return zero matches once implementation is complete), run from the repo root:

```sh
# Hardcoded English literals in error returns
grep -rnE "error: '[A-Z][a-zA-Z ]+" app/\(backoffice\) lib/user-provisioning.ts

# Raw driver-error passthrough (should be routed through toFriendlyMessage instead)
grep -rn "error\.message\b" app/\(backoffice\)/**/actions.ts

# English Zod validation messages
grep -rnE "'[A-Z][a-zA-Z ]{3,}'" lib/validation/*.ts
```

Plus the manual scenarios in [quickstart.md](../quickstart.md), one per user story.
