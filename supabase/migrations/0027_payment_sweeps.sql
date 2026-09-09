-- 007-finance-ops-expansion (T017): generate_monthly_payments() and
-- evaluate_payment_due_dates(), scheduled daily via pg_cron, matching the
-- expire_visitors()/purge_discarded_feedback() SECURITY DEFINER precedent
-- (research.md item 4). Run once daily (not every 10 minutes like the
-- existing visitor/feedback sweeps) since these are date-based, not
-- elapsed-time-based checks -- generate_monthly_payments() is additionally
-- idempotent (guards against a duplicate payment per apartment+available_date)
-- as defense in depth regardless of cadence.

create or replace function public.generate_monthly_payments()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  b record;
  a record;
  v_available_date date := current_date;
  v_due_date date;
begin
  for b in
    select id, payment_available_day, payment_due_day
    from public.buildings
    where payment_available_day is not null
      and payment_due_day is not null
      and payment_available_day = extract(day from current_date)::smallint
  loop
    -- A payment can't be due before it's available: if the due day's numeric
    -- value is <= the available day's, the due date rolls to next month.
    if b.payment_due_day <= b.payment_available_day then
      v_due_date := (date_trunc('month', current_date) + interval '1 month'
                      + ((b.payment_due_day - 1) || ' days')::interval)::date;
    else
      v_due_date := (date_trunc('month', current_date)
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
begin
  -- FR-021: notify every resident of an apartment whose payment is due tomorrow.
  for p in
    select pay.id, pay.building_id, pay.apartment_id
    from public.payments pay
    where pay.status in ('pending', 'submitted')
      and pay.due_date = current_date + 1
  loop
    for r in select id from public.profiles where apartment_id = p.apartment_id loop
      insert into public.notifications (user_id, building_id, title, body, link)
      values (r.id, p.building_id, 'Pago próximo a vencer', 'Tu pago vence mañana.', '/payments');
    end loop;
  end loop;

  -- FR-020: apply the configured late fee exactly once, the moment a due date
  -- first passes unreceived -- this only matches rows not already 'overdue',
  -- so it never re-applies.
  for p in
    select pay.id, pay.building_id, pay.amount, b.late_fee_type, b.late_fee_amount
    from public.payments pay
    join public.buildings b on b.id = pay.building_id
    where pay.status in ('pending', 'submitted')
      and pay.due_date < current_date
  loop
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
  end loop;
end;
$$;

select cron.schedule('finance-payment-generation', '0 6 * * *', $$select public.generate_monthly_payments();$$);
select cron.schedule('finance-payment-due-dates', '0 7 * * *', $$select public.evaluate_payment_due_dates();$$);
