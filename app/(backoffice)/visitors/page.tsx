import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { VisitorsClient } from './visitors-client';

/**
 * T065: visitors list (Staff-accessible) with mark-arrived. Staff provisioning
 * (createStaff/deleteStaff, still in staff-actions.ts) now lives under
 * "Usuarios y roles" (app/(backoffice)/users) to match the reference nav.
 */
export default async function VisitorsPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  // 007-finance-ops-expansion (US3, FR-030): show which apartment registered
  // each visitor — visitors.apartment_id already existed (feature 001), it was
  // simply not yet selected/joined here.
  // 011-module-navigation-performance (FR-008, research.md §9): capped to an
  // initial ~25-record batch rather than the full visitors history.
  const { data: visitors } = await supabase
    .from('visitors')
    .select(
      'id, full_name, document_id, vehicle_plate, status, expires_at, arrived_at, apartment_id, apartments(tower, unit_number)',
    )
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false })
    .range(0, 24);

  return <VisitorsClient buildingId={buildingId} visitors={visitors ?? []} />;
}
