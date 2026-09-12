import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { UsersClient } from './users-client';

/**
 * "Usuarios y roles" — combines residents (this story's US1), Staff
 * provisioning (US5's FR-039/040, moved here from /visitors to match the
 * reference nav), and a read-only list of this building's Administrators
 * (provisioned by the separate building-management feature — see
 * SCHEMA-ADAPTATION.md) into one tabbed page.
 */
export default async function UsersPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (!ctx.user || (ctx.role !== 'building_admin' && ctx.role !== 'app_admin')) {
    redirect('/login');
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
