# Contract: `Toggle` Usage in Polls Creation Form

Not an API/RLS contract (this feature has no backend surface) — the "contract" here is the prop
mapping that guarantees behavioral parity with the native checkboxes being replaced, per
`components/Toggle.tsx`'s existing signature:

```ts
function Toggle({
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}): JSX.Element
```

## Mapping: before → after

| | Before (native checkbox) | After (`Toggle`) |
|---|---|---|
| **Permitir múltiples respuestas** | `<label><input type="checkbox" checked={form.allow_multiple} onChange={(e) => setForm({ ...form, allow_multiple: e.target.checked })} /> Permitir múltiples respuestas</label>` | `<Toggle checked={form.allow_multiple} onChange={(allow_multiple) => setForm({ ...form, allow_multiple })} label="Permitir múltiples respuestas" />` |
| **Anónima** | `<label><input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} /> Anónima</label>` | `<Toggle checked={form.anonymous} onChange={(anonymous) => setForm({ ...form, anonymous })} label="Anónima" />` |

## Invariants this mapping preserves (FR-002)

- The `checked` prop is driven by the exact same `form.allow_multiple`/`form.anonymous` state as
  today — no new state, no new default.
- `onChange` still calls `setForm` with the same shape as today; only the event access pattern
  changes (`Toggle`'s callback already hands back the boolean directly, so `e.target.checked`
  becomes unnecessary — not a behavior change, just what the component already does for every
  other caller in this app).
- `disabled` is not used here (neither control was ever disabled) — omitted, matching `Toggle`'s
  optional prop.
- No `id`/`htmlFor` pairing existed on the native checkboxes (the whole `<label>` wrapped the
  input), and `Toggle` already renders its own internal `<label className="toggle">` wrapper with
  the same click-anywhere-in-the-label behavior — no accessibility regression.
