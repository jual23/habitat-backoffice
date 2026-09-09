'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { acknowledgeEmergencySchema, type AcknowledgeEmergencyInput } from '@/lib/validation/emergency';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** FR-059: the Emergency view (and its acknowledge action) is Staff/admin only. */
async function requireStaffOrAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

/**
 * FR-061: the only way an emergency's unhandled state clears -- an explicit
 * acknowledge/resolve action from the Emergency view (merely viewing never
 * clears it). Revalidates the root layout too, so the top-right indicator
 * and the nav link's blink re-evaluate immediately (FR-062).
 */
export async function acknowledgeEmergency(
  buildingId: string,
  input: AcknowledgeEmergencyInput,
): Promise<ActionResult> {
  const parsed = acknowledgeEmergencySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireStaffOrAdmin();

  const { error, count } = await supabase
    .from('emergencies')
    .update(
      { status: 'resolved', resolved_by: ctx.user!.id, resolved_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('id', parsed.data.emergency_id);
  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: 'This emergency was already handled.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'emergency.resolve',
    entityType: 'emergency',
    entityId: parsed.data.emergency_id,
  });

  revalidatePath('/emergency');
  revalidatePath('/', 'layout');
  return { ok: true };
}
