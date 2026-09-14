/**
 * 016-panel-dashboard-overview: shared helpers for the Panel dashboard.
 *
 * `getBuildingDayBounds` computes "today" per-building the same way
 * `supabase/migrations/0027c_payment_sweeps_timezone_fix.sql` fixed it for
 * payment sweeps (`now() at time zone b.timezone`) — but in TypeScript,
 * since the Panel's counts are ordinary `select` queries from a server
 * component, not a Postgres function. Using the database's own UTC day here
 * would reintroduce the exact off-by-one-day bug that migration fixed.
 */
export function getBuildingDayBounds(
  timezone: string,
  now: Date = new Date(),
): { startIso: string; endIso: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const year = get('year');
  const month = get('month');
  const day = get('day');

  // `timezone`'s offset from UTC at `now`: format `now`'s wall-clock reading
  // in `timezone`, then re-interpret those same numbers *as UTC* via
  // `Date.UTC` — the gap between that and the real instant `now` is exactly
  // the offset. This never touches `new Date(<locale string>)`, which
  // parses in the *server's own* local timezone rather than UTC and so
  // silently returns the wrong offset whenever the server's timezone
  // differs from `timezone` (caught via a direct unit check — see
  // lib/panel.ts's usage in tests/unit, if present, or quickstart.md).
  const wallClockAsUtc = Date.UTC(year, month - 1, day, get('hour'), get('minute'), get('second'));
  const offsetMs = wallClockAsUtc - now.getTime();

  // Midnight in `timezone` (same Y-M-D as `now`, reinterpreted as UTC), then
  // shifted back by the offset to get the real UTC instant.
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  const startIso = new Date(midnightAsUtc - offsetMs).toISOString();
  const endIso = new Date(midnightAsUtc - offsetMs + 24 * 60 * 60 * 1000).toISOString();

  return { startIso, endIso };
}

/** Spanish relative-time label, e.g. "Ahora", "hace 10 min", "hace 2 horas", "hace 1 día". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return 'Ahora';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;

  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
}

export type ActivityType = 'visit' | 'package' | 'incidencia' | 'emergency' | 'feedback';

export type ActivityItem = {
  id: string;
  type: ActivityType;
  createdAt: string;
  title: string;
  href: string;
};

/**
 * Flattens the per-table candidate groups, sorts newest-first (with `id` as
 * a stable tiebreaker so identical-timestamp events don't visibly reorder
 * between loads — spec.md's edge case on simultaneous events), and returns
 * the top `limit`.
 */
export function mergeRecentActivity(groups: ActivityItem[][], limit = 5): ActivityItem[] {
  return groups
    .flat()
    .sort((a, b) => {
      const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (byDate !== 0) return byDate;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    })
    .slice(0, limit);
}
