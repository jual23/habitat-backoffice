-- 007-finance-ops-expansion (T016): RLS policies + content-immutability
-- trigger for `payments`, per contracts/rls-policies.md.

create or replace function public.payments_prevent_content_change()
returns trigger
language plpgsql
as $$
begin
  if new.amount <> old.amount
     or new.apartment_id <> old.apartment_id
     or new.building_id <> old.building_id
     or new.available_date <> old.available_date
     or new.due_date <> old.due_date then
    raise exception 'payments: amount, apartment_id, building_id, available_date, and due_date are immutable once created';
  end if;
  return new;
end;
$$;

create trigger payments_content_immutable
  before update on public.payments
  for each row execute function public.payments_prevent_content_change();

-- SELECT: building_admin/app_admin of the building, or the Resident (not
-- Renter) of the payment's apartment. Staff/Renter/other buildings denied by
-- omission -- no matching policy.
create policy "payments select admin or resident" on public.payments
for select
using (
  public.can_admin_building(auth.uid(), building_id)
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.apartment_id = payments.apartment_id
      and p.tenant_type = 'resident'
  )
);

-- INSERT: nobody via a client -- only generate_monthly_payments() (SECURITY
-- DEFINER, bypasses RLS) inserts. No INSERT policy at all (default deny).

-- UPDATE: the apartment's Resident submits their own payment confirmation
-- (pending/overdue -> submitted).
create policy "payments update resident submits confirmation" on public.payments
for update
using (
  status in ('pending', 'overdue')
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.apartment_id = payments.apartment_id
      and p.tenant_type = 'resident'
  )
)
with check (
  status = 'submitted'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.apartment_id = payments.apartment_id
      and p.tenant_type = 'resident'
  )
);

-- UPDATE: building_admin/app_admin approves (pending/submitted/overdue -> received).
create policy "payments update admin approves" on public.payments
for update
using (
  public.can_admin_building(auth.uid(), building_id)
  and status in ('pending', 'submitted', 'overdue')
)
with check (
  public.can_admin_building(auth.uid(), building_id)
  and status = 'received'
  and reviewed_by = auth.uid()
  and reviewed_at is not null
);

-- DELETE: nobody -- no delete requirement in spec.md (default deny).
