-- ATLAS Payroll Wave 2: evidence-backed US federal tax determination for 2026.
-- Scope is deliberately narrow: W-4 2020+ regular wages, federal FIT/FICA and gross FUTA.
-- State/local taxes, FUTA state credit, filing, remittance and disbursement remain fail-closed.

create table if not exists public.payroll_federal_w4_elections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.people_workers(id) on delete restrict,
  form_year integer not null check (form_year >= 2019),
  filing_status text not null check (filing_status in (
    'married_filing_jointly','single_or_married_filing_separately','head_of_household'
  )),
  step2_checkbox boolean not null default false,
  step3_credits numeric(16,2) not null default 0 check (step3_credits >= 0),
  step4a_other_income numeric(16,2) not null default 0 check (step4a_other_income >= 0),
  step4b_deductions numeric(16,2) not null default 0 check (step4b_deductions >= 0),
  step4c_extra_withholding numeric(16,2) not null default 0 check (step4c_extra_withholding >= 0),
  exempt boolean not null default false,
  nonresident_alien boolean not null default false,
  effective_from date not null,
  source_evidence_hash text not null check (nullif(btrim(source_evidence_hash),'') is not null),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(org_id,worker_id,effective_from),
  unique(org_id,id)
);
create index if not exists payroll_federal_w4_elections_worker_idx
  on public.payroll_federal_w4_elections(org_id,worker_id,effective_from desc);

create table if not exists public.payroll_tax_determinations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.payroll_runs(id) on delete restrict,
  worker_id uuid not null references public.people_workers(id) on delete restrict,
  rule_pack_id uuid not null references public.payroll_rule_packs(id) on delete restrict,
  w4_election_id uuid references public.payroll_federal_w4_elections(id) on delete restrict,
  pay_date date not null,
  jurisdiction_country text not null default 'US',
  jurisdiction_region text not null default 'FEDERAL',
  calculation_version text not null,
  input_snapshot jsonb not null,
  output_snapshot jsonb not null,
  input_hash text not null check (nullif(btrim(input_hash),'') is not null),
  rule_checksum text not null check (nullif(btrim(rule_checksum),'') is not null),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(org_id,id)
);
create index if not exists payroll_tax_determinations_run_worker_idx
  on public.payroll_tax_determinations(org_id,run_id,worker_id,created_at desc);

alter table public.payroll_federal_w4_elections enable row level security;
alter table public.payroll_tax_determinations enable row level security;

revoke all privileges on table public.payroll_federal_w4_elections from anon, authenticated;
revoke all privileges on table public.payroll_tax_determinations from anon, authenticated;
grant select on table public.payroll_federal_w4_elections to authenticated;
grant select on table public.payroll_tax_determinations to authenticated;

drop policy if exists payroll_federal_w4_elections_read on public.payroll_federal_w4_elections;
create policy payroll_federal_w4_elections_read on public.payroll_federal_w4_elections
for select to authenticated using (
  public.has_identity_permission(org_id,'payroll.read')
  or public.has_identity_permission(org_id,'payroll.write')
  or exists (
    select 1 from public.people_workers w
    where w.id=payroll_federal_w4_elections.worker_id
      and w.org_id=payroll_federal_w4_elections.org_id
      and w.user_id=(select auth.uid())
      and public.has_identity_permission(payroll_federal_w4_elections.org_id,'payroll.self')
  )
);

drop policy if exists payroll_tax_determinations_read on public.payroll_tax_determinations;
create policy payroll_tax_determinations_read on public.payroll_tax_determinations
for select to authenticated using (
  public.has_identity_permission(org_id,'payroll.read')
  or public.has_identity_permission(org_id,'payroll.write')
  or exists (
    select 1 from public.people_workers w
    where w.id=payroll_tax_determinations.worker_id
      and w.org_id=payroll_tax_determinations.org_id
      and w.user_id=(select auth.uid())
      and public.has_identity_permission(payroll_tax_determinations.org_id,'payroll.self')
  )
);

create or replace function public.payroll_tax_determination_immutable()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  raise exception 'payroll_tax_determination_immutable';
end;
$$;
drop trigger if exists payroll_tax_determination_immutable_guard on public.payroll_tax_determinations;
create trigger payroll_tax_determination_immutable_guard
before update or delete on public.payroll_tax_determinations
for each row execute function public.payroll_tax_determination_immutable();

drop trigger if exists payroll_federal_w4_elections_audit on public.payroll_federal_w4_elections;
create trigger payroll_federal_w4_elections_audit
after insert on public.payroll_federal_w4_elections
for each row execute function public.audit_row_change();

drop trigger if exists payroll_tax_determinations_audit on public.payroll_tax_determinations;
create trigger payroll_tax_determinations_audit
after insert on public.payroll_tax_determinations
for each row execute function public.audit_row_change();

-- Canonical IRS-sourced rule parameters. This exact JSON is integrity-checked in CI.
-- Source authorities:
-- https://www.irs.gov/publications/p15t
-- https://www.irs.gov/publications/p15
-- https://www.irs.gov/taxtopics/tc751
insert into public.payroll_rule_packs(
  org_id,scope,jurisdiction_country,jurisdiction_region,jurisdiction_local,
  rule_version,source_uri,source_published_at,effective_from,effective_to,
  verified_at,checksum,status,parameters
)
select
  null,'platform','US','FEDERAL',null,
  'us-federal-2026-v1','https://www.irs.gov/publications/p15t',null,
  date '2026-01-01',date '2026-12-31',now(),
  'd12f065c13049b51362820958d48c94eca0334089d85f002444244725712656b','active',
  $atlas_rule${"annual_percentage_tables":{"standard":{"head_of_household":[[0,15550,0,0],[15550,33250,0,0.1],[33250,83000,1770,0.12],[83000,121250,7740,0.22],[121250,217300,16155,0.24],[217300,271750,39207,0.32],[271750,656150,56631,0.35],[656150,null,191171,0.37]],"married_filing_jointly":[[0,19300,0,0],[19300,44100,0,0.1],[44100,120100,2480,0.12],[120100,230700,11600,0.22],[230700,422850,35932,0.24],[422850,531750,82048,0.32],[531750,788000,116896,0.35],[788000,null,206583.5,0.37]],"single_or_married_filing_separately":[[0,7500,0,0],[7500,19900,0,0.1],[19900,57900,1240,0.12],[57900,113200,5800,0.22],[113200,209275,17966,0.24],[209275,263725,41024,0.32],[263725,648100,58448,0.35],[648100,null,192979.25,0.37]]},"step2_checkbox":{"head_of_household":[[0,12075,0,0],[12075,20925,0,0.1],[20925,45800,885,0.12],[45800,64925,3870,0.22],[64925,112950,8077.5,0.24],[112950,140175,19603.5,0.32],[140175,332375,28315.5,0.35],[332375,null,95585.5,0.37]],"married_filing_jointly":[[0,16100,0,0],[16100,28500,0,0.1],[28500,66500,1240,0.12],[66500,121800,5800,0.22],[121800,217875,17966,0.24],[217875,272325,41024,0.32],[272325,400450,58448,0.35],[400450,null,103291.75,0.37]],"single_or_married_filing_separately":[[0,8050,0,0],[8050,14250,0,0.1],[14250,33250,620,0.12],[33250,60900,2900,0.22],[60900,108938,8983,0.24],[108938,136163,20512,0.32],[136163,328350,29224,0.35],[328350,null,96489.63,0.37]]}},"coverage_level":"federal_standard_employee","engine_status":"production","fica":{"additional_medicare_employee_rate":0.009,"additional_medicare_employer_match_rate":0,"additional_medicare_employer_threshold":200000,"medicare_employee_rate":0.0145,"medicare_employer_rate":0.0145,"social_security_employee_rate":0.062,"social_security_employer_rate":0.062,"social_security_wage_base":184500},"futa":{"gross_rate":0.06,"maximum_state_credit_rate":0.054,"net_rate_if_full_credit":0.006,"state_credit_requires_evidence":true,"wage_base":7000},"method":"irs-pub-15-t-worksheet-1a","pay_periods":{"biweekly":26,"monthly":12,"semimonthly":24,"weekly":52},"sources":["https://www.irs.gov/publications/p15t","https://www.irs.gov/publications/p15","https://www.irs.gov/taxtopics/tc751"],"supported":{"filing_statuses":["married_filing_jointly","single_or_married_filing_separately","head_of_household"],"nonresident_alien":false,"special_tax_treatment":false,"w4_min_year":2020,"wage_methods":["regular"]},"tax_year":2026,"w4_adjustment":{"married_filing_jointly":12900,"other":8600}}$atlas_rule$::jsonb
where not exists (
  select 1 from public.payroll_rule_packs rp
  where rp.scope='platform' and rp.org_id is null
    and rp.jurisdiction_country='US' and rp.jurisdiction_region='FEDERAL'
    and rp.rule_version='us-federal-2026-v1'
);

create or replace function public.payroll_record_federal_w4_election(
  p_org_id uuid,
  p_worker_id uuid,
  p_form_year integer,
  p_filing_status text,
  p_step2_checkbox boolean default false,
  p_step3_credits numeric default 0,
  p_step4a_other_income numeric default 0,
  p_step4b_deductions numeric default 0,
  p_step4c_extra_withholding numeric default 0,
  p_exempt boolean default false,
  p_nonresident_alien boolean default false,
  p_effective_from date default current_date,
  p_source_evidence_hash text default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if not exists(select 1 from public.people_workers w where w.id=p_worker_id and w.org_id=p_org_id) then
    raise exception 'worker_not_found';
  end if;
  if p_filing_status not in ('married_filing_jointly','single_or_married_filing_separately','head_of_household') then
    raise exception 'unsupported_filing_status';
  end if;
  if p_form_year < 2019 then raise exception 'unsupported_w4_year'; end if;
  if p_source_evidence_hash is null or nullif(btrim(p_source_evidence_hash),'') is null then
    raise exception 'w4_source_evidence_required';
  end if;
  if coalesce(p_step3_credits,0)<0 or coalesce(p_step4a_other_income,0)<0 or coalesce(p_step4b_deductions,0)<0 or coalesce(p_step4c_extra_withholding,0)<0 then
    raise exception 'negative_w4_input';
  end if;
  insert into public.payroll_federal_w4_elections(
    org_id,worker_id,form_year,filing_status,step2_checkbox,step3_credits,step4a_other_income,
    step4b_deductions,step4c_extra_withholding,exempt,nonresident_alien,effective_from,
    source_evidence_hash,created_by
  ) values(
    p_org_id,p_worker_id,p_form_year,p_filing_status,coalesce(p_step2_checkbox,false),coalesce(p_step3_credits,0),
    coalesce(p_step4a_other_income,0),coalesce(p_step4b_deductions,0),coalesce(p_step4c_extra_withholding,0),
    coalesce(p_exempt,false),coalesce(p_nonresident_alien,false),p_effective_from,btrim(p_source_evidence_hash),auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.payroll_calculate_us_federal_2026(
  p_org_id uuid,
  p_pay_date date,
  p_frequency text,
  p_taxable_wages numeric,
  p_fica_wages numeric,
  p_futa_wages numeric,
  p_ytd_social_security_wages numeric default 0,
  p_ytd_medicare_wages numeric default 0,
  p_ytd_futa_wages numeric default 0,
  p_w4_year integer default 2020,
  p_filing_status text default 'single_or_married_filing_separately',
  p_step2_checkbox boolean default false,
  p_step3_credits numeric default 0,
  p_step4a_other_income numeric default 0,
  p_step4b_deductions numeric default 0,
  p_step4c_extra_withholding numeric default 0,
  p_exempt boolean default false,
  p_nonresident_alien boolean default false,
  p_wage_method text default 'regular',
  p_special_tax_treatment boolean default false
) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_rule public.payroll_rule_packs%rowtype;
  v_params jsonb;
  v_periods numeric;
  v_adjustment numeric;
  v_annual_adjusted numeric;
  v_table jsonb;
  v_row jsonb;
  v_lower numeric;
  v_upper numeric;
  v_base numeric;
  v_rate numeric;
  v_annual_tax numeric:=0;
  v_fit numeric:=0;
  v_ss_base numeric;
  v_ss_taxable numeric;
  v_ss_employee numeric;
  v_ss_employer numeric;
  v_medicare_employee numeric;
  v_medicare_employer numeric;
  v_addl_threshold numeric;
  v_addl_taxable numeric;
  v_addl_employee numeric;
  v_futa_base numeric;
  v_futa_taxable numeric;
  v_futa_gross numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (
    public.has_identity_permission(p_org_id,'payroll.read') or
    public.has_identity_permission(p_org_id,'payroll.write')
  ) then raise exception 'payroll_permission_required'; end if;
  if p_pay_date is null or extract(year from p_pay_date)::integer <> 2026 then raise exception 'unsupported_tax_year'; end if;
  if p_w4_year < 2020 then raise exception 'unsupported_w4_year'; end if;
  if coalesce(p_nonresident_alien,false) then raise exception 'unsupported_nonresident_alien'; end if;
  if coalesce(p_wage_method,'') <> 'regular' then raise exception 'unsupported_wage_method'; end if;
  if coalesce(p_special_tax_treatment,false) then raise exception 'unsupported_special_tax_treatment'; end if;
  if p_frequency not in ('weekly','biweekly','semimonthly','monthly') then raise exception 'unsupported_pay_frequency'; end if;
  if p_filing_status not in ('married_filing_jointly','single_or_married_filing_separately','head_of_household') then raise exception 'unsupported_filing_status'; end if;
  if least(coalesce(p_taxable_wages,0),coalesce(p_fica_wages,0),coalesce(p_futa_wages,0),
           coalesce(p_ytd_social_security_wages,0),coalesce(p_ytd_medicare_wages,0),coalesce(p_ytd_futa_wages,0),
           coalesce(p_step3_credits,0),coalesce(p_step4a_other_income,0),coalesce(p_step4b_deductions,0),coalesce(p_step4c_extra_withholding,0)) < 0 then
    raise exception 'negative_tax_input';
  end if;

  select rp.* into v_rule
  from public.payroll_rule_packs rp
  where rp.scope='platform' and rp.org_id is null
    and rp.jurisdiction_country='US' and rp.jurisdiction_region='FEDERAL'
    and rp.status='active'
    and rp.effective_from <= p_pay_date and (rp.effective_to is null or rp.effective_to >= p_pay_date)
    and rp.parameters ->> 'coverage_level' = 'federal_standard_employee'
    and rp.parameters ->> 'engine_status' = 'production'
    and rp.checksum='d12f065c13049b51362820958d48c94eca0334089d85f002444244725712656b'
  order by rp.effective_from desc
  limit 1;
  if v_rule.id is null then raise exception 'federal_rule_pack_unavailable'; end if;

  v_params:=v_rule.parameters;
  v_periods:=(v_params->'pay_periods'->>p_frequency)::numeric;
  v_adjustment:=case when coalesce(p_step2_checkbox,false) then 0
    when p_filing_status='married_filing_jointly' then (v_params->'w4_adjustment'->>'married_filing_jointly')::numeric
    else (v_params->'w4_adjustment'->>'other')::numeric end;
  v_annual_adjusted:=greatest(0,
    coalesce(p_taxable_wages,0)*v_periods + coalesce(p_step4a_other_income,0)
    - coalesce(p_step4b_deductions,0) - v_adjustment
  );

  if not coalesce(p_exempt,false) then
    v_table:=v_params->'annual_percentage_tables'->case when coalesce(p_step2_checkbox,false) then 'step2_checkbox' else 'standard' end->p_filing_status;
    for v_row in select value from jsonb_array_elements(v_table)
    loop
      v_lower:=(v_row->>0)::numeric;
      v_upper:=case when jsonb_typeof(v_row->1)='null' then null else (v_row->>1)::numeric end;
      if v_annual_adjusted >= v_lower and (v_upper is null or v_annual_adjusted < v_upper) then
        v_base:=(v_row->>2)::numeric;
        v_rate:=(v_row->>3)::numeric;
        v_annual_tax:=v_base + (v_annual_adjusted-v_lower)*v_rate;
        exit;
      end if;
    end loop;
    v_fit:=round(greatest(0,v_annual_tax/v_periods-coalesce(p_step3_credits,0)/v_periods)+coalesce(p_step4c_extra_withholding,0),2);
  end if;

  v_ss_base:=(v_params->'fica'->>'social_security_wage_base')::numeric;
  v_ss_taxable:=least(coalesce(p_fica_wages,0),greatest(0,v_ss_base-coalesce(p_ytd_social_security_wages,0)));
  v_ss_employee:=round(v_ss_taxable*(v_params->'fica'->>'social_security_employee_rate')::numeric,2);
  v_ss_employer:=round(v_ss_taxable*(v_params->'fica'->>'social_security_employer_rate')::numeric,2);
  v_medicare_employee:=round(coalesce(p_fica_wages,0)*(v_params->'fica'->>'medicare_employee_rate')::numeric,2);
  v_medicare_employer:=round(coalesce(p_fica_wages,0)*(v_params->'fica'->>'medicare_employer_rate')::numeric,2);
  v_addl_threshold:=(v_params->'fica'->>'additional_medicare_employer_threshold')::numeric;
  v_addl_taxable:=greatest(0,coalesce(p_ytd_medicare_wages,0)+coalesce(p_fica_wages,0)-v_addl_threshold)
    - greatest(0,coalesce(p_ytd_medicare_wages,0)-v_addl_threshold);
  v_addl_employee:=round(v_addl_taxable*(v_params->'fica'->>'additional_medicare_employee_rate')::numeric,2);

  v_futa_base:=(v_params->'futa'->>'wage_base')::numeric;
  v_futa_taxable:=least(coalesce(p_futa_wages,0),greatest(0,v_futa_base-coalesce(p_ytd_futa_wages,0)));
  v_futa_gross:=round(v_futa_taxable*(v_params->'futa'->>'gross_rate')::numeric,2);

  return jsonb_build_object(
    'tax_year',2026,
    'jurisdiction','US-FEDERAL',
    'coverage_level','federal_standard_employee',
    'rule_pack_id',v_rule.id,
    'rule_version',v_rule.rule_version,
    'rule_checksum',v_rule.checksum,
    'federal_income_tax',v_fit,
    'social_security_taxable_wages',v_ss_taxable,
    'social_security_employee',v_ss_employee,
    'social_security_employer',v_ss_employer,
    'medicare_employee',v_medicare_employee,
    'medicare_employer',v_medicare_employer,
    'additional_medicare_taxable_wages',v_addl_taxable,
    'additional_medicare_employee',v_addl_employee,
    'additional_medicare_employer',0,
    'futa_taxable_wages',v_futa_taxable,
    'futa_gross_tax',v_futa_gross,
    'futa_net_tax',null,
    'state_credit_status','evidence_required',
    'state_local_status','state_local_coverage_required',
    'source_uris',v_params->'sources'
  );
end;
$$;

-- Keep Wave 1 readiness truthful: a federal-only pack is useful but is not complete US tax determination.
create or replace function public.payroll_get_capability_readiness(p_org_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_pay_date date;
  v_full_rule_pack_id uuid;
  v_federal_rule_pack_id uuid;
  v_tax_provider record;
  v_filing_provider record;
  v_remit_provider record;
  v_ach_provider record;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (public.has_identity_permission(p_org_id,'payroll.read') or public.has_identity_permission(p_org_id,'payroll.write')) then
    raise exception 'payroll_permission_required';
  end if;

  select r.pay_date into v_pay_date from public.payroll_runs r
  where r.org_id=p_org_id and r.status not in ('locked','void')
  order by case when r.pay_date>=current_date then 0 else 1 end,r.pay_date desc limit 1;
  v_pay_date:=coalesce(v_pay_date,current_date);

  select rp.id into v_full_rule_pack_id from public.payroll_rule_packs rp
  where (rp.org_id=p_org_id or rp.org_id is null) and rp.status='active'
    and rp.jurisdiction_country='US' and rp.effective_from<=v_pay_date
    and (rp.effective_to is null or rp.effective_to>=v_pay_date)
    and rp.verified_at is not null and nullif(btrim(rp.checksum),'') is not null
    and rp.parameters ->> 'engine_status' = 'production'
    and rp.parameters ->> 'coverage_level' = 'full_us_payroll_tax'
  order by case when rp.org_id=p_org_id then 0 else 1 end,rp.effective_from desc limit 1;

  select rp.id into v_federal_rule_pack_id from public.payroll_rule_packs rp
  where rp.org_id is null and rp.scope='platform' and rp.status='active'
    and rp.jurisdiction_country='US' and rp.jurisdiction_region='FEDERAL'
    and rp.effective_from<=v_pay_date and (rp.effective_to is null or rp.effective_to>=v_pay_date)
    and rp.parameters ->> 'coverage_level' = 'federal_standard_employee'
    and rp.parameters ->> 'engine_status' = 'production'
  order by rp.effective_from desc limit 1;

  select pc.id,pc.provider_key into v_tax_provider from public.payroll_provider_connections pc
  where pc.org_id=p_org_id and pc.environment='production' and pc.status='verified'
    and 'tax.calculate'=any(pc.capabilities) order by pc.last_verified_at desc limit 1;
  select pc.id,pc.provider_key into v_filing_provider from public.payroll_provider_connections pc
  where pc.org_id=p_org_id and pc.environment='production' and pc.status='verified'
    and 'tax.file'=any(pc.capabilities) order by pc.last_verified_at desc limit 1;
  select pc.id,pc.provider_key into v_remit_provider from public.payroll_provider_connections pc
  where pc.org_id=p_org_id and pc.environment='production' and pc.status='verified'
    and 'tax.remit'=any(pc.capabilities) order by pc.last_verified_at desc limit 1;
  select pc.id,pc.provider_key into v_ach_provider from public.payroll_provider_connections pc
  where pc.org_id=p_org_id and pc.environment='production' and pc.status='verified'
    and 'payroll.disburse.ach'=any(pc.capabilities) order by pc.last_verified_at desc limit 1;

  return jsonb_build_object(
    'as_of',now(),'pay_date',v_pay_date,
    'capabilities',jsonb_build_object(
      'tax_determination',case
        when v_full_rule_pack_id is not null then jsonb_build_object('status','ready','severity','INFO','reason','Complete verified US payroll-tax rule coverage is available.','rule_pack_id',v_full_rule_pack_id)
        when v_tax_provider.id is not null then jsonb_build_object('status','ready','severity','INFO','reason','A verified production tax-calculation provider is available.','provider_key',v_tax_provider.provider_key,'provider_connection_id',v_tax_provider.id)
        when v_federal_rule_pack_id is not null then jsonb_build_object('status','blocked','severity','P0_BLOCKER','reason','Federal 2026 determination is available, but required state/local payroll-tax coverage is not complete.','rule_pack_id',v_federal_rule_pack_id)
        else jsonb_build_object('status','blocked','severity','P0_BLOCKER','reason','No complete production tax determination coverage is available.') end,
      'tax_filing',case when v_filing_provider.id is not null
        then jsonb_build_object('status','ready','severity','INFO','reason','A verified production tax-filing provider is configured.','provider_key',v_filing_provider.provider_key,'provider_connection_id',v_filing_provider.id)
        else jsonb_build_object('status','blocked','severity','P0_BLOCKER','reason','No verified production tax-filing provider is configured.') end,
      'tax_remittance',case when v_remit_provider.id is not null
        then jsonb_build_object('status','ready','severity','INFO','reason','A verified production tax-remittance provider is configured.','provider_key',v_remit_provider.provider_key,'provider_connection_id',v_remit_provider.id)
        else jsonb_build_object('status','blocked','severity','P0_BLOCKER','reason','No verified production tax-remittance provider is configured.') end,
      'direct_deposit',case when v_ach_provider.id is not null
        then jsonb_build_object('status','ready','severity','INFO','reason','A verified production ACH payroll provider is configured.','provider_key',v_ach_provider.provider_key,'provider_connection_id',v_ach_provider.id)
        else jsonb_build_object('status','blocked','severity','P0_BLOCKER','reason','No verified production ACH payroll provider is configured.') end
    )
  );
end;
$$;

revoke all on function public.payroll_record_federal_w4_election(uuid,uuid,integer,text,boolean,numeric,numeric,numeric,numeric,boolean,boolean,date,text) from public,anon;
grant execute on function public.payroll_record_federal_w4_election(uuid,uuid,integer,text,boolean,numeric,numeric,numeric,numeric,boolean,boolean,date,text) to authenticated;
revoke all on function public.payroll_calculate_us_federal_2026(uuid,date,text,numeric,numeric,numeric,numeric,numeric,numeric,integer,text,boolean,numeric,numeric,numeric,numeric,boolean,boolean,text,boolean) from public,anon;
grant execute on function public.payroll_calculate_us_federal_2026(uuid,date,text,numeric,numeric,numeric,numeric,numeric,numeric,integer,text,boolean,numeric,numeric,numeric,numeric,boolean,boolean,text,boolean) to authenticated;
revoke all on function public.payroll_get_capability_readiness(uuid) from public,anon;
grant execute on function public.payroll_get_capability_readiness(uuid) to authenticated;
