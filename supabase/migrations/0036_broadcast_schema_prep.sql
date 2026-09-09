-- 008-broadcast-message-persistence (T007): broadcast_status enum and the
-- Staff-broadcast permission toggle, per data-model.md.
create type public.broadcast_status as enum ('active', 'deactivated');

alter table public.buildings
  add column staff_broadcast_enabled boolean not null default false;
