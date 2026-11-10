create or replace function public.get_accounting_intercompany_candidates(
  organization_uuid uuid,
  group_uuid uuid,
  start_date_value date default null,
  end_date_value date default null
) returns table(
  line_id uuid,
  journal_id uuid,
  entry_number text,
  entry_date date,
  entity_id uuid,
  entity_code text,
  entity_name text,
  account_id uuid,
  account_number text,
  account_name text,
  debit numeric,
  credit numeric,
  functional_currency text,
  reporting_currency text,
  reporting_amount numeric,
  latest_match_id uuid,
  latest_match_reference text,
  latest_match_status text
)
language plpgsql
stable
set search_path to 'public','pg_temp'
as $$
declare
  group_org uuid;
  group_currency text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(organization_uuid) then raise exception 'Organization membership required'; end if;
  if start_date_value is not null and end_date_value is not null and end_date_value<start_date_value then
    raise exception 'Intercompany candidate end date must be on or after start date';
  end if;

  select org_id,reporting_currency into group_org,group_currency
  from public.accounting_consolidation_groups where id=group_uuid;
  if group_org is null or group_org<>organization_uuid then raise exception 'Consolidation group organization mismatch'; end if;

  return query
  select
    jl.id,
    je.id,
    je.entry_number,
    je.entry_date,
    e.id,
    e.code,
    e.legal_name,
    coa.id,
    coa.account_number,
    coa.name,
    coalesce(jl.debit,0),
    coalesce(jl.credit,0),
    coalesce(je.functional_currency,e.functional_currency),
    group_currency,
    round(abs(coalesce(jl.debit,0)-coalesce(jl.credit,0))
      * public.accounting_group_reporting_rate(
          organization_uuid,
          e.id,
          coalesce(je.functional_currency,e.functional_currency),
          group_currency,
          je.entry_date
        ),2),
    latest.id,
    latest.match_reference,
    latest.status
  from public.accounting_consolidation_members m
  join public.accounting_entities e on e.id=m.entity_id and e.org_id=organization_uuid
  join public.journal_entries je on je.entity_id=e.id and je.org_id=organization_uuid and je.status='posted'
  join public.journal_lines jl on jl.journal_entry_id=je.id and jl.org_id=organization_uuid
  join public.chart_of_accounts coa on coa.id=jl.account_id and coa.org_id=organization_uuid
  left join lateral (
    select ic.id,ic.match_reference,ic.status
    from public.accounting_intercompany_matches ic
    where ic.group_id=group_uuid
      and (ic.source_line_id=jl.id or ic.counterparty_line_id=jl.id)
    order by ic.created_at desc
    limit 1
  ) latest on true
  where m.group_id=group_uuid
    and je.entry_date between m.effective_from and coalesce(m.effective_to,'infinity'::date)
    and (start_date_value is null or je.entry_date>=start_date_value)
    and (end_date_value is null or je.entry_date<=end_date_value)
    and ((coalesce(jl.debit,0)>0 and coalesce(jl.credit,0)=0) or (coalesce(jl.credit,0)>0 and coalesce(jl.debit,0)=0))
  order by je.entry_date desc,je.entry_number,coa.account_number;
end;
$$;
