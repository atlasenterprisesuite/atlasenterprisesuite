-- ATLAS Identity / Persona Sandbox — server-only proofing state.
-- Do not apply to production before an isolated PostgreSQL 17 unprivileged RLS test.
-- No parallel authentication, biometric storage, provider documents or public Data API writes.
insert into public.identity_permissions(code,description)
values ('identity.proofing.create','Request an ATLAS-owned sandbox identity proofing inquiry for oneself')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions(role,permission_code)
values ('owner','identity.proofing.create'),('admin','identity.proofing.create')
on conflict(role,permission_code) do nothing;

create table public.atlas_persona_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  tenant_id uuid not null references public.organizations(id),
  subject_user_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  purpose text not null default 'identity_proofing' check (purpose='identity_proofing'),
  environment text not null default 'sandbox' check (environment='sandbox'),
  reference_id text not null unique default ('atlas_' || gen_random_uuid()::text),
  template_id text not null check (template_id ~ '^itmpl_[A-Za-z0-9]+$'),
  provider_inquiry_id text unique check (provider_inquiry_id is null or provider_inquiry_id ~ '^inq_[A-Za-z0-9]+$'),
  status text not null default 'reserved'
    check (status in ('reserved','pending','review','approved','rejected','expired')),
  last_event_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_persona_tenant_matches_org check (tenant_id=organization_id)
);
create unique index atlas_persona_active_subject
  on public.atlas_persona_inquiries(organization_id,subject_user_id,purpose,environment)
  where status in ('reserved','pending','review');
create index atlas_persona_inquiry_org_subject
  on public.atlas_persona_inquiries(organization_id,subject_user_id,created_at desc);

create table public.atlas_persona_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.atlas_persona_inquiries(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  provider_event_id text not null unique check (provider_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_name text not null check (length(event_name) between 1 and 100),
  decision text not null check (decision in ('approved','rejected','review','pending','ignored')),
  event_created_at timestamptz not null,
  outcome text not null check (outcome in ('applied','stale','ignored')),
  created_at timestamptz not null default now()
);
create index atlas_persona_events_inquiry on public.atlas_persona_events(inquiry_id,event_created_at desc);

create table public.atlas_persona_audit (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.atlas_persona_inquiries(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  actor_user_id uuid references auth.users(id),
  event_type text not null check (event_type in ('reserved','provider_created','webhook.applied','webhook.stale','webhook.ignored')),
  provider_event_id text,
  occurred_at timestamptz not null default now()
);
create index atlas_persona_audit_inquiry on public.atlas_persona_audit(inquiry_id,occurred_at desc);

-- Strict default denial in exposed public schema: data is only accessed by trusted server service role.
alter table public.atlas_persona_inquiries enable row level security;
alter table public.atlas_persona_events enable row level security;
alter table public.atlas_persona_audit enable row level security;
revoke all on public.atlas_persona_inquiries,public.atlas_persona_events,public.atlas_persona_audit
  from public,anon,authenticated;
grant select,insert,update on public.atlas_persona_inquiries,public.atlas_persona_events,public.atlas_persona_audit
  to service_role;

-- SECURITY INVOKER, never SECURITY DEFINER; only service_role may invoke.
-- Validate trusted actor against authentic active membership + canonical identity permissions.
create function public.atlas_persona_reserve_inquiry(
  p_organization_id uuid, p_actor_user_id uuid, p_template_id text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_role text; v_override boolean; v_allowed boolean; v_row public.atlas_persona_inquiries%rowtype;
begin
  if p_organization_id is null or p_actor_user_id is null or
     p_template_id is null or p_template_id !~ '^itmpl_[A-Za-z0-9]+$' then
    raise exception 'persona_invalid_request';
  end if;
  select m.role into v_role from public.organization_members m
    where m.org_id=p_organization_id and m.user_id=p_actor_user_id and m.status='active';
  if v_role is null then raise exception 'persona_authorization_denied'; end if;
  select p.allowed into v_override from public.organization_role_permissions p
    where p.org_id=p_organization_id and p.role=v_role
      and p.permission_code='identity.proofing.create';
  if found then
    v_allowed := v_override is true;
  else
    select exists(select 1 from public.identity_role_permissions p
      where p.role=v_role and p.permission_code='identity.proofing.create') into v_allowed;
  end if;
  if not v_allowed then raise exception 'persona_authorization_denied'; end if;

  -- A transaction-scoped lock stops concurrent starts for the same subject.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_actor_user_id::text || ':persona', 0)
  );
  update public.atlas_persona_inquiries set status='expired',updated_at=now()
   where organization_id=p_organization_id and subject_user_id=p_actor_user_id
     and purpose='identity_proofing' and environment='sandbox'
     and status in ('reserved','pending','review') and expires_at <= now();
  select * into v_row from public.atlas_persona_inquiries
   where organization_id=p_organization_id and subject_user_id=p_actor_user_id
     and purpose='identity_proofing' and environment='sandbox'
     and status in ('reserved','pending','review')
   for update;
  if found and v_row.template_id <> p_template_id then raise exception 'persona_template_conflict'; end if;
  if not found then
    insert into public.atlas_persona_inquiries(
      organization_id,tenant_id,subject_user_id,created_by,template_id
    ) values (p_organization_id,p_organization_id,p_actor_user_id,p_actor_user_id,p_template_id)
    returning * into v_row;
    insert into public.atlas_persona_audit(inquiry_id,organization_id,actor_user_id,event_type)
    values(v_row.id,p_organization_id,p_actor_user_id,'reserved');
  end if;
  return jsonb_build_object('id',v_row.id,'reference_id',v_row.reference_id,
    'template_id',v_row.template_id,'status',v_row.status,
    'provider_inquiry_id',v_row.provider_inquiry_id);
end $$;

create function public.atlas_persona_attach_inquiry(
  p_local_id uuid, p_organization_id uuid, p_actor_user_id uuid,
  p_reference_id text, p_template_id text, p_provider_inquiry_id text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row public.atlas_persona_inquiries%rowtype;
begin
  if p_provider_inquiry_id is null or p_provider_inquiry_id !~ '^inq_[A-Za-z0-9]+$' then
    raise exception 'persona_invalid_provider_inquiry';
  end if;
  select * into v_row from public.atlas_persona_inquiries
    where id=p_local_id and organization_id=p_organization_id and tenant_id=p_organization_id
      and subject_user_id=p_actor_user_id and created_by=p_actor_user_id
      and reference_id=p_reference_id and template_id=p_template_id
    for update;
  if not found or v_row.expires_at <= now() then raise exception 'persona_binding_mismatch'; end if;
  if v_row.provider_inquiry_id is not null and v_row.provider_inquiry_id <> p_provider_inquiry_id then
    raise exception 'persona_provider_conflict';
  end if;
  if v_row.provider_inquiry_id is null and v_row.status='reserved' then
    update public.atlas_persona_inquiries
      set provider_inquiry_id=p_provider_inquiry_id,status='pending',updated_at=now()
      where id=v_row.id returning * into v_row;
    insert into public.atlas_persona_audit(inquiry_id,organization_id,actor_user_id,event_type)
    values(v_row.id,v_row.organization_id,p_actor_user_id,'provider_created');
  elsif v_row.provider_inquiry_id is null then
    raise exception 'persona_state_conflict';
  end if;
  return jsonb_build_object('id',v_row.id,'status',v_row.status,'provider_inquiry_id',v_row.provider_inquiry_id);
end $$;

-- Called ONLY after Persona-Signature has been verified on the exact raw body.
-- This function atomically de-duplicates, rejects foreign bindings and stale timestamps,
-- updates the local proofing state, and writes privacy-minimal evidence.
create function public.atlas_persona_record_signed_event(
  p_provider_inquiry_id text, p_reference_id text, p_template_id text,
  p_provider_event_id text, p_event_name text, p_decision text, p_occurred_at timestamptz
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row public.atlas_persona_inquiries%rowtype; v_event_id uuid; v_outcome text;
begin
  if p_provider_event_id is null or p_provider_event_id !~ '^evt_[A-Za-z0-9]+$'
    or p_occurred_at is null or p_occurred_at > now() + interval '10 minutes'
    or p_decision not in ('approved','rejected','review','pending','ignored')
    or p_event_name is null or length(p_event_name)>100 then
    raise exception 'persona_invalid_event';
  end if;
  -- Defense in depth against inconsistent event-name/decision data.
  if p_decision='approved' and p_event_name<>'inquiry.approved' or
     p_decision='rejected' and p_event_name not in ('inquiry.declined','inquiry.failed') or
     p_decision='review' and p_event_name<>'inquiry.marked-for-review' or
     p_decision='pending' and p_event_name<>'inquiry.completed' then
    raise exception 'persona_invalid_decision';
  end if;
  select * into v_row from public.atlas_persona_inquiries
    where provider_inquiry_id=p_provider_inquiry_id and reference_id=p_reference_id
      and template_id=p_template_id and environment='sandbox'
      and tenant_id=organization_id
    for update;
  if not found then raise exception 'persona_binding_mismatch'; end if;

  insert into public.atlas_persona_events(
    inquiry_id,organization_id,provider_event_id,event_name,decision,event_created_at,outcome
  ) values(v_row.id,v_row.organization_id,p_provider_event_id,p_event_name,p_decision,p_occurred_at,'ignored')
  on conflict(provider_event_id) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('outcome','duplicate'); end if;

  if p_decision='ignored' then
    v_outcome:='ignored';
  elsif v_row.last_event_at is not null and p_occurred_at <= v_row.last_event_at then
    v_outcome:='stale';
  else
    v_outcome:='applied';
    update public.atlas_persona_inquiries
      set status=case
        when p_decision='pending' and v_row.status in ('approved','rejected') then v_row.status
        else p_decision end,
        last_event_at=p_occurred_at,updated_at=now()
      where id=v_row.id;
  end if;
  update public.atlas_persona_events set outcome=v_outcome where id=v_event_id;
  insert into public.atlas_persona_audit(
    inquiry_id,organization_id,event_type,provider_event_id
  ) values(v_row.id,v_row.organization_id,'webhook.'||v_outcome,p_provider_event_id);
  return jsonb_build_object('outcome',v_outcome);
end $$;

-- Postgres functions are otherwise executable by PUBLIC by default.
revoke all on function public.atlas_persona_reserve_inquiry(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.atlas_persona_attach_inquiry(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.atlas_persona_record_signed_event(text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.atlas_persona_reserve_inquiry(uuid,uuid,text) to service_role;
grant execute on function public.atlas_persona_attach_inquiry(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.atlas_persona_record_signed_event(text,text,text,text,text,text,timestamptz) to service_role;
