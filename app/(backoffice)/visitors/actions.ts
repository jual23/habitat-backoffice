'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** FR-023: mark an expected visitor as arrived. Staff and building_admin only. */
export async function markVisitorArrived(
  visitorId: string,
  buildingId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin')) {
    throw new Error('Not authorized');
  }

  const { error, count } = await supabase
    .from('visitors')
    .update({ status: 'arrived', arrived_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', visitorId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: 'This visitor is no longer pending.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user.id,
    buildingId,
    action: 'visitor.mark_arrived',
    entityType: 'visitor',
    entityId: visitorId,
  });

  revalidatePath('/visitors');
  return { ok: true };
}
