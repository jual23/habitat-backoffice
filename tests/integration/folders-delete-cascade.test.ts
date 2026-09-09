import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  cleanupTestBuilding,
  deleteTestUser,
  getServiceClient,
} from '../fixtures';

/**
 * T067: deleting a folder cascades to its subfolders and documents (FR-029).
 * (Storage-object purging is exercised by app/(backoffice)/documentation/actions.ts's
 * deleteFolder, not by this row-level DB test.)
 */
describe('document_folders: delete cascades to subfolders and documents', () => {
  let buildingId: string;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let parentId: string;
  let childId: string;
  let documentId: string;

  beforeAll(async () => {
    buildingId = await createTestBuilding();
    admin = await createTestUser({ role: 'building_admin', buildingId });

    const svc = getServiceClient();
    const { data: parent } = await svc
      .from('document_folders')
      .insert({ building_id: buildingId, name: 'Bylaws' })
      .select('id')
      .single();
    parentId = parent!.id;

    const { data: child } = await svc
      .from('document_folders')
      .insert({ building_id: buildingId, name: '2026', parent_id: parentId })
      .select('id')
      .single();
    childId = child!.id;

    const { data: doc } = await svc
      .from('documents')
      .insert({
        building_id: buildingId,
        folder_id: childId,
        name: 'rules.pdf',
        file_path: `${buildingId}/folders/${childId}/rules.pdf`,
      })
      .select('id')
      .single();
    documentId = doc!.id;
  });

  afterAll(async () => {
    await deleteTestUser(admin.userId);
    await cleanupTestBuilding(buildingId);
  });

  it('removes the subfolder and document rows when the parent folder is deleted', async () => {
    const client = await signIn(signInAs(admin.email, admin.password), admin.email, admin.password);
    const { error } = await client.from('document_folders').delete().eq('id', parentId);
    expect(error).toBeNull();

    const svc = getServiceClient();
    const { data: remainingFolders } = await svc
      .from('document_folders')
      .select('id')
      .in('id', [parentId, childId]);
    const { data: remainingDocs } = await svc.from('documents').select('id').eq('id', documentId);

    expect(remainingFolders ?? []).toHaveLength(0);
    expect(remainingDocs ?? []).toHaveLength(0);
  });
});
