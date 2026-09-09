-- 007-finance-ops-expansion (T045): RLS for polls/poll_options/poll_votes,
-- per contracts/rls-policies.md, including the Renter-exclusion WITH CHECK.

create policy "polls select building members" on public.polls
for select using (public.is_building_member(auth.uid(), building_id));

create policy "polls admin manage" on public.polls
for all
using (public.can_admin_building(auth.uid(), building_id))
with check (public.can_admin_building(auth.uid(), building_id));

-- poll_options has no building_id of its own -- every policy joins through
-- poll_id to polls for building scoping (matches ticket_comments->tickets).
create policy "poll_options select building members" on public.poll_options
for select using (
  exists (
    select 1 from public.polls p
    where p.id = poll_options.poll_id and public.is_building_member(auth.uid(), p.building_id)
  )
);

create policy "poll_options admin manage" on public.poll_options
for all
using (
  exists (
    select 1 from public.polls p
    where p.id = poll_options.poll_id and public.can_admin_building(auth.uid(), p.building_id)
  )
)
with check (
  exists (
    select 1 from public.polls p
    where p.id = poll_options.poll_id and public.can_admin_building(auth.uid(), p.building_id)
  )
);

-- poll_votes: SELECT full attribution for admins, or any resident/Renter of
-- the vote's own apartment (FR-003 -- the mobile app can show "your
-- apartment's current vote"). Anonymity is a page.tsx query-shaping decision
-- (research.md item 5), not an RLS rule.
create policy "poll_votes select admin or own apartment" on public.poll_votes
for select using (
  exists (
    select 1 from public.polls p
    where p.id = poll_votes.poll_id and public.can_admin_building(auth.uid(), p.building_id)
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.apartment_id = poll_votes.apartment_id
  )
);

-- INSERT/UPDATE/DELETE: the Resident (not Renter) of apartment_id, only
-- while the poll is open, voter_id = auth.uid().
create policy "poll_votes insert resident open poll" on public.poll_votes
for insert
with check (
  voter_id = auth.uid()
  and exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.apartment_id = poll_votes.apartment_id and pr.tenant_type = 'resident'
  )
  and exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.closes_at > now())
);

create policy "poll_votes update resident open poll" on public.poll_votes
for update
using (
  exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.apartment_id = poll_votes.apartment_id and pr.tenant_type = 'resident'
  )
  and exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.closes_at > now())
)
with check (
  voter_id = auth.uid()
  and exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.apartment_id = poll_votes.apartment_id and pr.tenant_type = 'resident'
  )
  and exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.closes_at > now())
);

create policy "poll_votes delete resident open poll" on public.poll_votes
for delete
using (
  exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.apartment_id = poll_votes.apartment_id and pr.tenant_type = 'resident'
  )
  and exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.closes_at > now())
);
