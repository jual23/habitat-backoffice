-- 004-facilities-incidencias-packages (T008): `ticket_comments` table per
-- data-model.md — an append-only status-update log, no updated_at/edit support.

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index ticket_comments_ticket_id_idx on public.ticket_comments (ticket_id);
