import { z } from 'zod';

/** T036: Zod schema for the facility form (US2). */
export const facilitySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => v || null),
  opens_at: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Usa el formato HH:MM.')
    .optional(),
  closes_at: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Usa el formato HH:MM.')
    .optional(),
  reservable: z.coerce.boolean().default(false),
});
export type FacilityInput = z.infer<typeof facilitySchema>;
