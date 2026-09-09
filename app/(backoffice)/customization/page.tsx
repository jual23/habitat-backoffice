import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { CustomizationClient } from './customization-client';

/** T085: customization page — accent-color picker + logo uploader. */
export default async function CustomizationPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage this per-building elsewhere.</p>;

  const { data: building } = await supabase
    .from('buildings')
    .select('accent_color, logo_url')
    .eq('id', buildingId)
    .single();

  // 003-upload-display-fix (T009): logo_url is a private Storage path.
  const logoSignedUrl = await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, building?.logo_url ?? null, 86400);

  return (
    <CustomizationClient
      buildingId={buildingId}
      accentColor={building?.accent_color ?? '#1F4D2E'}
      logoUrl={building?.logo_url ?? null}
      logoSignedUrl={logoSignedUrl}
    />
  );
}
