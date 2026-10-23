create table if not exists public.atlas_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_org_id uuid references public.organizations(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.atlas_user_preferences enable row level security;

drop policy if exists "users_read_own_preferences" on public.atlas_user_preferences;
create policy "users_read_own_preferences" on public.atlas_user_preferences
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users_insert_own_preferences" on public.atlas_user_preferences;
create policy "users_insert_own_preferences" on public.atlas_user_preferences
for insert to authenticated
with check (user_id = auth.uid() and (default_org_id is null or exists (select 1 from public.organization_members m where m.user_id=auth.uid() and m.org_id=default_org_id and m.status='active')));

drop policy if exists "users_update_own_preferences" on public.atlas_user_preferences;
create policy "users_update_own_preferences" on public.atlas_user_preferences
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and (default_org_id is null or exists (select 1 from public.organization_members m where m.user_id=auth.uid() and m.org_id=default_org_id and m.status='active')));

create or replace function public.atlas_resolve_default_org()
returns table(org_id uuid, org_name text, role text)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with pref as (
    select p.default_org_id
    from public.atlas_user_preferences p
    where p.user_id = auth.uid()
  ), candidates as (
    select m.org_id, o.name as org_name, m.role,
           case
             when m.org_id = (select default_org_id from pref) then 0
             when lower(o.name) = 'atlas' then 1
             else 2
           end as priority
    from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid() and m.status = 'active'
  )
  select c.org_id, c.org_name, c.role
  from candidates c
  order by c.priority, c.org_name
  limit 1;
$$;

grant select, insert, update on public.atlas_user_preferences to authenticated;
grant execute on function public.atlas_resolve_default_org() to authenticated;
