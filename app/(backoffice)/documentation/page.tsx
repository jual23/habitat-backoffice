import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { DocumentationClient } from './documentation-client';

/** T072: documentation folder-tree and document list/upload page. */
export default async function DocumentationPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage documentation per-building elsewhere.</p>;

  // 011-module-navigation-performance (FR-008, research.md §9): documents
  // capped to an initial ~25-record batch; the folder tree is typically
  // small and left uncapped.
  const [{ data: folders }, { data: documents }] = await Promise.all([
    supabase.from('document_folders').select('id, name, parent_id').eq('building_id', buildingId).order('name'),
    supabase
      .from('documents')
      .select('id, name, folder_id, size_bytes, created_at')
      .eq('building_id', buildingId)
      .order('name')
      .range(0, 24),
  ]);

  return (
    <DocumentationClient buildingId={buildingId} folders={folders ?? []} documents={documents ?? []} />
  );
}
