# Data Model: Error Message Language Consistency

No new persisted entities, tables, or columns. This feature changes the text content of error messages already returned by existing code paths — it introduces one new in-memory type/shape (below) and touches no database schema.

## `ActionResult<T>` (existing shape, unchanged structurally)

Every Server Action in `app/(backoffice)/**/actions.ts` already returns one of:

```ts
{ ok: true; ... }              // success, shape varies per action
| { ok: false; error: string }  // failure — `error` is shown verbatim to the user
```

**This feature's only requirement on this shape**: the `error` string, in every case, in every action, MUST be Spanish-language text suitable for direct display, never a raw driver/library message and never an untranslated literal (spec FR-001–FR-005). The shape itself (`{ ok, error }`) does not change.

## `toFriendlyMessage()` helper (new, `lib/errors.ts`)

```ts
function toFriendlyMessage(error: unknown, fallback: string): string
```

- **Input**: `error` — whatever was caught or returned by Supabase (Postgres, Storage, or Auth) or a thrown exception; `fallback` — a Spanish-language message the caller supplies, specific to that call site's context (e.g. `'No se pudo registrar el paquete.'`).
- **Behavior**: logs `error` server-side (`console.error`) for debuggability, then always returns `fallback`. Never inspects or forwards `error`'s own message text to the return value.
- **Output**: a Spanish string safe to place directly into an `ActionResult`'s `error` field.

This is the only new "entity" this feature introduces — a pure function, not a data model.
