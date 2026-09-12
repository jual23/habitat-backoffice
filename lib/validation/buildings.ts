import { z } from 'zod';

/**
 * 012-app-admin-building-management (T004): building create/edit — name is
 * the only required field (FR-005); logo is handled separately as a
 * FormData file, the same way Customization's logo upload is (see
 * app/(backoffice)/customization/actions.ts).
 */
export const createBuildingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
});
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;

export const updateBuildingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
});
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;

/**
 * New-Building-Administrator-account fields, for the "create a brand-new
 * account" path of FR-006/FR-009 (as opposed to selecting an existing
 * Building Administrator from the dropdown, research.md §10).
 *
 * Deliberately duplicates lib/validation/users.ts's baseAccountFields shape
 * rather than importing it — that constant isn't exported there, and adding
 * an export to a Building-Administrator-facing file solely for this feature
 * isn't worth it for a five-field object with no behavior to keep in sync
 * (research.md §9).
 */
export const createBuildingAdminAccountSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().trim().min(1, 'First name is required').max(200),
  last_name: z.string().trim().min(1, 'Last name is required').max(200),
  document_id: z.string().trim().min(1, 'Document ID is required').max(100),
});
export type CreateBuildingAdminAccountInput = z.infer<typeof createBuildingAdminAccountSchema>;
