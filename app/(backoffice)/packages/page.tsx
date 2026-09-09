import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { PackagesClient } from './packages-client';

/**
 * T027: package receipt list (Staff-accessible) — register-package form
 * (apartment dropdown, description, optional photo) and pending/Recogido list.
 */
export default async function PackagesPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, unit_number, tower')
    .eq('building_id', buildingId)
    .order('unit_number');

  const { data: packages } = await supabase
    .from('packages')
    .select('id, apartment_id, description, photo_url, status, created_at, picked_up_at')
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false });

  // 003-upload-display-fix pattern: photo_url is a private Storage path, not a
  // usable URL — resolve it to a signed URL server-side.
  const withSignedUrls = await Promise.all(
    (packages ?? []).map(async (p) => ({
      ...p,
      photo_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, p.photo_url),
    })),
  );

  return <PackagesClient buildingId={buildingId} apartments={apartments ?? []} packages={withSignedUrls} />;
}
