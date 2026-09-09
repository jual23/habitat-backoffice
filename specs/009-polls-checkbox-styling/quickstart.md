# Quickstart: Validating Polls Checkbox Styling

## Prerequisites

- `.env.local` populated (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- A Building Administrator account signed in, viewing `/polls`.

## Automated validation

```bash
npm run typecheck
npm run lint
npm run build
```

No new test file — see plan.md's Technical Context for why (no new logic branch; `Toggle`'s
`checked`/`onChange` contract is identical to a native checkbox's from the caller's point of view).

## Manual validation

1. Open `/polls` as a Building Administrator.
2. In the "Nueva encuesta" form, look at "Permitir múltiples respuestas" and "Anónima".
   - **Expect**: both render as the same pill-style toggle switch used elsewhere in the backoffice
     (e.g., Personalización's settings), not a plain square checkbox.
3. Click each toggle on, then off.
   - **Expect**: the visual "on" state (filled track, thumb moved) matches every other toggle in
     the app.
4. Tab to a toggle with the keyboard and press Space.
   - **Expect**: it flips state the same way clicking it does.
5. Fill in a title, at least one option, and a closing date; leave both toggles off; submit.
   - **Expect**: the poll is created with `allow_multiple: false`, `anonymous: false` — unchanged
     from before this feature (per contracts/ui-contract.md's invariants).
6. Repeat step 5 with both toggles on.
   - **Expect**: the poll is created with `allow_multiple: true`, `anonymous: true`.
