import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { IconBuilding, IconHome, IconMegaphone, IconCalendar } from '@/components/icons';

/** Panel: a small building-scoped dashboard, matching the reference nav's first item. */
export default async function PanelPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Panel no disponible para Administradores de la app.</p>;

  const [apartments, residents, pendingReservations, upcomingActivities, pendingVisitors] =
    await Promise.all([
      supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('building_id', buildingId),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', buildingId)
        .not('apartment_id', 'is', null),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', buildingId)
        .eq('status', 'requested'),
      supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', buildingId)
        .gte('starts_at', new Date().toISOString()),
      supabase
        .from('visitors')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', buildingId)
        .eq('status', 'pending'),
    ]);

  const stats = [
    { label: 'Apartamentos', value: apartments.count ?? 0, icon: IconHome, href: '/apartments' },
    { label: 'Residentes', value: residents.count ?? 0, icon: IconHome, href: '/users' },
    {
      label: 'Reservas pendientes',
      value: pendingReservations.count ?? 0,
      icon: IconBuilding,
      href: '/reservations',
    },
    {
      label: 'Actividades próximas',
      value: upcomingActivities.count ?? 0,
      icon: IconCalendar,
      href: '/activities',
    },
    {
      label: 'Visitas esperadas',
      value: pendingVisitors.count ?? 0,
      icon: IconMegaphone,
      href: '/visitors',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel</h1>
          <p>Resumen general de tu edificio.</p>
        </div>
      </div>

      <div className="grid">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="tile" style={{ textDecoration: 'none' }}>
            <div className="tile-body">
              <div className="tile-icon-avatar">
                <s.icon />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{s.value}</div>
              <div className="tile-meta">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
