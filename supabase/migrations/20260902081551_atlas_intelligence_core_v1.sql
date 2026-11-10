insert into public.identity_permissions(code,description) values
('intelligence.use','Use ATLAS Intelligence for authorized tenant work'),
('intelligence.manage','Manage ATLAS Intelligence tenant policy'),
('intelligence.audit','Read ATLAS Intelligence request metadata and audit state')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions(role,permission_code)
select r.role,p.code
from (values ('owner'),('admin')) as r(role)
cross join (values ('intelligence.use'),('intelligence.manage'),('intelligence.audit')) as p(code)
on conflict do nothing;

insert into public.identity_role_permissions(role,permission_code)
select r.role,'intelligence.use'
from (values ('manager'),('staff'),('accountant')) as r(role)
on conflict do nothing;

create or replace function public.can_use_atlas_intelligence(o uuid)
returns boolean language sql stable set search_path to 'public','pg_temp'
as $$ select public.is_org_member(o) and exists(select 1 from public.organization_members om join public.identity_role_permissions rp on rp.role=om.role where om.org_id=o and om.user_id=(select auth.uid()) and om.status='active' and rp.permission_code='intelligence.use') $$;

create or replace function public.can_manage_atlas_intelligence(o uuid)
returns boolean language sql stable set search_path to 'public','pg_temp'
as $$ select public.is_org_member(o) and exists(select 1 from public.organization_members om join public.identity_role_permissions rp on rp.role=om.role where om.org_id=o and om.user_id=(select auth.uid()) and om.status='active' and rp.permission_code='intelligence.manage') $$;

create or replace function public.can_audit_atlas_intelligence(o uuid)
returns boolean language sql stable set search_path to 'public','pg_temp'
as $$ select public.is_org_member(o) and exists(select 1 from public.organization_members om join public.identity_role_permissions rp on rp.role=om.role where om.org_id=o and om.user_id=(select auth.uid()) and om.status='active' and rp.permission_code in ('intelligence.audit','intelligence.manage')) $$;

create table if not exists public.atlas_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  created_by uuid not null default auth.uid(),
  module text not null default 'atlas',
  title text,
  retention_policy text not null default 'standard' check (retention_policy in ('session','standard','extended')),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_ai_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null references public.atlas_ai_conversations(id) on delete cascade,
  actor_id uuid,
  role text not null check (role in ('user','assistant','tool','system')),
  content jsonb not null,
  provenance jsonb not null default '[]'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_ai_requests (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null unique,
  org_id uuid not null,
  actor_id uuid not null,
  conversation_id uuid references public.atlas_ai_conversations(id) on delete set null,
  module text not null,
  intent text not null check (intent in ('fast','balanced','deep')),
  capabilities_requested text[] not null default '{}',
  capabilities_used text[] not null default '{}',
  provider text,
  model text,
  status text not null check (status in ('started','completed','failed','denied')),
  usage jsonb not null default '{}'::jsonb,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists atlas_ai_conversations_org_updated_idx on public.atlas_ai_conversations(org_id,updated_at desc);
create index if not exists atlas_ai_messages_org_conversation_created_idx on public.atlas_ai_messages(org_id,conversation_id,created_at);
create index if not exists atlas_ai_requests_org_created_idx on public.atlas_ai_requests(org_id,created_at desc);

alter table public.atlas_ai_conversations enable row level security;
alter table public.atlas_ai_messages enable row level security;
alter table public.atlas_ai_requests enable row level security;

drop policy if exists atlas_ai_conversations_read on public.atlas_ai_conversations;
create policy atlas_ai_conversations_read on public.atlas_ai_conversations for select to authenticated using (public.can_use_atlas_intelligence(org_id) and (created_by=(select auth.uid()) or public.can_manage_atlas_intelligence(org_id)));
drop policy if exists atlas_ai_conversations_insert on public.atlas_ai_conversations;
create policy atlas_ai_conversations_insert on public.atlas_ai_conversations for insert to authenticated with check (public.can_use_atlas_intelligence(org_id) and created_by=(select auth.uid()));
drop policy if exists atlas_ai_conversations_update on public.atlas_ai_conversations;
create policy atlas_ai_conversations_update on public.atlas_ai_conversations for update to authenticated using (public.can_use_atlas_intelligence(org_id) and (created_by=(select auth.uid()) or public.can_manage_atlas_intelligence(org_id))) with check (public.can_use_atlas_intelligence(org_id) and (created_by=(select auth.uid()) or public.can_manage_atlas_intelligence(org_id)));

drop policy if exists atlas_ai_messages_read on public.atlas_ai_messages;
create policy atlas_ai_messages_read on public.atlas_ai_messages for select to authenticated using (public.can_use_atlas_intelligence(atlas_ai_messages.org_id) and exists(select 1 from public.atlas_ai_conversations c where c.id=atlas_ai_messages.conversation_id and c.org_id=atlas_ai_messages.org_id and (c.created_by=(select auth.uid()) or public.can_manage_atlas_intelligence(atlas_ai_messages.org_id))));
drop policy if exists atlas_ai_messages_insert on public.atlas_ai_messages;
create policy atlas_ai_messages_insert on public.atlas_ai_messages for insert to authenticated with check (public.can_use_atlas_intelligence(atlas_ai_messages.org_id) and exists(select 1 from public.atlas_ai_conversations c where c.id=atlas_ai_messages.conversation_id and c.org_id=atlas_ai_messages.org_id and (c.created_by=(select auth.uid()) or public.can_manage_atlas_intelligence(atlas_ai_messages.org_id))));

drop policy if exists atlas_ai_requests_read on public.atlas_ai_requests;
create policy atlas_ai_requests_read on public.atlas_ai_requests for select to authenticated using (public.can_use_atlas_intelligence(org_id) and (actor_id=(select auth.uid()) or public.can_audit_atlas_intelligence(org_id)));
drop policy if exists atlas_ai_requests_insert on public.atlas_ai_requests;
create policy atlas_ai_requests_insert on public.atlas_ai_requests for insert to authenticated with check (public.can_use_atlas_intelligence(org_id) and actor_id=(select auth.uid()));
drop policy if exists atlas_ai_requests_update on public.atlas_ai_requests;
create policy atlas_ai_requests_update on public.atlas_ai_requests for update to authenticated using (public.can_use_atlas_intelligence(org_id) and actor_id=(select auth.uid())) with check (public.can_use_atlas_intelligence(org_id) and actor_id=(select auth.uid()));

grant select,insert,update on public.atlas_ai_conversations to authenticated;
grant select,insert on public.atlas_ai_messages to authenticated;
grant select,insert,update on public.atlas_ai_requests to authenticated;
