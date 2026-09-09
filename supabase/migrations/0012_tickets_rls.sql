-- 004-facilities-incidencias-packages (T009): RLS policies for `tickets` and
-- `ticket_comments` per contracts/rls-policies.md, plus the two tickets
-- triggers from data-model.md's Triggers section.
--
-- Schema-adaptation note (see this feature's SCHEMA-ADAPTATION.md): the live
-- helper functions take (_user_id, _building[, _role]) — the opposite
-- argument order from what contracts/rls-policies.md and
-- lib/supabase/database.types.ts's Functions section describe. Policies below
-- use the live signatures: is_building_member(_user_id, _building),
-- has_building_role(_user_id, _role, _building), and the live schema's
-- can_admin_building(_user_id, _building) (= is_app_admin OR
-- has_building_role(..., 'building_admin', ...)), which contracts/rls-policies.md
-- does not mention at all but every existing table's admin policy already uses.

alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;

-- tickets: SELECT — staff/admin of the building, the reporting resident, or app_admin
-- (already covered by can_admin_building's is_app_admin branch).
create policy "tickets select staff admin or reporter" on public.tickets
  for select
  using (
    public.can_admin_building(auth.uid(), building_id)
    or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    or reported_by = auth.uid()
  );

-- tickets: INSERT — out of this feature's scope, but a policy letting the
-- reporting resident insert their own ticket exists so a future resident-facing
-- surface can rely on it (contracts/rls-policies.md).
create policy "tickets insert own" on public.tickets
  for insert
  with check (
    reported_by = auth.uid()
    and public.is_building_member(auth.uid(), building_id)
  );

-- tickets: UPDATE — staff/admin of the building only. The duplicate-link
-- WITH CHECK (FR-009: same building, target status pending/in_progress) lives
-- here since it's a same-row NEW-value check; the OLD-vs-NEW "resolved only
-- from in_progress" rule (FR-010) can't be expressed in WITH CHECK and is
-- enforced by the tickets_status_transition_guard trigger below instead.
-- Column-level immutability (title/description/apartment_id/reported_by) is
-- enforced by the tickets_content_immutable trigger below, not by this policy.
create policy "tickets update staff or admin" on public.tickets
  for update
  using (
    public.can_admin_building(auth.uid(), building_id)
    or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
  )
  with check (
    (
      public.can_admin_building(auth.uid(), building_id)
      or public.has_building_role(auth.uid(), 'staff'::app_role, building_id)
    )
    and (
      duplicate_of_ticket_id is null
      or exists (
        select 1 from public.tickets t
        where t.id = duplicate_of_ticket_id
          and t.building_id = tickets.building_id
          and t.status in ('pending', 'in_progress')
      )
    )
  );

-- ticket_comments: SELECT — staff/admin of the parent ticket's building, or
-- the reporting resident (FR-007).
create policy "ticket_comments select staff admin or reporter" on public.ticket_comments
  for select
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
        and (
          public.can_admin_building(auth.uid(), t.building_id)
          or public.has_building_role(auth.uid(), 'staff'::app_role, t.building_id)
          or t.reported_by = auth.uid()
        )
    )
  );

-- ticket_comments: INSERT — staff/admin only, only while the parent ticket is
-- in_progress (FR-007).
create policy "ticket_comments insert staff or admin while in_progress" on public.ticket_comments
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
        and t.status = 'in_progress'
        and (
          public.can_admin_building(auth.uid(), t.building_id)
          or public.has_building_role(auth.uid(), 'staff'::app_role, t.building_id)
        )
    )
  );

-- Triggers (data-model.md's Triggers section) ------------------------------

create or replace function public.tickets_prevent_content_change()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.apartment_id is distinct from old.apartment_id
     or new.reported_by is distinct from old.reported_by then
    raise exception 'tickets.title/description/apartment_id/reported_by are immutable after creation';
  end if;
  return new;
end;
$$;

create trigger tickets_content_immutable
  before update on public.tickets
  for each row execute function public.tickets_prevent_content_change();

create or replace function public.tickets_check_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status = 'resolved' and old.status <> 'in_progress' then
    raise exception 'tickets.status can only become resolved from in_progress';
  end if;
  return new;
end;
$$;

create trigger tickets_status_transition_guard
  before update on public.tickets
  for each row execute function public.tickets_check_status_transition();

revoke all on function public.tickets_prevent_content_change() from public, anon, authenticated;
revoke all on function public.tickets_check_status_transition() from public, anon, authenticated;
