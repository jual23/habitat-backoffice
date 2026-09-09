'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import {
  sendBroadcastSchema,
  saveTemplateSchema,
  updateTemplateSchema,
  setStaffBroadcastPermissionSchema,
  type SendBroadcastInput,
  type SaveTemplateInput,
  type UpdateTemplateInput,
  type SetStaffBroadcastPermissionInput,
} from '@/lib/validation/broadcast';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireStaffOrAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

/** FR-052/053: template management and the permission toggle are admin-only. */
async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

/**
 * FR-051/054/056: send a custom or template-sourced broadcast. The
 * staff_broadcast_enabled check here is a friendly pre-check ahead of the
 * RLS `WITH CHECK` (ticket/package precedent) -- gives Staff a clear message
 * instead of a raw RLS error when the toggle is off.
 */
export async function sendBroadcast(buildingId: string, input: SendBroadcastInput): Promise<ActionResult> {
  const parsed = sendBroadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireStaffOrAdmin();

  if (ctx.role === 'staff') {
    const { data: building } = await supabase
      .from('buildings')
      .select('staff_broadcast_enabled')
      .eq('id', buildingId)
      .maybeSingle();
    if (!building?.staff_broadcast_enabled) {
      return { ok: false, error: 'Staff broadcast permission is not enabled for this building.' };
    }
  }

  // FR-052: sending from a template copies its icon onto the new broadcast.
  let icon: string | null = null;
  if (parsed.data.template_id) {
    const { data: template } = await supabase
      .from('broadcast_templates')
      .select('icon')
      .eq('id', parsed.data.template_id)
      .maybeSingle();
    icon = template?.icon ?? null;
  }

  const { data: broadcast, error } = await supabase
    .from('broadcasts')
    .insert({
      building_id: buildingId,
      message: parsed.data.message,
      icon,
      template_id: parsed.data.template_id ?? null,
      sent_by: ctx.user!.id,
    })
    .select('id')
    .single();
  if (error || !broadcast) return { ok: false, error: error?.message ?? 'Could not send broadcast' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'broadcast.send',
    entityType: 'broadcast',
    entityId: broadcast.id,
    metadata: { template_id: parsed.data.template_id ?? null },
  });

  revalidatePath('/broadcast');
  return { ok: true };
}

/** FR-004 (008): end an active broadcast's visibility without deleting its record. */
export async function deactivateBroadcast(broadcastId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaffOrAdmin();

  if (ctx.role === 'staff') {
    const { data: building } = await supabase
      .from('buildings')
      .select('staff_broadcast_enabled')
      .eq('id', buildingId)
      .maybeSingle();
    if (!building?.staff_broadcast_enabled) {
      return { ok: false, error: 'Staff broadcast permission is not enabled for this building.' };
    }
  }

  const { error, count } = await supabase
    .from('broadcasts')
    .update(
      { status: 'deactivated', deactivated_by: ctx.user!.id, deactivated_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('id', broadcastId);
  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: 'This broadcast is no longer active.' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'broadcast.deactivate',
    entityType: 'broadcast',
    entityId: broadcastId,
  });

  revalidatePath('/broadcast');
  return { ok: true };
}

/** FR-052: save a reusable predetermined message with an icon -- admin only. */
export async function saveTemplate(buildingId: string, input: SaveTemplateInput): Promise<ActionResult> {
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { data: template, error } = await supabase
    .from('broadcast_templates')
    .insert({
      building_id: buildingId,
      message: parsed.data.message,
      icon: parsed.data.icon ?? null,
      created_by: ctx.user!.id,
    })
    .select('id')
    .single();
  if (error || !template) return { ok: false, error: error?.message ?? 'Could not save template' };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'broadcast_template.create',
    entityType: 'broadcast_template',
    entityId: template.id,
  });

  revalidatePath('/broadcast');
  return { ok: true };
}

export async function updateTemplate(buildingId: string, input: UpdateTemplateInput): Promise<ActionResult> {
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('broadcast_templates')
    .update({ message: parsed.data.message, icon: parsed.data.icon ?? null })
    .eq('id', parsed.data.template_id)
    .eq('building_id', buildingId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'broadcast_template.update',
    entityType: 'broadcast_template',
    entityId: parsed.data.template_id,
  });

  revalidatePath('/broadcast');
  return { ok: true };
}

export async function deleteTemplate(templateId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('broadcast_templates')
    .delete()
    .eq('id', templateId)
    .eq('building_id', buildingId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'broadcast_template.delete',
    entityType: 'broadcast_template',
    entityId: templateId,
  });

  revalidatePath('/broadcast');
  return { ok: true };
}

/** FR-053: toggle whether Staff may send/deactivate broadcasts -- admin only, default off. */
export async function setStaffBroadcastPermission(
  buildingId: string,
  input: SetStaffBroadcastPermissionInput,
): Promise<ActionResult> {
  const parsed = setStaffBroadcastPermissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('buildings')
    .update({ staff_broadcast_enabled: parsed.data.enabled })
    .eq('id', buildingId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'broadcast.staff_permission_change',
    entityType: 'building',
    entityId: buildingId,
    metadata: { enabled: parsed.data.enabled },
  });

  revalidatePath('/broadcast');
  return { ok: true };
}
