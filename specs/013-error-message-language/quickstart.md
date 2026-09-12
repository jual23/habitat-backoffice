# Quickstart: Validating Error Message Language Consistency

## Prerequisites

- Dev server running (`npm run dev`) against the Habitat Supabase project.
- A signed-in Building Administrator session with at least one apartment already registered.
- A signed-in App Administrator session (see `app-admin-qa@habitat.invalid`, provisioned earlier this session) for the sign-in-screen scenario.

## Scenario 1 — Business-rule error in Spanish (User Story 1, P1)

1. As Building Administrator, go to **Apartamentos** and add a unit number that already exists in the building.
2. **Expected**: the inline error reads in Spanish (e.g. "Esta unidad ya existe en este edificio."), not English.
3. Repeat with a second module — e.g. **Finanzas**, try to approve a payment that's already approved.
4. **Expected**: Spanish error, no English text anywhere on the page.

## Scenario 2 — Unanticipated/technical failure falls back to Spanish (User Story 2, P2)

1. Pick any upload-based action (e.g. **Documentación** → upload a document, or **Anuncios** → banner upload) and force a failure the code doesn't specifically check for (e.g. a Storage-level failure — can be simulated by temporarily revoking Storage bucket access in a test project, or by reviewing the code path directly since forcing a live failure isn't always practical).
2. **Expected**: if it fails for a reason with no specific check, the message shown is a generic but clear Spanish sentence (e.g. "No se pudo subir el archivo. Intenta de nuevo."), never a raw Postgres/Storage error string, never English.
3. Code-review check (fastest path): confirm every `.message` passthrough identified in [research.md](./research.md) now routes through `toFriendlyMessage()` (see [contracts/error-message-contract.md](./contracts/error-message-contract.md)'s grep audit) instead of forwarding the driver's own text.

## Scenario 3 — Permission / not-found errors in Spanish (User Story 3, P3)

1. As a Staff account (or any role without the right permission), attempt an action outside your allowed scope — e.g. call a Building-Administrator-only action directly, or open a document/attachment that was already deleted by someone else.
2. **Expected**: the rejection or "not found" message is in Spanish.

## Scenario 4 — Sign-in screen (Edge Case)

1. Attempt to sign in with a wrong password.
2. **Expected**: "Correo o contraseña incorrectos." (already Spanish — confirms no regression).

## Full-audit pass (SC-001, SC-002)

Run the three grep patterns in [contracts/error-message-contract.md](./contracts/error-message-contract.md)'s Verification section from the repo root. All three must return zero matches. Any surviving match is a message not yet translated or not yet routed through `toFriendlyMessage()`.

## Out of scope for this quickstart

- Browser-native validation tooltips (e.g. a required-field prompt) — controlled by the browser/OS, not the app (spec Edge Cases).
- Any scenario requiring a second interface language — none exists or is introduced by this feature.
