'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { folderSchema, type FolderInput } from '@/lib/validation/documentation';
import {
  uploadBuildingFile,
  deleteBuildingFile,
  trySignedUrlFor,
  fileFromFormData,
  STORAGE_BUCKETS,
} from '@/lib/supabase/storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

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

export async function createFolder(buildingId: string, input: FolderInput): Promise<ActionResult> {
  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { data, error } = await supabase
    .from('document_folders')
    .insert({ building_id: buildingId, name: parsed.data.name, parent_id: parsed.data.parent_id ?? null })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'folder.create',
    entityType: 'document_folder',
    entityId: data.id,
    metadata: parsed.data,
  });

  revalidatePath('/documentation');
  return { ok: true };
}

export async function renameFolder(
  folderId: string,
  buildingId: string,
  name: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('document_folders').update({ name }).eq('id', folderId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'folder.rename',
    entityType: 'document_folder',
    entityId: folderId,
    metadata: { name },
  });

  revalidatePath('/documentation');
  return { ok: true };
}

/** Collects a folder id and every descendant folder id (BFS over parent_id). */
async function collectFolderSubtree(supabase: SupabaseClient<Database>, rootId: string) {
  const all = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const { data } = await supabase.from('document_folders').select('id').in('parent_id', frontier);
    const next = (data ?? []).map((f) => f.id);
    if (next.length === 0) break;
    all.push(...next);
    frontier = next;
  }
  return all;
}

/**
 * FR-029: deleting a folder deletes its subfolders and documents (DB rows
 * cascade via `ON DELETE CASCADE`), but Storage objects don't disappear on
 * their own — purge them first, per edge-functions.md's note.
 */
export async function deleteFolder(folderId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const folderIds = await collectFolderSubtree(supabase, folderId);
  const { data: docs } = await supabase.from('documents').select('file_path').in('folder_id', folderIds);

  for (const doc of docs ?? []) {
    await deleteBuildingFile(supabase, STORAGE_BUCKETS.documents, doc.file_path).catch(() => undefined);
  }

  const { error } = await supabase.from('document_folders').delete().eq('id', folderId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'folder.delete',
    entityType: 'document_folder',
    entityId: folderId,
    metadata: { documents_removed: docs?.length ?? 0 },
  });

  revalidatePath('/documentation');
  return { ok: true };
}

export async function uploadDocument(
  buildingId: string,
  folderId: string | null,
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
      pathSegments: folderId ? ['folders', folderId] : ['root'],
      file,
      kind: 'document',
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed' };
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      building_id: buildingId,
      folder_id: folderId,
      name: file.name,
      file_path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: ctx.user!.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'document.upload',
    entityType: 'document',
    entityId: data.id,
    metadata: { name: file.name, folder_id: folderId },
  });

  revalidatePath('/documentation');
  return { ok: true };
}

export async function deleteDocument(documentId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { data: doc } = await supabase.from('documents').select('file_path').eq('id', documentId).single();
  if (doc) {
    await deleteBuildingFile(supabase, STORAGE_BUCKETS.documents, doc.file_path).catch(() => undefined);
  }

  const { error } = await supabase.from('documents').delete().eq('id', documentId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'document.delete',
    entityType: 'document',
    entityId: documentId,
  });

  revalidatePath('/documentation');
  return { ok: true };
}

/**
 * T013 (003-upload-display-fix): on-demand signed URL for opening/downloading
 * a document (FR-003). Row lookup is RLS-scoped (denies cross-building
 * reads); trySignedUrlFor() requires the caller's own session-scoped client,
 * so a cross-building or unauthenticated caller gets { ok: false } — see
 * contracts/file-access.md.
 */
export async function getDocumentUrl(documentId: string): Promise<UrlResult> {
  const { supabase } = await requireBuildingAdmin();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', documentId)
    .single();

  if (error || !doc) return { ok: false, error: 'Document not found' };

  const url = await trySignedUrlFor(supabase, STORAGE_BUCKETS.documents, doc.file_path);
  if (!url) return { ok: false, error: 'Could not open this document' };

  return { ok: true, url };
}
