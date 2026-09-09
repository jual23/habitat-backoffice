import { z } from 'zod';

/** FR-061: acknowledge/resolve an unhandled emergency. */
export const acknowledgeEmergencySchema = z.object({
  emergency_id: z.string().uuid(),
});
export type AcknowledgeEmergencyInput = z.infer<typeof acknowledgeEmergencySchema>;
