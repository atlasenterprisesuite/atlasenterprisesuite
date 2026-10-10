-- ATLAS Payroll control plane, Wave 1.
-- Adds evidence-driven readiness and provider/rule governance without enabling
-- tax calculation, filing, remittance, or money movement by itself.

create table if not exists public.payroll_rule_packs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  scope text not null default 'organization' check (scope in ('platform','organization')),
  jurisdiction_country text not null,
  jurisdiction_region text,
  jurisdiction_local text,
  rule_version text not null,
  source_uri text not null,
  source_published_at timestamptz,
  effective_from date not null,
  effective_to date,
  verified_at timestamptz,
  checksum text not null,
  status text not null default 'draft' check (status in ('draft','verified','active','retired','blocked')),
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_rule_pack_scope_check check (
    (scope = 'platform' and org_id is null) or
    (scope = 'organization' and org_id is not null)
  ),
  constraint payroll_rule_pack_effective_window_check check (
    effective_to is null or effective_to >= effective_from
  ),
  constraint payroll_rule_pack_active_evidence_check check (
    status <> 'active' or (
      verified_at is not null and
      nullif(btrim(checksum),'') is not null and
      nullif(btrim(source_uri),'') is not null and
      parameters ->> 'engine_status' = 'production'
    )
  )
);

create unique index if not exists payroll_rule_packs_identity_uq
  on public.payroll_rule_packs (
    coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    jurisdiction_country,
    coalesce(jurisdiction_region,''),
    coalesce(jurisdiction_local,''),
    rule_version
  );

create table if not exists public.payroll_provider_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null,
  environment text not null default 'production' check (environment in ('sandbox','production')),
  status text not null default 'unverified' check (status in ('unverified','verified','blocked','disabled')),
  capabilities text[] not null default '{}'::text[],
  last_verified_at timestamptz,
  verification_evidence_hash text,
  credentials_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_provider_capability_allowlist_check check (
    capabilities <@ array[
      'tax.calculate',
      'tax.file',
      'tax.remit',
      'payroll.disburse.ach',
      'payroll.disburse.paycard',
      'benefits.sync',
      'year_end.forms'
    ]::text[]
  ),
  constraint payroll_provider_verified_evidence_check check (
    status <> 'verified' or (
      last_verified_at is not null and
      nullif(btrim(verification_evidence_hash),'') is not null and
      cardinality(capabilities) > 0
    )
  ),
  unique (org_id, provider_key, environment),
  unique (org_id, id)
);

create table if not exists public.payroll_execution_intents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.payroll_runs(id) on delete restrict,
  provider_connection_id uuid,
  execution_kind text not null check (execution_kind in (
    'tax.file',
    'tax.remit',
    'payroll.disburse.ach',
    'payroll.disburse.paycard',
    'year_end.forms',
    'benefits.sync'
  )),
  idempotency_key text not null,
  state text not null default 'draft' check (state in (
    'draft','ready','submitted','accepted','settled','blocked','rejected','failed','cancelled'
  )),
  amount numeric(18,2),
  currency text not null default 'USD',
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_execution_amount_check check (amount is null or amount >= 0),
  constraint payroll_execution_provider_org_fk foreign key (org_id, provider_connection_id)
    references public.payroll_provider_connections(org_id, id) on delete restrict,
  unique (org_id, idempotency_key),
  unique (org_id, id)
);

create table if not exists public.payroll_execution_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  intent_id uuid not null,
  normalized_state text not null check (normalized_state in ('submitted','accepted','settled','rejected','failed')),
  provider_request_ref text,
  provider_response_ref text,
  payload_hash text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint payroll_execution_evidence_payload_check check (nullif(btrim(payload_hash),'') is not null),
  constraint payroll_execution_evidence_intent_org_fk foreign key (org_id, intent_id)
    references public.payroll_execution_intents(org_id, id) on delete restrict
);

create index if not exists payroll_rule_packs_active_lookup_idx
  on public.payroll_rule_packs (jurisdiction_country, effective_from, effective_to, status);
create index if not exists payroll_provider_capabilities_idx
  on public.payroll_provider_connections using gin (capabilities);
create index if not exists payroll_execution_intents_run_idx
  on public.payroll_execution_intents (org_id, run_id, created_at desc);
create index if not exists payroll_execution_evidence_intent_idx
  on public.payroll_execution_evidence (org_id, intent_id, observed_at desc);

alter table public.payroll_rule_packs enable row level security;
alter table public.payroll_provider_connections enable row level security;
alter table public.payroll_execution_intents enable row level security;
alter table public.payroll_execution_evidence enable row level security;

revoke all on public.payroll_rule_packs from anon;
revoke all on public.payroll_provider_connections from anon;
revoke all on public.payroll_execution_intents from anon;
revoke all on public.payroll_execution_evidence from anon;

revoke insert, update, delete on public.payroll_rule_packs from authenticated;
revoke insert, update, delete on public.payroll_provider_connections from authenticated;
revoke insert, update, delete on public.payroll_execution_intents from authenticated;
revoke insert, update, delete on public.payroll_execution_evidence from authenticated;

grant select on public.payroll_rule_packs to authenticated;
grant select on public.payroll_provider_connections to authenticated;
grant select on public.payroll_execution_intents to authenticated;
grant select on public.payroll_execution_evidence to authenticated;

drop policy if exists payroll_rule_packs_read on public.payroll_rule_packs;
create policy payroll_rule_packs_read on public.payroll_rule_packs
for select to authenticated
using (
  (org_id is null and status = 'active') or
  (org_id is not null and (
    public.has_identity_permission(org_id,'payroll.read') or
    public.has_identity_permission(org_id,'payroll.write')
  ))
);

drop policy if exists payroll_provider_connections_read on public.payroll_provider_connections;
create policy payroll_provider_connections_read on public.payroll_provider_connections
for select to authenticated
using (
  public.has_identity_permission(org_id,'payroll.read') or
  public.has_identity_permission(org_id,'payroll.write')
);

drop policy if exists payroll_execution_intents_read on public.payroll_execution_intents;
create policy payroll_execution_intents_read on public.payroll_execution_intents
for select to authenticated
using (
  public.has_identity_permission(org_id,'payroll.read') or
  public.has_identity_permission(org_id,'payroll.write')
);

drop policy if exists payroll_execution_evidence_read on public.payroll_execution_evidence;
create policy payroll_execution_evidence_read on public.payroll_execution_evidence
for select to authenticated
using (
  public.has_identity_permission(org_id,'payroll.read') or
  public.has_identity_permission(org_id,'payroll.write')
);

create or replace function public.payroll_execution_evidence_immutable()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  raise exception 'payroll_execution_evidence_immutable';
end;
$$;

drop trigger if exists payroll_execution_evidence_immutable_guard on public.payroll_execution_evidence;
create trigger payroll_execution_evidence_immutable_guard
before update or delete on public.payroll_execution_evidence
for each row execute function public.payroll_execution_evidence_immutable();

create or replace function public.payroll_guard_execution_intent_scope()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.run_id is not null and not exists (
    select 1 from public.payroll_runs r
    where r.id = new.run_id and r.org_id = new.org_id
  ) then
    raise exception 'payroll_execution_run_org_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists payroll_execution_intent_scope_guard on public.payroll_execution_intents;
create trigger payroll_execution_intent_scope_guard
before insert or update on public.payroll_execution_intents
for each row execute function public.payroll_guard_execution_intent_scope();

create or replace function public.payroll_guard_execution_settlement()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.state = 'settled' and coalesce(old.state,'') <> 'settled' and not exists (
    select 1
    from public.payroll_execution_evidence e
    where e.org_id = new.org_id
      and e.intent_id = new.id
      and e.normalized_state = 'settled'
      and nullif(btrim(e.payload_hash),'') is not null
  ) then
    raise exception 'settled_evidence_required';
  end if;

  return new;
end;
$$;

drop trigger if exists payroll_execution_intent_settlement_guard on public.payroll_execution_intents;
create trigger payroll_execution_intent_settlement_guard
before update on public.payroll_execution_intents
for each row execute function public.payroll_guard_execution_settlement();

-- Keep mutable control-plane rows on the existing Payroll updated_at convention.
drop trigger if exists payroll_rule_packs_touch on public.payroll_rule_packs;
create trigger payroll_rule_packs_touch
before update on public.payroll_rule_packs
for each row execute function public.payroll_touch_updated_at();

drop trigger if exists payroll_provider_connections_touch on public.payroll_provider_connections;
create trigger payroll_provider_connections_touch
before update on public.payroll_provider_connections
for each row execute function public.payroll_touch_updated_at();

drop trigger if exists payroll_execution_intents_touch on public.payroll_execution_intents;
create trigger payroll_execution_intents_touch
before update on public.payroll_execution_intents
for each row execute function public.payroll_touch_updated_at();

-- Reuse ATLAS' canonical audit trigger for all control-plane mutations.
drop trigger if exists payroll_rule_packs_audit on public.payroll_rule_packs;
create trigger payroll_rule_packs_audit
after insert or update or delete on public.payroll_rule_packs
for each row execute function public.audit_row_change();

drop trigger if exists payroll_provider_connections_audit on public.payroll_provider_connections;
create trigger payroll_provider_connections_audit
after insert or update or delete on public.payroll_provider_connections
for each row execute function public.audit_row_change();

drop trigger if exists payroll_execution_intents_audit on public.payroll_execution_intents;
create trigger payroll_execution_intents_audit
after insert or update or delete on public.payroll_execution_intents
for each row execute function public.audit_row_change();

drop trigger if exists payroll_execution_evidence_audit on public.payroll_execution_evidence;
create trigger payroll_execution_evidence_audit
after insert on public.payroll_execution_evidence
for each row execute function public.audit_row_change();

create or replace function public.payroll_get_capability_readiness(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_pay_date date;
  v_rule_pack_id uuid;
  v_tax_provider record;
  v_filing_provider record;
  v_remit_provider record;
  v_ach_provider record;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.has_identity_permission(p_org_id,'payroll.read') or
    public.has_identity_permission(p_org_id,'payroll.write')
  ) then
    raise exception 'payroll_permission_required';
  end if;

  select r.pay_date
  into v_pay_date
  from public.payroll_runs r
  where r.org_id = p_org_id
    and r.status not in ('locked','void')
  order by case when r.pay_date >= current_date then 0 else 1 end, r.pay_date desc
  limit 1;

  v_pay_date := coalesce(v_pay_date,current_date);

  select rp.id
  into v_rule_pack_id
  from public.payroll_rule_packs rp
  where (rp.org_id = p_org_id or rp.org_id is null)
    and rp.status = 'active'
    and rp.jurisdiction_country = 'US'
    and rp.effective_from <= v_pay_date
    and (rp.effective_to is null or rp.effective_to >= v_pay_date)
    and rp.verified_at is not null
    and nullif(btrim(rp.checksum),'') is not null
    and rp.parameters ->> 'engine_status' = 'production'
  order by case when rp.org_id = p_org_id then 0 else 1 end, rp.effective_from desc
  limit 1;

  select pc.id, pc.provider_key
  into v_tax_provider
  from public.payroll_provider_connections pc
  where pc.org_id = p_org_id
    and pc.environment = 'production'
    and pc.status = 'verified'
    and 'tax.calculate' = any(pc.capabilities)
  order by pc.last_verified_at desc
  limit 1;

  select pc.id, pc.provider_key
  into v_filing_provider
  from public.payroll_provider_connections pc
  where pc.org_id = p_org_id
    and pc.environment = 'production'
    and pc.status = 'verified'
    and 'tax.file' = any(pc.capabilities)
  order by pc.last_verified_at desc
  limit 1;

  select pc.id, pc.provider_key
  into v_remit_provider
  from public.payroll_provider_connections pc
  where pc.org_id = p_org_id
    and pc.environment = 'production'
    and pc.status = 'verified'
    and 'tax.remit' = any(pc.capabilities)
  order by pc.last_verified_at desc
  limit 1;

  select pc.id, pc.provider_key
  into v_ach_provider
  from public.payroll_provider_connections pc
  where pc.org_id = p_org_id
    and pc.environment = 'production'
    and pc.status = 'verified'
    and 'payroll.disburse.ach' = any(pc.capabilities)
  order by pc.last_verified_at desc
  limit 1;

  return jsonb_build_object(
    'as_of', now(),
    'pay_date', v_pay_date,
    'capabilities', jsonb_build_object(
      'tax_determination', case
        when v_rule_pack_id is not null then jsonb_build_object(
          'status','ready','severity','INFO','reason','Active verified production tax rule coverage is available.','rule_pack_id',v_rule_pack_id
        )
        when v_tax_provider.id is not null then jsonb_build_object(
          'status','ready','severity','INFO','reason','A verified production tax-calculation provider is available.','provider_key',v_tax_provider.provider_key,'provider_connection_id',v_tax_provider.id
        )
        else jsonb_build_object(
          'status','blocked','severity','P0_BLOCKER','reason','No active production tax rule pack or verified tax-calculation provider covers this payroll.'
        )
      end,
      'tax_filing', case
        when v_filing_provider.id is not null then jsonb_build_object(
          'status','ready','severity','INFO','reason','A verified production tax-filing provider is configured.','provider_key',v_filing_provider.provider_key,'provider_connection_id',v_filing_provider.id
        )
        else jsonb_build_object(
          'status','blocked','severity','P0_BLOCKER','reason','No verified production tax-filing provider is configured.'
        )
      end,
      'tax_remittance', case
        when v_remit_provider.id is not null then jsonb_build_object(
          'status','ready','severity','INFO','reason','A verified production tax-remittance provider is configured.','provider_key',v_remit_provider.provider_key,'provider_connection_id',v_remit_provider.id
        )
        else jsonb_build_object(
          'status','blocked','severity','P0_BLOCKER','reason','No verified production tax-remittance provider is configured.'
        )
      end,
      'direct_deposit', case
        when v_ach_provider.id is not null then jsonb_build_object(
          'status','ready','severity','INFO','reason','A verified production ACH payroll provider is configured.','provider_key',v_ach_provider.provider_key,'provider_connection_id',v_ach_provider.id
        )
        else jsonb_build_object(
          'status','blocked','severity','P0_BLOCKER','reason','No verified production ACH payroll provider is configured.'
        )
      end
    )
  );
end;
$$;

revoke all on function public.payroll_get_capability_readiness(uuid) from public;
grant execute on function public.payroll_get_capability_readiness(uuid) to authenticated;
