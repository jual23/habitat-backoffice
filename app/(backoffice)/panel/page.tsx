import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { getBuildingDayBounds, formatRelativeTime, mergeRecentActivity, type ActivityItem } from '@/lib/panel';
import {
  IconUsers,
  IconWrench,
  IconPackage,
  IconWalking,
  IconAlertTriangle,
  IconMessage,
} from '@/components/icons';

const ACTIVITY_ICON: Record<ActivityItem['type'], typeof IconUsers> = {
  visit: IconWalking,
  package: IconPackage,
  incidencia: IconWrench,
  emergency: IconAlertTriangle,
  feedback: IconMessage,
};

const ACTIVITY_LABEL: Record<ActivityItem['type'], string> = {
  visit: 'Visita',
  package: 'Paquete',
  incidencia: 'Incidencia',
  emergency: 'Emergencia',
  feedback: 'Queja o sugerencia',
};

/**
 * 016-panel-dashboard-overview: the Panel, a building-scoped daily-operations
 * dashboard — four top stat cards (T003/T004/T005), a recent-activity feed
 * (T008/T009/T010), and a pending-items summary (added by later tasks in
 * this feature).
 */
export default async function PanelPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  // T021: Staff can now open the Panel too (previously redirected to
  // /login) — scoped to its permitted modules by `isStaff` below.
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin' && ctx.role !== 'staff')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Panel no disponible para Administradores de la app.</p>;

  // T022: Staff has no access to Residents/Users, Suggestions & Complaints,
  // or Reservations (Constitution Principle II's six-module list) — every
  // query and render branch below is decided server-side from this flag,
  // per contracts/panel-view-contract.md's access table, not merely hidden
  // in the JSX.
  const isStaff = ctx.role === 'staff';

  // T003: this building's "today" boundary, per lib/panel.ts (research.md §1).
  const { data: building } = await supabase
    .from('buildings')
    .select('timezone')
    .eq('id', buildingId)
    .single();
  const { startIso, endIso } = getBuildingDayBounds(building?.timezone ?? 'UTC');

  // T004: Residentes (owner + renter, unchanged from the previous Panel) plus
  // today's Incidencias/Paquetería/Visitas counts. T022: Staff has no
  // Residents/Users access, so that query is skipped entirely for it.
  const [residents, ticketsToday, packagesToday, visitorsToday] = await Promise.all([
    isStaff
      ? Promise.resolve({ count: null as number | null })
      : supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', buildingId)
          .not('apartment_id', 'is', null),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('packages')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('visitors')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
  ]);

  // T008: candidate pool for the recent-activity feed — top 5 by created_at
  // from each of the five tracked event types, building-scoped. Only
  // non-discarded feedback is eligible (a discarded suggestion/complaint
  // shouldn't surface here). T022: Staff has no Suggestions & Complaints
  // access, so the feedback query is skipped entirely — a suggestion/
  // complaint can never be selected into Staff's merged feed, not merely
  // filtered out after the fact.
  const [recentVisitors, recentPackages, recentTickets, recentEmergencies, recentFeedback] =
    await Promise.all([
      supabase
        .from('visitors')
        .select('id, full_name, created_at')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('packages')
        .select('id, description, created_at')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('tickets')
        .select('id, title, created_at')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('emergencies')
        .select('id, description, created_at')
        .eq('building_id', buildingId)
        .order('created_at', { ascending: false })
        .limit(5),
      isStaff
        ? Promise.resolve({ data: null as { id: string; subject: string; created_at: string }[] | null })
        : supabase
            .from('feedback')
            .select('id, subject, created_at')
            .eq('building_id', buildingId)
            .is('discarded_at', null)
            .order('created_at', { ascending: false })
            .limit(5),
    ]);

  // T009: map each group to ActivityItem[] and merge into the final top 5.
  const activity = mergeRecentActivity([
    (recentVisitors.data ?? []).map((v) => ({
      id: v.id,
      type: 'visit' as const,
      createdAt: v.created_at,
      title: v.full_name,
      href: '/visitors',
    })),
    (recentPackages.data ?? []).map((p) => ({
      id: p.id,
      type: 'package' as const,
      createdAt: p.created_at,
      title: p.description,
      href: '/packages',
    })),
    (recentTickets.data ?? []).map((t) => ({
      id: t.id,
      type: 'incidencia' as const,
      createdAt: t.created_at,
      title: t.title,
      href: '/incidencias',
    })),
    (recentEmergencies.data ?? []).map((e) => ({
      id: e.id,
      type: 'emergency' as const,
      createdAt: e.created_at,
      title: e.description ?? 'Emergencia reportada',
      href: '/emergency',
    })),
    (recentFeedback.data ?? []).map((f) => ({
      id: f.id,
      type: 'feedback' as const,
      createdAt: f.created_at,
      title: f.subject,
      href: '/suggestions-complaints',
    })),
  ]);

  // T016: pending-items summary counts — open incidencias, packages not yet
  // delivered, unread suggestions/complaints, reservations awaiting a
  // decision. Unlike the top cards, these are not "today"-bounded. T022:
  // Staff has no Suggestions & Complaints or Reservations access, so those
  // two queries are skipped entirely.
  const [openTickets, pendingPackages, unreadFeedback, requestedReservations] = await Promise.all([
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
      .in('status', ['pending', 'in_progress']),
    supabase
      .from('packages')
      .select('id', { count: 'exact', head: true })
      .eq('building_id', buildingId)
      .eq('status', 'pending'),
    isStaff
      ? Promise.resolve({ count: null as number | null })
      : supabase
          .from('feedback')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', buildingId)
          .is('viewed_at', null)
          .is('discarded_at', null),
    isStaff
      ? Promise.resolve({ count: null as number | null })
      : supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', buildingId)
          .eq('status', 'requested'),
  ]);

  // T017: right column rows — always rendered, even at 0. T022: the last two
  // rows are omitted entirely for Staff (not in its module list).
  const pendingItems = [
    { label: 'Incidencias', value: openTickets.count ?? 0, href: '/incidencias' },
    { label: 'Paquetería por entregar', value: pendingPackages.count ?? 0, href: '/packages' },
    ...(isStaff
      ? []
      : [
          { label: 'Quejas y sugerencias', value: unreadFeedback.count ?? 0, href: '/suggestions-complaints' },
          { label: 'Reservas de instalaciones', value: requestedReservations.count ?? 0, href: '/reservations' },
        ]),
  ];

  // T005: exactly four cards (replaces the previous five-tile shortcut grid).
  // T022: Residentes is omitted for Staff (no Residents/Users access).
  const stats = [
    ...(isStaff
      ? []
      : [{ label: 'Residentes', value: residents.count ?? 0, icon: IconUsers, href: '/apartments' }]),
    { label: 'Incidencias', value: ticketsToday.count ?? 0, icon: IconWrench, href: '/incidencias' },
    { label: 'Paquetería', value: packagesToday.count ?? 0, icon: IconPackage, href: '/packages' },
    { label: 'Visitas', value: visitorsToday.count ?? 0, icon: IconWalking, href: '/visitors' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel</h1>
          <p>Resumen general de tu edificio.</p>
        </div>
      </div>

      <div className="panel-stats">
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

      <div className="panel-columns">
        <div className="card card-pad">
          <h2 style={{ marginTop: 0 }}>Actividad reciente</h2>
          {activity.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Sin actividad reciente todavía.</p>
          ) : (
            <div className="row-list">
              {activity.map((item) => {
                const Icon = ACTIVITY_ICON[item.type];
                return (
                  <Link key={item.id} href={item.href} className="row" style={{ textDecoration: 'none' }}>
                    <div className="row-top">
                      <div className="tile-icon-avatar">
                        <Icon />
                      </div>
                      <div>
                        <div className="row-title">{ACTIVITY_LABEL[item.type]}</div>
                        <p className="row-body">{item.title}</p>
                      </div>
                      <div className="tile-meta">{formatRelativeTime(item.createdAt)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h2 style={{ marginTop: 0 }}>Solicitudes pendientes</h2>
          <div className="row-list">
            {pendingItems.map((item) => (
              <Link key={item.label} href={item.href} className="row" style={{ textDecoration: 'none' }}>
                <div className="row-top">
                  <div className="row-title">{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{item.value}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
