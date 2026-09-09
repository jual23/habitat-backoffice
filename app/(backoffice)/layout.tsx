import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { SignOutButton } from './sign-out-button';
import { SidebarNav } from './sidebar-nav';
import Link from 'next/link';
import { IconShield, IconAlertTriangle } from '@/components/icons';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';

const ROLE_LABELS: Record<string, string> = {
  app_admin: 'Administrador de la app',
  building_admin: 'Administrador',
  staff: 'Personal',
};

/**
 * T014: session check + role-based navigation. Redirect-if-unauthenticated and
 * the Staff route guard (FR-037) are enforced in middleware.ts, which runs
 * before this layout; here we additionally hide non-Visitas nav items from a
 * Staff-only session (defense in depth — the middleware guard is the real
 * enforcement point, RLS underneath is the actual authorization boundary).
 */
export default async function BackofficeLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  // 007-finance-ops-expansion: Renter, like Resident, has no backoffice access at all
  // (Constitution v1.7.0) — both are mobile-app-only account types.
  if (!ctx.user || ctx.role === 'resident' || ctx.role === 'renter' || ctx.role === null) {
    redirect('/login');
  }

  const isStaffOnly = ctx.role === 'staff';

  let buildingName = 'Habitat';
  let logoSignedUrl: string | null = null;
  let hasUnhandledEmergency = false;
  if (ctx.buildingId) {
    const [{ data: building }, { count: unhandledCount }] = await Promise.all([
      supabase.from('buildings').select('name, logo_url').eq('id', ctx.buildingId).maybeSingle(),
      // 007-finance-ops-expansion (T061, FR-060): a simple building-scoped
      // count, fresh on navigation/reload -- no polling infrastructure needed
      // (research.md item 6), using the (building_id, status) index.
      supabase
        .from('emergencies')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', ctx.buildingId)
        .eq('status', 'unhandled'),
    ]);
    if (building) {
      buildingName = building.name;
      // 003-upload-display-fix (T011): logo_url is a private Storage path.
      logoSignedUrl = await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, building.logo_url, 86400);
    }
    hasUnhandledEmergency = (unhandledCount ?? 0) > 0;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {logoSignedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSignedUrl} alt="" />
            ) : (
              <IconShield width={20} height={20} />
            )}
          </div>
          <div>
            <div className="sidebar-title">{buildingName}</div>
            <div className="sidebar-subtitle">ADMINISTRACIÓN</div>
          </div>
        </div>

        <SidebarNav staffOnly={isStaffOnly} hasUnhandledEmergency={hasUnhandledEmergency} />

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong style={{ color: 'var(--color-text)' }}>
              {ROLE_LABELS[ctx.role] ?? ctx.role}
            </strong>
            <span>{ctx.user.email}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="main">
        {hasUnhandledEmergency && (
          <Link href="/emergency" className="emergency-indicator">
            <IconAlertTriangle width={16} height={16} />
            Emergencia sin atender
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
