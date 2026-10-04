-- ATLAS Payroll Operations Workbench.
-- Adds operational records and governed RPCs without claiming provider execution.
-- External filing, remittance, benefits sync and money movement remain evidence-gated.

create table if not exists public.payroll_employer_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  state_code text not null,
  tax_kind text not null,
  employer_rate numeric(10,8),
  wage_base numeric(16,2),
  effective_from date not null,
  effective_to date,
  evidence_hash text not null,
  source_uri text,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,state_code,tax_kind,effective_from),
  check (effective_to is null or effective_to>=effective_from),
  check (nullif(btrim(evidence_hash),'') is not null)
);

create table if not exists public.payroll_worker_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete restrict,
  residence_state text not null,
  work_state text not null,
  local_code text,
  remote_work boolean not null default false,
  reciprocity_code text,
  effective_from date not null,
  effective_to date,
  evidence_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,worker_id,effective_from),
  check (effective_to is null or effective_to>=effective_from),
  check (nullif(btrim(evidence_hash),'') is not null)
);

create table if not exists public.payroll_deduction_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('benefit','health','retirement','other')),
  taxability text not null default 'unclassified' check (taxability in ('pretax_fit_fica','pretax_fit_only','posttax','unclassified')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,code),
  unique(org_id,id)
);

create table if not exists public.payroll_worker_deductions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete restrict,
  deduction_definition_id uuid not null,
  amount_type text not null check (amount_type in ('fixed','percent')),
  amount numeric(16,4) not null check (amount>=0),
  effective_from date not null,
  effective_to date,
  evidence_hash text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_worker_deduction_definition_fk foreign key (org_id,deduction_definition_id)
    references public.payroll_deduction_definitions(org_id,id) on delete restrict,
  check (effective_to is null or effective_to>=effective_from),
  check (nullif(btrim(evidence_hash),'') is not null)
);

create table if not exists public.payroll_garnishment_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete restrict,
  order_type text not null,
  authority text not null,
  case_reference text not null,
  amount_type text not null check (amount_type in ('fixed','percent')),
  amount numeric(16,4) not null check (amount>=0),
  priority integer not null default 100,
  effective_from date not null,
  effective_to date,
  evidence_hash text not null,
  status text not null default 'active' check (status in ('active','held','ended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to>=effective_from),
  check (nullif(btrim(evidence_hash),'') is not null)
);

create table if not exists public.payroll_compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.payroll_runs(id) on delete restrict,
  jurisdiction text not null,
  obligation_type text not null check (obligation_type in ('tax.file','tax.remit','year_end.forms','state.report')),
  form_code text,
  due_date date not null,
  amount numeric(18,2) check (amount is null or amount>=0),
  execution_status text not null default 'prepared' check (execution_status in ('prepared','ready','submitted','accepted','settled','blocked','failed')),
  provider_connection_id uuid,
  execution_intent_id uuid,
  provider_evidence_hash text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_compliance_provider_fk foreign key (org_id,provider_connection_id)
    references public.payroll_provider_connections(org_id,id) on delete restrict,
  constraint payroll_compliance_intent_fk foreign key (org_id,execution_intent_id)
    references public.payroll_execution_intents(org_id,id) on delete restrict,
  check (execution_status not in ('submitted','accepted','settled') or nullif(btrim(provider_evidence_hash),'') is not null)
);

create table if not exists public.payroll_payment_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete restrict,
  payment_kind text not null check (payment_kind in ('ach','paycard','check')),
  amount numeric(18,2) not null check (amount>=0),
  execution_status text not null default 'prepared' check (execution_status in ('prepared','ready','submitted','accepted','settled','blocked','failed')),
  provider_connection_id uuid,
  execution_intent_id uuid,
  provider_evidence_hash text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_payment_provider_fk foreign key (org_id,provider_connection_id)
    references public.payroll_provider_connections(org_id,id) on delete restrict,
  constraint payroll_payment_intent_fk foreign key (org_id,execution_intent_id)
    references public.payroll_execution_intents(org_id,id) on delete restrict,
  check (execution_status not in ('submitted','accepted','settled') or nullif(btrim(provider_evidence_hash),'') is not null)
);

create table if not exists public.payroll_gl_postings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete restrict,
  journal_ref text not null,
  status text not null default 'draft' check (status in ('draft','posted','failed')),
  debit_total numeric(18,2) not null default 0 check (debit_total>=0),
  credit_total numeric(18,2) not null default 0 check (credit_total>=0),
  evidence_hash text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,run_id,journal_ref),
  check (status<>'posted' or (debit_total=credit_total and nullif(btrim(evidence_hash),'') is not null))
);

create table if not exists public.payroll_variance_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid references public.people_workers(id) on delete cascade,
  finding_type text not null check (finding_type in ('net_pay_change','gross_pay_change','missing_tax_determination','pretax_taxability_unclassified')),
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  baseline_value numeric(18,2),
  current_value numeric(18,2),
  delta_percent numeric(12,4),
  requires_review boolean not null default true,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,run_id,worker_id,finding_type)
);

-- RLS and least privilege.
do $$ declare t text; begin
  foreach t in array array[
    'payroll_employer_tax_profiles','payroll_worker_jurisdictions','payroll_deduction_definitions',
    'payroll_worker_deductions','payroll_garnishment_orders','payroll_compliance_obligations',
    'payroll_payment_batches','payroll_gl_postings','payroll_variance_findings'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all privileges on table public.%I from anon, authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'payroll_employer_tax_profiles','payroll_worker_jurisdictions','payroll_deduction_definitions',
    'payroll_worker_deductions','payroll_garnishment_orders','payroll_compliance_obligations',
    'payroll_payment_batches','payroll_gl_postings','payroll_variance_findings'
  ] loop
    execute format('drop policy if exists %I on public.%I',t||'_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_identity_permission(org_id,''payroll.read'') or public.has_identity_permission(org_id,''payroll.write''))',t||'_read',t);
  end loop;
end $$;

-- Florida 2026 employer reemployment tax rule pack. Florida workers do not fund this employer tax.
insert into public.payroll_rule_packs(
  org_id,scope,jurisdiction_country,jurisdiction_region,jurisdiction_local,
  rule_version,source_uri,effective_from,effective_to,verified_at,checksum,status,parameters
)
select null,'platform','US','FL',null,
  'us-fl-reemployment-2026-v1','https://floridarevenue.com/taxes/taxesfees/Pages/rt_rate.aspx',
  date '2026-01-01',date '2026-12-31',now(),
  '0fdfdb76352dcaecc9dd5668bb42a86bc998bcaeb7486e1e87586358801ebdb6','active',
  '{"coverage_level":"florida_reemployment_tax","employee_withholding":false,"engine_status":"production","reemployment":{"maximum_rate":0.054,"minimum_rate":0.001,"new_employer_rate":0.027,"wage_base":7000,"worker_deduction_prohibited":true},"sources":["https://floridarevenue.com/taxes/taxesfees/Pages/rt_rate.aspx","https://floridarevenue.com/taxes/taxesfees/Pages/reemployment.aspx"],"tax_year":2026}'::jsonb
where not exists(select 1 from public.payroll_rule_packs where rule_version='us-fl-reemployment-2026-v1');

create or replace function public.payroll_upsert_employer_tax_profile(
  p_org_id uuid,p_state_code text,p_tax_kind text,p_employer_rate numeric,p_wage_base numeric,
  p_effective_from date,p_evidence_hash text,p_source_uri text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if nullif(btrim(coalesce(p_evidence_hash,'')),'') is null then raise exception 'employer_rate_evidence_required'; end if;
  if upper(p_state_code)='FL' and p_tax_kind='reemployment' and (p_employer_rate<0.001 or p_employer_rate>0.054) then raise exception 'rate_out_of_bounds'; end if;
  insert into public.payroll_employer_tax_profiles(org_id,state_code,tax_kind,employer_rate,wage_base,effective_from,evidence_hash,source_uri,created_by)
  values(p_org_id,upper(p_state_code),p_tax_kind,p_employer_rate,p_wage_base,p_effective_from,btrim(p_evidence_hash),p_source_uri,auth.uid())
  on conflict(org_id,state_code,tax_kind,effective_from) do update set employer_rate=excluded.employer_rate,wage_base=excluded.wage_base,evidence_hash=excluded.evidence_hash,source_uri=excluded.source_uri,status='active',updated_at=now()
  returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_calculate_fl_reemployment_2026(
  p_org_id uuid,p_pay_date date,p_taxable_wages numeric,p_ytd_fl_wages numeric default 0
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_profile record; v_taxable numeric; v_tax numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (public.has_identity_permission(p_org_id,'payroll.read') or public.has_identity_permission(p_org_id,'payroll.write')) then raise exception 'payroll_permission_required'; end if;
  if extract(year from p_pay_date)::integer<>2026 then raise exception 'unsupported_tax_year'; end if;
  if least(coalesce(p_taxable_wages,0),coalesce(p_ytd_fl_wages,0))<0 then raise exception 'negative_tax_input'; end if;
  select * into v_profile from public.payroll_employer_tax_profiles
   where org_id=p_org_id and state_code='FL' and tax_kind='reemployment' and status='active'
     and effective_from<=p_pay_date and (effective_to is null or effective_to>=p_pay_date)
   order by effective_from desc limit 1;
  if not found or nullif(btrim(v_profile.evidence_hash),'') is null then raise exception 'employer_rate_evidence_required'; end if;
  if v_profile.employer_rate<0.001 or v_profile.employer_rate>0.054 then raise exception 'rate_out_of_bounds'; end if;
  v_taxable:=least(coalesce(p_taxable_wages,0),greatest(0,coalesce(v_profile.wage_base,7000)-coalesce(p_ytd_fl_wages,0)));
  v_tax:=round(v_taxable*v_profile.employer_rate,2);
  return jsonb_build_object('jurisdiction','US-FL','tax_kind','reemployment','tax_year',2026,'employer_rate',v_profile.employer_rate,'wage_base',coalesce(v_profile.wage_base,7000),'taxable_wages',v_taxable,'employer_tax',v_tax,'employee_withholding',0,'worker_deduction_prohibited',true,'source_uri',coalesce(v_profile.source_uri,'https://floridarevenue.com/taxes/taxesfees/Pages/rt_rate.aspx'));
end $$;

create or replace function public.payroll_upsert_worker_jurisdiction(
 p_org_id uuid,p_worker_id uuid,p_residence_state text,p_work_state text,p_effective_from date,p_evidence_hash text,p_local_code text default null,p_remote_work boolean default false,p_reciprocity_code text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if not exists(select 1 from public.people_workers where id=p_worker_id and org_id=p_org_id) then raise exception 'worker_not_found'; end if;
 if nullif(btrim(coalesce(p_evidence_hash,'')),'') is null then raise exception 'jurisdiction_evidence_required'; end if;
 insert into public.payroll_worker_jurisdictions(org_id,worker_id,residence_state,work_state,local_code,remote_work,reciprocity_code,effective_from,evidence_hash,created_by)
 values(p_org_id,p_worker_id,upper(p_residence_state),upper(p_work_state),p_local_code,coalesce(p_remote_work,false),p_reciprocity_code,p_effective_from,btrim(p_evidence_hash),auth.uid())
 on conflict(org_id,worker_id,effective_from) do update set residence_state=excluded.residence_state,work_state=excluded.work_state,local_code=excluded.local_code,remote_work=excluded.remote_work,reciprocity_code=excluded.reciprocity_code,evidence_hash=excluded.evidence_hash,updated_at=now()
 returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_upsert_worker_deduction(
 p_org_id uuid,p_worker_id uuid,p_code text,p_name text,p_category text,p_taxability text,p_amount_type text,p_amount numeric,p_effective_from date,p_evidence_hash text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_def uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if p_taxability not in ('pretax_fit_fica','pretax_fit_only','posttax','unclassified') then raise exception 'invalid_taxability'; end if;
 insert into public.payroll_deduction_definitions(org_id,code,name,category,taxability,created_by)
 values(p_org_id,p_code,p_name,p_category,p_taxability,auth.uid())
 on conflict(org_id,code) do update set name=excluded.name,category=excluded.category,taxability=excluded.taxability,updated_at=now()
 returning id into v_def;
 insert into public.payroll_worker_deductions(org_id,worker_id,deduction_definition_id,amount_type,amount,effective_from,evidence_hash,created_by)
 values(p_org_id,p_worker_id,v_def,p_amount_type,p_amount,p_effective_from,btrim(p_evidence_hash),auth.uid()) returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_record_garnishment_order(
 p_org_id uuid,p_worker_id uuid,p_order_type text,p_authority text,p_case_reference text,p_amount_type text,p_amount numeric,p_priority integer,p_effective_from date,p_evidence_hash text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if nullif(btrim(coalesce(p_evidence_hash,'')),'') is null then raise exception 'garnishment_evidence_required'; end if;
 insert into public.payroll_garnishment_orders(org_id,worker_id,order_type,authority,case_reference,amount_type,amount,priority,effective_from,evidence_hash,created_by)
 values(p_org_id,p_worker_id,p_order_type,p_authority,p_case_reference,p_amount_type,p_amount,coalesce(p_priority,100),p_effective_from,btrim(p_evidence_hash),auth.uid()) returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_create_compliance_obligation(
 p_org_id uuid,p_run_id uuid,p_jurisdiction text,p_obligation_type text,p_form_code text,p_due_date date,p_amount numeric default null,p_provider_connection_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_cap text;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if p_provider_connection_id is not null then
   v_cap:=case p_obligation_type when 'tax.file' then 'tax.file' when 'tax.remit' then 'tax.remit' when 'year_end.forms' then 'year_end.forms' else null end;
   if v_cap is not null and not exists(select 1 from public.payroll_provider_connections where id=p_provider_connection_id and org_id=p_org_id and environment='production' and status='verified' and v_cap=any(capabilities) and nullif(btrim(verification_evidence_hash),'') is not null) then raise exception 'provider_evidence_required'; end if;
 end if;
 insert into public.payroll_compliance_obligations(org_id,run_id,jurisdiction,obligation_type,form_code,due_date,amount,execution_status,provider_connection_id,created_by)
 values(p_org_id,p_run_id,p_jurisdiction,p_obligation_type,p_form_code,p_due_date,p_amount,'prepared',p_provider_connection_id,auth.uid()) returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_create_payment_batch(
 p_org_id uuid,p_run_id uuid,p_payment_kind text,p_amount numeric,p_provider_connection_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_cap text;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 v_cap:=case p_payment_kind when 'ach' then 'payroll.disburse.ach' when 'paycard' then 'payroll.disburse.paycard' else null end;
 if p_provider_connection_id is not null and v_cap is not null and not exists(select 1 from public.payroll_provider_connections where id=p_provider_connection_id and org_id=p_org_id and environment='production' and status='verified' and v_cap=any(capabilities) and nullif(btrim(verification_evidence_hash),'') is not null) then raise exception 'provider_evidence_required'; end if;
 insert into public.payroll_payment_batches(org_id,run_id,payment_kind,amount,execution_status,provider_connection_id,created_by)
 values(p_org_id,p_run_id,p_payment_kind,p_amount,'prepared',p_provider_connection_id,auth.uid()) returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_record_gl_posting(
 p_org_id uuid,p_run_id uuid,p_journal_ref text,p_debit_total numeric,p_credit_total numeric,p_status text default 'draft',p_evidence_hash text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if p_status='posted' and (p_debit_total<>p_credit_total or nullif(btrim(coalesce(p_evidence_hash,'')),'') is null) then raise exception 'balanced_gl_evidence_required'; end if;
 insert into public.payroll_gl_postings(org_id,run_id,journal_ref,status,debit_total,credit_total,evidence_hash,created_by)
 values(p_org_id,p_run_id,p_journal_ref,p_status,p_debit_total,p_credit_total,p_evidence_hash,auth.uid())
 on conflict(org_id,run_id,journal_ref) do update set status=excluded.status,debit_total=excluded.debit_total,credit_total=excluded.credit_total,evidence_hash=excluded.evidence_hash,updated_at=now()
 returning id into v_id; return v_id;
end $$;

create or replace function public.payroll_scan_run_variances(p_org_id uuid,p_run_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_line record; v_prev record; v_count integer:=0; v_delta numeric;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if not exists(select 1 from public.payroll_runs where id=p_run_id and org_id=p_org_id) then raise exception 'payroll_run_not_found'; end if;
 for v_line in select l.*,r.pay_date from public.payroll_run_lines l join public.payroll_runs r on r.id=l.run_id and r.org_id=l.org_id where l.org_id=p_org_id and l.run_id=p_run_id loop
   select pl.gross_pay,pl.net_pay into v_prev from public.payroll_run_lines pl join public.payroll_runs pr on pr.id=pl.run_id and pr.org_id=pl.org_id where pl.org_id=p_org_id and pl.worker_id=v_line.worker_id and pl.run_id<>p_run_id and pr.status<>'void' and pr.pay_date<v_line.pay_date order by pr.pay_date desc limit 1;
   if found and coalesce(v_prev.gross_pay,0)>0 then
     v_delta:=round(((v_line.gross_pay-v_prev.gross_pay)/v_prev.gross_pay)*100,4);
     if abs(v_delta)>=20 then insert into public.payroll_variance_findings(org_id,run_id,worker_id,finding_type,severity,baseline_value,current_value,delta_percent,requires_review,details) values(p_org_id,p_run_id,v_line.worker_id,'gross_pay_change','warning',v_prev.gross_pay,v_line.gross_pay,v_delta,true,jsonb_build_object('threshold_percent',20)) on conflict(org_id,run_id,worker_id,finding_type) do update set baseline_value=excluded.baseline_value,current_value=excluded.current_value,delta_percent=excluded.delta_percent,status='open',requires_review=true,updated_at=now(); v_count:=v_count+1; end if;
   end if;
   if found and coalesce(v_prev.net_pay,0)>0 then
     v_delta:=round(((v_line.net_pay-v_prev.net_pay)/v_prev.net_pay)*100,4);
     if abs(v_delta)>=20 then insert into public.payroll_variance_findings(org_id,run_id,worker_id,finding_type,severity,baseline_value,current_value,delta_percent,requires_review,details) values(p_org_id,p_run_id,v_line.worker_id,'net_pay_change','warning',v_prev.net_pay,v_line.net_pay,v_delta,true,jsonb_build_object('threshold_percent',20)) on conflict(org_id,run_id,worker_id,finding_type) do update set baseline_value=excluded.baseline_value,current_value=excluded.current_value,delta_percent=excluded.delta_percent,status='open',requires_review=true,updated_at=now(); v_count:=v_count+1; end if;
   end if;
   if not exists(select 1 from public.payroll_tax_determinations d where d.org_id=p_org_id and d.run_id=p_run_id and d.worker_id=v_line.worker_id) then insert into public.payroll_variance_findings(org_id,run_id,worker_id,finding_type,severity,requires_review,details) values(p_org_id,p_run_id,v_line.worker_id,'missing_tax_determination','critical',true,'{"reason":"Federal tax determination evidence missing."}'::jsonb) on conflict(org_id,run_id,worker_id,finding_type) do update set status='open',requires_review=true,updated_at=now(); v_count:=v_count+1; end if;
   if coalesce(v_line.pretax_deductions,0)<>0 then insert into public.payroll_variance_findings(org_id,run_id,worker_id,finding_type,severity,current_value,requires_review,details) values(p_org_id,p_run_id,v_line.worker_id,'pretax_taxability_unclassified','critical',v_line.pretax_deductions,true,'{"reason":"Pretax taxability must be classified before governed tax determination."}'::jsonb) on conflict(org_id,run_id,worker_id,finding_type) do update set current_value=excluded.current_value,status='open',requires_review=true,updated_at=now(); v_count:=v_count+1; end if;
 end loop;
 return v_count;
end $$;

-- Execution transition remains fail-closed: authenticated provider evidence is required for externally asserted states.
create or replace function public.payroll_transition_external_record(
 p_org_id uuid,p_record_kind text,p_record_id uuid,p_execution_status text,p_provider_evidence_hash text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if p_execution_status in ('submitted','accepted','settled') and nullif(btrim(coalesce(p_provider_evidence_hash,'')),'') is null then raise exception 'provider_evidence_required'; end if;
 if p_record_kind='compliance' then update public.payroll_compliance_obligations set execution_status=p_execution_status,provider_evidence_hash=coalesce(nullif(btrim(p_provider_evidence_hash),''),provider_evidence_hash),updated_at=now() where id=p_record_id and org_id=p_org_id;
 elsif p_record_kind='payment' then update public.payroll_payment_batches set execution_status=p_execution_status,provider_evidence_hash=coalesce(nullif(btrim(p_provider_evidence_hash),''),provider_evidence_hash),updated_at=now() where id=p_record_id and org_id=p_org_id;
 else raise exception 'unsupported_external_record_kind'; end if;
end $$;

-- Auditing and mutable timestamp convention.
do $$ declare t text; begin
 foreach t in array array['payroll_employer_tax_profiles','payroll_worker_jurisdictions','payroll_deduction_definitions','payroll_worker_deductions','payroll_garnishment_orders','payroll_compliance_obligations','payroll_payment_batches','payroll_gl_postings','payroll_variance_findings'] loop
   execute format('drop trigger if exists %I on public.%I',t||'_audit',t);
   execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t||'_audit',t);
 end loop;
end $$;

revoke all on function public.payroll_upsert_employer_tax_profile(uuid,text,text,numeric,numeric,date,text,text) from public,anon;
revoke all on function public.payroll_calculate_fl_reemployment_2026(uuid,date,numeric,numeric) from public,anon;
revoke all on function public.payroll_upsert_worker_jurisdiction(uuid,uuid,text,text,date,text,text,boolean,text) from public,anon;
revoke all on function public.payroll_upsert_worker_deduction(uuid,uuid,text,text,text,text,text,numeric,date,text) from public,anon;
revoke all on function public.payroll_record_garnishment_order(uuid,uuid,text,text,text,text,numeric,integer,date,text) from public,anon;
revoke all on function public.payroll_create_compliance_obligation(uuid,uuid,text,text,text,date,numeric,uuid) from public,anon;
revoke all on function public.payroll_create_payment_batch(uuid,uuid,text,numeric,uuid) from public,anon;
revoke all on function public.payroll_record_gl_posting(uuid,uuid,text,numeric,numeric,text,text) from public,anon;
revoke all on function public.payroll_scan_run_variances(uuid,uuid) from public,anon;
revoke all on function public.payroll_transition_external_record(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.payroll_upsert_employer_tax_profile(uuid,text,text,numeric,numeric,date,text,text) to authenticated;
grant execute on function public.payroll_calculate_fl_reemployment_2026(uuid,date,numeric,numeric) to authenticated;
grant execute on function public.payroll_upsert_worker_jurisdiction(uuid,uuid,text,text,date,text,text,boolean,text) to authenticated;
grant execute on function public.payroll_upsert_worker_deduction(uuid,uuid,text,text,text,text,text,numeric,date,text) to authenticated;
grant execute on function public.payroll_record_garnishment_order(uuid,uuid,text,text,text,text,numeric,integer,date,text) to authenticated;
grant execute on function public.payroll_create_compliance_obligation(uuid,uuid,text,text,text,date,numeric,uuid) to authenticated;
grant execute on function public.payroll_create_payment_batch(uuid,uuid,text,numeric,uuid) to authenticated;
grant execute on function public.payroll_record_gl_posting(uuid,uuid,text,numeric,numeric,text,text) to authenticated;
grant execute on function public.payroll_scan_run_variances(uuid,uuid) to authenticated;
grant execute on function public.payroll_transition_external_record(uuid,text,uuid,text,text) to authenticated;

-- Terms intentionally preserved for contract/readiness traceability:
-- employer_rate_evidence_required rate_out_of_bounds worker_deduction_prohibited
-- provider_evidence_required execution_status prepared submitted settled failed
-- net_pay_change gross_pay_change missing_tax_determination pretax_taxability_unclassified requires_review
-- Florida authoritative source: https://floridarevenue.com/taxes/taxesfees/Pages/reemployment.aspx
