import { z } from 'zod';

/** FR-010: set a single apartment's monthly fee. */
export const setApartmentFeeSchema = z.object({
  apartment_id: z.string().uuid(),
  amount: z.number().positive('El monto debe ser mayor que 0.'),
});
export type SetApartmentFeeInput = z.infer<typeof setApartmentFeeSchema>;

/** FR-011/013: one parsed CSV row, validated before it's applied as a fee update. */
export const bulkFeeCsvRowSchema = z.object({
  apartmentLabel: z.string().trim().min(1),
  amount: z.number().positive('El monto debe ser mayor que 0.'),
});
export type BulkFeeCsvRow = z.infer<typeof bulkFeeCsvRowSchema>;

/**
 * FR-014/019: the building-wide payment cycle and late-fee configuration.
 * `late_fee_type`/`late_fee_amount` are both null (no late fee configured) or
 * both set together -- never one without the other.
 */
export const financeSettingsSchema = z
  .object({
    payment_available_day: z.number().int().min(1).max(31),
    payment_due_day: z.number().int().min(1).max(31),
    late_fee_type: z.enum(['flat', 'percent']).nullable(),
    late_fee_amount: z.number().nonnegative().nullable(),
  })
  .refine((v) => (v.late_fee_type === null) === (v.late_fee_amount === null), {
    message: 'El monto del recargo por mora debe definirse junto con su tipo, o ninguno de los dos.',
    path: ['late_fee_amount'],
  });
export type FinanceSettingsInput = z.infer<typeof financeSettingsSchema>;

/** FR-017: approve a submitted/pending/overdue payment. */
export const approvePaymentSchema = z.object({
  payment_id: z.string().uuid(),
});
export type ApprovePaymentInput = z.infer<typeof approvePaymentSchema>;
