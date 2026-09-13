# Research: Button-Beside-Input Sizing

## Context

Confirmed against the live `app/globals.css` and the two named screens:

- `.btn` (`app/globals.css`): `padding: 9px 16px; font-size: 14px; line-height: 1;` + `1px` border → renders at **~34px** tall (matches the user's measurement).
- `.field input, .field select, .field textarea`: `padding: 9px 10px; font-size: 14px;` + `1px` border, **no explicit `height`** — the browser's default line-height for the computed font stack pushes this to **~40-41px** (matches the user's measurement). The height isn't pinned to a value anywhere; it falls out of font metrics, which vary slightly by browser/OS.
- `Finance` (`finance-client.tsx`, "Cuota por apartamento" row) and `Maintenance` (`maintenance-client.tsx`, "Nueva tarea" row) are the only two places in the app where a `.btn` sits inside a `.form-row` beside a `.field input`/`select`, each wrapped in `<div className="field" style={{ alignSelf: 'flex-end' }}>` — confirmed via a repo-wide search for this pattern (no other current occurrence).
- A second, related finding: `.form-row > .field { flex: 1; }`, and `.field` is itself `display: flex; flex-direction: column;` with no `align-items` override — so its default `align-items: stretch` already stretches the `<button>` (a flex item of that column) to the **full width of its 1fr column slice** of the row today. This means the button isn't just short — depending on how many fields share the row and the card's width, it can already render considerably wider than its own label needs, which is what Spec User Story 2 is describing as "stretching arbitrarily." The width cap (FR-002) is therefore an active fix for something already happening today, not purely a future-proofing measure.
- `Login` (`app/login/login-form.tsx`): its submit button is on its own full-width line below both fields, not beside one — confirmed no current occurrence there (per spec's Assumptions).

## Decision 1: An explicit opt-in modifier class, not a broad descendant selector

**Decision**: Add a new modifier class, `.btn-inline`, applied via `className="btn btn-inline"` only at the specific call sites where a button is genuinely placed beside an input/select in the same row (today: Finance's "Guardar", Maintenance's "Crear"). Do **not** implement this as an implicit selector like `.form-row .btn` that would apply automatically to any button inside a `.form-row`.

**Rationale**: `finance-client.tsx` has a second `.form-row` (the "Descargar plantilla CSV" link-button) that contains **only** a button — no input beside it, already "on its own line" per spec's Edge Cases, and explicitly out of scope per FR-005. Its label is also longer than "Guardar"/"Crear" and would clip or wrap under a 150px cap. A `.form-row .btn` descendant selector would incorrectly resize this unrelated button too, a direct FR-005 violation. An explicit modifier class is scoped to exactly the buttons that need it, matches this codebase's existing convention for button variants (`.btn-secondary`, `.btn-danger` are already opt-in modifier classes, not inferred from context), and keeps the "present or future" requirement (FR-004) satisfiable by documentation (apply `.btn-inline` whenever a button sits beside an input) rather than by CSS selector cleverness that the next developer touching a `.form-row` would need to reverse-engineer.

**Alternatives considered**:
- `.form-row .btn` (descendant selector): rejected — would resize the CSV-template button (FR-005 violation), see above.
- `.form-row:has(input, select) .btn` (`:has()` scoped selector): would correctly exclude the CSV-template row (no input in that row), but was rejected in favor of the explicit class anyway — it's less immediately readable at the JSX call site (a developer sees `className="btn"` and has no signal this button's size depends on a sibling element elsewhere in the DOM), whereas `btn-inline` is self-documenting at the point of use. Principle V favors the more explicit, conventional option when both solve the problem equally well.

## Decision 2: A shared CSS custom property for the matched height, not two independently-guessed values

**Decision**: Add one new custom property, `--control-height: 40px`, and set `height: var(--control-height)` on `.btn-inline` only. `.field input`/`select` are **not** modified — their height stays exactly as implicitly computed today (per Alternatives below, the delta is imperceptible, but touching them is unnecessary risk this feature doesn't need to take).

**Rationale**: FR-001 requires the button to match the field's height, and the two need a single, exact, deterministic value rather than the button guessing a pixel number that happens to look right in one browser. Defining it once as a custom property (rather than a bare `40px` literal duplicated wherever needed) means a future adjustment to this height is a one-line change, consistent with how `--radius`/`--radius-sm` already work in this file.

**Alternatives considered**:
- Also applying `height: var(--control-height)` to `.field input, .field select` so both sides are provably pinned to the identical value: rejected for this feature. It would touch the rendered height of every text input and select in the entire backoffice (dozens of forms) to fix two buttons — a far larger blast radius than the reported problem, and directly against Constitution Principle V ("build the minimum needed to satisfy the current spec") and against FR-005's spirit (nothing outside the two named buttons should visibly change). `40px` is close enough to the existing ~40-41px implicit rendering that the two will look aligned without moving the input at all; if a future feature wants pixel-perfect determinism on inputs too, that's a separate, explicitly-scoped change.

## Decision 3: Centering via `justify-content`, capping via `max-width` (not a fixed `width`)

**Decision**: `.btn-inline` sets `justify-content: center` (the button is already `display: inline-flex; align-items: center`, so this adds horizontal centering to match the existing vertical centering) and `max-width: 150px` (an upper bound, not a fixed width) — the button continues to stretch to fill its `.field` wrapper (today's existing behavior, per Context above) up to that cap, and shrinks naturally on narrower rows.

**Rationale**: FR-002 says "maximum width of 150px," not a fixed width — a cap preserves the button's ability to be naturally narrower on a tight layout while preventing the oversized stretch described in Context. `justify-content: center` is the minimal addition needed for FR-003 given the button no longer has a purely content-driven width.

**Alternatives considered**: A fixed `width: 150px` regardless of available space — rejected as an unnecessary behavior change beyond what FR-002 asks for, and would look odd if a future `.form-row` beside a `.btn-inline` only has ~100px of column space available.

## Verification approach

No new automated test is warranted (Constitution Principle III's test-first mandate applies to authorization and core CRUD workflows, neither of which this touches). Verification is a manual visual check (quickstart.md): open Finance and Maintenance, confirm the button's rendered height (via browser devtools) equals `--control-height` (40px) and matches the adjacent field, confirm its width never exceeds 150px, and confirm every other button in the app (including the CSV-template button and login's submit button) is pixel-identical to its current appearance.
