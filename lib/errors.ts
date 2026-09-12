/**
 * 013-error-message-language (research.md Decision 2): every Server Action
 * that used to forward a raw Postgres/Storage/Auth error's own `.message`
 * (or a caught exception's `.message`) directly to the user leaked English
 * and occasionally internal detail (constraint/column names) into an
 * otherwise all-Spanish interface. `toFriendlyMessage()` replaces every one
 * of those call sites: it logs the original error server-side for
 * debuggability, then always returns the Spanish `fallback` the caller
 * supplies — never the underlying error's own text.
 *
 * This is deliberately not a code-to-message lookup table (see research.md
 * Decision 2's Alternatives Considered): every call site that has a specific,
 * anticipated failure mode already checks for it before ever reaching this
 * helper (e.g. a unique-constraint violation), so the only errors that reach
 * `toFriendlyMessage()` are the ones no check anticipated — exactly the case
 * User Story 2 says a generic (but Spanish) message is acceptable for.
 */
export function toFriendlyMessage(error: unknown, fallback: string): string {
  console.error(error);
  return fallback;
}
