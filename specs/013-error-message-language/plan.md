# Implementation Plan: Error Message Language Consistency

**Branch**: `013-error-message-language` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-error-message-language/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Every user-facing error message in the backoffice must appear in Spanish, matching the rest of the interface. A repo-wide audit (see [research.md](./research.md)) found the interface itself is entirely Spanish already, but the *error text* returned by Server Actions is not: ~30 hardcoded English string literals, ~90 raw Postgres/Storage/Auth error passthroughs (`error.message`), and ~30 English Zod validation messages, spread across `app/(backoffice)/**/actions.ts`, `lib/validation/*.ts`, and `lib/user-provisioning.ts`. The technical approach is: (1) translate every hardcoded/custom message in place to Spanish, one-to-one, with no change to the underlying logic; (2) introduce one small shared helper, `lib/errors.ts`'s `toFriendlyMessage()`, that replaces every raw driver-error passthrough with a Spanish generic fallback (logging the original server-side); (3) verify via a repo-wide grep audit plus a manual quickstart pass, with no new automated tests needed since no control-flow, authorization, or data-access logic changes.

## Technical Context

**Language/Version**: TypeScript (Next.js 14.2.35 App Router), Node.js runtime

**Primary Dependencies**: React 18.3.1 (Server + Client Components), `@supabase/ssr` / `@supabase/supabase-js`, Zod (form/action validation)

**Storage**: N/A — this feature changes message text only, no schema or query changes

**Testing**: Vitest (`tests/integration/*.test.ts`, against the live Habitat Supabase project) — existing tests assert on `{ ok, error }` shape and business outcomes, not on error string language, so none require changes for this feature

**Target Platform**: Web (backoffice PWA), server-rendered + Server Actions

**Project Type**: Web application (single Next.js project, no separate frontend/backend split)

**Performance Goals**: N/A — no behavioral or performance change; text-only edits

**Constraints**: Preserve every existing validation rule, business-rule check, and control-flow path exactly as-is; change only the language of the message text returned to the user (spec FR-002, FR-005)

**Scale/Scope**: ~15 `actions.ts` files with hardcoded English literals, ~19 `actions.ts` files with raw error passthroughs, 13 of 15 `lib/validation/*.ts` files, plus `lib/user-provisioning.ts` and one new file (`lib/errors.ts`) — see [research.md](./research.md) for the full breakdown

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Multi-Tenant Data Isolation)**: Not implicated — no query, filter, or access-scoping logic changes; only returned message text changes. ✅ Pass.
- **Principle II (RBAC)**: Not implicated — no role, permission, or provisioning-flow changes. Authorization *checks* are untouched; only the text of their rejection messages changes (spec User Story 3 / FR-007). ✅ Pass.
- **Principle III (Test-First for Authorization & Core Workflows)**: No authorization rule or core CRUD workflow's *behavior* changes — only message copy. Per research.md Decision 4, existing tests (which assert on outcomes, not string language) remain valid and are not required to change. ✅ Pass, no new tests required.
- **Principle IV (Auditability & Data Integrity)**: Not implicated — no change to what gets audit-logged or when. The new `toFriendlyMessage()` helper adds a server-side `console.error` for unanticipated failures, which is additive debugging, not a replacement for audit logging. ✅ Pass.
- **Principle V (Simplicity & Incremental Delivery)**: Directly served by this plan — research.md Decision 1 explicitly rejects introducing an i18n/localization framework for a single-locale app, in favor of translating strings in place plus one small shared fallback helper. ✅ Pass.
- **Client Platform Requirements**: No navigation, routing, or PWA changes. ✅ Pass.

No violations. Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/013-error-message-language/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
lib/
├── errors.ts                       # NEW — shared toFriendlyMessage() helper (research.md Decision 2)
├── user-provisioning.ts            # 3 hardcoded English literals → Spanish
└── validation/
    ├── activities.ts               # English custom Zod messages → Spanish
    ├── announcements.ts            # "
    ├── apartments.ts               # "
    ├── broadcast.ts                # "
    ├── buildings.ts                # "
    ├── customization.ts            # audit for any remaining English messages
    ├── documentation.ts            # English custom Zod messages → Spanish
    ├── emergency.ts                # audit for any remaining English messages
    ├── facilities.ts               # English custom Zod messages → Spanish
    ├── finance.ts                  # audit for any remaining English messages
    ├── maintenance.ts              # English custom Zod messages → Spanish
    ├── packages.ts                 # "
    ├── polls.ts                    # "
    ├── tickets.ts                  # "
    └── users.ts                    # "

app/(backoffice)/
├── login/login-form.tsx            # already Spanish — no change expected
└── */actions.ts                    # ~15 files: hardcoded English literals → Spanish
                                     # ~19 files: raw `.message` passthroughs → toFriendlyMessage()
                                     # (see research.md "Summary of files in scope" for the full list)
```

**Structure Decision**: Single Next.js project (existing structure, unchanged). This feature only edits existing files in `app/(backoffice)/**/actions.ts` and `lib/validation/*.ts`, plus `lib/user-provisioning.ts`, and adds one new file, `lib/errors.ts`. No new routes, components, tables, or migrations.

## Complexity Tracking

*No violations — section not applicable.*
