-- 007-finance-ops-expansion (T003): Renter role signal, per data-model.md User Story 1.
-- Mirrors how Resident itself is represented (profiles.building_id/apartment_id, no
-- user_roles row) -- Renter needs to be "the same kind of thing, but distinguishable"
-- (research.md item 1).
create type public.tenant_type as enum ('resident', 'renter');

alter table public.profiles
  add column tenant_type public.tenant_type not null default 'resident';
