-- 007-finance-ops-expansion (T015): the `payments` table per data-model.md.
create type public.payment_status as enum ('pending', 'submitted', 'received', 'overdue');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete restrict,
  amount numeric(12,2) not null,
  late_fee_amount numeric(12,2),
  status public.payment_status not null default 'pending',
  confirmation_photo_url text,
  available_date date not null,
  due_date date not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_received_requires_reviewer check (status <> 'received' or reviewed_by is not null)
);

create index payments_building_apartment_idx on public.payments (building_id, apartment_id);
create index payments_building_status_idx on public.payments (building_id, status);
create index payments_status_due_date_idx on public.payments (status, due_date);

create trigger trg_payments_updated
  before update on public.payments
  for each row execute function public.update_updated_at_column();

alter table public.payments enable row level security;
