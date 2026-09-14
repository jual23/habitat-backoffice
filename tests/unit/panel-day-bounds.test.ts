import { describe, it, expect } from 'vitest';
import { getBuildingDayBounds, formatRelativeTime, mergeRecentActivity } from '@/lib/panel';

/**
 * 016-panel-dashboard-overview: regression coverage for a real bug caught
 * during implementation — the first cut of `getBuildingDayBounds` derived a
 * timezone's UTC offset via `new Date(now.toLocaleString('en-US', {
 * timeZone }))`, but `new Date(<locale string>)` parses in the *test/server
 * machine's own* local timezone, not UTC. That made the computed offset
 * silently wrong (often exactly 0) whenever the machine's local timezone
 * differed from the building's configured one — which is the normal case in
 * production (a server typically runs UTC; buildings are in various Latin
 * American timezones). These cases pin the fixed, offset-safe implementation.
 */
describe('getBuildingDayBounds', () => {
  it('computes UTC-5 (America/Panama) day bounds correctly', () => {
    const now = new Date('2026-09-13T15:30:00.000Z'); // 10:30am local
    const { startIso, endIso } = getBuildingDayBounds('America/Panama', now);
    expect(startIso).toBe('2026-09-13T05:00:00.000Z');
    expect(endIso).toBe('2026-09-14T05:00:00.000Z');
  });

  it('computes UTC+9 (Asia/Tokyo) day bounds correctly, including a date rollover', () => {
    const now = new Date('2026-09-13T15:30:00.000Z'); // 00:30am the *next* day locally
    const { startIso, endIso } = getBuildingDayBounds('Asia/Tokyo', now);
    expect(startIso).toBe('2026-09-13T15:00:00.000Z');
    expect(endIso).toBe('2026-09-14T15:00:00.000Z');
  });

  it('the end bound is always exactly 24 hours after the start bound', () => {
    const { startIso, endIso } = getBuildingDayBounds('America/Panama', new Date());
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-13T15:30:00.000Z');
  const minutesAgo = (n: number) => new Date(now.getTime() - n * 60 * 1000).toISOString();

  it('labels sub-minute as "Ahora"', () => {
    expect(formatRelativeTime(minutesAgo(0.5), now)).toBe('Ahora');
  });

  it('labels minutes, hours, and days with correct singular/plural', () => {
    expect(formatRelativeTime(minutesAgo(10), now)).toBe('hace 10 min');
    expect(formatRelativeTime(minutesAgo(60), now)).toBe('hace 1 hora');
    expect(formatRelativeTime(minutesAgo(120), now)).toBe('hace 2 horas');
    expect(formatRelativeTime(minutesAgo(24 * 60), now)).toBe('hace 1 día');
    expect(formatRelativeTime(minutesAgo(2 * 24 * 60), now)).toBe('hace 2 días');
  });
});

describe('mergeRecentActivity', () => {
  it('sorts newest first and breaks exact-timestamp ties by id, stably', () => {
    const merged = mergeRecentActivity(
      [
        [{ id: 'a', type: 'visit', createdAt: '2026-09-13T15:00:00Z', title: 'A', href: '/visitors' }],
        [{ id: 'b', type: 'package', createdAt: '2026-09-13T15:00:00Z', title: 'B', href: '/packages' }],
        [{ id: 'c', type: 'incidencia', createdAt: '2026-09-13T16:00:00Z', title: 'C', href: '/incidencias' }],
      ],
      5,
    );
    expect(merged.map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('caps at the given limit', () => {
    const groups = [Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      type: 'visit' as const,
      createdAt: new Date(2026, 8, 13, 0, i).toISOString(),
      title: `item ${i}`,
      href: '/visitors',
    }))];
    expect(mergeRecentActivity(groups, 5)).toHaveLength(5);
  });
});
