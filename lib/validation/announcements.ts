import { z } from 'zod';

/** T045: Zod schema for the announcement form (US3). */
export const announcementSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  body: z.string().trim().max(10000).optional().or(z.literal('')).transform((v) => v ?? ''),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
