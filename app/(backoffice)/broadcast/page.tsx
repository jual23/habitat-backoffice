import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { BroadcastClient } from './broadcast-client';

/** T016: Broadcast module -- Building Administrator always; Staff only when the toggle is on. */
export default async function BroadcastPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  const [{ data: broadcasts }, { data: templates }, { data: building }] = await Promise.all([
    supabase
      .from('broadcasts')
      .select('id, message, icon, template_id, status, sent_by, deactivated_at, created_at')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false }),
    supabase
      .from('broadcast_templates')
      .select('id, message, icon, created_at')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false }),
    supabase.from('buildings').select('staff_broadcast_enabled').eq('id', buildingId).maybeSingle(),
  ]);

  return (
    <BroadcastClient
      buildingId={buildingId}
      isStaffOnly={ctx.role === 'staff'}
      broadcasts={broadcasts ?? []}
      templates={templates ?? []}
      staffBroadcastEnabled={building?.staff_broadcast_enabled ?? false}
    />
  );
}
