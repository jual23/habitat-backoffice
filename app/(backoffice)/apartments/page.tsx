import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { ApartmentsClient } from './apartments-client';

/** T027: apartments list/detail — create/edit/delete apartment, view its residents. */
export default async function ApartmentsPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) {
    return <p>App Administrators manage apartments per-building elsewhere.</p>;
  }

  // 011-module-navigation-performance (FR-008, research.md §9): both lists
  // scale with building size — capped to an initial ~25-record batch each.
  const [{ data: apartments }, { data: residents }] = await Promise.all([
    supabase
      .from('apartments')
      .select('id, tower, unit_number, floor, created_at')
      .eq('building_id', buildingId)
      .order('tower')
      .order('unit_number')
      .range(0, 24),
    supabase
      .from('profiles')
      .select('id, full_name, email, apartment_id')
      .eq('building_id', buildingId)
      .not('apartment_id', 'is', null)
      .range(0, 24),
  ]);

  return (
    <ApartmentsClient
      buildingId={buildingId}
      apartments={apartments ?? []}
      residents={residents ?? []}
    />
  );
}
