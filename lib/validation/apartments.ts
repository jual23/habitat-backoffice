import { z } from 'zod';

/** T024: Zod schemas for the apartment and resident forms (US1). */

export const apartmentSchema = z.object({
  tower: z.string().trim().max(50).optional().or(z.literal('')).transform((v) => v || null),
  unit_number: z.string().trim().min(1, 'El número de unidad es obligatorio.').max(50),
  floor: z.coerce.number().int().optional().nullable(),
});
export type ApartmentInput = z.infer<typeof apartmentSchema>;

/**
 * FR-002: creating a resident. This schema's live schema has no direct way to
 * insert an `auth.users`-backed `profiles` row (an auth account must exist
 * first), so `createResident` provisions via the existing `invitations` table
 * (role fixed to 'resident') rather than a `profiles` insert — the resident's
 * `profiles` row is created once they accept the invite, which is out-of-band
 * per spec.md's Assumptions.
 */
export const createResidentSchema = z.object({
  email: z.string().trim().email('Se requiere un correo electrónico válido.'),
  full_name: z.string().trim().max(200).optional().or(z.literal('')).transform((v) => v || null),
  apartment_id: z.string().uuid('Debes seleccionar un apartamento.'),
});
export type CreateResidentInput = z.infer<typeof createResidentSchema>;

/**
 * FR-004/005, extended by 006-direct-user-creation (T014, spec.md User Story 2):
 * editing an existing (already-signed-up) resident. `first_name`/`last_name`/
 * `document_id` are new, real identity fields captured at creation time
 * (006-direct-user-creation) — each, if provided, must be non-blank so an edit
 * can't silently clear a required field.
 */
export const updateResidentSchema = z
  .object({
    email: z.string().trim().email().optional(),
    apartment_id: z.string().uuid().optional(),
    first_name: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(200).optional(),
    last_name: z.string().trim().min(1, 'El apellido no puede estar vacío.').max(200).optional(),
    document_id: z.string().trim().min(1, 'El documento de identidad no puede estar vacío.').max(100).optional(),
  })
  .refine(
    (v) =>
      v.email !== undefined ||
      v.apartment_id !== undefined ||
      v.first_name !== undefined ||
      v.last_name !== undefined ||
      v.document_id !== undefined,
    { message: 'Proporciona al menos un campo para actualizar.' },
  );
export type UpdateResidentInput = z.infer<typeof updateResidentSchema>;
