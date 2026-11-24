begin;

create table if not exists public.atlas_module_registry(
  org_id uuid not null references public.organizations(id) on delete cascade,
  module_code text not null,
  enabled boolean not null default true,
  launch_status text not null default 'active' check (launch_status in ('active','blocked','disabled')),
  data_backend text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(org_id,module_code)
);

create table if not exists public.atlas_module_records(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module_code text not null,
  record_type text not null,
  external_key text,
  subject_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atlas_module_records_external_key_uq
  on public.atlas_module_records(org_id,module_code,record_type,external_key)
  where external_key is not null;
create index if not exists atlas_module_records_lookup_idx
  on public.atlas_module_records(org_id,module_code,record_type,updated_at desc);
create index if not exists atlas_module_records_subject_idx
  on public.atlas_module_records(subject_user_id,module_code) where subject_user_id is not null;

create table if not exists public.atlas_events(
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  source_module text not null,
  target_module text,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid not null default auth.uid() references auth.users(id),
  occurred_at timestamptz not null default now()
);
create index if not exists atlas_events_org_time_idx on public.atlas_events(org_id,occurred_at desc);
create index if not exists atlas_events_route_idx on public.atlas_events(org_id,source_module,target_module,event_type);

create table if not exists public.atlas_workflows(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_event text not null,
  enabled boolean not null default true,
  definition jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_workflows_trigger_idx on public.atlas_workflows(org_id,enabled,trigger_event);

create table if not exists public.atlas_workflow_runs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid references public.atlas_workflows(id) on delete set null,
  event_id bigint references public.atlas_events(id) on delete set null,
  status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  actor_id uuid not null default auth.uid() references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_workflow_runs_org_idx on public.atlas_workflow_runs(org_id,created_at desc);

create table if not exists public.atlas_connectors(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_key text not null,
  display_name text not null,
  kind text not null,
  mode text not null default 'production' check(mode in ('production','disabled')),
  status text not null default 'disconnected' check(status in ('connected','disconnected','pending','error')),
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  last_health_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,connector_key)
);

create table if not exists public.atlas_outbox(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id bigint references public.atlas_events(id) on delete set null,
  channel text not null,
  destination_ref text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check(status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_outbox_dispatch_idx on public.atlas_outbox(status,next_attempt_at);

create table if not exists public.atlas_intelligence_signals(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_module text not null,
  signal_type text not null,
  severity text not null default 'info' check(severity in ('info','low','medium','high','critical')),
  title text not null,
  summary text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check(status in ('open','acknowledged','resolved','dismissed')),
  subject_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_intelligence_signals_org_idx on public.atlas_intelligence_signals(org_id,status,severity,created_at desc);

alter table public.atlas_module_registry enable row level security;
alter table public.atlas_module_records enable row level security;
alter table public.atlas_events enable row level security;
alter table public.atlas_workflows enable row level security;
alter table public.atlas_workflow_runs enable row level security;
alter table public.atlas_connectors enable row level security;
alter table public.atlas_outbox enable row level security;
alter table public.atlas_intelligence_signals enable row level security;

drop policy if exists atlas_module_registry_read on public.atlas_module_registry;
create policy atlas_module_registry_read on public.atlas_module_registry for select to authenticated
using(public.is_org_member(org_id));
drop policy if exists atlas_module_registry_manage on public.atlas_module_registry;
create policy atlas_module_registry_manage on public.atlas_module_registry for all to authenticated
using(public.has_org_role(org_id,array['owner','admin']))
with check(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_module_records_read on public.atlas_module_records;
create policy atlas_module_records_read on public.atlas_module_records for select to authenticated
using(
  public.is_org_member(org_id)
  and (
    module_code not in ('wallet','health','identity')
    or subject_user_id=auth.uid()
    or public.has_org_role(org_id,array['owner','admin','manager'])
  )
);
drop policy if exists atlas_module_records_insert on public.atlas_module_records;
create policy atlas_module_records_insert on public.atlas_module_records for insert to authenticated
with check(
  created_by=auth.uid() and updated_by=auth.uid()
  and (
    (module_code in ('wallet','health','identity') and (subject_user_id=auth.uid() or public.has_org_role(org_id,array['owner','admin','manager'])))
    or (module_code not in ('wallet','health','identity') and public.can_write_business_data(org_id))
  )
);
drop policy if exists atlas_module_records_update on public.atlas_module_records;
create policy atlas_module_records_update on public.atlas_module_records for update to authenticated
using(
  (module_code in ('wallet','health','identity') and (subject_user_id=auth.uid() or public.has_org_role(org_id,array['owner','admin','manager'])))
  or (module_code not in ('wallet','health','identity') and public.can_write_business_data(org_id))
)
with check(
  updated_by=auth.uid()
  and (
    (module_code in ('wallet','health','identity') and (subject_user_id=auth.uid() or public.has_org_role(org_id,array['owner','admin','manager'])))
    or (module_code not in ('wallet','health','identity') and public.can_write_business_data(org_id))
  )
);
drop policy if exists atlas_module_records_delete on public.atlas_module_records;
create policy atlas_module_records_delete on public.atlas_module_records for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_events_read on public.atlas_events;
create policy atlas_events_read on public.atlas_events for select to authenticated using(public.is_org_member(org_id));
drop policy if exists atlas_events_insert on public.atlas_events;
create policy atlas_events_insert on public.atlas_events for insert to authenticated
with check(public.is_org_member(org_id) and actor_id=auth.uid());

drop policy if exists atlas_workflows_read on public.atlas_workflows;
create policy atlas_workflows_read on public.atlas_workflows for select to authenticated using(public.is_org_member(org_id));
drop policy if exists atlas_workflows_write on public.atlas_workflows;
create policy atlas_workflows_write on public.atlas_workflows for all to authenticated
using(public.can_write_business_data(org_id))
with check(public.can_write_business_data(org_id) and updated_by=auth.uid());

drop policy if exists atlas_workflow_runs_read on public.atlas_workflow_runs;
create policy atlas_workflow_runs_read on public.atlas_workflow_runs for select to authenticated using(public.is_org_member(org_id));
drop policy if exists atlas_workflow_runs_insert on public.atlas_workflow_runs;
create policy atlas_workflow_runs_insert on public.atlas_workflow_runs for insert to authenticated
with check(public.can_write_business_data(org_id) and actor_id=auth.uid());
drop policy if exists atlas_workflow_runs_update on public.atlas_workflow_runs;
create policy atlas_workflow_runs_update on public.atlas_workflow_runs for update to authenticated
using(public.can_write_business_data(org_id))
with check(public.can_write_business_data(org_id));
drop policy if exists atlas_workflow_runs_delete on public.atlas_workflow_runs;
create policy atlas_workflow_runs_delete on public.atlas_workflow_runs for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_connectors_read on public.atlas_connectors;
create policy atlas_connectors_read on public.atlas_connectors for select to authenticated
using(public.has_org_role(org_id,array['owner','admin','manager','accountant']));
drop policy if exists atlas_connectors_manage on public.atlas_connectors;
create policy atlas_connectors_manage on public.atlas_connectors for all to authenticated
using(public.has_org_role(org_id,array['owner','admin']))
with check(public.has_org_role(org_id,array['owner','admin']) and updated_by=auth.uid());

drop policy if exists atlas_outbox_read on public.atlas_outbox;
create policy atlas_outbox_read on public.atlas_outbox for select to authenticated
using(public.has_org_role(org_id,array['owner','admin','manager']));
drop policy if exists atlas_outbox_write on public.atlas_outbox;
create policy atlas_outbox_write on public.atlas_outbox for all to authenticated
using(public.has_org_role(org_id,array['owner','admin','manager']))
with check(public.has_org_role(org_id,array['owner','admin','manager']) and created_by=auth.uid());

drop policy if exists atlas_intelligence_signals_read on public.atlas_intelligence_signals;
create policy atlas_intelligence_signals_read on public.atlas_intelligence_signals for select to authenticated
using(
  public.is_org_member(org_id)
  and (subject_user_id is null or subject_user_id=auth.uid() or public.has_org_role(org_id,array['owner','admin','manager']))
);
drop policy if exists atlas_intelligence_signals_insert on public.atlas_intelligence_signals;
create policy atlas_intelligence_signals_insert on public.atlas_intelligence_signals for insert to authenticated
with check(public.can_write_business_data(org_id) and created_by=auth.uid());
drop policy if exists atlas_intelligence_signals_update on public.atlas_intelligence_signals;
create policy atlas_intelligence_signals_update on public.atlas_intelligence_signals for update to authenticated
using(public.is_org_member(org_id))
with check(public.is_org_member(org_id));
drop policy if exists atlas_intelligence_signals_delete on public.atlas_intelligence_signals;
create policy atlas_intelligence_signals_delete on public.atlas_intelligence_signals for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

grant select,insert,update,delete on public.atlas_module_registry to authenticated;
grant select,insert,update,delete on public.atlas_module_records to authenticated;
grant select,insert on public.atlas_events to authenticated;
grant usage,select on sequence public.atlas_events_id_seq to authenticated;
grant select,insert,update,delete on public.atlas_workflows to authenticated;
grant select,insert,update,delete on public.atlas_workflow_runs to authenticated;
grant select,insert,update,delete on public.atlas_connectors to authenticated;
grant select,insert,update,delete on public.atlas_outbox to authenticated;
grant select,insert,update,delete on public.atlas_intelligence_signals to authenticated;

-- Existing trigger helpers are reused so all new operational writes receive timestamps and audit coverage.
do $$
declare t text;
begin
  foreach t in array array['atlas_module_registry','atlas_module_records','atlas_workflows','atlas_workflow_runs','atlas_connectors','atlas_outbox','atlas_intelligence_signals'] loop
    execute format('drop trigger if exists %I on public.%I','atlas_updated_'||t,t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()','atlas_updated_'||t,t);
  end loop;
  foreach t in array array['atlas_module_records','atlas_workflows','atlas_workflow_runs','atlas_connectors','atlas_outbox','atlas_intelligence_signals'] loop
    execute format('drop trigger if exists %I on public.%I','atlas_audit_'||t,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()','atlas_audit_'||t,t);
  end loop;
end;
$$;

-- Register every ATLAS module against a real production data backend. External integrations remain explicitly disconnected until credentials exist.
insert into public.atlas_module_registry(org_id,module_code,enabled,launch_status,data_backend,config)
select o.id,v.module_code,true,'active',v.data_backend,'{}'::jsonb
from public.organizations o
cross join (values
 ('core','core_relational'),('crm','core_relational'),('finance','core_relational'),('accounting','core_relational'),
 ('inventory','core_relational'),('hr','core_relational'),('payroll','module_records'),('documents','core_relational'),
 ('wallet','module_records'),('rewards','module_records'),('ride','module_records'),('marketplace','module_records'),
 ('freight','module_records'),('cars','module_records'),('health','module_records'),('safety','module_records'),
 ('community','module_records'),('projects','module_records'),('pos','module_records'),('education','module_records'),
 ('security','identity_system'),('automation','workflow_engine'),('field_ops','module_records'),('analytics','event_stream'),
 ('intelligence','event_stream'),('calendar','module_records'),('support','module_records')
) as v(module_code,data_backend)
on conflict(org_id,module_code) do update set enabled=true,launch_status='active',data_backend=excluded.data_backend,updated_at=now();

insert into public.organization_modules(org_id,module_code,enabled,launch_status)
select org_id,module_code,true,'active' from public.atlas_module_registry
on conflict(org_id,module_code) do update set enabled=true,launch_status='active',updated_at=now();

commit;
