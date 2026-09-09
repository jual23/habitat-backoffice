-- 007-finance-ops-expansion (T004): extend handle_new_user() to also populate
-- profiles.tenant_type from auth.users.raw_user_meta_data, set by
-- lib/user-provisioning.ts's createBuildingUser() when role = 'renter'. Defaults to
-- 'resident' when absent (every other existing caller is unaffected).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name, document_id, email,
                                building_id, apartment_id, tenant_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'document_id',
    new.email,
    nullif(new.raw_user_meta_data->>'building_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'apartment_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data->>'tenant_type', '')::public.tenant_type, 'resident')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
