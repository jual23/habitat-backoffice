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

  // 011-module-navigation-performance (FR-008, research.md §9): capped to an
  // initial ~25-record batch rather than the full reservations history.
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, facility_id, reserved_date, start_time, end_time, guests, status, facilities(name)')
    .eq('building_id', buildingId)
    .order('reserved_date', { ascending: false })
    .range(0, 24);

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
