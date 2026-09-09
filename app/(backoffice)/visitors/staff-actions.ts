'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { getAdminClient } from '@/lib/supabase/admin';
import { createBuildingUser } from '@/lib/user-provisioning';
import { createStaffAccountSchema, type CreateStaffAccountInput } from '@/lib/validation/users';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireBuildingAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || ctx.role !== 'building_admin') {
    throw new Error('Not authorized');
  }
  return { supabase, ctx };
}

/**
 * 006-direct-user-creation (T011): provision a real, immediately-usable Staff
 * account directly (FR-001/FR-005), scoped to the calling building_admin's
 * own building — replaces the old `invitations`-row-only flow (see
 * SCHEMA-ADAPTATION.md's note on the accept-invitation flow that never got
 * built). As in `users/actions.ts`'s `createResident()`, `buildingId` is taken
 * from `ctx.buildingId` (the authenticated session), never from the
 * `buildingId` argument — research.md item 4.
 */
export async function createStaff(
  buildingId: string,
  input: CreateStaffAccountInput,
): Promise<ActionResult> {
  const parsed = createStaffAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { supabase, ctx } = await requireBuildingAdmin();
  if (!ctx.buildingId) return { ok: false, error: 'Not authorized' };

  const result = await createBuildingUser({
    adminClient: getAdminClient(),
    requestClient: supabase,
    actorId: ctx.user!.id,
    buildingId: ctx.buildingId,
    role: 'staff',
    email: parsed.data.email,
    password: parsed.data.password,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    documentId: parsed.data.document_id,
  });

  if ('error' in result) return { ok: false, error: result.error };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'staff.create',
    entityType: 'user_role',
    entityId: result.userId,
    metadata: {
      email: parsed.data.email,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      document_id: parsed.data.document_id,
    },
  });

  revalidatePath('/visitors');
  return { ok: true };
}

/** FR-040: remove an already-accepted Staff account (a `user_roles` row). */
export async function deleteStaff(userRoleId: string, buildingId: string): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('user_roles').delete().eq('id', userRoleId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'staff.remove',
    entityType: 'user_role',
    entityId: userRoleId,
  });

  revalidatePath('/visitors');
  return { ok: true };
}

/** Cancels a Staff invitation that hasn't been accepted yet. */
export async function cancelStaffInvitation(
  invitationId: string,
  buildingId: string,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireBuildingAdmin();

  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
  if (error) return { ok: false, error: error.message };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'staff.invite_cancel',
    entityType: 'invitation',
    entityId: invitationId,
  });

  revalidatePath('/visitors');
  return { ok: true };
}
