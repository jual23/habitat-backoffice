import { z } from 'zod';

/** T052: Zod schema for the activity form (US4). FR-020: max_participants > 0 or unset. */
export const activitySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => v || null),
  location: z.string().trim().max(200).optional().or(z.literal('')).transform((v) => v || null),
  starts_at: z.string().min(1, 'Date is required'),
  ends_at: z.string().optional().or(z.literal('')).transform((v) => v || null),
  max_participants: z.coerce.number().int().positive().optional().nullable(),
});
export type ActivityInput = z.infer<typeof activitySchema>;
