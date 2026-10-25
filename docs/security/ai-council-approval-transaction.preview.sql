-- AI Council 777 design-only migration candidate. NOT applied to production.
-- Execute only in isolated preview after security review.
-- A private schema prevents direct Data API access; no client-side service key.
create schema if not exists atlas_council_private;
revoke all on schema atlas_council_private from public, anon, authenticated;
create table if not exists atlas_council_private.approval_consumptions (
  approval_id uuid primary key references public.atlas_approvals(id) on delete restrict,
  org_id uuid not null references public.organizations(id),
  requester_id uuid not null,
  proposal_hash text not null check (proposal_hash ~ '^[a-f0-9]{64}$'),
  consumed_at timestamptz not null default now()
);
revoke all on atlas_council_private.approval_consumptions from public, anon, authenticated;
-- SECURITY INVOKER and service-only execution. Caller must separately authenticate
-- actor, org membership, permission and proposal digest before calling this RPC.
-- No grant to anon/authenticated: untrusted users cannot claim an arbitrary actor.
create or replace function atlas_council_private.consume_approved_action(
  p_approval_id uuid, p_org_id uuid, p_user_id uuid, p_proposal_hash text
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare v public.atlas_approvals%rowtype;
begin
  if p_approval_id is null or p_org_id is null or p_user_id is null
     or p_proposal_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'approval_invalid';
  end if;
  select * into v from public.atlas_approvals
   where id=p_approval_id and org_id=p_org_id and requested_by=p_user_id
     and status='approved' and expires_at>clock_timestamp()
     and subject_type='ai_council'
     and metadata->>'proposal_hash'=p_proposal_hash
   for update;
  if not found then raise exception 'approval_invalid'; end if;
  insert into atlas_council_private.approval_consumptions
    (approval_id,org_id,requester_id,proposal_hash)
    values (p_approval_id,p_org_id,p_user_id,p_proposal_hash);
  -- Transaction rolls back consumption if this audit insert fails.
  insert into public.execution_audit_events
    (org_id,tenant_id,actor_user_id,module,action,previous_state,resulting_state,correlation_id)
    values (p_org_id,p_org_id::text,p_user_id,'ai_council','approval_consumed','approved','consumed',p_approval_id::text);
  return jsonb_build_object('status','consumed','organization_id',p_org_id,
    'user_id',p_user_id,'proposal_hash',p_proposal_hash,
    'expires_at_ms',extract(epoch from v.expires_at)*1000);
end $$;
revoke all on function atlas_council_private.consume_approved_action(uuid,uuid,uuid,text) from public, anon, authenticated;
-- Do NOT grant EXECUTE until service identity, SQL privileges, RLS and
-- transaction semantics have been proven in preview.
