import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { IncidenciasClient } from './incidencias-client';

/**
 * T014: Incidencias list (Staff-accessible) — every ticket for the building,
 * its comments, apartment display data, and the Pending/In-Progress-only
 * ticket list used by the duplicate-ticket picker (FR-009).
 */
export default async function IncidenciasPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  const { data: tickets } = await supabase
    .from('tickets')
    .select(
      'id, title, description, status, rejection_reason, duplicate_of_ticket_id, apartment_id, reported_by, created_at',
    )
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false });

  const ticketIds = (tickets ?? []).map((t) => t.id);

  const { data: comments } =
    ticketIds.length > 0
      ? await supabase
          .from('ticket_comments')
          .select('id, ticket_id, author_id, body, created_at')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: true })
      : { data: [] };

  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, unit_number, tower')
    .eq('building_id', buildingId);

  // FR-009: only Pending/In-Progress tickets are valid duplicate-link targets.
  const { data: duplicateCandidates } = await supabase
    .from('tickets')
    .select('id, title')
    .eq('building_id', buildingId)
    .in('status', ['pending', 'in_progress']);

  return (
    <IncidenciasClient
      buildingId={buildingId}
      tickets={tickets ?? []}
      comments={comments ?? []}
      apartments={apartments ?? []}
      duplicateCandidates={duplicateCandidates ?? []}
    />
  );
}
