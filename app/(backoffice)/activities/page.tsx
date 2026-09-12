import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { ActivitiesClient } from './activities-client';

/** T054: activities list/detail with date, banner upload, participant cap field. */
export default async function ActivitiesPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage activities per-building elsewhere.</p>;

  // 011-module-navigation-performance (FR-008, research.md §9): capped to an
  // initial ~25-record batch rather than the full activities table.
  const { data: activities } = await supabase
    .from('activities')
    .select('id, title, description, location, starts_at, ends_at, max_participants, banner_url')
    .eq('building_id', buildingId)
    .order('starts_at', { ascending: true })
    .range(0, 24);

  // 003-upload-display-fix (T005): banner_url is a private Storage path.
  const withSignedUrls = await Promise.all(
    (activities ?? []).map(async (a) => ({
      ...a,
      banner_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, a.banner_url, 86400),
    })),
  );

  return <ActivitiesClient buildingId={buildingId} activities={withSignedUrls} />;
}
