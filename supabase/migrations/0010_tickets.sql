-- 004-facilities-incidencias-packages (T007): `ticket_status` enum and the
-- `tickets` table (Incidencia), per data-model.md.
--
-- Schema-adaptation note (see this feature's SCHEMA-ADAPTATION.md): unlike
-- data-model.md's assumption, this live schema does not FK "who did this"
-- columns (visitors.created_by, feedback.user_id) to auth.users/profiles —
-- reported_by follows that existing, established convention rather than
-- adding a new one.

create type public.ticket_status as enum ('pending', 'in_progress', 'rejected', 'resolved', 'duplicate');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  apartment_id uuid references public.apartments(id) on delete set null,
  reported_by uuid not null,
  title text not null,
  description text,
  status public.ticket_status not null default 'pending',
  rejection_reason text,
  duplicate_of_ticket_id uuid references public.tickets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_rejection_reason_required check (status <> 'rejected' or rejection_reason is not null),
  constraint tickets_duplicate_of_required check (status <> 'duplicate' or duplicate_of_ticket_id is not null),
  constraint tickets_duplicate_not_self check (duplicate_of_ticket_id is null or duplicate_of_ticket_id <> id)
);

create index tickets_building_status_idx on public.tickets (building_id, status);
create index tickets_building_created_idx on public.tickets (building_id, created_at);

create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.update_updated_at_column();
