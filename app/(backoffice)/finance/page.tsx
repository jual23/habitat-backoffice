import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { FinanceClient } from './finance-client';

/**
 * T023: Finance module (FR-025) -- Building-Administrator-only. Loads
 * apartments + their fees, the building's payment-cycle/late-fee settings,
 * and the full payments table (filtered/exported client-side, matching this
 * app's existing scale for every other list).
 */
export default async function FinancePage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  const [{ data: apartments }, { data: building }, { data: payments }] = await Promise.all([
    supabase
      .from('apartments')
      .select('id, tower, unit_number, monthly_fee')
      .eq('building_id', buildingId)
      .order('unit_number'),
    supabase
      .from('buildings')
      .select('payment_available_day, payment_due_day, late_fee_type, late_fee_amount')
      .eq('id', buildingId)
      .maybeSingle(),
    supabase
      .from('payments')
      .select(
        'id, apartment_id, amount, late_fee_amount, status, available_date, due_date, reviewed_at, apartments(tower, unit_number)',
      )
      .eq('building_id', buildingId)
      .order('due_date', { ascending: false }),
  ]);

  return (
    <FinanceClient
      buildingId={buildingId}
      apartments={apartments ?? []}
      settings={
        building ?? {
          payment_available_day: null,
          payment_due_day: null,
          late_fee_type: null,
          late_fee_amount: null,
        }
      }
      payments={payments ?? []}
    />
  );
}
