import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { MaintenanceClient } from './maintenance-client';

/** T036: Maintenance module -- Building Administrator (full) + Staff (mark-done). */
export default async function MaintenancePage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'staff' && ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  const [{ data: tasks }, { data: completions }] = await Promise.all([
    supabase
      .from('maintenance_tasks')
      .select('id, name, frequency, interval_months, next_due_date')
      .eq('building_id', buildingId)
      .order('next_due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('maintenance_completions')
      .select('id, task_id, completed_by, completed_at, photo_url')
      .eq('building_id', buildingId)
      .order('completed_at', { ascending: false })
      .limit(50),
  ]);

  const completionsWithUrls = await Promise.all(
    (completions ?? []).map(async (c) => ({
      ...c,
      photo_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, c.photo_url),
    })),
  );

  return (
    <MaintenanceClient
      buildingId={buildingId}
      isStaffOnly={ctx.role === 'staff'}
      tasks={tasks ?? []}
      completions={completionsWithUrls}
    />
  );
}
