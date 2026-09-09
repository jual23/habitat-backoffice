'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { announcementSchema, type AnnouncementInput } from '@/lib/validation/announcements';
import {
  uploadBuildingFile,
  trySignedUrlFor,
  fileFromFormData,
  STORAGE_BUCKETS,
} from '@/lib/supabase/storage';
import type { TablesUpdate } from '@/lib/supabase/database.types';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

export async function createAnnouncement(
  buildingId: string,
  input: AnnouncementInput,
  bannerFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  let banner_url: string | null = null;
  const bannerFile = fileFromFormData(bannerFormData);
  if (bannerFile && bannerFile.size > 0) {
    try {
      banner_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['announcements'],
        file: bannerFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Banner upload failed' };
    }
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({ building_id: buildingId, author_id: ctx.user!.id, banner_url, ...parsed.data })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'announcement.create',
    entityType: 'announcement',
    entityId: data.id,
    metadata: parsed.data,
  });

  revalidatePath('/announcements');
  return { ok: true };
}

export async function updateAnnouncement(
  announcementId: string,
  buildingId: string,
  input: AnnouncementInput,
  bannerFormData?: FormData | null,
): Promise<ActionResult> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const update: TablesUpdate<'announcements'> = { ...parsed.data };
  const bannerFile = fileFromFormData(bannerFormData);
  if (bannerFile && bannerFile.size > 0) {
    try {
      update.banner_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['announcements'],
        file: bannerFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Banner upload failed' };
    }
  }

  const { error } = await supabase.from('announcements').update(update).eq('id', announcementId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'announcement.update',
    entityType: 'announcement',
    entityId: announcementId,
    metadata: parsed.data,
  });

  revalidatePath('/announcements');
  return { ok: true };
}

export async function deleteAnnouncement(
  announcementId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'announcement.delete',
    entityType: 'announcement',
    entityId: announcementId,
  });

  revalidatePath('/announcements');
  return { ok: true };
}

/** FR-017/018: pinned announcements sort above unpinned. */
export async function togglePin(
  announcementId: string,
  buildingId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('announcements').update({ pinned }).eq('id', announcementId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: pinned ? 'announcement.pin' : 'announcement.unpin',
    entityType: 'announcement',
    entityId: announcementId,
  });

  revalidatePath('/announcements');
  return { ok: true };
}

/** FR-015: attach a file to an announcement. */
export async function addAttachment(
  announcementId: string,
  buildingId: string,
  fileFormData: FormData,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const file = fileFromFormData(fileFormData);
  if (!file) return { ok: false, error: 'No file selected' };

  let file_path: string;
  try {
    file_path = await uploadBuildingFile(supabase, {
      bucket: STORAGE_BUCKETS.documents,
      buildingId,
      pathSegments: ['announcements', announcementId],
      file,
      kind: 'document',
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Attachment upload failed' };
  }

  const { data, error } = await supabase
    .from('announcement_attachments')
    .insert({
      announcement_id: announcementId,
      file_path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'announcement.add_attachment',
    entityType: 'announcement_attachment',
    entityId: data.id,
    metadata: { announcement_id: announcementId, file_name: file.name },
  });

  revalidatePath('/announcements');
  return { ok: true };
}

/**
 * T015 (003-upload-display-fix): on-demand signed URL for an announcement
 * attachment (FR-002/FR-003). The row lookup itself is RLS-scoped (denies
 * cross-building reads, per feature 001's table RLS); trySignedUrlFor()
 * additionally requires the caller's own session-scoped client, so a
 * cross-building or unauthenticated caller gets { ok: false } either way
 * the read is denied — see contracts/file-access.md.
 */
export async function getAttachmentUrl(attachmentId: string): Promise<UrlResult> {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user) return { ok: false, error: 'Not authorized' };

  const { data: attachment, error } = await supabase
    .from('announcement_attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .single();

  if (error || !attachment) return { ok: false, error: 'Attachment not found' };

  const url = await trySignedUrlFor(supabase, STORAGE_BUCKETS.documents, attachment.file_path);
  if (!url) return { ok: false, error: 'Could not open this attachment' };

  return { ok: true, url };
}
