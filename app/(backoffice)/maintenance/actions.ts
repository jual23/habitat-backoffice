'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { uploadBuildingFile, fileFromFormData, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { advanceDueDate } from '@/lib/maintenance';
import {
  createMaintenanceTaskSchema,
  rescheduleTaskSchema,
  completeTaskSchema,
  type CreateMaintenanceTaskInput,
  type RescheduleTaskInput,
  type CompleteTaskInput,
} from '@/lib/validation/maintenance';
import { toFriendlyMessage } from '@/lib/errors';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('No autorizado.');
  }
  return { supabase, ctx };
}

async function requireStaffOrAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('No autorizado.');
  }
  return { supabase, ctx };
}

/** FR-033: create a task (Building Administrator only). */
export async function createTask(
  buildingId: string,
  input: CreateMaintenanceTaskInput,
): Promise<ActionResult> {
  const parsed = createMaintenanceTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { data: task, error } = await supabase
    .from('maintenance_tasks')
    .insert({
      building_id: buildingId,
      name: parsed.data.name,
      frequency: parsed.data.frequency,
      interval_months: parsed.data.interval_months,
      next_due_date: parsed.data.next_due_date,
      created_by: ctx.user!.id,
    })
    .select('id')
    .single();
  if (error || !task) return { ok: false, error: toFriendlyMessage(error, 'No se pudo crear la tarea.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'maintenance.task_create',
    entityType: 'maintenance_task',
    entityId: task.id,
    metadata: { name: parsed.data.name, frequency: parsed.data.frequency },
  });

  revalidatePath('/maintenance');
  return { ok: true };
}

/** FR-034: reschedule a task's date freely (Building Administrator only -- not Staff). */
export async function rescheduleTask(
  buildingId: string,
  input: RescheduleTaskInput,
): Promise<ActionResult> {
  const parsed = rescheduleTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('maintenance_tasks')
    .update({ next_due_date: parsed.data.next_due_date })
    .eq('id', parsed.data.task_id)
    .eq('building_id', buildingId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo reprogramar la tarea.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'maintenance.task_reschedule',
    entityType: 'maintenance_task',
    entityId: parsed.data.task_id,
    metadata: { next_due_date: parsed.data.next_due_date },
  });

  revalidatePath('/maintenance');
  return { ok: true };
}

/**
 * FR-035/036/037: mark a due task done -- Staff or admin. Inserts the
 * completion (photo required, from device storage or camera) then advances
 * `next_due_date` per the task's `frequency` in this same Server Action
 * (research.md item 7 -- a normal, already-authorized write, no trigger
 * needed; T029 gates the exact math).
 */
export async function completeTask(
  buildingId: string,
  input: CompleteTaskInput,
  photoFormData: FormData,
): Promise<ActionResult> {
  const parsed = completeTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const photoFile = fileFromFormData(photoFormData);
  if (!photoFile || photoFile.size === 0) {
    return { ok: false, error: 'Se requiere una foto para marcar esta tarea como hecha.' };
  }

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { data: task, error: fetchError } = await supabase
    .from('maintenance_tasks')
    .select('id, frequency, interval_months, next_due_date')
    .eq('id', parsed.data.task_id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: toFriendlyMessage(fetchError, 'No se pudo cargar la tarea.') };
  if (!task) return { ok: false, error: 'Tarea no encontrada.' };

  let photo_url: string;
  try {
    photo_url = await uploadBuildingFile(supabase, {
      bucket: STORAGE_BUCKETS.media,
      buildingId,
      pathSegments: ['maintenance'],
      file: photoFile,
      kind: 'image',
    });
  } catch (e) {
    return { ok: false, error: toFriendlyMessage(e, 'No se pudo subir la foto.') };
  }

  const { error: completionError } = await supabase.from('maintenance_completions').insert({
    task_id: task.id,
    building_id: buildingId,
    completed_by: ctx.user!.id,
    photo_url,
  });
  if (completionError) return { ok: false, error: toFriendlyMessage(completionError, 'No se pudo registrar la finalización.') };

  const nextDueDate = advanceDueDate(task.next_due_date, task.frequency, task.interval_months);
  const { error: advanceError, count } = await supabase
    .from('maintenance_tasks')
    .update({ next_due_date: nextDueDate }, { count: 'exact' })
    .eq('id', task.id);
  if (advanceError) return { ok: false, error: toFriendlyMessage(advanceError, 'No se pudo avanzar la programación de la tarea.') };
  if (count === 0) return { ok: false, error: 'No se pudo avanzar la programación de la tarea.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'maintenance.task_complete',
    entityType: 'maintenance_task',
    entityId: task.id,
    metadata: { next_due_date: nextDueDate },
  });

  revalidatePath('/maintenance');
  return { ok: true };
}
