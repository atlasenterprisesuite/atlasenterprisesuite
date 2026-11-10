create or replace function public.import_finances_compact_v5(organization_uuid uuid, entity_code_value text, data_text text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  entity_uuid uuid; line text; f text[]; acct_code integer; target_code integer; bank_uuid uuid; target_bank_uuid uuid;
  category_code text; confidence_code text; hint_code text; hint_value text; amount_value numeric;
  affected_count integer := 0; processed_count integer := 0;
begin
  if organization_uuid is null or nullif(btrim(entity_code_value),'') is null then raise exception 'Organization and entity code are required'; end if;
  if nullif(data_text,'') is null then return jsonb_build_object('processed',0,'affected',0); end if;
  if auth.uid() is not null then
    if not public.can_write_accounting_data(organization_uuid) then raise exception 'Accounting role required'; end if;
  elsif session_user <> 'postgres' then raise exception 'Authentication required'; end if;
  select id into entity_uuid from public.accounting_entities where org_id=organization_uuid and code=entity_code_value and active limit 1;
  if entity_uuid is null then raise exception 'Active accounting entity not found'; end if;
  foreach line in array string_to_array(data_text,';') loop
    if nullif(line,'') is null then continue; end if;
    f := string_to_array(line,'~',null);
    if coalesce(array_length(f,1),0) < 10 then raise exception 'Malformed compact finance row'; end if;
    acct_code := f[1]::integer; category_code := nullif(f[5],''); confidence_code := nullif(f[6],''); hint_code := nullif(f[7],'');
    target_code := nullif(f[9],'')::integer; amount_value := (f[4]::numeric / 100.0);
    bank_uuid := case acct_code when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid else null end;
    if bank_uuid is null then raise exception 'Unsupported finance account code %',acct_code; end if;
    target_bank_uuid := case target_code when 1 then '0acfb726-a76e-4cbb-b5ec-bf0172b7720d'::uuid when 2 then 'bbab5ea7-bdba-4e99-8fdd-e9de5ed8f7fc'::uuid when 3 then '25b689e1-07ba-43a9-b44f-abfdbdf43765'::uuid when 4 then '8f09c7b7-dccc-443d-9d63-aa2f005896c9'::uuid when 5 then '4940824d-dac4-4a79-bee1-bee20266a559'::uuid else null end;
    hint_value := case hint_code when 'i' then 'internal_transfer' when 'c' then 'external_credit_card_payment' when 'd' then 'cash_or_external_deposit' when 'a' then 'backup_balance_advance' when 'b' then 'backup_balance_repayment' when 'u' then 'uber_income' when 'l' then 'lyft_income' when 'g' then 'gig_income' when 'w' then 'wage_income' when 'n' then 'other_income' when 'p' then 'bnpl_payment' when 'f' then 'financial_fee_interest' when 'k' then 'auto_loan_payment' when 'r' then 'fuel' when 's' then 'auto_service' when 't' then 'toll' else null end;
    update public.accounting_bank_accounts set entity_id=entity_uuid where id=bank_uuid and org_id=organization_uuid and entity_id is distinct from entity_uuid;
    insert into public.accounting_transactions(org_id,entity_id,bank_account_id,external_id,posted_date,amount,currency,description,merchant,status,confidence,evidence_state,dimension,fingerprint,source_payload,classification_source)
    values(organization_uuid,entity_uuid,bank_uuid,f[2],to_date(f[3],'YYYYMMDD'),amount_value,'USD',
      coalesce(hint_value,case category_code when 'F' then 'Financial activity' when 'E' then 'Entertainment' when 'D' then 'Dining and drinks' when 'G' then 'Groceries' when 'S' then 'Shopping' when 'T' then 'Transfer' when 'H' then 'Health and wellness' when 'O' then 'Other activity' when 'B' then 'Bills and utilities' when 'R' then 'Transportation' when 'V' then 'Services' when 'N' then 'Income' when 'U' then 'Housing' when 'L' then 'Travel' when 'Q' then 'Gifts and donations' when 'C' then 'Education' else 'Imported financial activity' end),
      null,'needs_review',case confidence_code when 'V' then 0.99 when 'H' then 0.90 when 'M' then 0.70 when 'L' then 0.40 else 0.50 end,'not_required',
      jsonb_strip_nulls(jsonb_build_object('category_code',category_code,'confidence_code',confidence_code,'classification_hint',hint_value,'transfer_transaction_id',nullif(f[8],''),'transfer_bank_account_id',target_bank_uuid,'reconstructed_from_counterpart',(f[10]='1'))),
      encode(extensions.digest((organization_uuid::text||'|'||bank_uuid::text||'|'||f[2])::bytea,'sha256'),'hex'),
      jsonb_strip_nulls(jsonb_build_object('source','Finances','import_batch','initial_finances_full_history_2026_09_15','privacy_mode','provider_ids_hashed','category_code',category_code,'confidence_code',confidence_code,'classification_hint',hint_value,'transfer_transaction_id',nullif(f[8],''),'transfer_bank_account_id',target_bank_uuid,'reconstructed_from_counterpart',(f[10]='1'))),'provider')
    on conflict (org_id,bank_account_id,external_id) where external_id is not null do update set entity_id=excluded.entity_id,posted_date=excluded.posted_date,amount=excluded.amount,currency=excluded.currency,description=excluded.description,confidence=excluded.confidence,evidence_state=excluded.evidence_state,dimension=excluded.dimension,fingerprint=excluded.fingerprint,source_payload=excluded.source_payload,classification_source=excluded.classification_source,updated_at=now();
    processed_count := processed_count + 1; affected_count := affected_count + 1;
  end loop;
  return jsonb_build_object('processed',processed_count,'affected',affected_count,'entity_id',entity_uuid);
end;
$function$;
revoke all on function public.import_finances_compact_v5(uuid,text,text) from public, anon;
grant execute on function public.import_finances_compact_v5(uuid,text,text) to authenticated, service_role;
