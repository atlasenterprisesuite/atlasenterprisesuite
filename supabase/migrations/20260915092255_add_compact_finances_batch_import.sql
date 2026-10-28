create or replace function public.import_finances_accounting_batch_v3(
  organization_uuid uuid,
  entity_code_value text,
  rows_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entity_uuid uuid;
  row_total integer := 0;
  resolved_total integer := 0;
  affected_total integer := 0;
begin
  if auth.uid() is null and session_user <> 'postgres' then
    raise exception 'Authentication required';
  end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if auth.uid() is not null and not public.can_write_accounting_data(organization_uuid) then
    raise exception 'Accounting role required';
  end if;
  if rows_value is null or jsonb_typeof(rows_value) <> 'array' then raise exception 'Rows must be a JSON array'; end if;

  select id into entity_uuid
  from public.accounting_entities
  where org_id=organization_uuid and code=btrim(entity_code_value) and active
  limit 1;
  if entity_uuid is null then raise exception 'Active accounting entity not found'; end if;

  row_total := jsonb_array_length(rows_value);
  if row_total=0 then return jsonb_build_object('processed',0,'affected',0,'entity_id',entity_uuid); end if;
  if row_total>1000 then raise exception 'Maximum batch size is 1000'; end if;

  with s as (
    select
      (x->>'b')::uuid bank_account_id,
      nullif(btrim(x->>'t'),'') external_id,
      (x->>'d')::date posted_date,
      (x->>'v')::numeric amount,
      nullif(btrim(x->>'c'),'') category_primary,
      nullif(btrim(x->>'e'),'') category_detailed,
      nullif(btrim(x->>'q'),'') category_confidence,
      nullif(btrim(x->>'x'),'') transfer_transaction_id,
      case when nullif(btrim(x->>'y'),'') is null then null else (x->>'y')::uuid end transfer_bank_account_id,
      coalesce((x->>'r')::integer,0)<>0 reconstructed_from_counterpart
    from jsonb_array_elements(rows_value) x
  ), r as (
    select s.* from s join public.accounting_bank_accounts b
      on b.id=s.bank_account_id and b.org_id=organization_uuid and b.provider='Finances'
    where s.external_id is not null and s.posted_date is not null and s.amount is not null
  ) select count(*) into resolved_total from r;

  if resolved_total<>row_total then
    raise exception 'Every imported row must resolve to a valid Finances bank account and required transaction fields';
  end if;

  with s as (
    select
      (x->>'b')::uuid bank_account_id,
      nullif(btrim(x->>'t'),'') external_id,
      (x->>'d')::date posted_date,
      (x->>'v')::numeric amount,
      nullif(btrim(x->>'c'),'') category_primary,
      nullif(btrim(x->>'e'),'') category_detailed,
      nullif(btrim(x->>'q'),'') category_confidence,
      nullif(btrim(x->>'x'),'') transfer_transaction_id,
      case when nullif(btrim(x->>'y'),'') is null then null else (x->>'y')::uuid end transfer_bank_account_id,
      coalesce((x->>'r')::integer,0)<>0 reconstructed_from_counterpart
    from jsonb_array_elements(rows_value) x
  ), r as (
    select s.* from s join public.accounting_bank_accounts b
      on b.id=s.bank_account_id and b.org_id=organization_uuid and b.provider='Finances'
  )
  insert into public.accounting_transactions(
    org_id,entity_id,bank_account_id,external_id,posted_date,description,merchant,
    amount,currency,confidence,status,evidence_state,review_reason,dimension,fingerprint,source_payload
  )
  select
    organization_uuid,entity_uuid,r.bank_account_id,r.external_id,r.posted_date,
    coalesce(r.category_detailed,r.category_primary,'Imported financial transaction'),null,
    r.amount,'USD',
    case r.category_confidence when 'V' then 0.99 when 'H' then 0.90 when 'M' then 0.65 when 'L' then 0.35 else 0.25 end,
    'needs_review','not_required','Imported from connected financial account; accounting classification pending.',
    jsonb_strip_nulls(jsonb_build_object(
      'category_primary',r.category_primary,'category_detailed',r.category_detailed,
      'transfer_transaction_id',r.transfer_transaction_id,'transfer_bank_account_id',r.transfer_bank_account_id
    )),
    md5(r.bank_account_id::text||'|'||r.external_id||'|'||r.posted_date::text||'|'||r.amount::text),
    jsonb_strip_nulls(jsonb_build_object(
      'source','Finances','privacy_mode','provider_ids_hashed','category_primary',r.category_primary,
      'category_detailed',r.category_detailed,'category_confidence',r.category_confidence,
      'transfer_transaction_id',r.transfer_transaction_id,'transfer_bank_account_id',r.transfer_bank_account_id,
      'reconstructed_from_counterpart',r.reconstructed_from_counterpart,
      'import_batch','initial_finances_full_history_2026_09_15'
    ))
  from r
  on conflict (org_id,bank_account_id,external_id) where external_id is not null
  do update set
    entity_id=excluded.entity_id,posted_date=excluded.posted_date,description=excluded.description,
    amount=excluded.amount,currency=excluded.currency,confidence=excluded.confidence,
    fingerprint=excluded.fingerprint,source_payload=excluded.source_payload,dimension=excluded.dimension,
    updated_at=now();

  get diagnostics affected_total=row_count;

  update public.accounting_bank_accounts
  set entity_id=entity_uuid,updated_at=now()
  where org_id=organization_uuid and id in (
    select distinct (x->>'b')::uuid from jsonb_array_elements(rows_value) x
  );

  return jsonb_build_object('processed',row_total,'affected',affected_total,'entity_id',entity_uuid);
end;
$$;

revoke all on function public.import_finances_accounting_batch_v3(uuid,text,jsonb) from public;
grant execute on function public.import_finances_accounting_batch_v3(uuid,text,jsonb) to authenticated;
