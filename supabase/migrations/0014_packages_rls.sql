-- 004-facilities-incidencias-packages (T022): RLS policies for `packages` per
-- contracts/rls-policies.md, the content-immutability trigger, and widening
-- `notifications`' INSERT policy so staff/admin can notify a resident.
--
-- Confirmed against the live schema (see this feature's SCHEMA-ADAPTATION.md):
-- `notifications` previously had no INSERT policy at all (only "read own" and
-- "update own"), so this is a genuinely new grant, not a widening of an
-- existing self-only policy as contracts/rls-policies.md speculated.

alter table public.packages enable row level security;

-- packages: SELECT — staff/admin of the building, or any resident of the
-- package's apartment (so a future resident-facing surface can show "your
-- packages").
create policy "packages select staff admin or apartment resident" on public.packages
  for select
  using (
    public.can_admin_building(auth.uid(), building_id)
    or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.apartment_id = packages.apartment_id
    )
  );

-- packages: INSERT — staff/admin of the target building, apartment_id must
-- belong to that same building (FR-013/FR-014).
create policy "packages insert staff or admin" on public.packages
  for insert
  with check (
    (
      public.can_admin_building(auth.uid(), building_id)
      or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    )
    and exists (
      select 1 from public.apartments a
      where a.id = packages.apartment_id and a.building_id = packages.building_id
    )
  );

-- packages: UPDATE — staff/admin, pending -> picked_up only (FR-018). USING
-- pins the OLD row to status='pending'; WITH CHECK pins the NEW row to
-- status='picked_up' — a plain OLD-vs-fixed-value / NEW-vs-fixed-value
-- comparison, so (unlike tickets' resolved-transition rule) no trigger is
-- needed for this one. Column-level immutability (description/photo_url/
-- apartment_id) is enforced by the packages_content_immutable trigger below.
create policy "packages update staff or admin pending to picked_up" on public.packages
  for update
  using (
    (
      public.can_admin_building(auth.uid(), building_id)
      or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    )
    and status = 'pending'
  )
  with check (
    (
      public.can_admin_building(auth.uid(), building_id)
      or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    )
    and status = 'picked_up'
  );

create or replace function public.packages_prevent_content_change()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.description is distinct from old.description
     or new.photo_url is distinct from old.photo_url
     or new.apartment_id is distinct from old.apartment_id then
    raise exception 'packages.description/photo_url/apartment_id are immutable after creation';
  end if;
  return new;
end;
$$;

create trigger packages_content_immutable
  before update on public.packages
  for each row execute function public.packages_prevent_content_change();

revoke all on function public.packages_prevent_content_change() from public, anon, authenticated;

-- notifications: INSERT — staff/admin registering a package (or any future
-- building action) may address a notification to a resident of their own
-- building. The resident-of-that-building check keeps this scoped to
-- Principle I even though notifications.building_id/user_id aren't otherwise
-- cross-validated by an existing constraint.
create policy "notifications insert by staff or admin for their building" on public.notifications
  for insert
  with check (
    building_id is not null
    and (
      public.can_admin_building(auth.uid(), building_id)
      or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    )
    and exists (
      select 1 from public.profiles p
      where p.id = notifications.user_id and p.building_id = notifications.building_id
    )
  );
