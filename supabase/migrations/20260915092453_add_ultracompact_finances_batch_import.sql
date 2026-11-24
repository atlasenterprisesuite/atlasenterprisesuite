create or replace function public.import_finances_accounting_batch_v4(
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
  if auth.uid() is null and session_user <> 'postgres' then raise exception 'Authentication required'; end if;
  if organization_uuid is null then raise exception 'Organization is required'; end if;
  if auth.uid() is not null and not public.can_write_accounting_data(organization_uuid) then raise exception 'Accounting role required'; end if;
  if rows_value is null or jsonb_typeof(rows_value) <> 'array' then raise exception 'Rows must be a JSON array'; end if;

  select id into entity_uuid from public.accounting_entities
  where org_id=organization_uuid and code=btrim(entity_code_value) and active limit 1;
  if entity_uuid is null then raise exception 'Active accounting entity not found'; end if;

  row_total := jsonb_array_length(rows_value);
  if row_total=0 then return jsonb_build_object('processed',0,'affected',0,'entity_id',entity_uuid); end if;
  if row_total>1000 then raise exception 'Maximum batch size is 1000'; end if;

  with s as (
    select
      case (x->>'a')::integer
        when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid
        when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid
        when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid
        when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid
        when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid
      end bank_account_id,
      nullif(btrim(x->>'t'),'') external_id,
      (x->>'d')::date posted_date,
      (x->>'v')::numeric amount,
      nullif(btrim(x->>'c'),'') category_code,
      nullif(btrim(x->>'q'),'') confidence_code,
      nullif(btrim(x->>'e'),'') classification_hint,
      nullif(btrim(x->>'x'),'') transfer_transaction_id,
      case (x->>'y')::integer
        when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid
        when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid
        when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid
        when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid
        when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid
        else null
      end transfer_bank_account_id,
      coalesce((x->>'r')::integer,0)<>0 reconstructed_from_counterpart
    from jsonb_array_elements(rows_value) x
  ), r as (
    select s.* from s join public.accounting_bank_accounts b
      on b.id=s.bank_account_id and b.org_id=organization_uuid and b.provider='Finances'
    where s.external_id is not null and s.posted_date is not null and s.amount is not null
  ) select count(*) into resolved_total from r;

  if resolved_total<>row_total then raise exception 'Every imported row must resolve to a valid Finances bank account and required transaction fields'; end if;

  with s as (
    select
      case (x->>'a')::integer
        when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid
        when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid
        when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid
        when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid
        when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid
      end bank_account_id,
      nullif(btrim(x->>'t'),'') external_id,
      (x->>'d')::date posted_date,
      (x->>'v')::numeric amount,
      nullif(btrim(x->>'c'),'') category_code,
      nullif(btrim(x->>'q'),'') confidence_code,
      nullif(btrim(x->>'e'),'') classification_hint,
      nullif(btrim(x->>'x'),'') transfer_transaction_id,
      case (x->>'y')::integer
        when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid
        when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid
        when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid
        when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid
        when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid
        else null
      end transfer_bank_account_id,
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
    case r.category_code
      when 'F' then 'Financial activity' when 'E' then 'Entertainment' when 'D' then 'Dining and drinks'
      when 'G' then 'Groceries' when 'S' then 'Shopping' when 'T' then 'Transfer'
      when 'H' then 'Health and wellness' when 'O' then 'Other activity' when 'B' then 'Bills and utilities'
      when 'R' then 'Transportation' when 'V' then 'Services' when 'N' then 'Income'
      when 'U' then 'Housing' when 'L' then 'Travel' when 'Q' then 'Gifts and donations'
      when 'C' then 'Education' when 'P' then 'Pets' when 'K' then 'Family and kids'
      else 'Imported financial transaction' end,
    null,r.amount,'USD',
    case r.confidence_code when 'V' then 0.99 when 'H' then 0.90 when 'M' then 0.65 when 'L' then 0.35 else 0.25 end,
    'needs_review','not_required','Imported from connected financial account; accounting classification pending.',
    jsonb_strip_nulls(jsonb_build_object(
      'category_code',r.category_code,'classification_hint',r.classification_hint,
      'transfer_transaction_id',r.transfer_transaction_id,'transfer_bank_account_id',r.transfer_bank_account_id
    )),
    md5(r.bank_account_id::text||'|'||r.external_id||'|'||r.posted_date::text||'|'||r.amount::text),
    jsonb_strip_nulls(jsonb_build_object(
      'source','Finances','privacy_mode','provider_ids_hashed','category_code',r.category_code,
      'classification_hint',r.classification_hint,'confidence_code',r.confidence_code,
      'transfer_transaction_id',r.transfer_transaction_id,'transfer_bank_account_id',r.transfer_bank_account_id,
      'reconstructed_from_counterpart',r.reconstructed_from_counterpart,
      'import_batch','initial_finances_full_history_2026_09_15'
    ))
  from r
  on conflict (org_id,bank_account_id,external_id) where external_id is not null
  do update set entity_id=excluded.entity_id,posted_date=excluded.posted_date,description=excluded.description,
    amount=excluded.amount,currency=excluded.currency,confidence=excluded.confidence,
    fingerprint=excluded.fingerprint,source_payload=excluded.source_payload,dimension=excluded.dimension,updated_at=now();

  get diagnostics affected_total=row_count;
  update public.accounting_bank_accounts set entity_id=entity_uuid,updated_at=now()
  where org_id=organization_uuid and id in (select distinct case (x->>'a')::integer
    when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid
    when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid
    when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid end from jsonb_array_elements(rows_value) x);

  return jsonb_build_object('processed',row_total,'affected',affected_total,'entity_id',entity_uuid);
end;
$$;
revoke all on function public.import_finances_accounting_batch_v4(uuid,text,jsonb) from public;
grant execute on function public.import_finances_accounting_batch_v4(uuid,text,jsonb) to authenticated;
