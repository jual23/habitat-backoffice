'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { parseFeeCsv } from '@/lib/csv';
import {
  setApartmentFeeSchema,
  bulkFeeCsvRowSchema,
  financeSettingsSchema,
  approvePaymentSchema,
  type SetApartmentFeeInput,
  type FinanceSettingsInput,
  type ApprovePaymentInput,
} from '@/lib/validation/finance';
import { toFriendlyMessage } from '@/lib/errors';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BulkResult = ActionResult & { errors?: string[] };

/** FR-025: Finance is Building-Administrator-only -- not Staff, Resident, or Renter. */
async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('No autorizado.');
  }
  return { supabase, ctx };
}

/** FR-010: set a single apartment's monthly fee. */
export async function setApartmentFee(
  buildingId: string,
  input: SetApartmentFeeInput,
): Promise<ActionResult> {
  const parsed = setApartmentFeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('apartments')
    .update({ monthly_fee: parsed.data.amount })
    .eq('id', parsed.data.apartment_id)
    .eq('building_id', buildingId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar la cuota.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'finance.fee_set',
    entityType: 'apartment',
    entityId: parsed.data.apartment_id,
    metadata: { amount: parsed.data.amount },
  });

  revalidatePath('/finance');
  return { ok: true };
}

/**
 * FR-011/013: bulk-update fees from an uploaded CSV -- a merge (only listed
 * apartments change) that rejects an unknown-apartment row individually,
 * without discarding the rest of the file's valid rows (Edge Cases). Matches
 * apartments by the same `tower + unit_number` label the template (T022) and
 * the rest of this app's UI already use.
 */
export async function bulkSetFees(buildingId: string, csvText: string): Promise<BulkResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, tower, unit_number')
    .eq('building_id', buildingId);

  const labelToId = new Map<string, string>();
  for (const a of apartments ?? []) {
    const label = a.tower ? `${a.tower} ${a.unit_number}` : a.unit_number;
    labelToId.set(label, a.id);
  }

  const rows = parseFeeCsv(csvText);
  const errors: string[] = [];
  let updated = 0;

  for (const row of rows) {
    const parsedRow = bulkFeeCsvRowSchema.safeParse(row);
    if (!parsedRow.success) {
      errors.push(`${row.apartmentLabel}: ${parsedRow.error.issues[0]?.message ?? 'Fila inválida.'}`);
      continue;
    }
    const apartmentId = labelToId.get(parsedRow.data.apartmentLabel);
    if (!apartmentId) {
      errors.push(`${row.apartmentLabel}: apartamento no encontrado en este edificio`);
      continue;
    }
    const { error } = await supabase
      .from('apartments')
      .update({ monthly_fee: parsedRow.data.amount })
      .eq('id', apartmentId)
      .eq('building_id', buildingId);
    if (error) {
      errors.push(`${row.apartmentLabel}: ${toFriendlyMessage(error, 'no se pudo actualizar la cuota')}`);
      continue;
    }
    updated++;
  }

  if (updated > 0) {
    await writeAuditLog(supabase, {
      actorId: ctx.user!.id,
      buildingId,
      action: 'finance.fee_bulk_set',
      entityType: 'apartment',
      entityId: null,
      metadata: { updated, errors: errors.length },
    });
  }

  revalidatePath('/finance');
  if (updated === 0 && errors.length > 0) {
    return { ok: false, error: errors[0] ?? 'No se actualizó ninguna fila.', errors };
  }
  return { ok: true, errors: errors.length > 0 ? errors : undefined };
}

/**
 * FR-017/FR-018/SC-005: approve a payment (submitted/pending/overdue ->
 * received) and notify every resident of the apartment -- reuses the
 * existing "notifications insert by staff or admin for their building"
 * policy unchanged (contracts/rls-policies.md), matching registerPackage()'s
 * fan-out pattern exactly.
 */
export async function approvePayment(
  buildingId: string,
  input: ApprovePaymentInput,
): Promise<ActionResult> {
  const parsed = approvePaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, apartment_id')
    .eq('id', parsed.data.payment_id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: toFriendlyMessage(fetchError, 'No se pudo cargar el pago.') };
  if (!payment) return { ok: false, error: 'Pago no encontrado.' };

  const { error, count } = await supabase
    .from('payments')
    .update(
      { status: 'received', reviewed_by: ctx.user!.id, reviewed_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('id', parsed.data.payment_id);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo aprobar el pago.') };
  if (count === 0) return { ok: false, error: 'Este pago ya no puede aprobarse.' };

  const { data: residents } = await supabase
    .from('profiles')
    .select('id')
    .eq('apartment_id', payment.apartment_id);

  for (const resident of residents ?? []) {
    await supabase.from('notifications').insert({
      user_id: resident.id,
      building_id: buildingId,
      title: 'Pago recibido',
      body: 'Tu pago fue confirmado y marcado como recibido.',
      link: '/payments',
    });
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'payment.approve',
    entityType: 'payment',
    entityId: parsed.data.payment_id,
    metadata: { notified: (residents ?? []).length },
  });

  revalidatePath('/finance');
  return { ok: true };
}

/** FR-014/019: the building-wide payment cycle and late-fee configuration. */
export async function setFinanceSettings(
  buildingId: string,
  input: FinanceSettingsInput,
): Promise<ActionResult> {
  const parsed = financeSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase
    .from('buildings')
    .update({
      payment_available_day: parsed.data.payment_available_day,
      payment_due_day: parsed.data.payment_due_day,
      late_fee_type: parsed.data.late_fee_type,
      late_fee_amount: parsed.data.late_fee_amount,
    })
    .eq('id', buildingId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar la configuración de finanzas.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'finance.settings_update',
    entityType: 'building',
    entityId: buildingId,
    metadata: parsed.data,
  });

  revalidatePath('/finance');
  return { ok: true };
}
