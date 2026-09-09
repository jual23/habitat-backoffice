-- 007-finance-ops-expansion (T032): RLS + content-immutability trigger for
-- maintenance_tasks/maintenance_completions, per contracts/rls-policies.md.

create or replace function public.maintenance_tasks_prevent_content_change()
returns trigger
language plpgsql
as $$
begin
  if new.name <> old.name
     or new.frequency <> old.frequency
     or new.building_id <> old.building_id
     or coalesce(new.interval_months, -1) <> coalesce(old.interval_months, -1) then
    raise exception 'maintenance_tasks: name, frequency, interval_months, and building_id are immutable once created';
  end if;
  return new;
end;
$$;

create trigger maintenance_tasks_content_immutable
  before update on public.maintenance_tasks
  for each row execute function public.maintenance_tasks_prevent_content_change();

-- SELECT: building_admin/app_admin/staff of the building.
create policy "maintenance_tasks select building members" on public.maintenance_tasks
for select
using (
  public.can_admin_building(auth.uid(), building_id)
  or public.has_building_role(auth.uid(), 'staff', building_id)
);

-- INSERT: building_admin/app_admin only (FR-033).
create policy "maintenance_tasks insert admin" on public.maintenance_tasks
for insert
with check (public.can_admin_building(auth.uid(), building_id));

-- UPDATE next_due_date: both admin (free reschedule, FR-034) and staff
-- (advancing on completion) -- the Server Action layer is the actual
-- enforcement point narrowing *why* staff updates it (mechanism note,
-- contracts/rls-policies.md).
create policy "maintenance_tasks update next_due_date" on public.maintenance_tasks
for update
using (
  public.can_admin_building(auth.uid(), building_id)
  or public.has_building_role(auth.uid(), 'staff', building_id)
)
with check (
  public.can_admin_building(auth.uid(), building_id)
  or public.has_building_role(auth.uid(), 'staff', building_id)
);

-- DELETE: nobody -- no delete requirement in spec.md (default deny).

-- maintenance_completions: SELECT for building_admin/app_admin/staff.
create policy "maintenance_completions select building members" on public.maintenance_completions
for select
using (
  public.can_admin_building(auth.uid(), building_id)
  or public.has_building_role(auth.uid(), 'staff', building_id)
);

-- INSERT: building_admin/app_admin/staff, only when the referenced task is
-- actually due (next_due_date <= current_date).
create policy "maintenance_completions insert when due" on public.maintenance_completions
for insert
with check (
  (public.can_admin_building(auth.uid(), building_id) or public.has_building_role(auth.uid(), 'staff', building_id))
  and exists (
    select 1 from public.maintenance_tasks t
    where t.id = maintenance_completions.task_id
      and t.building_id = maintenance_completions.building_id
      and t.next_due_date <= current_date
  )
);

-- UPDATE/DELETE: nobody -- append-only, matching ticket_comments (default deny).
