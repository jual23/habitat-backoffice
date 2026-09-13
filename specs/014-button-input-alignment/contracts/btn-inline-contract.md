# Contract: When to apply `.btn-inline`

Not a network API contract — the convention every developer (or future feature) MUST follow when placing a `.btn` beside an input/select field, per spec FR-004 ("present or future").

## Contract

Apply `className="btn btn-inline"` (never `.btn-inline` alone — it's a modifier, not a replacement for the base `.btn`/`.btn-secondary`/`.btn-danger` classes) whenever a button:

1. Sits in the same row (visually beside, not stacked above/below) as a text input, select, or date field, **and**
2. Is meant to act on that row (e.g., submit its value) rather than being an unrelated action that merely happens to share a container.

Do **not** apply it to a button that is already alone on its own line (e.g., a full-width or link-styled action button) — per spec FR-005, those must render exactly as they do today. The existing "Descargar plantilla CSV" button in Finance is the concrete counter-example: it lives in a `.form-row` for spacing purposes only, with no input beside it, so it does **not** get `.btn-inline`.

## What `.btn-inline` does

- Sets the button's height to `var(--control-height)` (40px), matching the current rendered height of `.field input`/`select` (research.md).
- Caps the button's width at 150px — an upper bound, so it still shrinks on a narrow column, it just never grows past 150px (research.md Decision 3).
- Centers the button's label text horizontally.

## Non-goals

- This contract does not change `.field input`/`select`'s own height, nor any button that isn't explicitly given the `.btn-inline` class.
- This contract does not introduce a new component or JSX abstraction — it's a plain CSS class, applied the same way `.btn-secondary`/`.btn-danger` already are.

## Verification

- Today's two occurrences (Finance's "Guardar", Maintenance's "Crear") carry `.btn-inline` after this feature ships.
- Grep check (should match exactly these two call sites once implemented):
  ```sh
  grep -rn "btn-inline" app/
  ```
- See [quickstart.md](../quickstart.md) for the manual visual verification steps.
