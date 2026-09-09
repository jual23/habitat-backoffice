'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { getAdminClient } from '@/lib/supabase/admin';
import { createBuildingUser } from '@/lib/user-provisioning';
import {
  createResidentAccountSchema,
  type CreateResidentAccountInput,
} from '@/lib/validation/users';
import { updateResidentSchema, type UpdateResidentInput } from '@/lib/validation/apartments';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

/**
 * 006-direct-user-creation (T010): create a real, immediately-usable resident
 * account directly (FR-001/FR-005) — replaces the old `invitations`-row-only
 * flow. `buildingId` is taken from the caller's own authenticated session
 * (`ctx.buildingId`), never from the `buildingId` argument some other actions
 * in this app accept as a convenience parameter — see research.md item 4 for
 * why that distinction matters once an elevated (RLS-bypassing) call is
 * involved. The `buildingId` parameter below exists only for the caller's own
 * revalidate/audit convenience and is never passed to `createBuildingUser()`.
 *
 * 007-finance-ops-expansion (T009, FR-001/FR-004): `role` extends to `'renter'`,
 * provisioned identically (same form, same validation) — `createBuildingUser()`
 * is what actually branches on it (tenant_type in the Admin API metadata).
 */
export async function createResident(
  buildingId: string,
  input: CreateResidentAccountInput,
  role: 'resident' | 'renter' = 'resident',
): Promise<ActionResult> {
  const parsed = createResidentAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireBuildingAdmin();
  if (!ctx.buildingId) return { ok: false, error: 'Not authorized' };

  const result = await createBuildingUser({
    adminClient: getAdminClient(),
    requestClient: supabase,
    actorId: ctx.user!.id,
    buildingId: ctx.buildingId,
    role,
    email: parsed.data.email,
    password: parsed.data.password,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    documentId: parsed.data.document_id,
    apartmentId: parsed.data.apartment_id,
  });

  if ('error' in result) return { ok: false, error: result.error };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: role === 'renter' ? 'renter.create' : 'resident.create',
    entityType: 'profile',
    entityId: result.userId,
    metadata: {
      email: parsed.data.email,
      apartment_id: parsed.data.apartment_id,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      document_id: parsed.data.document_id,
    },
  });

  revalidatePath('/users');
  return { ok: true };
}

/**
 * FR-004/005, extended by 006-direct-user-creation (T015, spec.md User Story 2):
 * edit an existing resident's email, apartment, first name, last name, or
 * document ID. `updateResidentSchema`'s validated fields pass straight through
 * to the `profiles` UPDATE — no per-field branching needed, the existing
 * `"profiles managed by admins"` RLS policy already covers every one of these
 * columns unchanged. Note: this updates `profiles.email` (the display record
 * used throughout the backoffice); it does not change the resident's actual
 * sign-in email in `auth.users`, which requires the service-role admin API —
 * revisit if/when an admin-API-backed path for that specific case is needed.
 */
export async function updateResident(
  profileId: string,
  buildingId: string,
  input: UpdateResidentInput,
): Promise<ActionResult> {
  const parsed = updateResidentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', profileId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'resident.update',
    entityType: 'profile',
    entityId: profileId,
    metadata: parsed.data,
  });

  revalidatePath('/users');
  return { ok: true };
}

/** FR-006: delete a resident (an accepted invitation, i.e. a `profiles` row). */
export async function deleteResident(
  profileId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('profiles').delete().eq('id', profileId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'resident.delete',
    entityType: 'profile',
    entityId: profileId,
  });

  revalidatePath('/users');
  return { ok: true };
}

/** Cancels a resident invitation that hasn't been accepted yet. */
export async function cancelResidentInvitation(
  invitationId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'resident.invite_cancel',
    entityType: 'invitation',
    entityId: invitationId,
  });

  revalidatePath('/users');
  return { ok: true };
}
