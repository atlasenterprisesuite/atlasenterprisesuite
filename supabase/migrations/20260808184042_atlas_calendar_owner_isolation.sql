begin;

drop policy if exists calendar_events_read on public.calendar_events;
drop policy if exists calendar_events_insert on public.calendar_events;
drop policy if exists calendar_events_update on public.calendar_events;
drop policy if exists calendar_events_delete on public.calendar_events;

create policy calendar_events_read on public.calendar_events for select to authenticated
using (owner_user_id = auth.uid());
create policy calendar_events_insert on public.calendar_events for insert to authenticated
with check (owner_user_id = auth.uid() and (org_id is null or public.is_org_member(org_id)));
create policy calendar_events_update on public.calendar_events for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid() and (org_id is null or public.is_org_member(org_id)));
create policy calendar_events_delete on public.calendar_events for delete to authenticated
using (owner_user_id = auth.uid());

create unique index if not exists calendar_events_owner_external_ref_uidx
on public.calendar_events(owner_user_id, external_ref)
where external_ref is not null;

commit;
