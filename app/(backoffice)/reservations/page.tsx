import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { ReservationsClient } from './reservations-client';

/** T040: reservations list (filterable by status) with approve/decline actions. */
export default async function ReservationsPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage reservations per-building elsewhere.</p>;

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, facility_id, reserved_date, start_time, end_time, guests, status, facilities(name)')
    .eq('building_id', buildingId)
    .order('reserved_date', { ascending: false });

  return (
    <ReservationsClient
      buildingId={buildingId}
      reservations={(reservations ?? []).map((r) => ({
        ...r,
        facility_name: (r.facilities as unknown as { name: string } | null)?.name ?? '—',
      }))}
    />
  );
}
