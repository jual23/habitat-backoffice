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
    .select('id, type, subject, body, starred, discarded_at, created_at')
    .eq('building_id', buildingId)
    .is('discarded_at', null)
    .order('created_at', { ascending: false })
    .range(0, 24);

  return <SuggestionsComplaintsClient buildingId={buildingId} entries={entries ?? []} />;
}
