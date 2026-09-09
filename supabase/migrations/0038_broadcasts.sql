-- 008-broadcast-message-persistence (T009): `broadcasts` per data-model.md.
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  message text not null,
  icon text,
  template_id uuid references public.broadcast_templates(id) on delete set null,
  status public.broadcast_status not null default 'active',
  sent_by uuid not null,
  deactivated_by uuid,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broadcasts_deactivated_requires_fields
    check (status <> 'deactivated' or (deactivated_at is not null and deactivated_by is not null)),
  constraint broadcasts_active_has_no_deactivation
    check (status = 'deactivated' or (deactivated_at is null and deactivated_by is null))
);

create index broadcasts_building_status_idx on public.broadcasts (building_id, status);

create trigger trg_broadcasts_updated
  before update on public.broadcasts
  for each row execute function public.update_updated_at_column();

alter table public.broadcasts enable row level security;
