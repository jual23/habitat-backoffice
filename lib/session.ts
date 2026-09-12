import type { SupabaseClient, User } from '@supabase/supabase-js';
import { requestCache } from './request-cache';
import type { Database, Enums } from './supabase/database.types';

export type AdminRole = Exclude<Enums<'app_role'>, 'resident'>;

export type UserContext =
  | { user: User; role: 'app_admin'; buildingId: null }
  | { user: User; role: 'building_admin' | 'staff'; buildingId: string }
  | { user: User; role: 'resident' | 'renter'; buildingId: string; apartmentId: string }
  | { user: User; role: null; buildingId: null }
  | { user: null; role: null; buildingId: null };

/**
 * Resolves the signed-in user's role for this app. Roles live in `user_roles`
 * (app_admin/building_admin/staff) except `resident`/`renter`, which this schema
 * encodes as a `profiles` row carrying `building_id`/`apartment_id` directly (see
 * `is_building_member()`) rather than a `user_roles` row — Renter (007-finance-ops-
 * expansion, Constitution v1.7.0) is the same kind of thing as Resident,
 * distinguished only by `profiles.tenant_type` (research.md item 1). A user with no
 * `user_roles` row and a `profiles.apartment_id` is treated as a resident or renter
 * per that column; this app's backoffice does not serve either, but
 * `app/(backoffice)/layout.tsx` still needs to recognize (and reject) both cases.
 *
 * 011-module-navigation-performance (research.md §2): wrapped in
 * `requestCache()` (lib/request-cache.ts — React's `cache()` where
 * available, a plain passthrough otherwise) so it's computed once per
 * request instead of once per caller — `app/(backoffice)/layout.tsx` and
 * whichever module's `page.tsx` is rendering both call this, and previously
 * each paid the full `auth.getUser()` + `user_roles` (+ `profiles`)
 * round-trip cost independently. This still takes `supabase` as a parameter
 * (rather than resolving it internally via `createClient()`) for two
 * reasons: (1) it keeps this function directly unit/integration-testable
 * with a plain client outside a Next.js request context, the same way
 * `createBuildingUser()` (lib/user-provisioning.ts) is; (2) `createClient()`
 * (lib/supabase/server.ts) is itself now also wrapped in `requestCache()`,
 * so every real caller within one request already receives the *same*
 * client instance — which is what makes `cache()`'s argument-identity
 * memoization actually hit here.
 */
export const getUserContext = requestCache(async function getUserContext(
  supabase: SupabaseClient<Database>,
): Promise<UserContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null, buildingId: null };
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, building_id')
    .eq('user_id', user.id);

  const appAdmin = roles?.find((r) => r.role === 'app_admin');
  if (appAdmin) {
    return { user, role: 'app_admin', buildingId: null };
  }

  const adminOrStaff = roles?.find(
    (r) => (r.role === 'building_admin' || r.role === 'staff') && r.building_id,
  );
  if (adminOrStaff && adminOrStaff.building_id) {
    return {
      user,
      role: adminOrStaff.role as 'building_admin' | 'staff',
      buildingId: adminOrStaff.building_id,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('building_id, apartment_id, tenant_type')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.building_id && profile.apartment_id) {
    return {
      user,
      role: profile.tenant_type,
      buildingId: profile.building_id,
      apartmentId: profile.apartment_id,
    };
  }

  return { user, role: null, buildingId: null };
});
