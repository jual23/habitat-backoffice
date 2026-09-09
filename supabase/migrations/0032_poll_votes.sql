-- 007-finance-ops-expansion (T044): `poll_votes` per data-model.md.
create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete restrict,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voter_id uuid not null,
  created_at timestamptz not null default now(),
  constraint poll_votes_unique_option unique (poll_id, apartment_id, option_id)
);

create index poll_votes_poll_apartment_idx on public.poll_votes (poll_id, apartment_id);

alter table public.poll_votes enable row level security;
