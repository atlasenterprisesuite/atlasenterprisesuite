begin;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  start_at timestamptz not null,
  timezone text not null default 'America/New_York',
  category text not null default 'ATLAS',
  notes text,
  reminder_minutes integer not null default 0 check (reminder_minutes between 0 and 10080),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  source text not null default 'atlas-calendar',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_owner_start_idx on public.calendar_events(owner_user_id, start_at);
create index if not exists calendar_events_org_start_idx on public.calendar_events(org_id, start_at) where org_id is not null;

drop trigger if exists atlas_updated_calendar_events on public.calendar_events;
create trigger atlas_updated_calendar_events before update on public.calendar_events for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
drop policy if exists calendar_events_read on public.calendar_events;
drop policy if exists calendar_events_insert on public.calendar_events;
drop policy if exists calendar_events_update on public.calendar_events;
drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_read on public.calendar_events for select to authenticated
using (owner_user_id = auth.uid() or (org_id is not null and public.is_org_member(org_id)));
create policy calendar_events_insert on public.calendar_events for insert to authenticated
with check (owner_user_id = auth.uid() and (org_id is null or public.can_write_business_data(org_id)));
create policy calendar_events_update on public.calendar_events for update to authenticated
using (owner_user_id = auth.uid() or (org_id is not null and public.can_write_business_data(org_id)))
with check (owner_user_id = auth.uid() and (org_id is null or public.can_write_business_data(org_id)));
create policy calendar_events_delete on public.calendar_events for delete to authenticated
using (owner_user_id = auth.uid() or (org_id is not null and public.has_org_role(org_id,array['owner','admin'])));

create table if not exists public.personal_intelligence_memory (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  namespace text not null default 'default',
  memory_key text not null,
  memory_type text not null default 'context' check (memory_type in ('context','fact','preference','task','state')),
  content jsonb not null default '{}'::jsonb,
  source text not null default 'atlas-personal-intelligence',
  status text not null default 'active' check (status in ('active','archived','deleted')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  unique(owner_user_id, namespace, memory_key)
);

create index if not exists personal_intelligence_memory_owner_idx on public.personal_intelligence_memory(owner_user_id, namespace, status);

drop trigger if exists atlas_updated_personal_intelligence_memory on public.personal_intelligence_memory;
create trigger atlas_updated_personal_intelligence_memory before update on public.personal_intelligence_memory for each row execute function public.set_updated_at();

alter table public.personal_intelligence_memory enable row level security;
drop policy if exists personal_intelligence_memory_self on public.personal_intelligence_memory;
create policy personal_intelligence_memory_self on public.personal_intelligence_memory for all to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create table if not exists public.personal_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id text,
  route text,
  model text,
  status text not null default 'started' check (status in ('started','completed','failed','blocked','limited')),
  tool_count integer not null default 0 check (tool_count >= 0),
  input_hash text,
  output_hash text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists personal_intelligence_runs_owner_started_idx on public.personal_intelligence_runs(owner_user_id, started_at desc);
alter table public.personal_intelligence_runs enable row level security;
drop policy if exists personal_intelligence_runs_self on public.personal_intelligence_runs;
create policy personal_intelligence_runs_self on public.personal_intelligence_runs for all to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

grant select,insert,update,delete on public.calendar_events to authenticated;
grant select,insert,update,delete on public.personal_intelligence_memory to authenticated;
grant select,insert,update,delete on public.personal_intelligence_runs to authenticated;
revoke all on public.calendar_events from anon;
revoke all on public.personal_intelligence_memory from anon;
revoke all on public.personal_intelligence_runs from anon;

commit;
