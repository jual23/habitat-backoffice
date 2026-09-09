import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { FacilitiesClient } from './facilities-client';

/** T039: facilities list/detail — image upload, opening hours, reservable toggle. */
export default async function FacilitiesPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage facilities per-building elsewhere.</p>;

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, description, image_url, opens_at, closes_at, open_days, reservable, deleted_at')
    .eq('building_id', buildingId)
    .is('deleted_at', null)
    .order('name');

  // 003-upload-display-fix (T003): image_url is a private Storage path, not a
  // usable URL — resolve it to a 24h signed URL here, server-side, before
  // handing rows to the client component.
  const withSignedUrls = await Promise.all(
    (facilities ?? []).map(async (f) => ({
      ...f,
      image_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, f.image_url, 86400),
    })),
  );

  // 004-facilities-incidencias-packages (T033): the open/closed bubble needs
  // the building's own timezone, not the viewer's browser timezone
  // (research.md item 3).
  const { data: building } = await supabase.from('buildings').select('timezone').eq('id', buildingId).single();

  return (
    <FacilitiesClient
      buildingId={buildingId}
      facilities={withSignedUrls}
      buildingTimezone={building?.timezone ?? 'UTC'}
    />
  );
}
