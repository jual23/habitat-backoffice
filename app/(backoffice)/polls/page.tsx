import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { PollsClient } from './polls-client';

/**
 * T049: Community Polls (Building-Administrator-only, FR-048). For an
 * anonymous poll, only aggregate counts per option are queried/passed to the
 * client; for a non-anonymous poll, the per-apartment breakdown is also
 * queried (research.md item 5 -- anonymity is enforced here, not by RLS).
 */
export default async function PollsPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  const { data: polls } = await supabase
    .from('polls')
    .select('id, title, description, allow_multiple, anonymous, closes_at')
    .eq('building_id', buildingId)
    .order('closes_at', { ascending: false });

  const pollsWithData = await Promise.all(
    (polls ?? []).map(async (poll) => {
      const { data: options } = await supabase
        .from('poll_options')
        .select('id, label, sort_order')
        .eq('poll_id', poll.id)
        .order('sort_order');

      if (poll.anonymous) {
        const { data: votes } = await supabase.from('poll_votes').select('option_id').eq('poll_id', poll.id);
        const counts = new Map<string, number>();
        for (const v of votes ?? []) counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
        return {
          ...poll,
          options: options ?? [],
          results: (options ?? []).map((o) => ({ option_id: o.id, count: counts.get(o.id) ?? 0 })),
          breakdown: null,
        };
      }

      const { data: votes } = await supabase
        .from('poll_votes')
        .select('option_id, apartment_id, apartments(tower, unit_number)')
        .eq('poll_id', poll.id);
      const counts = new Map<string, number>();
      for (const v of votes ?? []) counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
      return {
        ...poll,
        options: options ?? [],
        results: (options ?? []).map((o) => ({ option_id: o.id, count: counts.get(o.id) ?? 0 })),
        breakdown: votes ?? [],
      };
    }),
  );

  return <PollsClient buildingId={buildingId} polls={pollsWithData} />;
}
