-- ATLAS Payroll Wave 2 persistence hardening.
-- Binds the deterministic 2026 federal calculator to a governed payroll run,
-- immutable W-4 election evidence, explicit YTD evidence and an immutable result.

create unique index if not exists payroll_tax_determinations_input_uq
  on public.payroll_tax_determinations(org_id,run_id,worker_id,input_hash)
  where run_id is not null;

create or replace function public.payroll_determine_us_federal_2026(
  p_org_id uuid,
  p_run_id uuid,
  p_worker_id uuid,
  p_ytd_social_security_wages numeric default 0,
  p_ytd_medicare_wages numeric default 0,
  p_ytd_futa_wages numeric default 0,
  p_ytd_evidence_hash text default null
) returns uuid
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_run record;
  v_line public.payroll_run_lines%rowtype;
  v_w4 public.payroll_federal_w4_elections%rowtype;
  v_output jsonb;
  v_input jsonb;
  v_input_hash text;
  v_rule_pack_id uuid;
  v_rule_checksum text;
  v_existing_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then
    raise exception 'payroll_write_required';
  end if;
  if least(
    coalesce(p_ytd_social_security_wages,0),
    coalesce(p_ytd_medicare_wages,0),
    coalesce(p_ytd_futa_wages,0)
  ) < 0 then
    raise exception 'negative_ytd_tax_input';
  end if;
  if greatest(
    coalesce(p_ytd_social_security_wages,0),
    coalesce(p_ytd_medicare_wages,0),
    coalesce(p_ytd_futa_wages,0)
  ) > 0 and nullif(btrim(coalesce(p_ytd_evidence_hash,'')),'') is null then
    raise exception 'ytd_evidence_required';
  end if;

  select r.id,r.org_id,r.pay_date,r.status,s.frequency
  into v_run
  from public.payroll_runs r
  left join public.payroll_schedules s
    on s.id=r.schedule_id and s.org_id=r.org_id
  where r.id=p_run_id and r.org_id=p_org_id
  for update of r;

  if not found then
    raise exception 'payroll_run_not_found';
  end if;
  if v_run.status not in ('draft','calculated') then
    raise exception 'payroll_run_not_editable';
  end if;
  if v_run.frequency is null then
    raise exception 'payroll_schedule_required_for_tax';
  end if;

  select l.*
  into v_line
  from public.payroll_run_lines l
  where l.org_id=p_org_id and l.run_id=p_run_id and l.worker_id=p_worker_id;

  if not found then
    raise exception 'payroll_line_not_found';
  end if;
  if coalesce(v_line.pretax_deductions,0) <> 0 then
    raise exception 'unsupported_pretax_taxability';
  end if;

  select w.*
  into v_w4
  from public.payroll_federal_w4_elections w
  where w.org_id=p_org_id
    and w.worker_id=p_worker_id
    and w.effective_from<=v_run.pay_date
  order by w.effective_from desc,w.created_at desc
  limit 1;

  if not found then
    raise exception 'w4_election_not_found';
  end if;

  select public.payroll_calculate_us_federal_2026(
    p_org_id,
    v_run.pay_date,
    v_run.frequency,
    v_line.gross_pay,
    v_line.gross_pay,
    v_line.gross_pay,
    coalesce(p_ytd_social_security_wages,0),
    coalesce(p_ytd_medicare_wages,0),
    coalesce(p_ytd_futa_wages,0),
    v_w4.form_year,
    v_w4.filing_status,
    v_w4.step2_checkbox,
    v_w4.step3_credits,
    v_w4.step4a_other_income,
    v_w4.step4b_deductions,
    v_w4.step4c_extra_withholding,
    v_w4.exempt,
    v_w4.nonresident_alien,
    'regular',
    false
  ) into v_output;

  v_rule_pack_id:=(v_output->>'rule_pack_id')::uuid;
  v_rule_checksum:=v_output->>'rule_checksum';

  v_input:=jsonb_build_object(
    'run_id',p_run_id,
    'worker_id',p_worker_id,
    'pay_date',v_run.pay_date,
    'frequency',v_run.frequency,
    'gross_pay',v_line.gross_pay,
    'taxable_wages',v_line.gross_pay,
    'fica_wages',v_line.gross_pay,
    'futa_wages',v_line.gross_pay,
    'ytd_social_security_wages',coalesce(p_ytd_social_security_wages,0),
    'ytd_medicare_wages',coalesce(p_ytd_medicare_wages,0),
    'ytd_futa_wages',coalesce(p_ytd_futa_wages,0),
    'ytd_evidence_hash',nullif(btrim(coalesce(p_ytd_evidence_hash,'')),''),
    'w4_election_id',v_w4.id,
    'w4_source_evidence_hash',v_w4.source_evidence_hash,
    'w4_form_year',v_w4.form_year,
    'filing_status',v_w4.filing_status,
    'step2_checkbox',v_w4.step2_checkbox,
    'step3_credits',v_w4.step3_credits,
    'step4a_other_income',v_w4.step4a_other_income,
    'step4b_deductions',v_w4.step4b_deductions,
    'step4c_extra_withholding',v_w4.step4c_extra_withholding,
    'exempt',v_w4.exempt,
    'nonresident_alien',v_w4.nonresident_alien,
    'wage_method','regular',
    'special_tax_treatment',false
  );

  v_input_hash:=encode(
    extensions.digest(convert_to(v_input::text,'UTF8'),'sha256'),
    'hex'
  );

  select d.id into v_existing_id
  from public.payroll_tax_determinations d
  where d.org_id=p_org_id
    and d.run_id=p_run_id
    and d.worker_id=p_worker_id
    and d.input_hash=v_input_hash
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.payroll_tax_determinations(
    org_id,run_id,worker_id,rule_pack_id,w4_election_id,pay_date,
    calculation_version,input_snapshot,output_snapshot,input_hash,rule_checksum,created_by
  ) values(
    p_org_id,p_run_id,p_worker_id,v_rule_pack_id,v_w4.id,v_run.pay_date,
    coalesce(v_output->>'rule_version','us-federal-2026-v1'),
    v_input,v_output,v_input_hash,v_rule_checksum,auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.payroll_determine_us_federal_2026(uuid,uuid,uuid,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.payroll_determine_us_federal_2026(uuid,uuid,uuid,numeric,numeric,numeric,text) to authenticated;
