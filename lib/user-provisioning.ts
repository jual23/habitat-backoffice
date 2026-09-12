import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';

export type CreateBuildingUserResult = { userId: string } | { error: string };

/**
 * 006-direct-user-creation (T009): creates a real, immediately-usable
 * Resident or Staff account — the core logic behind FR-005 (contracts/provisioning.md).
 *
 * Deliberately takes its Supabase clients and the acting admin's already-
 * resolved identity as plain arguments rather than calling cookies()/
 * getUserContext() itself (research.md item 3), so it's directly testable
 * from Vitest and so the caller (a 'use server' action) is the one place
 * responsible for resolving `buildingId` from the authenticated session —
 * never from a client-supplied parameter (research.md item 4). This function
 * trusts that its caller has already verified the actor is authorized to
 * provision accounts for `buildingId` (contracts/provisioning.md's first
 * table row) — it does not re-check that itself.
 *
 * `adminClient` MUST be a service-role client (lib/supabase/admin.ts in the
 * running app; tests/fixtures.ts's getServiceClient() in tests) — it's the
 * only way to create an auth.users row with an admin-chosen password.
 * `requestClient` MUST be the acting admin's own RLS-enforced, request-scoped
 * client — used only for the Staff/Building Administrator `user_roles`
 * insert, which stays subject to the existing (Staff) or newly-added
 * (Building Administrator, 012-app-admin-building-management migration 0048)
 * RLS policy regardless of what `buildingId` this function was called with
 * (defense in depth).
 *
 * 012-app-admin-building-management (research.md §4): `role` additionally
 * accepts `'building_admin'`, provisioned identically to `'staff'` — no
 * `apartmentId`, a plain `user_roles` insert, just a different `role` value.
 * Called only from an App Administrator's own actions (`buildings-actions.ts`);
 * this function itself does not re-verify the caller's role (research.md §7's
 * existing pattern — the caller is responsible for that).
 */
export async function createBuildingUser(opts: {
  adminClient: SupabaseClient<Database>;
  requestClient: SupabaseClient<Database>;
  actorId: string;
  buildingId: string;
  role: 'resident' | 'renter' | 'staff' | 'building_admin';
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  documentId: string;
  apartmentId?: string;
}): Promise<CreateBuildingUserResult> {
  const { adminClient, requestClient, buildingId, role, email, password, firstName, lastName, documentId, apartmentId } =
    opts;

  // 007-finance-ops-expansion: Renter is provisioned exactly like Resident (same
  // required apartmentId, no user_roles row) — see data-model.md's User Story 1.
  const isApartmentScoped = role === 'resident' || role === 'renter';

  if (isApartmentScoped) {
    if (!apartmentId) {
      return { error: 'Debes seleccionar un apartamento para esta cuenta.' };
    }
    // Defense in depth (contracts/provisioning.md): the apartment must belong
    // to the same building the account is being scoped to. Checked BEFORE the
    // elevated call so a mismatch never creates an account at all.
    const { data: apartment, error: apartmentError } = await requestClient
      .from('apartments')
      .select('id')
      .eq('id', apartmentId)
      .eq('building_id', buildingId)
      .maybeSingle();
    if (apartmentError) return { error: apartmentError.message };
    if (!apartment) return { error: 'No se encontró ese apartamento en este edificio.' };
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      document_id: documentId,
      building_id: buildingId,
      ...(isApartmentScoped ? { apartment_id: apartmentId, tenant_type: role } : {}),
    },
  });

  if (createError || !created.user) {
    // FR-007: surface a friendly message for the common case (duplicate email)
    // without leaking the rest of Supabase Auth's raw error shape.
    const message = createError?.message ?? 'Could not create the account.';
    if (/already.*registered|already.*exists/i.test(message)) {
      return { error: 'Ya existe una cuenta con este correo electrónico.' };
    }
    return { error: message };
  }

  const userId = created.user.id;

  if (role === 'staff' || role === 'building_admin') {
    const { error: roleError } = await requestClient
      .from('user_roles')
      .insert({ user_id: userId, role, building_id: buildingId });
    if (roleError) {
      // Roll back the just-created auth account so a partial failure never
      // leaves an orphaned, role-less account behind (FR-007/FR-008's "no
      // account created" guarantee extends to this failure mode too).
      await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
      return { error: roleError.message };
    }
  }

  return { userId };
}
