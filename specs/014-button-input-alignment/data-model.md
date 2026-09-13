# Data Model: Button-Beside-Input Sizing

No persisted entities, tables, or columns — this is a CSS-only visual fix. The only two "artifacts" this feature introduces are style definitions, not data:

## `--control-height` (new CSS custom property, `app/globals.css` `:root`)

```css
--control-height: 40px;
```

The single source of truth for the height a button must match when placed beside an input (research.md Decision 2). Not applied to `.field input`/`select` themselves — only to `.btn-inline`.

## `.btn-inline` (new CSS modifier class, `app/globals.css`)

```css
.btn-inline {
  height: var(--control-height);
  max-width: 150px;
  justify-content: center;
}
```

Combined with the existing `.btn` base class (`className="btn btn-inline"`). Applied only where a button is placed beside an input/select in the same row — today, Finance's "Guardar" and Maintenance's "Crear" (research.md Decision 1; see [contracts/btn-inline-contract.md](./contracts/btn-inline-contract.md) for when to apply it going forward).
