create or replace function private.accounting_audit(
  p_tenant_id uuid,
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.audit_logs(
    tenant_id, org_id, actor_id, action, entity_type, entity_id,
    before_state, after_state, correlation_id
  ) values (
    p_tenant_id, p_org_id, auth.uid(), p_action, p_entity_type, p_entity_id,
    p_before, p_after, gen_random_uuid()
  );
end;
$$;

create or replace function public.ingest_bank_transaction_service(
  p_tenant_id uuid,
  p_org_id uuid,
  p_bank_account_id uuid,
  p_external_id text,
  p_posted_date date,
  p_description text,
  p_merchant text,
  p_amount numeric,
  p_currency text,
  p_source_state text,
  p_source_payload jsonb,
  p_source_fingerprint text
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_bank public.bank_accounts%rowtype;
  v_after jsonb;
begin
  if p_source_state not in ('imported','provider_live') then raise exception 'Service ingestion source_state must be imported or provider_live'; end if;
  if nullif(btrim(coalesce(p_external_id,'')),'') is null then raise exception 'External id is required for service ingestion'; end if;
  select * into v_bank from public.bank_accounts where id=p_bank_account_id and tenant_id=p_tenant_id and org_id=p_org_id;
  if v_bank.id is null then raise exception 'Bank account not found in scope'; end if;
  if upper(btrim(p_currency))<>v_bank.currency then raise exception 'Transaction currency must match bank account currency'; end if;
  if p_source_state='provider_live' and v_bank.connection_state<>'live' then raise exception 'Provider-live ingestion requires bank account live state'; end if;
  if p_source_state='provider_live' and coalesce(p_source_payload,'{}'::jsonb)='{}'::jsonb then raise exception 'Provider-live ingestion requires source payload evidence'; end if;

  insert into public.bank_transactions(
    tenant_id,org_id,bank_account_id,external_id,posted_date,description,merchant,
    amount,currency,source_state,source_payload,source_fingerprint,created_by
  ) values(
    p_tenant_id,p_org_id,p_bank_account_id,btrim(p_external_id),p_posted_date,btrim(p_description),
    nullif(btrim(coalesce(p_merchant,'')),''),p_amount,upper(btrim(p_currency)),p_source_state,
    coalesce(p_source_payload,'{}'::jsonb),nullif(btrim(coalesce(p_source_fingerprint,'')),''),null
  ) returning id into v_id;

  select to_jsonb(t) into v_after from public.bank_transactions t where id=v_id;
  insert into public.audit_logs(
    tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state,correlation_id
  ) values(
    p_tenant_id,p_org_id,null,'accounting.bank_transaction.ingest_service','bank_transactions',
    v_id::text,null,v_after,gen_random_uuid()
  );
  return v_id;
end;
$$;

create or replace function public.set_bank_provider_state_service(
  p_tenant_id uuid,
  p_org_id uuid,
  p_bank_account_id uuid,
  p_state text,
  p_provider text,
  p_provider_account_ref text,
  p_reported_balance numeric,
  p_balance_as_of timestamp with time zone,
  p_evidence jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if p_state not in ('not_configured','configured','live','unavailable') then raise exception 'Invalid provider state'; end if;
  select to_jsonb(b) into v_before from public.bank_accounts b where id=p_bank_account_id and tenant_id=p_tenant_id and org_id=p_org_id for update;
  if v_before is null then raise exception 'Bank account not found in scope'; end if;

  update public.bank_accounts set
    connection_state=p_state,
    provider=nullif(btrim(coalesce(p_provider,'')),''),
    provider_account_ref=nullif(btrim(coalesce(p_provider_account_ref,'')),''),
    reported_balance=p_reported_balance,
    balance_as_of=p_balance_as_of,
    source_evidence=coalesce(p_evidence,'{}'::jsonb),
    updated_at=now()
  where id=p_bank_account_id;

  select to_jsonb(b) into v_after from public.bank_accounts b where id=p_bank_account_id;
  insert into public.audit_logs(
    tenant_id,org_id,actor_id,action,entity_type,entity_id,before_state,after_state,correlation_id
  ) values(
    p_tenant_id,p_org_id,null,'accounting.bank_account.provider_state_service','bank_accounts',
    p_bank_account_id::text,v_before,v_after,gen_random_uuid()
  );
end;
$$;
