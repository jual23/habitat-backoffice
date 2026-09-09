-- Bug fix (found via finance-late-fee-sweep.test.ts): the original 0027
-- functions used the database's own `current_date` (UTC), not each
-- building's configured `timezone` column -- a building's "today" could be
-- off by a day from the database server's, causing payment_available_day and
-- due-date comparisons to misfire near a UTC midnight boundary. Both
-- functions now compute "today" per building via `now() at time zone
-- b.timezone`.

create or replace function public.generate_monthly_payments()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b record;
  a record;
  v_today date;
  v_available_date date;
  v_due_date date;
begin
  for b in
    select id, payment_available_day, payment_due_day, timezone
    from public.buildings
    where payment_available_day is not null
      and payment_due_day is not null
  loop
    v_today := (now() at time zone b.timezone)::date;
    if b.payment_available_day <> extract(day from v_today)::smallint then
      continue;
    end if;

    v_available_date := v_today;
    -- A payment can't be due before it's available: if the due day's numeric
    -- value is <= the available day's, the due date rolls to next month.
    if b.payment_due_day <= b.payment_available_day then
      v_due_date := (date_trunc('month', v_today) + interval '1 month'
                      + ((b.payment_due_day - 1) || ' days')::interval)::date;
    else
      v_due_date := (date_trunc('month', v_today)
                      + ((b.payment_due_day - 1) || ' days')::interval)::date;
    end if;

    for a in
      select id, monthly_fee from public.apartments
      where building_id = b.id and monthly_fee is not null
    loop
      if not exists (
        select 1 from public.payments
        where apartment_id = a.id and available_date = v_available_date
      ) then
        insert into public.payments (building_id, apartment_id, amount, available_date, due_date)
        values (b.id, a.id, a.monthly_fee, v_available_date, v_due_date);

        insert into public.audit_log (building_id, actor_id, action, entity_type, entity_id, metadata)
        values (b.id, null, 'payment.auto_generate', 'apartment', a.id,
                jsonb_build_object('amount', a.monthly_fee, 'due_date', v_due_date));
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.evaluate_payment_due_dates()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p record;
  r record;
  v_late_fee numeric(12,2);
  v_today date;
begin
  for p in
    select pay.id, pay.building_id, pay.apartment_id, pay.due_date, pay.amount,
           b.timezone, b.late_fee_type, b.late_fee_amount
    from public.payments pay
    join public.buildings b on b.id = pay.building_id
    where pay.status in ('pending', 'submitted')
  loop
    v_today := (now() at time zone p.timezone)::date;

    -- FR-021: one-day-before reminder.
    if p.due_date = v_today + 1 then
      for r in select id from public.profiles where apartment_id = p.apartment_id loop
        insert into public.notifications (user_id, building_id, title, body, link)
        values (r.id, p.building_id, 'Pago próximo a vencer', 'Tu pago vence mañana.', '/payments');
      end loop;
    end if;

    -- FR-020: apply the late fee exactly once -- only pending/submitted rows
    -- reach this loop at all, so an already-'overdue' row is never re-matched.
    if p.due_date < v_today then
      if p.late_fee_type = 'flat' then
        v_late_fee := p.late_fee_amount;
      elsif p.late_fee_type = 'percent' then
        v_late_fee := round(p.amount * p.late_fee_amount / 100, 2);
      else
        v_late_fee := 0;
      end if;

      update public.payments
      set status = 'overdue', late_fee_amount = v_late_fee
      where id = p.id;

      insert into public.audit_log (building_id, actor_id, action, entity_type, entity_id, metadata)
      values (p.building_id, null, 'payment.overdue', 'payment', p.id,
              jsonb_build_object('late_fee_amount', v_late_fee));
    end if;
  end loop;
end;
$$;
