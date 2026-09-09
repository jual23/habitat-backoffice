-- 007-finance-ops-expansion (T043): `polls`/`poll_options` per data-model.md User Story 5.
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  title text not null,
  description text,
  attachment_url text,
  allow_multiple boolean not null default false,
  anonymous boolean not null default false,
  closes_at timestamptz not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_polls_updated
  before update on public.polls
  for each row execute function public.update_updated_at_column();

alter table public.polls enable row level security;

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  sort_order smallint not null default 0
);

alter table public.poll_options enable row level security;
