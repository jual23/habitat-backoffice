import type { SVGProps } from 'react';

/** Minimal outline icon set (no external icon library — Principle V) matching
 * the reference design's stroke-based glyphs. 20x20, currentColor stroke. */
function base(children: React.ReactNode, props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconGrid = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>,
    p,
  );

export const IconBuilding = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
    </>,
    p,
  );

export const IconMegaphone = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l2 5h2l-1-5h2l7 4V6l-7 4H6a2 2 0 0 0-2 2z" />
      <path d="M8 15v4a1 1 0 0 0 1 1h1" />
    </>,
    p,
  );

export const IconCalendar = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>,
    p,
  );

export const IconWalking = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="M9 8l3-2 3 2 3 3M11 10l-2 4 3 2-1 5M14 11l2 2-1 5M9 14l-3 2" />
    </>,
    p,
  );

export const IconFile = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </>,
    p,
  );

export const IconMessage = (p: SVGProps<SVGSVGElement>) =>
  base(
    <path d="M4 4h16v12H8l-4 4V4z" />,
    p,
  );

export const IconHome = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </>,
    p,
  );

export const IconUsers = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.6" />
      <path d="M15.5 14.2c2.5.4 4.5 2.7 4.5 5.8" />
    </>,
    p,
  );

export const IconPalette = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.9.7-1.5 1.5-1.5H16a4 4 0 0 0 4-4c0-4.4-3.6-8-8-8z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="8" r="1" fill="currentColor" />
    </>,
    p,
  );

export const IconShield = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />, p);

export const IconPlus = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M12 5v14M5 12h14" />, p);

export const IconPencil = (p: SVGProps<SVGSVGElement>) =>
  base(
    <path d="M4 20l4-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5 16l-1 4z" />,
    p,
  );

export const IconTrash = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </>,
    p,
  );

export const IconX = (p: SVGProps<SVGSVGElement>) => base(<path d="M6 6l12 12M18 6L6 18" />, p);

export const IconPin = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M12 2a5 5 0 0 0-5 5c0 3.5 5 12 5 12s5-8.5 5-12a5 5 0 0 0-5-5z" />
      <circle cx="12" cy="7" r="2" />
    </>,
    p,
  );

export const IconPaperclip = (p: SVGProps<SVGSVGElement>) =>
  base(
    <path d="M21 11.5l-9 9a4 4 0 0 1-5.5-5.8l9-9a2.7 2.7 0 0 1 3.8 3.8l-9 9a1.3 1.3 0 0 1-1.9-1.9l8.2-8.2" />,
    p,
  );

export const IconSignOut = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>,
    p,
  );

/** 004-facilities-incidencias-packages (T013): Incidencias nav item. */
export const IconWrench = (p: SVGProps<SVGSVGElement>) =>
  base(
    <path d="M14.7 6.3a4 4 0 0 0-5.4 4.6L4 16.2V20h3.8l5.3-5.3a4 4 0 0 0 4.6-5.4l-2.6 2.6-2-2z" />,
    p,
  );

/** 004-facilities-incidencias-packages (T026): Packages nav item. */
export const IconPackage = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </>,
    p,
  );

/** 007-finance-ops-expansion (T025): Finance nav item. */
export const IconCoin = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.3a2.5 2 0 0 1 2.5-1.3c1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2a2.5 2 0 0 0 2.5-1.3" />
    </>,
    p,
  );

/**
 * 007-finance-ops-expansion (T038): Maintenance nav item — a clock face
 * (recurring/scheduled tasks), distinct from Incidencias' wrench.
 */
export const IconClock = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3.5 2" />
    </>,
    p,
  );

/** 007-finance-ops-expansion (T051): Polls nav item. */
export const IconChartBar = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </>,
    p,
  );

/**
 * 007-finance-ops-expansion (T062): Emergency nav item. Reused for broadcast's
 * 'warning-triangle' icon key (008-broadcast-message-persistence, T014) rather
 * than duplicating an identical glyph under a second name.
 */
export const IconAlertTriangle = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M10.3 3.9 2.6 18a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0z" />
      <path d="M12 9.5v4M12 16.8h.01" />
    </>,
    p,
  );

/** 008-broadcast-message-persistence (T014): broadcast template icon -- 'fire'. */
export const IconFire = (p: SVGProps<SVGSVGElement>) =>
  base(
    <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 1 2 2.5 2 4.5A5.5 5.5 0 0 1 6.5 19 6 6 0 0 1 6 13c0-3 2-4 2-7 1.5 1 2 2.5 2 4 1-2-1-4 2-8z" />,
    p,
  );

/** 008-broadcast-message-persistence (T014): broadcast template icon -- 'water-drop'. */
export const IconWaterDrop = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z" />, p);
