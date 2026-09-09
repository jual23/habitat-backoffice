'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { activitySchema, type ActivityInput } from '@/lib/validation/activities';
import { uploadBuildingFile, fileFromFormData, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import type { TablesUpdate } from '@/lib/supabase/database.types';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

function translateCheckViolation(message: string) {
  if (message.includes('activities_max_participants_check')) {
    return 'Participant cap must be a positive number, or left empty for unlimited.';
  }
  return message;
}

export async function createActivity(
  buildingId: string,
  input: ActivityInput,
  bannerFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  let banner_url: string | null = null;
  const bannerFile = fileFromFormData(bannerFormData);
  if (bannerFile && bannerFile.size > 0) {
    try {
      banner_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['activities'],
        file: bannerFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Banner upload failed' };
    }
  }

  const { data, error } = await supabase
    .from('activities')
    .insert({ building_id: buildingId, banner_url, ...parsed.data })
    .select('id')
    .single();

  if (error) return { ok: false, error: translateCheckViolation(error.message) };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'activity.create',
    entityType: 'activity',
    entityId: data.id,
    metadata: parsed.data,
  });

  revalidatePath('/activities');
  return { ok: true };
}

export async function updateActivity(
  activityId: string,
  buildingId: string,
  input: ActivityInput,
  bannerFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const update: TablesUpdate<'activities'> = { ...parsed.data };
  const bannerFile = fileFromFormData(bannerFormData);
  if (bannerFile && bannerFile.size > 0) {
    try {
      update.banner_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['activities'],
        file: bannerFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Banner upload failed' };
    }
  }

  const { error } = await supabase.from('activities').update(update).eq('id', activityId);
  if (error) return { ok: false, error: translateCheckViolation(error.message) };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'activity.update',
    entityType: 'activity',
    entityId: activityId,
    metadata: parsed.data,
  });

  revalidatePath('/activities');
  return { ok: true };
}

export async function deleteActivity(activityId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('activities').delete().eq('id', activityId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'activity.delete',
    entityType: 'activity',
    entityId: activityId,
  });

  revalidatePath('/activities');
  return { ok: true };
}
