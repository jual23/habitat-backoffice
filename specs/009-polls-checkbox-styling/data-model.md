# Phase 1 Data Model: Polls Checkbox Styling

No entities, columns, or state transitions are introduced or modified by this feature.

`polls.allow_multiple` and `polls.anonymous` (both `boolean`, already added in
`specs/007-finance-ops-expansion/data-model.md`) are read and written exactly as they are today —
this feature only changes which React component renders their checked/unchecked UI state in
`app/(backoffice)/polls/polls-client.tsx`'s creation form. `createPoll()`
(`app/(backoffice)/polls/actions.ts`) and its Zod schema (`lib/validation/polls.ts`) are untouched.
