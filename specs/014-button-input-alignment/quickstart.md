# Quickstart: Validating Button-Beside-Input Sizing

## Prerequisites

- Dev server running (`npm run dev`).
- A signed-in Building Administrator session, browser devtools open.

## Scenario 1 — Finance's fee row (User Story 1 & 2)

1. Go to **Finanzas** → the "Cuota por apartamento" row (apartment select, amount input, "Guardar" button).
2. Visually confirm the "Guardar" button's height now matches the select/input beside it — no more short, squat button in a taller row.
3. In devtools, inspect the button and confirm its computed `height` is `40px` (`--control-height`), and its `width` is at most `150px`.
4. Confirm "Guardar" reads centered within the button, not left-aligned.

## Scenario 2 — Maintenance's new-task row (User Story 1 & 2)

1. Go to **Mantenimiento** → the "Nueva tarea" row (name, frequency, [interval], date fields, "Crear" button).
2. Same checks as Scenario 1: height matches the fields beside it, width ≤ 150px, label centered.

## Scenario 3 — No regression elsewhere (FR-005)

1. On Finance, confirm the "Descargar plantilla CSV" button (its own line, no input beside it) looks exactly as it did before — same height (~34px), same width (not capped at 150px), text not force-centered beyond its existing appearance.
2. Spot-check a handful of other screens with a standalone save/create button on its own line (e.g., Facilities, Announcements, Users) — confirm none of them changed.
3. On the login screen, confirm the sign-in button is unchanged (it isn't beside a field today, so `.btn-inline` doesn't apply to it).

## Grep check

```sh
grep -rn "btn-inline" app/
```

Expect exactly two JSX call sites (Finance's "Guardar", Maintenance's "Crear") plus the one CSS definition in `app/globals.css`.
