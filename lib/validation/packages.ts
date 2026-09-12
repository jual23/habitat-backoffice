import { z } from 'zod';

/**
 * FR-014: registering a package — apartment, description, and an optional
 * photo (handled separately via lib/supabase/storage.ts's
 * fileFormData()/fileFromFormData() pattern, matching facilities' image
 * upload — a File can't be passed as a direct Server Action argument).
 */
export const registerPackageSchema = z.object({
  apartment_id: z.string().uuid(),
  description: z.string().trim().min(1, 'La descripción es obligatoria.'),
});
export type RegisterPackageInput = z.infer<typeof registerPackageSchema>;
