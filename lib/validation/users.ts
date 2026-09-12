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
  email: z.string().trim().email('Se requiere un correo electrónico válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  first_name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  last_name: z.string().trim().min(1, 'El apellido es obligatorio.').max(200),
  document_id: z.string().trim().min(1, 'El documento de identidad es obligatorio.').max(100),
};

/** FR-006: Resident creation additionally requires an apartment. */
export const createResidentAccountSchema = z.object({
  ...baseAccountFields,
  apartment_id: z.string().uuid('Debes seleccionar un apartamento.'),
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
