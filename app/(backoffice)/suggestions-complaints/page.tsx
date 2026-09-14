import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { SuggestionsComplaintsClient } from './suggestions-complaints-client';

/** T079: suggestions/complaints tabbed page with favorite/discard actions. */
export default async function SuggestionsComplaintsPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>App Administrators manage this per-building elsewhere.</p>;

  // 011-module-navigation-performance (FR-008, research.md §9): capped to an
  // initial ~25-record batch rather than the full feedback table.
  const { data: entries } = await supabase
    .from('feedback')
    .select('id, type, subject, body, starred, discarded_at, created_at, viewed_at')
    .eq('building_id', buildingId)
    .is('discarded_at', null)
    .order('created_at', { ascending: false })
    .range(0, 24);

  // 016-panel-dashboard-overview (T015, US3): mark any still-unread rows on
  // this page as viewed, as a side effect of rendering the list — the list
  // already shows each entry's full subject+body inline (no separate "open"
  // interaction), so viewing this page *is* "opening" the entry (research.md
  // §3). Only building_admin/app_admin ever reach this page (guard above),
  // so the existing "feedback managed by admins" policy covers this write.
  const unreadIds = (entries ?? []).filter((e) => e.viewed_at === null).map((e) => e.id);
  if (unreadIds.length > 0) {
    await supabase
      .from('feedback')
      .update({ viewed_at: new Date().toISOString() })
      .eq('building_id', buildingId)
      .in('id', unreadIds);
  }

  return <SuggestionsComplaintsClient buildingId={buildingId} entries={entries ?? []} />;
}
