import { z } from 'zod';

/**
 * 006-direct-user-creation (T008): Zod schemas for direct account creation —
 * replaces the old email-and-optional-name invitation shape (FR-002/003/004).
 *
 * Password minimum: 8 characters. No password policy exists anywhere else in
 * this codebase to reuse (research.md item 5) — this is this feature's own
 * fail-fast floor, ahead of the network round-trip to Supabase Auth's own
 * (independently-enforced) minimum.
 */
const baseAccountFields = {
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().trim().min(1, 'First name is required').max(200),
  last_name: z.string().trim().min(1, 'Last name is required').max(200),
  document_id: z.string().trim().min(1, 'Document ID is required').max(100),
};

/** FR-006: Resident creation additionally requires an apartment. */
export const createResidentAccountSchema = z.object({
  ...baseAccountFields,
  apartment_id: z.string().uuid('An apartment must be selected'),
});
export type CreateResidentAccountInput = z.infer<typeof createResidentAccountSchema>;

/**
 * 007-finance-ops-expansion (T008/T009, FR-001): Renter creation uses the exact
 * same shape as Resident — apartment-scoped, same required fields.
 */
export const createRenterAccountSchema = createResidentAccountSchema;
export type CreateRenterAccountInput = z.infer<typeof createRenterAccountSchema>;

/** FR-006: Staff creation has no apartment field. */
export const createStaffAccountSchema = z.object(baseAccountFields);
export type CreateStaffAccountInput = z.infer<typeof createStaffAccountSchema>;
