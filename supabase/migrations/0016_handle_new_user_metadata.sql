-- 006-direct-user-creation (T004): extend handle_new_user() to also populate the new profiles
-- columns plus building_id/apartment_id from auth.users.raw_user_meta_data, set by the Admin API
-- call in lib/user-provisioning.ts's createBuildingUser(). All keys are optional/NULL-safe, so any
-- other caller of auth.users insertion (none currently known) is unaffected -- existing
-- full_name/email population is unchanged.
--
-- Why in the trigger, not a follow-up RLS-enforced UPDATE (research.md item 2): the existing
-- "profiles managed by admins" policy requires building_id IS NOT NULL on the CURRENT row before a
-- building_admin can update it -- a profile created with building_id = NULL could never be claimed
-- into a building afterward through the normal RLS-enforced client. Setting it inside this
-- SECURITY DEFINER trigger (already elevated, already firing exactly once per auth.users row)
-- avoids that gap and avoids a second elevated write.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name, document_id, email,
                                building_id, apartment_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'document_id',
    new.email,
    nullif(new.raw_user_meta_data->>'building_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'apartment_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
