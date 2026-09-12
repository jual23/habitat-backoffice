import { z } from 'zod';

/**
 * FR-041: create a poll -- title, optional description/attachment, one or
 * more answer options, single/multiple-answer, anonymous, and a closing date.
 */
export const createPollSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  options: z.array(z.string().trim().min(1)).min(1, 'Se requiere al menos una opción de respuesta.'),
  allow_multiple: z.boolean(),
  anonymous: z.boolean(),
  closes_at: z.string().min(1, 'La fecha de cierre es obligatoria.'),
});
export type CreatePollInput = z.infer<typeof createPollSchema>;
