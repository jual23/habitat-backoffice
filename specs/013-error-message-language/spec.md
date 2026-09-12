# Feature Specification: Error Message Language Consistency

**Feature Branch**: `013-error-message-language`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Los mensajes de error deben mostrarse en el mismo idioma que el resto de la interfaz de usuario."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everyday action errors match the interface language (Priority: P1)

A user of the backoffice (App Administrator, Building Administrator, or Staff) performs a routine action — creating a building, marking a package delivered, approving a payment, adding an apartment — and the action fails because a business rule wasn't met (a duplicate unit, a payment that can no longer be approved, a ticket that's no longer pending). Today many of these messages appear in English even though every label, button, and page around them is in Spanish. The user should read the reason for the failure in the same language as everything else on screen.

**Why this priority**: This is the largest and most frequently hit category — it covers the everyday "why didn't that work" moment across nearly every module, and is the core of the reported problem.

**Independent Test**: Trigger any business-rule failure already covered by an existing action (e.g., try to approve a payment that was already approved, or add a duplicate apartment unit) and confirm the message shown is in Spanish and reads naturally alongside the rest of the page.

**Acceptance Scenarios**:

1. **Given** a Building Administrator is on a module screen, **When** they submit an action that fails a business rule (e.g., the record is no longer in the required state), **Then** the error text shown is in Spanish and consistent in tone with the rest of the interface.
2. **Given** any role submits a form with a value that conflicts with existing data (e.g., a duplicate unit number), **When** the submission fails, **Then** the message explaining the conflict is in Spanish.

---

### User Story 2 - Unexpected or technical failures still read in Spanish (Priority: P2)

When something fails for a reason the interface didn't anticipate — a database constraint the code doesn't have a specific message for, a storage/upload failure, an underlying service error — the user should never see the raw, untranslated technical text passed straight through. They should see a clear, Spanish-language explanation (even if generic) instead of a message a non-English speaker cannot act on.

**Why this priority**: Lower frequency than everyday validation errors, but higher risk of confusing or alarming a user with unreadable technical text, and it's a distinct code path (today several actions forward the underlying error message verbatim).

**Independent Test**: Force an unexpected failure that has no specific handling (e.g., an underlying save operation fails for a reason the action doesn't check for) and confirm the user sees a generic Spanish message rather than a raw technical or English string.

**Acceptance Scenarios**:

1. **Given** an action fails for a reason the system has no specific Spanish message for, **When** the error reaches the user, **Then** they see a generic but clear Spanish-language message instead of the raw underlying error text.
2. **Given** a file upload or storage operation fails, **When** the failure is reported to the user, **Then** the message is in Spanish.

---

### User Story 3 - Permission and "not found" errors match the interface language (Priority: P3)

When a user attempts something they're not allowed to do, or references a record that no longer exists or was already handled by someone else (a document that was deleted, an attachment that can't be opened, an action attempted without the right role), the resulting message should also be in Spanish, matching every other message on the page.

**Why this priority**: Narrower in scope than US1/US2 (these are guard-clause style checks rather than business-rule validation), but still visible to real users, particularly in multi-admin scenarios where two people act on the same record.

**Independent Test**: Attempt an action without the required permission, or reference a record that was already removed, and confirm the resulting message is in Spanish.

**Acceptance Scenarios**:

1. **Given** a user attempts an action they don't have permission for, **When** the system rejects it, **Then** the rejection message is in Spanish.
2. **Given** a user references a record that no longer exists (already deleted or handled), **When** the system reports this, **Then** the message is in Spanish.

---

### Edge Cases

- What happens when an error message needs to include user-supplied or record-specific data (an email address, a unit number, a file name)? The surrounding message text must be in Spanish; the embedded data itself is shown exactly as entered, not translated.
- What happens when the underlying failure has no existing Spanish translation prepared for it (an unanticipated technical failure)? The user must still see a generic, clear Spanish-language message rather than the raw underlying text (see User Story 2).
- What happens with validation prompts generated by the browser itself (e.g., a native "fill out this field" tooltip)? These are controlled by the user's browser/operating system language setting, not by the application, and are out of scope for this feature.
- What happens on the sign-in screen specifically, before a user has an authenticated session? The same standard applies — every error shown there must also be in Spanish, matching the rest of that screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display every user-facing error message across the backoffice interface (including the sign-in screen) in the same language currently used throughout that interface.
- **FR-002**: The system MUST replace every currently non-Spanish error message surfaced to users with a Spanish-language equivalent that preserves the original meaning.
- **FR-003**: When an operation fails for a reason the system did not specifically anticipate (an unexpected or technical failure), the system MUST show the user a generic, Spanish-language message rather than the raw underlying error text.
- **FR-004**: The system MUST NOT surface raw technical error identifiers, codes, or messages produced by underlying services (database, authentication, file storage) directly to users.
- **FR-005**: Error messages MUST keep any embedded user-supplied or record-specific data (such as an email address, unit number, or file name) exactly as entered, translating only the surrounding message text.
- **FR-006**: This standard MUST apply consistently across every role (App Administrator, Building Administrator, Staff) and every module currently available in the backoffice.
- **FR-007**: Errors resulting from a permission check or a reference to a record that no longer exists or was already handled MUST also be shown in Spanish.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer manually exercising every existing user-facing action that can fail finds 100% of the resulting error messages in Spanish.
- **SC-002**: No screen in the application displays a mix of Spanish interface text and an English-language (or other non-Spanish) error message.
- **SC-003**: When an unexpected or technical failure occurs, 100% of the time the user sees a clear, Spanish-language explanation rather than a raw technical message.
- **SC-004**: Users report no confusion about the meaning of an error message due to it appearing in an unexpected language (measured via support/feedback reports mentioning language, trending to zero after release).

## Assumptions

- The backoffice interface's language is Spanish throughout today; this feature brings error messages in line with that existing standard rather than introducing multi-language or user-selectable language support.
- Browser-native validation prompts (controlled by the visitor's browser/OS language) are outside the application's control and are out of scope.
- Audit log entries and developer/console-only output are not user-facing and are out of scope.
- Error messages already shown in Spanish today (e.g., the sign-in screen's "Correo o contraseña incorrectos.") are correct as-is and only need review, not necessarily rewording.
- Where a technical failure has no pre-existing specific translation, a generic Spanish fallback message (e.g., "Ocurrió un error inesperado. Intenta de nuevo.") is an acceptable substitute for the raw underlying text.
