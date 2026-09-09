-- 008-broadcast-message-persistence (T011): notify_broadcast_sent() --
-- mirrors notify_reservation_decision()/notify_visitor_arrival()'s shape
-- (confirmed live earlier this session): one notifications row + one push
-- per resident/renter of the building (every profiles row with apartment_id
-- set), fired once per broadcast sent.
create or replace function public.notify_broadcast_sent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  notif_title text := 'Aviso urgente';
  link_path text := '/broadcasts';
  resident record;
  token_row record;
begin
  for resident in
    select id from public.profiles
    where building_id = new.building_id and apartment_id is not null
  loop
    insert into public.notifications (user_id, building_id, title, body, link)
    values (resident.id, new.building_id, notif_title, new.message, link_path);

    for token_row in select token from public.push_tokens where user_id = resident.id loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'to', token_row.token,
          'title', notif_title,
          'body', new.message,
          'data', jsonb_build_object('link', link_path)
        )
      );
    end loop;
  end loop;
  return new;
end;
$$;

create trigger trg_broadcast_sent
  after insert on public.broadcasts
  for each row execute function public.notify_broadcast_sent();
