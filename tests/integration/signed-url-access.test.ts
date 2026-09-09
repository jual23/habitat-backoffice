import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestFacility,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';
import { signedUrlFor, trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';

/**
 * T019 (003-upload-display-fix): proves the isolation guarantee this whole
 * feature depends on — signed URLs (and the row lookups the on-demand
 * document/attachment actions do first) are scoped by the caller's own
 * Storage/table RLS, not by application logic alone (FR-004), and a missing
 * object fails soft rather than throwing through to the page (FR-005).
 *
 * This tests `signedUrlFor()`/`trySignedUrlFor()` directly with a signed-in
 * `@supabase/supabase-js` client (via tests/setup.ts's `signInAs()`), rather
 * than calling the `getDocumentUrl()`/`getAttachmentUrl()` server actions
 * themselves — those actions call `lib/supabase/server.ts`'s `createClient()`,
 * which requires a real Next.js request's `cookies()` and cannot run outside
 * one. Both paths go through the identical RLS-scoped
 * `supabase.storage...createSignedUrl()` call, so this exercises the same
 * security property the actions rely on (see contracts/file-access.md).
 */
describe('signed URL access: cross-building isolation and missing-object fallback', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let facilityAImagePath: string;
  let facilityAId: string;
  let documentAId: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });

    const svc = getServiceClient();

    facilityAImagePath = `${buildingA}/facilities/fixture-${crypto.randomUUID().slice(0, 8)}.png`;
    const { error: uploadError } = await svc.storage
      .from(STORAGE_BUCKETS.media)
      .upload(facilityAImagePath, new Blob(['fixture'], { type: 'image/png' }));
    if (uploadError) throw new Error(`fixture upload failed: ${uploadError.message}`);

    facilityAId = await createTestFacility(buildingA, { image_url: facilityAImagePath });

    const { data: doc, error: docError } = await svc
      .from('documents')
      .insert({
        building_id: buildingA,
        file_path: `${buildingA}/documents/fixture.txt`,
        name: 'fixture.txt',
      })
      .select('id')
      .single();
    if (docError || !doc) throw new Error(`fixture document insert failed: ${docError?.message}`);
    documentAId = doc.id;
  });

  afterAll(async () => {
    const svc = getServiceClient();
    await svc.storage.from(STORAGE_BUCKETS.media).remove([facilityAImagePath]).catch(() => undefined);
    await Promise.all([deleteTestUser(adminA.userId), deleteTestUser(adminB.userId)]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows the same-building admin to obtain a signed URL for a facility image', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const url = await signedUrlFor(client, STORAGE_BUCKETS.media, facilityAImagePath);
    expect(url).toMatch(/^https:\/\//);
  });

  it("denies a different-building admin a signed URL for building A's facility image (FR-004)", async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    await expect(signedUrlFor(client, STORAGE_BUCKETS.media, facilityAImagePath)).rejects.toThrow();
  });

  it('trySignedUrlFor returns null (not a throw) for the same denial case, so a page never crashes on it', async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const url = await trySignedUrlFor(client, STORAGE_BUCKETS.media, facilityAImagePath);
    expect(url).toBeNull();
  });

  it('trySignedUrlFor returns null for a path that does not exist in Storage, even for a legitimate same-building member (FR-005)', async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const url = await trySignedUrlFor(client, STORAGE_BUCKETS.media, `${buildingA}/facilities/does-not-exist.png`);
    expect(url).toBeNull();
  });

  it("denies a different-building admin from even reading building A's document row (the first gate getDocumentUrl() relies on)", async () => {
    const client = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data, error } = await client.from('documents').select('file_path').eq('id', documentAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("allows the same-building admin to read building A's document row", async () => {
    const client = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data, error } = await client.from('documents').select('file_path').eq('id', documentAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
