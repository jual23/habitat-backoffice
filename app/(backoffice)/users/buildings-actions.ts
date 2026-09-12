'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { getAdminClient } from '@/lib/supabase/admin';
import { createBuildingUser } from '@/lib/user-provisioning';
import { uploadBuildingFile, fileFromFormData, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { getImageDimensions } from '@/lib/image-dimensions';
import {
  createBuildingSchema,
  updateBuildingSchema,
  createBuildingAdminAccountSchema,
} from '@/lib/validation/buildings';
import { toFriendlyMessage } from '@/lib/errors';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * 012-app-admin-building-management: every action here is reachable only by
 * App Administrator — re-checked server-side on every call (Constitution
 * Principle III), never relying on the navigation restriction (FR-001) as
 * the only gate (contracts/app-admin-users-content.md).
 */
async function requireAppAdmin() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);
  if (!ctx.user || ctx.role !== 'app_admin') {
    throw new Error('No autorizado.');
  }
  return { supabase, ctx };
}

/** Either pick an existing Building Administrator, or provide a new account's details (research.md §10). */
export type AdministratorChoice =
  | { kind: 'existing'; userId: string }
  | {
      kind: 'new';
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      document_id: string;
    };

async function assignAdministrator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  buildingId: string,
  actorId: string,
  administrator: AdministratorChoice,
): Promise<ActionResult> {
  if (administrator.kind === 'existing') {
    // research.md §10: sourced only from existing role='building_admin' rows
    // (never App Administrator, FR-013) — enforced by buildings-client.tsx's
    // dropdown only offering such users; this insert itself doesn't need to
    // re-verify that (the RLS policy scopes what any app_admin can insert
    // here to role='building_admin' regardless of who the target user is).
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: administrator.userId, role: 'building_admin', building_id: buildingId });
    if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo asignar el administrador.') };
    return { ok: true };
  }

  const parsed = createBuildingAdminAccountSchema.safeParse(administrator);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const result = await createBuildingUser({
    adminClient: getAdminClient(),
    requestClient: supabase,
    actorId,
    buildingId,
    role: 'building_admin',
    email: parsed.data.email,
    password: parsed.data.password,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    documentId: parsed.data.document_id,
  });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * FR-005/FR-006: create a building and assign its first Building
 * Administrator in one flow. Ordering per research.md §8: the building row
 * first, the administrator assignment last — if that fails, the just-created
 * building row is deleted, so a request that completes never leaves a
 * `buildings` row with zero corresponding `role = 'building_admin'` rows.
 */
export async function createBuilding(
  name: string,
  logoFormData: FormData | null,
  administrator: AdministratorChoice,
): Promise<ActionResult> {
  const parsedName = createBuildingSchema.safeParse({ name });
  if (!parsedName.success) return { ok: false, error: parsedName.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireAppAdmin();

  const { data: building, error: insertError } = await supabase
    .from('buildings')
    .insert({ name: parsedName.data.name })
    .select('id')
    .single();
  if (insertError || !building) {
    return { ok: false, error: toFriendlyMessage(insertError, 'No se pudo crear el edificio.') };
  }

  // Logo is optional (FR-005) and, unlike updateBuilding(), a problem with it
  // (not square, upload failure) is never fatal here — the building and its
  // administrator still get created; the App Administrator can add/fix the
  // logo afterward via updateBuilding(). ActionResult has no "success with a
  // warning" shape, so this stays silent-best-effort rather than returning
  // ok: false for something that didn't actually fail to create anything.
  const logoFile = fileFromFormData(logoFormData);
  if (logoFile && logoFile.size > 0) {
    const bytes = new Uint8Array(await logoFile.arrayBuffer());
    const dims = getImageDimensions(bytes);
    if (!dims || dims.width === dims.height) {
      try {
        const logoUrl = await uploadBuildingFile(supabase, {
          bucket: STORAGE_BUCKETS.media,
          buildingId: building.id,
          pathSegments: ['branding'],
          file: logoFile,
          kind: 'image',
        });
        await supabase.from('buildings').update({ logo_url: logoUrl }).eq('id', building.id);
      } catch {
        // Best-effort — logo is optional (FR-005); the building still gets created.
      }
    }
  }

  const adminResult = await assignAdministrator(supabase, building.id, ctx.user!.id, administrator);
  if (!adminResult.ok) {
    // research.md §8: never leave a new, administrator-less building behind.
    await supabase.from('buildings').delete().eq('id', building.id);
    return adminResult;
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId: building.id,
    action: 'building.create',
    entityType: 'building',
    entityId: building.id,
    metadata: { name: parsedName.data.name },
  });

  revalidatePath('/users');
  return { ok: true };
}

/** FR-007: edit an existing building's name and/or logo. */
export async function updateBuilding(
  buildingId: string,
  name: string,
  logoFormData: FormData | null,
): Promise<ActionResult> {
  const parsed = updateBuildingSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos. Revisa el formulario.' };

  const { supabase, ctx } = await requireAppAdmin();

  const update: { name: string; logo_url?: string } = { name: parsed.data.name };
  const logoFile = fileFromFormData(logoFormData);

  if (logoFile && logoFile.size > 0) {
    const bytes = new Uint8Array(await logoFile.arrayBuffer());
    const dims = getImageDimensions(bytes);
    if (dims && dims.width !== dims.height) {
      return { ok: false, error: `El logo debe ser cuadrado (se recibió ${dims.width}×${dims.height}).` };
    }
    try {
      update.logo_url = await uploadBuildingFile(supabase, {
        bucket: STORAGE_BUCKETS.media,
        buildingId,
        pathSegments: ['branding'],
        file: logoFile,
        kind: 'image',
      });
    } catch (e) {
      return { ok: false, error: toFriendlyMessage(e, 'No se pudo subir el logo.') };
    }
  }

  const { error } = await supabase.from('buildings').update(update).eq('id', buildingId);
  if (error) return { ok: false, error: toFriendlyMessage(error, 'No se pudo actualizar el edificio.') };

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'building.update',
    entityType: 'building',
    entityId: buildingId,
    metadata: update,
  });

  revalidatePath('/users');
  return { ok: true };
}

/**
 * FR-009/FR-010/FR-011: reassign a building's Building Administrator — or
 * assign one to a building that currently has none (research.md §10). The
 * new `user_roles` row is inserted before any outgoing one is deleted
 * (research.md §8) — deleting zero rows, for a building with no previous
 * administrator, is an expected no-op, not an error.
 */
export async function reassignBuildingAdministrator(
  buildingId: string,
  administrator: AdministratorChoice,
): Promise<ActionResult> {
  const { supabase, ctx } = await requireAppAdmin();

  const { data: outgoing } = await supabase
    .from('user_roles')
    .select('id, user_id')
    .eq('building_id', buildingId)
    .eq('role', 'building_admin');

  const assignResult = await assignAdministrator(supabase, buildingId, ctx.user!.id, administrator);
  if (!assignResult.ok) return assignResult;

  if (outgoing && outgoing.length > 0) {
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('building_id', buildingId)
      .eq('role', 'building_admin')
      .in(
        'user_id',
        outgoing.map((o) => o.user_id),
      );
    if (deleteError) return { ok: false, error: toFriendlyMessage(deleteError, 'No se pudo reasignar el administrador.') };
  }

  await writeAuditLog(supabase, {
    actorId: ctx.user!.id,
    buildingId,
    action: 'building_admin.reassign',
    entityType: 'user_roles',
    entityId: buildingId,
    metadata: { previous_administrator_count: outgoing?.length ?? 0 },
  });

  revalidatePath('/users');
  return { ok: true };
}
