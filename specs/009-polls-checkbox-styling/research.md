# Phase 0 Research: Polls Checkbox Styling

No `NEEDS CLARIFICATION` markers exist in this plan's Technical Context — the one decision below
was settled by directly inspecting the codebase, not by research in the usual sense.

## 1. What "the overall aesthetic" means here: the existing `Toggle` component

**Decision**: Reuse `components/Toggle.tsx` (a labeled pill-switch: `<input type="checkbox">`
under the hood, visually rendered as `.toggle-track`/`.toggle-thumb`) for both
"Permitir múltiples respuestas" and "Anónima" in `polls-client.tsx`'s poll creation form.

**Rationale**: A repo-wide search confirmed `type="checkbox"` appears in exactly one place in this
entire backoffice — `polls-client.tsx`, added when the Polls module was built
(007-finance-ops-expansion). Every other on/off setting already in the app uses `Toggle`. There is
no ambiguity about which control "the overall aesthetic" refers to: it's the only established
on/off pattern that exists to match.

**Alternatives considered**: Designing a new, dedicated checkbox visual style (rejected —
Principle V; this app has exactly one on/off control pattern today, and introducing a second,
visually distinct one for two controls would itself be the inconsistency this request is trying to
fix). Leaving the native checkboxes but adding custom CSS to restyle `input[type="checkbox"]`
directly (rejected — `Toggle` already exists, is already proven elsewhere, and a global
`input[type="checkbox"]` style risks affecting other checkboxes introduced by future features in
ways not reviewed here).

## Summary

One existing component (`Toggle`), reused as-is, in one file. No new dependency, no schema/RLS
change, no new pattern.
