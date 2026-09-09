import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { AnnouncementsClient } from './announcements-client';

/** T047: announcements list/detail with attachment upload, banner upload, pin toggle. */
export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage announcements per-building elsewhere.</p>;

  const { data: announcements } = await supabase
    .from('announcements')
    .select(
      'id, title, body, banner_url, pinned, created_at, announcement_attachments(id, file_name)',
    )
    .eq('building_id', buildingId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  // 003-upload-display-fix (T007): banner_url is a private Storage path.
  const withSignedUrls = await Promise.all(
    (announcements ?? []).map(async (a) => ({
      ...a,
      banner_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, a.banner_url, 86400),
      attachments: a.announcement_attachments ?? [],
    })),
  );

  return <AnnouncementsClient buildingId={buildingId} announcements={withSignedUrls} />;
}
