-- 006-direct-user-creation (T003): additive identity fields on `profiles`, per data-model.md.
-- All nullable -- rows created before this feature (old invitations-accept path, seed data)
-- predate them; required at the application/Zod layer for new writes, not enforced at the DB level.

alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column document_id text;
