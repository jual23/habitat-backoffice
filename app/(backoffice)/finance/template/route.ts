import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { generateFeeCsv } from '@/lib/csv';

/**
 * FR-012 (research.md item 2): streams the fee CSV template -- every
 * apartment in the building in column A, its currently configured fee (if
 * any) pre-filled in column B. A Route Handler, not a Server Action, since a
 * Server Action can't hand the browser a native file-download response.
 */
export async function GET() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin') || !ctx.buildingId) {
    return new Response('Not authorized', { status: 403 });
  }

  const { data: apartments } = await supabase
    .from('apartments')
    .select('tower, unit_number, monthly_fee')
    .eq('building_id', ctx.buildingId)
    .order('unit_number');

  const csv = generateFeeCsv(
    (apartments ?? []).map((a) => ({
      apartmentLabel: a.tower ? `${a.tower} ${a.unit_number}` : a.unit_number,
      amount: a.monthly_fee,
    })),
  );

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="cuotas.csv"',
    },
  });
}
