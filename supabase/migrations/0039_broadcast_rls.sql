-- 008-broadcast-message-persistence (T010): RLS + content-immutability
-- trigger for `broadcasts`/`broadcast_templates`, per contracts/rls-policies.md.

create or replace function public.broadcasts_prevent_content_change()
returns trigger
language plpgsql
as $$
begin
  if new.message <> old.message
     or coalesce(new.icon, '') <> coalesce(old.icon, '')
     or new.building_id <> old.building_id
     or coalesce(new.template_id::text, '') <> coalesce(old.template_id::text, '') then
    raise exception 'broadcasts: message, icon, building_id, and template_id are immutable once sent';
  end if;
  return new;
end;
$$;

create trigger broadcasts_content_immutable
  before update on public.broadcasts
  for each row execute function public.broadcasts_prevent_content_change();

-- SELECT: any building member (mobile app reads this directly to show active broadcasts).
create policy "broadcasts select building members" on public.broadcasts
for select using (public.is_building_member(auth.uid(), building_id));

-- INSERT: building_admin/app_admin always; staff only when the building's toggle is on.
create policy "broadcasts insert admin or enabled staff" on public.broadcasts
for insert
with check (
  public.can_admin_building(auth.uid(), building_id)
  or (
    public.has_building_role(auth.uid(), 'staff', building_id)
    and exists (select 1 from public.buildings b where b.id = broadcasts.building_id and b.staff_broadcast_enabled)
  )
);

-- UPDATE (status: active -> deactivated): same actors as INSERT, only from an active row.
create policy "broadcasts update deactivate" on public.broadcasts
for update
using (
  status = 'active'
  and (
    public.can_admin_building(auth.uid(), building_id)
    or (
      public.has_building_role(auth.uid(), 'staff', building_id)
      and exists (select 1 from public.buildings b where b.id = broadcasts.building_id and b.staff_broadcast_enabled)
    )
  )
)
with check (
  status = 'deactivated'
  and deactivated_by = auth.uid()
  and deactivated_at is not null
  and (
    public.can_admin_building(auth.uid(), building_id)
    or (
      public.has_building_role(auth.uid(), 'staff', building_id)
      and exists (select 1 from public.buildings b where b.id = broadcasts.building_id and b.staff_broadcast_enabled)
    )
  )
);

-- DELETE: nobody (default deny).

-- broadcast_templates: SELECT staff/admin only (never shown to residents).
create policy "broadcast_templates select staff or admin" on public.broadcast_templates
for select using (
  public.can_admin_building(auth.uid(), building_id)
  or public.has_building_role(auth.uid(), 'staff', building_id)
);

-- INSERT/UPDATE/DELETE: building_admin/app_admin only -- never staff, even with the toggle on
-- (template management is not toggle-gated, per contracts/rls-policies.md).
create policy "broadcast_templates admin manage" on public.broadcast_templates
for all
using (public.can_admin_building(auth.uid(), building_id))
with check (public.can_admin_building(auth.uid(), building_id));
