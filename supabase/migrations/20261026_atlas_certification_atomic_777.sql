-- ATLAS 777: certification evidence only. No provider delivery, deploy or production side effects.
create table public.atlas_certification_snapshot_777 (
  org_id uuid not null,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  module_id text not null check (module_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  sha text not null check (sha ~ '^[a-f0-9]{40}$'),
  evidence jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, tenant_id, module_id)
);
create table public.atlas_certification_audit_777 (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  tenant_id text not null,
  module_id text not null,
  sha text not null,
  evidence jsonb not null,
  created_at timestamptz not null default now()
);
create index atlas_certification_audit_scope_777 on public.atlas_certification_audit_777(org_id,tenant_id,module_id,id);
alter table public.atlas_certification_snapshot_777 enable row level security;
alter table public.atlas_certification_audit_777 enable row level security;
revoke all on public.atlas_certification_snapshot_777 from public,anon,authenticated;
revoke all on public.atlas_certification_audit_777 from public,anon,authenticated;
grant select on public.atlas_certification_snapshot_777 to service_role;
grant select on public.atlas_certification_audit_777 to service_role;
create function public.atlas_reject_certification_audit_mutation_777()
returns trigger language plpgsql as $$
begin
  raise exception 'certification_audit_append_only' using errcode='42501';
end $$;
create trigger atlas_certification_audit_no_mutation_777
before update or delete on public.atlas_certification_audit_777
for each row execute function public.atlas_reject_certification_audit_mutation_777();

-- A single privileged RPC writes the snapshot and its append-only audit atomically.
-- Replays with identical evidence do not create additional audit records.
create function public.atlas_record_certification_777(
 p_org_id uuid,p_tenant_id text,p_module_id text,p_sha text,p_evidence jsonb
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare old_evidence jsonb;
begin
 if auth.role() is distinct from 'service_role' then
   raise exception 'service_role_required' using errcode='42501';
 end if;
 if p_org_id is null or nullif(trim(coalesce(p_tenant_id,'')),'') is null
   or p_module_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
   or p_sha !~ '^[a-f0-9]{40}$'
   or jsonb_typeof(p_evidence) is distinct from 'object'
   or p_evidence->>'moduleId' is distinct from p_module_id
   or p_evidence->>'sha' is distinct from p_sha
   or jsonb_typeof(p_evidence->'blockers') is distinct from 'array'
   or jsonb_typeof(p_evidence->'certified') is distinct from 'boolean'
   or jsonb_typeof(p_evidence->'state') is distinct from 'string' then
   raise exception 'invalid_certification_evidence' using errcode='23514';
 end if;
 -- This evidence recorder cannot independently attest deployment or authorization.
 -- A separate, reviewed certification authority is required for a certified=true state.
 if (p_evidence->>'certified')::boolean then
   raise exception 'certification_gates_not_verified' using errcode='23514';
 end if;
 -- Serialize writes for the same organization/tenant/module, including first insert.
 perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_tenant_id || ':' || p_module_id,0));
 select evidence into old_evidence from public.atlas_certification_snapshot_777
 where org_id=p_org_id and tenant_id=p_tenant_id and module_id=p_module_id for update;
 if found and old_evidence = p_evidence then return true; end if;
 insert into public.atlas_certification_snapshot_777(org_id,tenant_id,module_id,sha,evidence)
 values(p_org_id,p_tenant_id,p_module_id,p_sha,p_evidence)
 on conflict(org_id,tenant_id,module_id) do update
 set sha=excluded.sha,evidence=excluded.evidence,updated_at=now();
 insert into public.atlas_certification_audit_777(org_id,tenant_id,module_id,sha,evidence)
 values(p_org_id,p_tenant_id,p_module_id,p_sha,p_evidence);
 return true;
end $$;
revoke all on function public.atlas_record_certification_777(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_record_certification_777(uuid,text,text,text,jsonb) to service_role;
