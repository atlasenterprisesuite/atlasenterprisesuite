-- ATLAS Payroll Operations tenant hardening.
-- Composite org-scoped foreign keys prevent cross-tenant references even when UUIDs are known.

create unique index if not exists people_workers_org_id_id_uq on public.people_workers(org_id,id);
create unique index if not exists payroll_runs_org_id_id_uq on public.payroll_runs(org_id,id);

alter table public.payroll_worker_jurisdictions
  drop constraint if exists payroll_worker_jurisdictions_org_worker_fk,
  add constraint payroll_worker_jurisdictions_org_worker_fk
    foreign key (org_id,worker_id) references public.people_workers(org_id,id) on delete restrict;

alter table public.payroll_worker_deductions
  drop constraint if exists payroll_worker_deductions_org_worker_fk,
  add constraint payroll_worker_deductions_org_worker_fk
    foreign key (org_id,worker_id) references public.people_workers(org_id,id) on delete restrict;

alter table public.payroll_garnishment_orders
  drop constraint if exists payroll_garnishment_orders_org_worker_fk,
  add constraint payroll_garnishment_orders_org_worker_fk
    foreign key (org_id,worker_id) references public.people_workers(org_id,id) on delete restrict;

alter table public.payroll_compliance_obligations
  drop constraint if exists payroll_compliance_obligations_org_run_fk,
  add constraint payroll_compliance_obligations_org_run_fk
    foreign key (org_id,run_id) references public.payroll_runs(org_id,id) on delete restrict;

alter table public.payroll_payment_batches
  drop constraint if exists payroll_payment_batches_org_run_fk,
  add constraint payroll_payment_batches_org_run_fk
    foreign key (org_id,run_id) references public.payroll_runs(org_id,id) on delete restrict;

alter table public.payroll_gl_postings
  drop constraint if exists payroll_gl_postings_org_run_fk,
  add constraint payroll_gl_postings_org_run_fk
    foreign key (org_id,run_id) references public.payroll_runs(org_id,id) on delete restrict;

alter table public.payroll_variance_findings
  drop constraint if exists payroll_variance_findings_org_run_fk,
  add constraint payroll_variance_findings_org_run_fk
    foreign key (org_id,run_id) references public.payroll_runs(org_id,id) on delete cascade;

alter table public.payroll_variance_findings
  drop constraint if exists payroll_variance_findings_org_worker_fk,
  add constraint payroll_variance_findings_org_worker_fk
    foreign key (org_id,worker_id) references public.people_workers(org_id,id) on delete cascade;

create or replace function public.payroll_scan_run_variances(p_org_id uuid,p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_line record;
  v_prev record;
  v_prev_found boolean;
  v_count integer:=0;
  v_delta numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
  if not exists(select 1 from public.payroll_runs where id=p_run_id and org_id=p_org_id) then raise exception 'payroll_run_not_found'; end if;

  for v_line in
    select l.*,r.pay_date
    from public.payroll_run_lines l
    join public.payroll_runs r on r.id=l.run_id and r.org_id=l.org_id
    where l.org_id=p_org_id and l.run_id=p_run_id
  loop
    select pl.gross_pay,pl.net_pay
      into v_prev
    from public.payroll_run_lines pl
    join public.payroll_runs pr on pr.id=pl.run_id and pr.org_id=pl.org_id
    where pl.org_id=p_org_id
      and pl.worker_id=v_line.worker_id
      and pl.run_id<>p_run_id
      and pr.status<>'void'
      and pr.pay_date<v_line.pay_date
    order by pr.pay_date desc
    limit 1;
    v_prev_found:=found;

    if v_prev_found and coalesce(v_prev.gross_pay,0)>0 then
      v_delta:=round(((v_line.gross_pay-v_prev.gross_pay)/v_prev.gross_pay)*100,4);
      if abs(v_delta)>=20 then
        insert into public.payroll_variance_findings(
          org_id,run_id,worker_id,finding_type,severity,baseline_value,current_value,delta_percent,requires_review,details
        ) values(
          p_org_id,p_run_id,v_line.worker_id,'gross_pay_change','warning',v_prev.gross_pay,v_line.gross_pay,v_delta,true,jsonb_build_object('threshold_percent',20)
        ) on conflict(org_id,run_id,worker_id,finding_type) do update set
          baseline_value=excluded.baseline_value,current_value=excluded.current_value,
          delta_percent=excluded.delta_percent,status='open',requires_review=true,updated_at=now();
        v_count:=v_count+1;
      end if;
    end if;

    if v_prev_found and coalesce(v_prev.net_pay,0)>0 then
      v_delta:=round(((v_line.net_pay-v_prev.net_pay)/v_prev.net_pay)*100,4);
      if abs(v_delta)>=20 then
        insert into public.payroll_variance_findings(
          org_id,run_id,worker_id,finding_type,severity,baseline_value,current_value,delta_percent,requires_review,details
        ) values(
          p_org_id,p_run_id,v_line.worker_id,'net_pay_change','warning',v_prev.net_pay,v_line.net_pay,v_delta,true,jsonb_build_object('threshold_percent',20)
        ) on conflict(org_id,run_id,worker_id,finding_type) do update set
          baseline_value=excluded.baseline_value,current_value=excluded.current_value,
          delta_percent=excluded.delta_percent,status='open',requires_review=true,updated_at=now();
        v_count:=v_count+1;
      end if;
    end if;

    if not exists(
      select 1 from public.payroll_tax_determinations d
      where d.org_id=p_org_id and d.run_id=p_run_id and d.worker_id=v_line.worker_id
    ) then
      insert into public.payroll_variance_findings(org_id,run_id,worker_id,finding_type,severity,requires_review,details)
      values(p_org_id,p_run_id,v_line.worker_id,'missing_tax_determination','critical',true,'{"reason":"Federal tax determination evidence missing."}'::jsonb)
      on conflict(org_id,run_id,worker_id,finding_type) do update set status='open',requires_review=true,updated_at=now();
      v_count:=v_count+1;
    end if;

    if coalesce(v_line.pretax_deductions,0)<>0 then
      insert into public.payroll_variance_findings(org_id,run_id,worker_id,finding_type,severity,current_value,requires_review,details)
      values(p_org_id,p_run_id,v_line.worker_id,'pretax_taxability_unclassified','critical',v_line.pretax_deductions,true,'{"reason":"Pretax taxability must be classified before governed tax determination."}'::jsonb)
      on conflict(org_id,run_id,worker_id,finding_type) do update set current_value=excluded.current_value,status='open',requires_review=true,updated_at=now();
      v_count:=v_count+1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Explicit RPC ownership checks produce deterministic errors instead of raw FK failures.
create or replace function public.payroll_record_garnishment_order(
 p_org_id uuid,p_worker_id uuid,p_order_type text,p_authority text,p_case_reference text,p_amount_type text,p_amount numeric,p_priority integer,p_effective_from date,p_evidence_hash text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if not exists(select 1 from public.people_workers where id=p_worker_id and org_id=p_org_id) then raise exception 'worker_not_found'; end if;
 if nullif(btrim(coalesce(p_evidence_hash,'')),'') is null then raise exception 'garnishment_evidence_required'; end if;
 insert into public.payroll_garnishment_orders(org_id,worker_id,order_type,authority,case_reference,amount_type,amount,priority,effective_from,evidence_hash,created_by)
 values(p_org_id,p_worker_id,p_order_type,p_authority,p_case_reference,p_amount_type,p_amount,coalesce(p_priority,100),p_effective_from,btrim(p_evidence_hash),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.payroll_create_payment_batch(
 p_org_id uuid,p_run_id uuid,p_payment_kind text,p_amount numeric,p_provider_connection_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_cap text;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if not exists(select 1 from public.payroll_runs where id=p_run_id and org_id=p_org_id) then raise exception 'payroll_run_not_found'; end if;
 v_cap:=case p_payment_kind when 'ach' then 'payroll.disburse.ach' when 'paycard' then 'payroll.disburse.paycard' else null end;
 if p_provider_connection_id is not null and v_cap is not null and not exists(
   select 1 from public.payroll_provider_connections
   where id=p_provider_connection_id and org_id=p_org_id and environment='production' and status='verified'
     and v_cap=any(capabilities) and nullif(btrim(verification_evidence_hash),'') is not null
 ) then raise exception 'provider_evidence_required'; end if;
 insert into public.payroll_payment_batches(org_id,run_id,payment_kind,amount,execution_status,provider_connection_id,created_by)
 values(p_org_id,p_run_id,p_payment_kind,p_amount,'prepared',p_provider_connection_id,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.payroll_record_gl_posting(
 p_org_id uuid,p_run_id uuid,p_journal_ref text,p_debit_total numeric,p_credit_total numeric,p_status text default 'draft',p_evidence_hash text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not public.has_identity_permission(p_org_id,'payroll.write') then raise exception 'payroll_write_required'; end if;
 if not exists(select 1 from public.payroll_runs where id=p_run_id and org_id=p_org_id) then raise exception 'payroll_run_not_found'; end if;
 if p_status='posted' and (p_debit_total<>p_credit_total or nullif(btrim(coalesce(p_evidence_hash,'')),'') is null) then raise exception 'balanced_gl_evidence_required'; end if;
 insert into public.payroll_gl_postings(org_id,run_id,journal_ref,status,debit_total,credit_total,evidence_hash,created_by)
 values(p_org_id,p_run_id,p_journal_ref,p_status,p_debit_total,p_credit_total,p_evidence_hash,auth.uid())
 on conflict(org_id,run_id,journal_ref) do update set status=excluded.status,debit_total=excluded.debit_total,credit_total=excluded.credit_total,evidence_hash=excluded.evidence_hash,updated_at=now()
 returning id into v_id;
 return v_id;
end $$;

revoke all on function public.payroll_record_garnishment_order(uuid,uuid,text,text,text,text,numeric,integer,date,text) from public,anon;
revoke all on function public.payroll_create_payment_batch(uuid,uuid,text,numeric,uuid) from public,anon;
revoke all on function public.payroll_record_gl_posting(uuid,uuid,text,numeric,numeric,text,text) from public,anon;
revoke all on function public.payroll_scan_run_variances(uuid,uuid) from public,anon;
grant execute on function public.payroll_record_garnishment_order(uuid,uuid,text,text,text,text,numeric,integer,date,text) to authenticated;
grant execute on function public.payroll_create_payment_batch(uuid,uuid,text,numeric,uuid) to authenticated;
grant execute on function public.payroll_record_gl_posting(uuid,uuid,text,numeric,numeric,text,text) to authenticated;
grant execute on function public.payroll_scan_run_variances(uuid,uuid) to authenticated;
