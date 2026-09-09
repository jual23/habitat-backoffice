'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { createPollSchema, type CreatePollInput } from '@/lib/validation/polls';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** FR-048: poll creation and management is Building-Administrator-only. */
async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

/**
 * FR-041: create a poll and its answer options. Vote-casting itself
 * (castVote/changeVote) is the mobile app's responsibility (spec.md
 * Assumptions) -- this admin-facing action set is limited to poll management.
 */
export async function createPoll(buildingId: string, input: CreatePollInput): Promise<ActionResult> {
  const parsed = createPollSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { data: poll, error } = await supabase
    .from('polls')
    .insert({
      building_id: buildingId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      allow_multiple: parsed.data.allow_multiple,
      anonymous: parsed.data.anonymous,
      closes_at: parsed.data.closes_at,
      created_by: ctx.user!.id,
    })
    .select('id')
    .single();
  if (error || !poll) return { ok: false, error: error?.message ?? 'Could not create poll' };

  const { error: optionsError } = await supabase.from('poll_options').insert(
    parsed.data.options.map((label, index) => ({ poll_id: poll.id, label, sort_order: index })),
  );
  if (optionsError) return { ok: false, error: optionsError.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'poll.create',
    entityType: 'poll',
    entityId: poll.id,
    metadata: { title: parsed.data.title, options: parsed.data.options.length },
  });

  revalidatePath('/polls');
  return { ok: true };
}
