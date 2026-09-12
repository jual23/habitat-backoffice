'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
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

/** FR-031: favorite/unfavorite an entry. */
export async function toggleFavorite(
  feedbackId: string,
  buildingId: string,
  starred: boolean,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('feedback').update({ starred }).eq('id', feedbackId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar el favorito.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: starred ? 'suggestion_complaint.favorite' : 'suggestion_complaint.unfavorite',
    entityType: 'feedback',
    entityId: feedbackId,
  });

  revalidatePath('/suggestions-complaints');
  return { ok: true };
}

/**
 * FR-032/033: discard an entry (auto-deleted after 24h by the discard-cleanup
 * sweep). Re-discarding an already-discarded row is a no-op — the `.is('discarded_at', null)`
 * guard means the UPDATE simply matches zero rows instead of erroring.
 */
export async function discardEntry(feedbackId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error, count } = await supabase
    .from('feedback')
    .update({ discarded_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', feedbackId)
    .is('discarded_at', null);

  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo descartar la entrada.') };
  if (count === 0) return { ok: true }; // already discarded — no-op, not an error

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'suggestion_complaint.discard',
    entityType: 'feedback',
    entityId: feedbackId,
  });

  revalidatePath('/suggestions-complaints');
  return { ok: true };
}
