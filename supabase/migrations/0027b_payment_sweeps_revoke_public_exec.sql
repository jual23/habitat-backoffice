-- Tighten to match the expire_visitors()/purge_discarded_feedback() precedent:
-- callable by authenticated/service_role only, never anon or PUBLIC.
revoke all on function public.generate_monthly_payments() from public, anon;
revoke all on function public.evaluate_payment_due_dates() from public, anon;
grant execute on function public.generate_monthly_payments() to authenticated, service_role;
grant execute on function public.evaluate_payment_due_dates() to authenticated, service_role;
