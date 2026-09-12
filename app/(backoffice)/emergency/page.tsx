import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { EmergencyClient } from './emergency-client';

/** T059: Emergency module -- Staff and Building Administrator (FR-059). */
export default async function EmergencyPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  // 011-module-navigation-performance (FR-008, research.md §9): capped to an
  // initial ~25-record batch rather than the full emergencies history.
  const { data: emergencies } = await supabase
    .from('emergencies')
    .select('id, reported_by, apartment_id, description, status, created_at, resolved_at, apartments(tower, unit_number)')
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false })
    .range(0, 24);

  return <EmergencyClient buildingId={buildingId} emergencies={emergencies ?? []} />;
}
