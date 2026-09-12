import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { trySignedUrlFor, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { UsersClient } from './users-client';
import { BuildingsClient } from './buildings-client';

/**
 * "Usuarios y roles" — combines residents (this story's US1), Staff
 * provisioning (US5's FR-039/040, moved here from /visitors to match the
 * reference nav), and a read-only list of this building's Administrators
 * (provisioned by the separate building-management feature — see
 * SCHEMA-ADAPTATION.md) into one tabbed page.
 *
 * 012-app-admin-building-management (research.md §3): branches on `ctx.role`
 * right after resolving context. The `building_admin` branch below is
 * completely unchanged from before this feature (FR-002/SC-005) — App
 * Administrator gets entirely different content (buildings + their
 * administrators), never the resident/staff data below.
 */
export default async function UsersPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
  }

  if (ctx.role === 'app_admin') {
    const [{ data: buildings }, { data: adminRoles }] = await Promise.all([
      supabase.from('buildings').select('id, name, logo_url').order('name'),
      supabase.from('user_roles').select('user_id, building_id').eq('role', 'building_admin'),
    ]);

    const adminUserIds = [...new Set((adminRoles ?? []).map((r) => r.user_id))];
    const { data: adminProfiles } = adminUserIds.length
      ? await supabase.from('profiles').select('id, full_name, first_name, last_name, email').in('id', adminUserIds)
      : { data: [] };

    function profileFor(userId: string) {
      const p = adminProfiles?.find((pr) => pr.id === userId);
      return {
        user_id: userId,
        full_name: p?.full_name ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        email: p?.email ?? null,
      };
    }

    // Every existing Building Administrator, deduplicated by user — the
    // dropdown source for both createBuilding() and reassignBuildingAdministrator()
    // (research.md §10). Never includes App Administrator accounts (FR-013).
    const existingAdministrators = adminUserIds.map(profileFor);

    const buildingsWithSignedLogos = await Promise.all(
      (buildings ?? []).map(async (b) => {
        const admins = (adminRoles ?? []).filter((r) => r.building_id === b.id).map((r) => profileFor(r.user_id));
        return {
          ...b,
          logo_signed_url: await trySignedUrlFor(supabase, STORAGE_BUCKETS.media, b.logo_url, 86400),
          // FR-011/research.md §10: a building predating this feature may have
          // none — surfaced as an empty array, not an error.
          administrators: admins,
        };
      }),
    );

    return <BuildingsClient buildings={buildingsWithSignedLogos} existingAdministrators={existingAdministrators} />;
  }

  const buildingId = ctx.buildingId;
  if (!buildingId) return <p>Los Administradores de la app gestionan esto por edificio en otro lugar.</p>;

  // 011-module-navigation-performance (FR-008, research.md §9): apartments
  // and residents are the two lists here that scale with building size —
  // both capped to an initial ~25-record batch; invites/roles are typically
  // small (pending invites, a handful of admins/staff) and left uncapped.
  const [{ data: apartments }, { data: residents }, { data: residentInvites }, { data: roles }, { data: staffInvites }] =
    await Promise.all([
      supabase
        .from('apartments')
        .select('id, tower, unit_number')
        .eq('building_id', buildingId)
        .order('unit_number')
        .range(0, 24),
      supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, document_id, email, apartment_id, tenant_type')
        .eq('building_id', buildingId)
        .not('apartment_id', 'is', null)
        .range(0, 24),
      supabase
        .from('invitations')
        .select('id, email, full_name, apartment_id, expires_at')
        .eq('building_id', buildingId)
        .eq('role', 'resident')
        .is('accepted_at', null),
      supabase.from('user_roles').select('id, user_id, role').eq('building_id', buildingId),
      supabase
        .from('invitations')
        .select('id, email, full_name, expires_at')
        .eq('building_id', buildingId)
        .eq('role', 'staff')
        .is('accepted_at', null),
    ]);

  const adminRoleRows = (roles ?? []).filter((r) => r.role === 'building_admin');
  const staffRoleRows = (roles ?? []).filter((r) => r.role === 'staff');
  const allRoleUserIds = [...adminRoleRows, ...staffRoleRows].map((r) => r.user_id);

  const { data: roleProfiles } = allRoleUserIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, document_id, email')
        .in('id', allRoleUserIds)
    : { data: [] };

  function withProfile(row: { id: string; user_id: string }) {
    const p = roleProfiles?.find((pr) => pr.id === row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      email: p?.email ?? null,
      full_name: p?.full_name ?? null,
      first_name: p?.first_name ?? null,
      last_name: p?.last_name ?? null,
      document_id: p?.document_id ?? null,
    };
  }

  return (
    <UsersClient
      buildingId={buildingId}
      apartments={apartments ?? []}
      residents={residents ?? []}
      pendingResidentInvites={residentInvites ?? []}
      admins={adminRoleRows.map(withProfile)}
      staff={staffRoleRows.map(withProfile)}
      pendingStaffInvites={staffInvites ?? []}
    />
  );
}
