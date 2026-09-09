import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Generic Storage upload/download helper (T011), enforcing plan.md's size limits
 * before upload. The live Habitat project uses two buckets rather than the five
 * originally sketched in research.md item 5: `building-media` (images: facility
 * photos, announcement/activity banners, branding logos) and `building-documents`
 * (uploaded documents). Both buckets share the same path convention —
 * `{building_id}/...` — which their Storage RLS policies parse via
 * `storage_building_id()` to enforce per-building isolation, mirroring the table
 * each object belongs to.
 */
export const STORAGE_BUCKETS = {
  media: 'building-media',
  documents: 'building-documents',
} as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB

export type UploadKind = 'image' | 'document';

export class UploadValidationError extends Error {}

/**
 * Bug fix: a `File` object can't be passed as a direct Server Action argument
 * in this Next.js version — only `FormData` (and other plain-object-shaped
 * built-ins) reliably serialize across the client→server boundary; passing a
 * `File` positionally throws "Only plain objects, and a few built-ins, can be
 * passed to Server Actions." Every upload call site wraps its File with
 * `fileFormData()` client-side and unwraps it with `fileFromFormData()`
 * server-side instead of passing the File itself.
 */
export function fileFormData(file: File | null | undefined): FormData | null {
  if (!file) return null;
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

export function fileFromFormData(formData: FormData | null | undefined): File | null {
  if (!formData) return null;
  const file = formData.get('file');
  return file instanceof File ? file : null;
}

function assertWithinLimit(file: File, kind: UploadKind) {
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > limit) {
    const limitMb = limit / (1024 * 1024);
    throw new UploadValidationError(`File exceeds the ${limitMb}MB limit for ${kind}s.`);
  }
}

/**
 * Uploads a file to the given bucket under `{buildingId}/{...pathSegments}/{file.name}`.
 * Returns the storage object path (not a public URL — buckets are private; read
 * access is via signed URL or an authenticated `download`).
 */
export async function uploadBuildingFile(
  supabase: SupabaseClient<Database>,
  opts: {
    bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
    buildingId: string;
    pathSegments?: string[];
    file: File;
    kind: UploadKind;
  },
): Promise<string> {
  assertWithinLimit(opts.file, opts.kind);

  const safeName = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const segments = [opts.buildingId, ...(opts.pathSegments ?? []), `${Date.now()}-${safeName}`];
  const path = segments.join('/');

  const { error } = await supabase.storage.from(opts.bucket).upload(path, opts.file, {
    contentType: opts.file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new UploadValidationError(error.message);
  }

  return path;
}

export async function deleteBuildingFile(
  supabase: SupabaseClient<Database>,
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS],
  path: string,
) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new UploadValidationError(error.message);
  }
}

/**
 * Signed URL for reading a private object (default 1 hour expiry). Throws on
 * failure — including RLS denying the read (e.g. a caller outside the
 * object's building, or an unauthenticated request), which is the actual
 * enforcement point for cross-tenant isolation here (see
 * specs/003-upload-display-fix/research.md item 3). MUST be called with a
 * request-scoped client (lib/supabase/server.ts's createClient()) — never a
 * service-role client, which would bypass that RLS check entirely.
 */
export async function signedUrlFor(
  supabase: SupabaseClient<Database>,
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS],
  path: string,
  expiresInSeconds = 3600,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new UploadValidationError(error?.message ?? 'Could not create signed URL');
  }
  return data.signedUrl;
}

/**
 * T002 (003-upload-display-fix): same as signedUrlFor(), but returns null
 * instead of throwing (FR-005/FR-006) — used by every display call site so a
 * missing/inaccessible object degrades to the existing "no image" fallback
 * UI rather than breaking the page. Denied-by-RLS and object-not-found are
 * intentionally indistinguishable here: both are "can't show this," and a
 * caller must never learn from the *shape* of the failure whether an object
 * exists in a building they can't access.
 */
export async function trySignedUrlFor(
  supabase: SupabaseClient<Database>,
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS],
  path: string | null,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  try {
    return await signedUrlFor(supabase, bucket, path, expiresInSeconds);
  } catch {
    return null;
  }
}
