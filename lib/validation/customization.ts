import { z } from 'zod';

/** FR-034: accent color as a hex string. */
export const customizationSchema = z.object({
  accent_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hexadecimal como #1F4D2E.'),
});
export type CustomizationInput = z.infer<typeof customizationSchema>;
