# Research: Error Message Language Consistency

## Context

A repo-wide audit (grep across `app/(backoffice)/**/actions.ts`, `lib/validation/*.ts`, and `lib/user-provisioning.ts`) found the interface is Spanish throughout (labels, buttons, page copy, and the two existing client-side `setError(...)` calls), but the error text returned by Server Actions is inconsistent:

- **~30 hardcoded English string literals** returned directly as `{ ok: false, error: '...' }` across ~15 `actions.ts` files (e.g. `'This unit already exists in this building.'`, `'This payment can no longer be approved.'`, `'Not authorized'`, `'Document not found'`).
- **~90 raw driver/library passthroughs**: `error.message` / `fetchError?.message` / `e instanceof Error ? e.message : '...'`, forwarding whatever text Postgres, Supabase Storage, or Supabase Auth produced — untranslated, occasionally exposing internal detail (constraint names, column names).
- **~30 Zod validation messages** (`parsed.error.issues[0]?.message ?? 'Invalid input'`) across 13 of 15 files in `lib/validation/`, most with an explicit but English custom message (e.g. `'Name is required'`, `'A valid email is required'`); the `?? 'Invalid input'` fallback is itself English too.

No i18n/localization library or locale-switching mechanism exists anywhere in the codebase (confirmed: no `next-intl`, `i18next`, or similar dependency; no `cookieOptions`/locale config). The app has always been single-language (Spanish UI copy hardcoded directly in JSX/TSX).

## Decision 1: Translate in place, do not introduce an i18n framework

**Decision**: Fix this by editing the existing strings directly (hardcoded Spanish literals, same as every other piece of UI copy in the app), not by introducing a localization library, message-catalog system, or translation key layer.

**Rationale**: The app has exactly one interface language today and no stated requirement for more (constitution and spec Assumptions both confirm this is a consistency fix, not an i18n feature). Introducing a full i18n framework for a single-locale app is exactly the kind of speculative abstraction Constitution Principle V (Simplicity & Incremental Delivery) rules out — "avoid... configurability with no current consumer... until a real second use case exists."

**Alternatives considered**:
- A translation-key + message-catalog system (e.g. `t('errors.unitExists')`) — rejected: adds a lookup layer, a catalog file, and a new convention for zero present benefit, since there is only one locale to serve.
- A runtime locale-detection/switching mechanism — rejected: no requirement exists for a second language; out of scope per spec Assumptions.

## Decision 2: A single shared fallback for raw/unexpected errors, not per-file translation of every possible driver message

**Decision**: Add one small shared helper — `toFriendlyMessage(error: unknown, fallback: string): string` in `lib/errors.ts` — used everywhere a Server Action currently forwards `error.message` (or `e instanceof Error ? e.message : '...'`) directly to the user. It logs the original error server-side (`console.error`, for debuggability — consistent with the app's existing practice of not silently swallowing errors) and always returns the Spanish `fallback` string to the caller, never the raw driver/service text.

**Rationale**: This is the direct implementation of FR-003/FR-004 and spec User Story 2 ("even if generic"). A single shared helper, called from ~90 sites, is simpler and more consistent than writing bespoke Spanish translations for every possible Postgres/Storage/Auth error string (which are numerous, change with library versions, and frequently contain internal detail — column/constraint names — that should never reach a user anyway per FR-004). Every one of these call sites already has a specific, already-translated (Decision 1) message for every business rule the code actually checks for beforehand (e.g., the duplicate-unit check happens before the generic insert error is ever reached) — so the fallback path is, by construction, only ever the "we didn't specifically anticipate this" case, which is exactly what a generic message is for.

**Alternatives considered**:
- Mapping specific Postgres error codes (e.g. `23505` unique-violation) to tailored Spanish messages inside the helper — rejected for this feature: every current call site with a known, specific failure mode already has its own dedicated pre-check and dedicated (now-translated) message; the remaining passthrough sites are exactly the ones with no specific handling today, matching User Story 2's "unanticipated failure" framing. Nothing prevents adding code-specific messages later without changing the helper's signature.
- Leaving `error.message` untranslated with a comment "TODO: translate" — rejected: fails FR-004 and leaves the exact leak this feature exists to close.

## Decision 3: Give every Zod schema field an explicit Spanish message; keep one Spanish generic fallback for the rest

**Decision**: Replace every existing English custom message in `lib/validation/*.ts` (e.g. `.min(1, 'Name is required')` → `.min(1, 'El nombre es obligatorio')`) with an equivalent Spanish one, one-to-one, preserving the exact validation rule. Change the generic `parsed.error.issues[0]?.message ?? 'Invalid input'` fallback (used in the `actions.ts` files that consume these schemas) to a Spanish generic fallback (`?? 'Datos inválidos. Revisa el formulario.'`), as a safety net for any Zod-internal default message not covered by an explicit custom one.

**Rationale**: Field-level validation messages are the most specific, most useful category of error a user sees (they say exactly what's wrong with what they typed) — collapsing them to one generic string, as Decision 2 does for truly unanticipated failures, would be a real UX regression here. Translating them 1:1 is mechanical, low-risk (the validation rule itself is untouched), and keeps the same specificity the app already has, just in Spanish.

**Alternatives considered**: Using `z.setErrorMap()` to globally translate Zod's built-in default messages (the ones shown when a field has no custom message at all) — considered but not needed: every field found in the audit that fails validation in a user-visible way already carries an explicit custom message once Decision 3 is applied; a global error map would be additional machinery for a case the audit didn't find in active use. Revisit only if a future schema field is added without a custom message.

## Decision 4: Verification is a repo-wide grep audit, not a new automated test

**Decision**: Completion is verified by re-running the same grep patterns used for this audit (English string literals in `error:` returns, `parsed.error.issues[...].message` fallbacks, and `.message` passthroughs in `app/(backoffice)/**/actions.ts`, `lib/user-provisioning.ts`, and `lib/validation/*.ts`) and confirming zero remaining matches, plus a manual pass through `quickstart.md`'s scenarios (one concrete trigger per user story).

**Rationale**: This is a text-content correctness change, not a new behavior or code path — existing integration tests (which assert on `{ ok, error }` shape and business-rule outcomes, not on the literal error string's language) do not need to change, and writing new automated tests whose only assertion is "this string is in Spanish" (an assertion about copy, not logic) is disproportionate for a single-locale app with no i18n framework to regress against. Constitution Principle III's test-first requirement applies to *authorization* rules and core CRUD workflows, neither of which this feature touches — no control-flow, permission check, or data access changes; only the text of messages already being returned changes.

**Alternatives considered**: A lint rule or CI check banning English string literals in `error:` returns — worth considering as a future guardrail, but out of scope for this feature (Principle V: build the minimum needed for the current spec).

## Summary of files in scope (representative, confirmed by audit; exact edit list finalized in tasks.md)

- `lib/errors.ts` — **new**, the shared `toFriendlyMessage()` helper (Decision 2).
- `lib/validation/*.ts` (13 of 15 files have English custom messages today) — translate custom messages; Spanish generic fallback where consumed.
- `app/(backoffice)/**/actions.ts` (~15 files with hardcoded English literals; ~19 files with raw `.message` passthroughs — overlapping sets) — translate literals in place; replace passthroughs with `toFriendlyMessage(...)`.
- `lib/user-provisioning.ts` — 3 hardcoded English literals, translate in place.
- No changes needed: client components (`login-form.tsx`, `maintenance-client.tsx`, and every `*-client.tsx` that renders `{error}`) already just render whatever string the server returns — once the server always returns Spanish, no client-side change is required. No changes to middleware, RLS policies, or any authorization logic.
