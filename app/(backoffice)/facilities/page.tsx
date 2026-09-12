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

  // 011-module-navigation-performance (research.md §1.3, §4, §9): the
  // facilities query and the building-timezone query are independent —
  // run them concurrently instead of sequentially. Facilities is also
  // capped to an initial ~25-record batch (FR-008) rather than the full
  // table (contracts/module-page-pattern.md rule 5 — this is the contract's
  // reference implementation).
  const [{ data: facilities }, { data: building }] = await Promise.all([
    supabase
      .from('facilities')
      .select('id, name, description, image_url, opens_at, closes_at, open_days, reservable, deleted_at')
      .eq('building_id', buildingId)
      .is('deleted_at', null)
      .order('name')
      .range(0, 24),
    // 004-facilities-incidencias-packages (T033): the open/closed bubble needs
    // the building's own timezone, not the viewer's browser timezone
    // (research.md item 3).
    supabase.from('buildings').select('timezone').eq('id', buildingId).single(),
  ]);

  // 003-upload-display-fix (T003): image_url is a private Storage path, not a
  // usable URL — resolve it to a 24h signed URL here, server-side, before
  // handing rows to the client component.
  const withSignedUrls = await Promise.all(
    (facilities ?? []).map(async (f) => ({
      ...f,
      image_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, f.image_url, 86400),
    })),
  );

  return (
    <FacilitiesClient
      buildingId={buildingId}
      facilities={withSignedUrls}
      buildingTimezone={building?.timezone ?? 'UTC'}
    />
  );
}
