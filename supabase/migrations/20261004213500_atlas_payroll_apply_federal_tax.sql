-- Apply an immutable federal 2026 tax determination to an editable payroll line.
-- This removes manual tax-entry drift while preserving the determination as source evidence.

create or replace function public.payroll_apply_federal_tax_to_line(
  p_org_id uuid,
  p_run_id uuid,
  p_worker_id uuid,
  p_determination_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_status text;
  v_line public.payroll_run_lines%rowtype;
  v_det public.payroll_tax_determinations%rowtype;
  v_tax numeric;
  v_net numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;

  select status into v_status
  from public.payroll_runs
  where id=p_run_id and org_id=p_org_id
  for update;
  if not found then raise exception 'payroll_run_not_found'; end if;
  if v_status not in ('draft','calculated') then raise exception 'payroll_run_not_editable'; end if;

  select * into v_line
  from public.payroll_run_lines
  where org_id=p_org_id and run_id=p_run_id and worker_id=p_worker_id
  for update;
  if not found then raise exception 'payroll_line_not_found'; end if;

  if p_determination_id is null then
    select * into v_det
    from public.payroll_tax_determinations
    where org_id=p_org_id and run_id=p_run_id and worker_id=p_worker_id
      and jurisdiction_country='US' and jurisdiction_region='FEDERAL'
    order by created_at desc limit 1;
  else
    select * into v_det
    from public.payroll_tax_determinations
    where id=p_determination_id and org_id=p_org_id and run_id=p_run_id and worker_id=p_worker_id
      and jurisdiction_country='US' and jurisdiction_region='FEDERAL';
  end if;
  if not found then raise exception 'federal_tax_determination_required'; end if;

  v_tax:=round(
    coalesce((v_det.output_snapshot->>'federal_income_tax')::numeric,0)
    + coalesce((v_det.output_snapshot->>'social_security_employee')::numeric,0)
    + coalesce((v_det.output_snapshot->>'medicare_employee')::numeric,0)
    + coalesce((v_det.output_snapshot->>'additional_medicare_employee')::numeric,0),2
  );
  v_net:=round(v_line.gross_pay-v_line.pretax_deductions-v_tax-v_line.posttax_deductions,2);
  if v_net<0 then raise exception 'taxes_exceed_gross_pay'; end if;

  update public.payroll_run_lines
  set taxes_withheld=v_tax,
      net_pay=v_net,
      calculation=coalesce(calculation,'{}'::jsonb)||jsonb_build_object(
        'tax_source','federal_2026_determination',
        'tax_determination_id',v_det.id,
        'tax_rule_checksum',v_det.rule_checksum,
        'tax_applied_at',now(),
        'tax_applied_by',auth.uid(),
        'direct_deposit_executed',false,
        'tax_filing_executed',false
      )
  where id=v_line.id and org_id=p_org_id;

  update public.payroll_runs
  set status='draft',approved_by=null,approved_at=null
  where id=p_run_id and org_id=p_org_id;

  return v_line.id;
end;
$$;

revoke all on function public.payroll_apply_federal_tax_to_line(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.payroll_apply_federal_tax_to_line(uuid,uuid,uuid,uuid) to authenticated;
