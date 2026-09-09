-- 007-finance-ops-expansion (T031): append-only completion log, matching
-- ticket_comments' precedent (no updated_at, no UPDATE policy).
create table public.maintenance_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.maintenance_tasks(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  completed_by uuid not null,
  completed_at timestamptz not null default now(),
  photo_url text
);

alter table public.maintenance_completions enable row level security;
