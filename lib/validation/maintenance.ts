import { z } from 'zod';

/** FR-033: create a maintenance task -- a free-text name, a date, and a frequency. */
export const createMaintenanceTaskSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
    frequency: z.enum(['once', 'weekly', 'monthly', 'every_n_months']),
    interval_months: z.number().int().positive().nullable(),
    next_due_date: z.string().min(1, 'La fecha es obligatoria.'),
  })
  .refine((v) => v.frequency !== 'every_n_months' || v.interval_months !== null, {
    message: 'Se requiere un intervalo (en meses) para esta frecuencia.',
    path: ['interval_months'],
  });
export type CreateMaintenanceTaskInput = z.infer<typeof createMaintenanceTaskSchema>;

/** FR-034: reschedule an existing task's date (Building Administrator only). */
export const rescheduleTaskSchema = z.object({
  task_id: z.string().uuid(),
  next_due_date: z.string().min(1, 'La fecha es obligatoria.'),
});
export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;

/** FR-035/036: mark a due task done -- a photo is required (device storage or camera). */
export const completeTaskSchema = z.object({
  task_id: z.string().uuid(),
});
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
