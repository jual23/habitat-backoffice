'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconGrid,
  IconBuilding,
  IconMegaphone,
  IconCalendar,
  IconWalking,
  IconFile,
  IconMessage,
  IconHome,
  IconUsers,
  IconPalette,
  IconWrench,
  IconPackage,
  IconCoin,
  IconClock,
  IconChartBar,
  IconAlertTriangle,
} from '@/components/icons';

// Icon components can't cross the server/client boundary as props (they're
// functions), so the nav definition — icons included — lives here, in the
// client component, rather than being passed down from layout.tsx.
const NAV_ITEMS = [
  { href: '/panel', label: 'Panel', icon: IconGrid },
  { href: '/facilities', label: 'Instalaciones', icon: IconBuilding },
  { href: '/announcements', label: 'Noticias y avisos', icon: IconMegaphone },
  { href: '/activities', label: 'Actividades', icon: IconCalendar },
  { href: '/visitors', label: 'Visitas', icon: IconWalking },
  { href: '/incidencias', label: 'Incidencias', icon: IconWrench },
  { href: '/packages', label: 'Paquetería', icon: IconPackage },
  // 007-finance-ops-expansion (T025): admin-only, no `staffOnly` change.
  { href: '/finance', label: 'Finanzas', icon: IconCoin },
  // 007-finance-ops-expansion (T038): Staff-accessible (mark-done only).
  { href: '/maintenance', label: 'Mantenimiento', icon: IconClock },
  // 007-finance-ops-expansion (T051): admin-only, no `staffOnly` change.
  { href: '/polls', label: 'Encuestas', icon: IconChartBar },
  // 007-finance-ops-expansion (T062): Staff-accessible (view/acknowledge).
  { href: '/emergency', label: 'Emergencias', icon: IconAlertTriangle },
  // 008-broadcast-message-persistence (T018): Staff-accessible only when the
  // building's staff_broadcast_enabled toggle is on (enforced by the page/RLS).
  { href: '/broadcast', label: 'Difusión', icon: IconMegaphone },
  { href: '/documentation', label: 'Documentos', icon: IconFile },
  { href: '/suggestions-complaints', label: 'Quejas y sugerencias', icon: IconMessage },
  { href: '/apartments', label: 'Apartamentos', icon: IconHome },
  { href: '/users', label: 'Usuarios y roles', icon: IconUsers },
  { href: '/customization', label: 'Personalización', icon: IconPalette },
];

export function SidebarNav({
  staffOnly,
  isAppAdmin = false,
  hasUnhandledEmergency = false,
}: {
  staffOnly: boolean;
  /**
   * 012-app-admin-building-management (research.md §2): App Administrator
   * keeps only the Users link — every building-operational module is hidden,
   * since none of them apply without a specific building selected (App
   * Administrator's own `ctx.buildingId` is always null).
   */
  isAppAdmin?: boolean;
  /** 007-finance-ops-expansion (T062, FR-060): blinks the Emergency link. */
  hasUnhandledEmergency?: boolean;
}) {
  const pathname = usePathname();
  const items = isAppAdmin
    ? NAV_ITEMS.filter((item) => item.href === '/users')
    : staffOnly
      ? NAV_ITEMS.filter(
          (item) =>
            item.href === '/visitors' ||
            item.href === '/incidencias' ||
            item.href === '/packages' ||
            item.href === '/maintenance' ||
            item.href === '/emergency' ||
            item.href === '/broadcast',
        )
      : NAV_ITEMS;

  return (
    <nav className="nav">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-item${pathname?.startsWith(item.href) ? ' active' : ''}${
            item.href === '/emergency' && hasUnhandledEmergency ? ' nav-item-blink' : ''
          }`}
        >
          <item.icon />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
