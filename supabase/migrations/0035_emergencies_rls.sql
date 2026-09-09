-- 007-finance-ops-expansion (T055): RLS + content-immutability trigger for
-- `emergencies`, per contracts/rls-policies.md.

create or replace function public.emergencies_prevent_content_change()
returns trigger
language plpgsql
as $$
begin
  if new.description is distinct from old.description
     or new.apartment_id is distinct from old.apartment_id
     or new.reported_by <> old.reported_by
     or new.building_id <> old.building_id then
    raise exception 'emergencies: description, apartment_id, reported_by, and building_id are immutable once reported';
  end if;
  return new;
end;
$$;

create trigger emergencies_content_immutable
  before update on public.emergencies
  for each row execute function public.emergencies_prevent_content_change();

-- SELECT: building_admin/app_admin/staff only (FR-059, internal view).
create policy "emergencies select staff or admin" on public.emergencies
for select using (
  public.can_admin_building(auth.uid(), building_id)
  or public.has_building_role(auth.uid(), 'staff', building_id)
);

-- INSERT: any resident or Renter of the building, only for reported_by = auth.uid() (FR-058).
create policy "emergencies insert own report" on public.emergencies
for insert
with check (
  reported_by = auth.uid()
  and public.is_building_member(auth.uid(), building_id)
);

-- UPDATE (status: unhandled -> resolved, resolved_by, resolved_at): staff or admin (FR-061).
create policy "emergencies update resolve" on public.emergencies
for update
using (
  status = 'unhandled'
  and (public.can_admin_building(auth.uid(), building_id) or public.has_building_role(auth.uid(), 'staff', building_id))
)
with check (
  status = 'resolved'
  and resolved_by = auth.uid()
  and resolved_at is not null
  and (public.can_admin_building(auth.uid(), building_id) or public.has_building_role(auth.uid(), 'staff', building_id))
);

-- DELETE: nobody (default deny).
