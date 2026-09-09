-- 004-facilities-incidencias-packages (T021): `package_status` enum and the
-- `packages` table per data-model.md.
--
-- apartment_id uses ON DELETE RESTRICT (not data-model.md's unspecified
-- default) because the column is NOT NULL — matching this schema's existing
-- precedent for a NOT NULL apartment reference (profiles.apartment_id, see
-- apartments_restrict_delete_with_residents in specs/001's SCHEMA-ADAPTATION.md)
-- rather than the nullable-only ON DELETE SET NULL used for tickets.apartment_id.

create type public.package_status as enum ('pending', 'picked_up');

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete restrict,
  description text not null,
  photo_url text,
  status public.package_status not null default 'pending',
  registered_by uuid not null,
  picked_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index packages_building_status_idx on public.packages (building_id, status);

create trigger trg_packages_updated before update on public.packages
  for each row execute function public.update_updated_at_column();
