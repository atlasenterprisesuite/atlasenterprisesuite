-- Atomic import into existing draft journals. No new business tables.
create or replace function public.import_google_sheet_drafts(
 p_actor uuid,p_org uuid,p_file text,p_sheet text,p_debit uuid,p_credit uuid,p_rows jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
 actor uuid:=p_actor; previous_sub text:=current_setting('request.jwt.claim.sub',true); r jsonb; journal_id uuid; old_link record;
 object_key text; fingerprint text; amount_cents bigint; amount_value numeric;
 imported integer:=0; duplicates integer:=0;
begin
 -- Service-only RPC. Recheck current RBAC using the authenticated actor supplied
 -- by the Edge Function, never a browser-supplied user identifier.
 perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
 if actor is null or not public.has_identity_permission(p_org,'integrations.manage')
   or not public.has_identity_permission(p_org,'accounting.write') then
   raise exception 'permission_denied' using errcode='42501';
 end if;
 if p_file is null or length(p_file)>256 or p_file !~ '^[A-Za-z0-9_-]+$' or p_sheet is null
   or length(trim(p_sheet)) not between 1 and 100 or p_debit is null or p_credit is null
   or p_debit=p_credit or jsonb_typeof(p_rows) is distinct from 'array'
   or jsonb_array_length(p_rows) not between 1 and 10000
   or octet_length(p_rows::text)>2000000 then raise exception 'invalid_import'; end if;
 -- All imports for this organization serialize; repeated requests cannot duplicate
 -- links even if another provider connection/user imports the same source file.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':google-sheet-import',0));
 perform 1 from public.atlas_integration_connections where org_id=p_org
   and provider='google' and connection_name='workspace-sheets:'||actor::text
   and authorized and provider_verified and state='connected' for share;
 if not found then raise exception 'google_not_connected'; end if;
 perform 1 from public.chart_of_accounts where org_id=p_org and id=p_debit and active for share;
 if not found then raise exception 'invalid_debit_account'; end if;
 perform 1 from public.chart_of_accounts where org_id=p_org and id=p_credit and active for share;
 if not found then raise exception 'invalid_credit_account'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x group by trim(x->>'reference') having count(*)>1)
   then raise exception 'duplicate_reference'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
   if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'reference') is distinct from 'string'
     or length(trim(r->>'reference')) not between 1 and 256
     or jsonb_typeof(r->'description') is distinct from 'string' or length(r->>'description')>2000
     or r->>'currency' is distinct from 'USD' or r->>'date' is null
     or r->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or jsonb_typeof(r->'amountMinor') is distinct from 'number'
     or r->>'amountMinor' !~ '^-?[0-9]{1,16}$' then raise exception 'invalid_row'; end if;
   -- Cast rejects nonexistent calendar days; comparison rejects normalized dates.
   if to_char((r->>'date')::date,'YYYY-MM-DD')<>r->>'date' then raise exception 'invalid_date'; end if;
   amount_cents:=(r->>'amountMinor')::bigint;
   if amount_cents=0 or abs(amount_cents)>9007199254740991 then raise exception 'invalid_amount'; end if;
   object_key:=md5(p_file||chr(31)||p_sheet||chr(31)||trim(r->>'reference'));
   fingerprint:=md5(jsonb_build_object('date',r->>'date','description',r->>'description',
      'amount',amount_cents,'currency','USD','debit',p_debit,'credit',p_credit)::text);
   select * into old_link from public.atlas_external_object_links where org_id=p_org
     and provider='google' and provider_account_id='workspace-sheets'
     and provider_object_type='sheet_transaction' and provider_object_id=object_key;
   if found then
     if old_link.source_fingerprint is distinct from fingerprint then raise exception 'reference_conflict'; end if;
     -- Fail closed if the linked journal was deleted after import.
     if not exists(select 1 from public.journal_entries j where j.id=old_link.atlas_object_id and j.org_id=p_org)
       then raise exception 'linked_journal_missing'; end if;
     duplicates:=duplicates+1; continue;
   end if;
   journal_id:=gen_random_uuid(); amount_value:=abs(amount_cents)::numeric/100;
   insert into public.journal_entries(id,org_id,entry_number,entry_date,memo,status,created_by)
   values(journal_id,p_org,'GS-'||object_key,(r->>'date')::date,
     'Google Sheets '||trim(r->>'reference')||': '||(r->>'description'),'draft',actor);
   insert into public.journal_lines(org_id,journal_entry_id,account_id,debit,credit) values
    (p_org,journal_id,p_debit,case when amount_cents>0 then amount_value else 0 end,case when amount_cents<0 then amount_value else 0 end),
    (p_org,journal_id,p_credit,case when amount_cents<0 then amount_value else 0 end,case when amount_cents>0 then amount_value else 0 end);
   insert into public.atlas_external_object_links(org_id,provider,provider_account_id,provider_object_type,
     provider_object_id,atlas_object_type,atlas_object_id,last_seen_at,source_fingerprint)
   values(p_org,'google','workspace-sheets','sheet_transaction',object_key,'journal_entry',journal_id,now(),fingerprint);
   imported:=imported+1;
 end loop;
 insert into public.atlas_integration_sync_runs(org_id,provider,operation,object_type,status,records_observed,started_by,completed_at)
 values(p_org,'google','sheets.import','journal_draft','completed',imported,actor,now());
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 return jsonb_build_object('imported',imported,'duplicates',duplicates);
end $$;
revoke all on function public.import_google_sheet_drafts(uuid,uuid,text,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.import_google_sheet_drafts(uuid,uuid,text,text,uuid,uuid,jsonb) to service_role;
