-- 008-broadcast-message-persistence (T008): `broadcast_templates` per
-- data-model.md, created before `broadcasts` since the latter FK-references it.
create table public.broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  message text not null,
  icon text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index broadcast_templates_building_idx on public.broadcast_templates (building_id);

create trigger trg_broadcast_templates_updated
  before update on public.broadcast_templates
  for each row execute function public.update_updated_at_column();

alter table public.broadcast_templates enable row level security;
