-- 007-finance-ops-expansion (T030): `maintenance_tasks` per data-model.md User Story 4.
create type public.maintenance_frequency as enum ('once', 'weekly', 'monthly', 'every_n_months');

create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  frequency public.maintenance_frequency not null,
  interval_months smallint,
  next_due_date date,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_tasks_interval_months_required
    check (frequency <> 'every_n_months' or interval_months is not null)
);

create index maintenance_tasks_building_due_idx on public.maintenance_tasks (building_id, next_due_date);

create trigger trg_maintenance_tasks_updated
  before update on public.maintenance_tasks
  for each row execute function public.update_updated_at_column();

alter table public.maintenance_tasks enable row level security;
