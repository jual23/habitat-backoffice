-- 007-finance-ops-expansion (T054): `emergencies` per data-model.md User Story 7.
create type public.emergency_status as enum ('unhandled', 'resolved');

create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  reported_by uuid not null,
  apartment_id uuid references public.apartments(id) on delete set null,
  description text,
  status public.emergency_status not null default 'unhandled',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint emergencies_resolved_requires_fields
    check (status <> 'resolved' or (resolved_by is not null and resolved_at is not null))
);

create index emergencies_building_status_idx on public.emergencies (building_id, status);

alter table public.emergencies enable row level security;
