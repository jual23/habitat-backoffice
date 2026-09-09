import { z } from 'zod';

/**
 * FR-041: create a poll -- title, optional description/attachment, one or
 * more answer options, single/multiple-answer, anonymous, and a closing date.
 */
export const createPollSchema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  options: z.array(z.string().trim().min(1)).min(1, 'At least one answer option is required'),
  allow_multiple: z.boolean(),
  anonymous: z.boolean(),
  closes_at: z.string().min(1, 'A closing date is required'),
});
export type CreatePollInput = z.infer<typeof createPollSchema>;
