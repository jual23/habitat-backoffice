-- 007-finance-ops-expansion (T014): per-apartment fee and building-wide
-- payment-cycle/late-fee settings, per data-model.md User Story 2.
create type public.late_fee_type as enum ('flat', 'percent');

alter table public.apartments
  add column monthly_fee numeric(12,2);

alter table public.buildings
  add column payment_available_day smallint check (payment_available_day between 1 and 31),
  add column payment_due_day smallint check (payment_due_day between 1 and 31),
  add column late_fee_type public.late_fee_type,
  add column late_fee_amount numeric(12,2);
