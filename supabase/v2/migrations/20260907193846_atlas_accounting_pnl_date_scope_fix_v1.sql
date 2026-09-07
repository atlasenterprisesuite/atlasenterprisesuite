create or replace function public.accounting_profit_and_loss(p_tenant_id uuid,p_org_id uuid,p_start_date date,p_end_date date)
returns table(account_id uuid,account_number text,account_name text,account_type text,amount numeric)
language plpgsql security invoker set search_path=public,pg_temp
as $$
begin
  if not public.has_identity_permission(p_tenant_id,p_org_id,'accounting.read') then raise exception 'accounting.read permission required'; end if;
  if p_end_date<p_start_date then raise exception 'Report end date must be on or after start date'; end if;
  return query
  select a.id,a.account_number,a.name,a.account_type,
         case when a.account_type='revenue'
              then coalesce(sum(case when j.id is not null then l.credit-l.debit else 0 end),0)
              else coalesce(sum(case when j.id is not null then l.debit-l.credit else 0 end),0)
         end::numeric
  from public.chart_of_accounts a
  left join public.journal_lines l
    on l.account_id=a.id and l.tenant_id=a.tenant_id and l.org_id=a.org_id
  left join public.journal_entries j
    on j.id=l.journal_entry_id and j.tenant_id=l.tenant_id and j.org_id=l.org_id
   and j.status in ('posted','reversed') and j.entry_date between p_start_date and p_end_date
  where a.tenant_id=p_tenant_id and a.org_id=p_org_id and a.account_type in ('revenue','expense')
  group by a.id,a.account_number,a.name,a.account_type
  order by a.account_type,a.account_number;
end;
$$;

revoke all on function public.accounting_profit_and_loss(uuid,uuid,date,date) from public,anon;
grant execute on function public.accounting_profit_and_loss(uuid,uuid,date,date) to authenticated;