-- ATLAS 777: evidence-only reconciliation; no outbound provider call or retry.
create table public.atlas_external_effect_audit_777 (
 id bigint generated always as identity primary key,
 effect_id uuid not null references public.atlas_external_effect_ledger_777(id),
 org_id uuid not null,
 tenant_id text not null,
 from_status text not null,
 to_status text not null,
 evidence_ref text not null,
 provider_receipt text,
 created_at timestamptz not null default now()
);
create unique index atlas_effect_audit_receipt_777
 on public.atlas_external_effect_audit_777(provider_receipt)
 where provider_receipt is not null;
alter table public.atlas_external_effect_audit_777 enable row level security;
create or replace function public.atlas_reject_effect_audit_mutation_777()
returns trigger language plpgsql as $audit_guard$
begin
 raise exception 'external_effect_audit_append_only' using errcode='42501';
end; $audit_guard$;
create trigger atlas_effect_audit_no_update_delete_777
before update or delete on public.atlas_external_effect_audit_777
for each row execute function public.atlas_reject_effect_audit_mutation_777();
revoke all on public.atlas_external_effect_audit_777 from public, anon, authenticated;
grant select on public.atlas_external_effect_audit_777 to service_role;
-- Direct ledger updates remain forbidden: service role gets only EXECUTE on RPC.
create or replace function public.atlas_reconcile_external_effect_777(
 p_org_id uuid, p_tenant_id text, p_effect_key text,
 p_expected_status text, p_next_status text,
 p_evidence_ref text, p_provider_receipt text default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_effect public.atlas_external_effect_ledger_777%rowtype;
begin
 if auth.role() is distinct from 'service_role' then
   raise exception 'service_role_required' using errcode='42501';
 end if;
 if nullif(trim(coalesce(p_evidence_ref,'')), '') is null
   or nullif(trim(coalesce(p_tenant_id,'')), '') is null
   or nullif(trim(coalesce(p_effect_key,'')), '') is null then
   raise exception 'reconciliation_evidence_required' using errcode='22023';
 end if;
 select * into v_effect from public.atlas_external_effect_ledger_777
 where org_id=p_org_id and tenant_id=p_tenant_id and effect_key=p_effect_key
 for update;
 if not found or v_effect.status is distinct from p_expected_status then
   return false;
 end if;
 if not (
   (p_expected_status='reserved' and p_next_status='unknown')
   or (p_expected_status in ('reserved','unknown') and p_next_status in ('confirmed','rejected'))
 ) then
   return false;
 end if;
 if p_next_status in ('confirmed','rejected')
   and nullif(trim(coalesce(p_provider_receipt,'')), '') is null then
   raise exception 'provider_evidence_required' using errcode='22023';
 end if;
 update public.atlas_external_effect_ledger_777
 set status=p_next_status, provider_receipt=p_provider_receipt, audit_ref=p_evidence_ref,
     updated_at=now()
 where id=v_effect.id;
 insert into public.atlas_external_effect_audit_777
   (effect_id,org_id,tenant_id,from_status,to_status,evidence_ref,provider_receipt)
 values (v_effect.id,v_effect.org_id,v_effect.tenant_id,
         v_effect.status,p_next_status,p_evidence_ref,p_provider_receipt);
 return true;
end;
$$;
revoke all on function public.atlas_reconcile_external_effect_777(uuid,text,text,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.atlas_reconcile_external_effect_777(uuid,text,text,text,text,text,text)
 to service_role;
