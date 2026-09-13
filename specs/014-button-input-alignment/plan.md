# Implementation Plan: Button-Beside-Input Sizing

**Branch**: `014-button-input-alignment` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-button-input-alignment/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Finance's apartment-fee "Guardar" button and Maintenance's new-task "Crear" button sit beside input/select fields but render shorter (~34px) than those fields (~40-41px), and — per research.md — already stretch to fill their flex column's full width today, looking oversized relative to their short labels. The fix is a new opt-in CSS modifier class, `.btn-inline`, applied only at these two call sites: it pins the button's height to a new shared `--control-height: 40px` custom property (matching the field's height without touching the fields themselves), caps its width at 150px (an upper bound, not a fixed width — it can still shrink narrower), and centers its label text. No other button in the app is touched; `.form-row .btn` (a broad descendant selector that would also resize the unrelated "Descargar plantilla CSV" button) was explicitly rejected in favor of the scoped class.

## Technical Context

**Language/Version**: TypeScript (Next.js 14.2.35 App Router), plain CSS (`app/globals.css`, no CSS-in-JS/Tailwind in this project)

**Primary Dependencies**: None new — no library, no build tooling change

**Storage**: N/A — no data/schema involved

**Testing**: None new. Constitution Principle III's test-first mandate covers authorization and core CRUD workflows only, neither of which this touches; verification is the manual visual check in quickstart.md

**Target Platform**: Web (backoffice PWA), all supported browsers

**Project Type**: Web application (existing single Next.js project, no structural change)

**Performance Goals**: N/A — a CSS-only visual change

**Constraints**: No button other than the two named ones may change in appearance (spec FR-005); no change to any input/select field's own rendering (research.md Decision 2)

**Scale/Scope**: 3 files — `app/globals.css` (one new custom property + one new modifier class), `app/(backoffice)/finance/finance-client.tsx` and `app/(backoffice)/maintenance/maintenance-client.tsx` (add the modifier class name to one button each)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Multi-Tenant Data Isolation)**: Not implicated — no data access of any kind. ✅ Pass.
- **Principle II (RBAC)**: Not implicated — no role, permission, or provisioning logic touched; purely visual. ✅ Pass.
- **Principle III (Test-First for Authorization & Core Workflows)**: Not implicated — no authorization rule or core CRUD workflow behavior changes, only two buttons' CSS. No new test required. ✅ Pass.
- **Principle IV (Auditability & Data Integrity)**: Not implicated. ✅ Pass.
- **Principle V (Simplicity & Incremental Delivery)**: Directly served — research.md Decision 1 explicitly rejects a broader, "clever" CSS selector in favor of the minimal, explicit, conventional opt-in class already used by this codebase (`.btn-secondary`/`.btn-danger`); Decision 2 explicitly rejects touching every input/select in the app to avoid an unnecessarily large blast radius for a two-button fix. ✅ Pass.
- **Client Platform Requirements**: No routing, navigation, or PWA changes. ✅ Pass.

No violations. Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/014-button-input-alignment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── globals.css                                  # NEW: --control-height custom property + .btn-inline class
└── (backoffice)/
    ├── finance/finance-client.tsx                # "Guardar" button: className="btn" → "btn btn-inline"
    └── maintenance/maintenance-client.tsx         # "Crear" button: className="btn" → "btn btn-inline"
```

**Structure Decision**: Single existing Next.js project, unchanged. This feature only edits `app/globals.css` (additive: one new custom property, one new class, nothing existing removed or renamed) and two `className` attributes in existing Client Components. No new files, routes, components, or dependencies.

## Complexity Tracking

*No violations — section not applicable.*
