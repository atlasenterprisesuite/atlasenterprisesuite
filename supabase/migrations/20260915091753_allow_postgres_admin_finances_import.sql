create or replace function public.import_finances_accounting_batch(
  organization_uuid uuid,
  entity_code_value text,
  rows_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
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
  if organization_uuid is null then
    raise exception 'Organization is required';
  end if;
  if auth.uid() is not null and not public.can_write_accounting_data(organization_uuid) then
    raise exception 'Accounting role required';
  end if;
  if rows_value is null or jsonb_typeof(rows_value) <> 'array' then
    raise exception 'Rows must be a JSON array';
  end if;

  select id into entity_uuid
  from public.accounting_entities
  where org_id = organization_uuid
    and code = btrim(entity_code_value)
    and active
  limit 1;

  if entity_uuid is null then
    raise exception 'Active accounting entity not found';
  end if;

  row_total := jsonb_array_length(rows_value);
  if row_total = 0 then
    return jsonb_build_object('processed', 0, 'affected', 0, 'entity_id', entity_uuid);
  end if;
  if row_total > 1000 then
    raise exception 'Maximum batch size is 1000';
  end if;

  with source_rows as (
    select
      nullif(btrim(x->>'a'), '') as source_account_id,
      nullif(btrim(x->>'t'), '') as external_id,
      (x->>'d')::date as posted_date,
      coalesce(nullif(btrim(x->>'n'), ''), nullif(btrim(x->>'m'), ''), 'Imported transaction') as description,
      nullif(btrim(x->>'m'), '') as merchant,
      (x->>'v')::numeric as amount,
      coalesce(nullif(upper(btrim(x->>'u')), ''), 'USD') as currency,
      nullif(btrim(x->>'i'), '') as item_id,
      nullif(btrim(x->>'an'), '') as source_account_name,
      nullif(btrim(x->>'dt'), '') as source_datetime,
      nullif(btrim(x->>'pdt'), '') as posted_datetime,
      nullif(btrim(x->>'pc'), '') as payment_channel,
      nullif(btrim(x->>'c'), '') as category_primary,
      nullif(btrim(x->>'cd'), '') as category_detailed,
      nullif(btrim(x->>'q'), '') as category_confidence,
      nullif(btrim(x->>'to'), '') as transfer_to_account_id,
      nullif(btrim(x->>'tt'), '') as transfer_transaction_id,
      coalesce((x->>'r')::boolean, false) as reconstructed_from_counterpart
    from jsonb_array_elements(rows_value) x
  ), resolved as (
    select s.*, b.id as bank_account_id
    from source_rows s
    join public.accounting_bank_accounts b
      on b.org_id = organization_uuid
     and b.provider = 'Finances'
     and b.provider_account_ref = s.source_account_id
    where s.source_account_id is not null
      and s.external_id is not null
      and s.posted_date is not null
      and s.amount is not null
  )
  select count(*) into resolved_total from resolved;

  if resolved_total <> row_total then
    raise exception 'Every imported row must resolve to a valid Finances bank account and required transaction fields';
  end if;

  with source_rows as (
    select
      nullif(btrim(x->>'a'), '') as source_account_id,
      nullif(btrim(x->>'t'), '') as external_id,
      (x->>'d')::date as posted_date,
      coalesce(nullif(btrim(x->>'n'), ''), nullif(btrim(x->>'m'), ''), 'Imported transaction') as description,
      nullif(btrim(x->>'m'), '') as merchant,
      (x->>'v')::numeric as amount,
      coalesce(nullif(upper(btrim(x->>'u')), ''), 'USD') as currency,
      nullif(btrim(x->>'i'), '') as item_id,
      nullif(btrim(x->>'an'), '') as source_account_name,
      nullif(btrim(x->>'dt'), '') as source_datetime,
      nullif(btrim(x->>'pdt'), '') as posted_datetime,
      nullif(btrim(x->>'pc'), '') as payment_channel,
      nullif(btrim(x->>'c'), '') as category_primary,
      nullif(btrim(x->>'cd'), '') as category_detailed,
      nullif(btrim(x->>'q'), '') as category_confidence,
      nullif(btrim(x->>'to'), '') as transfer_to_account_id,
      nullif(btrim(x->>'tt'), '') as transfer_transaction_id,
      coalesce((x->>'r')::boolean, false) as reconstructed_from_counterpart
    from jsonb_array_elements(rows_value) x
  ), resolved as (
    select s.*, b.id as bank_account_id
    from source_rows s
    join public.accounting_bank_accounts b
      on b.org_id = organization_uuid
     and b.provider = 'Finances'
     and b.provider_account_ref = s.source_account_id
  )
  insert into public.accounting_transactions(
    org_id, entity_id, bank_account_id, external_id, posted_date,
    description, merchant, amount, currency, confidence, status,
    evidence_state, review_reason, dimension, fingerprint, source_payload
  )
  select
    organization_uuid,
    entity_uuid,
    r.bank_account_id,
    r.external_id,
    r.posted_date,
    r.description,
    r.merchant,
    r.amount,
    r.currency,
    case upper(coalesce(r.category_confidence, ''))
      when 'VERY_HIGH' then 0.99
      when 'HIGH' then 0.90
      when 'MEDIUM' then 0.65
      when 'LOW' then 0.35
      else 0.25
    end,
    'needs_review',
    'not_required',
    'Imported from connected financial account; accounting classification pending.',
    jsonb_strip_nulls(jsonb_build_object(
      'category_primary', r.category_primary,
      'category_detailed', r.category_detailed,
      'transfer_to_account_id', r.transfer_to_account_id,
      'transfer_transaction_id', r.transfer_transaction_id
    )),
    encode(extensions.digest(
      r.source_account_id || '|' || r.external_id || '|' || r.posted_date::text || '|' || r.amount::text,
      'sha256'
    ), 'hex'),
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'Finances',
      'provider', 'plaid',
      'item_id', r.item_id,
      'source_account_id', r.source_account_id,
      'source_account_name', r.source_account_name,
      'datetime', r.source_datetime,
      'posted_datetime', r.posted_datetime,
      'payment_channel', r.payment_channel,
      'category_primary', r.category_primary,
      'category_detailed', r.category_detailed,
      'category_confidence', r.category_confidence,
      'transfer_to_account_id', r.transfer_to_account_id,
      'transfer_transaction_id', r.transfer_transaction_id,
      'reconstructed_from_counterpart', r.reconstructed_from_counterpart,
      'import_batch', 'initial_finances_full_history_2026_09_15'
    ))
  from resolved r
  on conflict (org_id, bank_account_id, external_id) where external_id is not null
  do update set
    entity_id = excluded.entity_id,
    posted_date = excluded.posted_date,
    description = excluded.description,
    merchant = excluded.merchant,
    amount = excluded.amount,
    currency = excluded.currency,
    confidence = excluded.confidence,
    fingerprint = excluded.fingerprint,
    source_payload = excluded.source_payload,
    dimension = excluded.dimension,
    updated_at = now();

  get diagnostics affected_total = row_count;

  update public.accounting_bank_accounts
     set entity_id = entity_uuid,
         updated_at = now()
   where org_id = organization_uuid
     and provider = 'Finances'
     and provider_account_ref in (
       select distinct nullif(btrim(x->>'a'), '')
       from jsonb_array_elements(rows_value) x
     );

  return jsonb_build_object(
    'processed', row_total,
    'affected', affected_total,
    'entity_id', entity_uuid
  );
end;
$$;

revoke all on function public.import_finances_accounting_batch(uuid, text, jsonb) from public;
grant execute on function public.import_finances_accounting_batch(uuid, text, jsonb) to authenticated;
