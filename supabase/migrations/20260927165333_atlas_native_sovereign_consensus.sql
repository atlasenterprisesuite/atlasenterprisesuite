-- ATLAS Native Sovereign Consensus
-- Replaces GitHub Actions as the authoritative 3-of-3 release consensus gate.
-- GitHub may remain source control, but is not required for consensus execution.
-- ChatGPT orchestrates; independent release opinions are Codex, Gemini, and ATLAS Runtime Verifier.

create table if not exists public.atlas_consensus_runs (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.atlas_deployments(id) on delete cascade,
  artifact_sha text not null,
  source_ref text,
  status text not null default 'running'
    check (status in ('running','passed','failed','blocked','cancelled')),
  required_count integer not null default 3 check (required_count = 3),
  passed_count integer not null default 0 check (passed_count between 0 and 3),
  evidence_digest text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 12000),
  unique (deployment_id, artifact_sha)
);

create table if not exists public.atlas_consensus_opinions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.atlas_consensus_runs(id) on delete cascade,
  opinion_key text not null
    check (opinion_key in ('codex_engineering','gemini_independent_review','atlas_runtime_verifier')),
  agent_id text not null,
  status text not null check (status in ('passed','failed','blocked')),
  artifact_sha text not null,
  evidence_ref text not null,
  evidence_digest text not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 12000),
  recorded_at timestamptz not null default now(),
  unique (run_id, opinion_key)
);

create index if not exists atlas_consensus_runs_deployment_idx
  on public.atlas_consensus_runs(deployment_id, started_at desc);

create index if not exists atlas_consensus_opinions_run_idx
  on public.atlas_consensus_opinions(run_id, opinion_key);

alter table public.atlas_consensus_runs enable row level security;
alter table public.atlas_consensus_opinions enable row level security;

revoke all on public.atlas_consensus_runs from public, anon, authenticated;
revoke all on public.atlas_consensus_opinions from public, anon, authenticated;
grant select, insert, update on public.atlas_consensus_runs to service_role;
grant select, insert, update on public.atlas_consensus_opinions to service_role;

create or replace function public.atlas_default_deployment_gates(p_environment text)
returns jsonb
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case p_environment
    when 'production' then '[
      {"key":"artifact_integrity","type":"integrity","required":true},
      {"key":"release_manifest_integrity","type":"integrity","required":true},
      {"key":"migration_validation","type":"migration","required":true},
      {"key":"security_advisor","type":"security","required":true},
      {"key":"runtime_readiness","type":"runtime","required":true},
      {"key":"public_health","type":"health","required":true},
      {"key":"observability_critical_incidents","type":"observability","required":true},
      {"key":"deployment_evidence","type":"evidence","required":true},
      {"key":"sovereign_consensus_3of3","type":"consensus","required":true},
      {"key":"approval_policy","type":"approval","required":true},
      {"key":"post_deploy_verification","type":"runtime","required":true},
      {"key":"github_ci","type":"provider","required":false}
    ]'::jsonb
    when 'staging' then '[
      {"key":"artifact_integrity","type":"integrity","required":true},
      {"key":"release_manifest_integrity","type":"integrity","required":true},
      {"key":"migration_validation","type":"migration","required":true},
      {"key":"runtime_readiness","type":"runtime","required":true},
      {"key":"deployment_evidence","type":"evidence","required":true},
      {"key":"sovereign_consensus_3of3","type":"consensus","required":true}
    ]'::jsonb
    when 'development' then '[
      {"key":"artifact_integrity","type":"integrity","required":true},
      {"key":"release_manifest_integrity","type":"integrity","required":true}
    ]'::jsonb
    else null
  end;
$$;

create or replace function public.atlas_begin_sovereign_consensus(
  p_deployment_id uuid,
  p_artifact_sha text,
  p_source_ref text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_id uuid;
  v_environment text;
begin
  if p_deployment_id is null then raise exception 'deployment_id_required'; end if;
  if p_artifact_sha is null or p_artifact_sha !~ '^[0-9a-f]{40,64}$' then
    raise exception 'artifact_sha_invalid';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then
    raise exception 'metadata_object_required';
  end if;

  select environment into v_environment
  from public.atlas_deployments
  where id=p_deployment_id;

  if v_environment is null then raise exception 'deployment_not_found'; end if;
  if v_environment not in ('staging','production') then
    raise exception 'consensus_environment_not_required';
  end if;

  insert into public.atlas_consensus_runs(
    deployment_id,artifact_sha,source_ref,status,metadata
  ) values (
    p_deployment_id,lower(p_artifact_sha),nullif(p_source_ref,''),'running',
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (deployment_id,artifact_sha) do update
    set source_ref=coalesce(excluded.source_ref,atlas_consensus_runs.source_ref),
        metadata=atlas_consensus_runs.metadata || excluded.metadata
  returning id into v_id;

  insert into public.atlas_deployment_gates(
    deployment_id,gate_key,gate_type,required,status,evidence_ref,metadata
  ) values (
    p_deployment_id,'sovereign_consensus_3of3','consensus',true,'running',
    'consensus:'||v_id::text,
    jsonb_build_object(
      'run_id',v_id,
      'artifact_sha',lower(p_artifact_sha),
      'required_opinions',jsonb_build_array(
        'codex_engineering','gemini_independent_review','atlas_runtime_verifier'
      ),
      'github_actions_required',false
    )
  )
  on conflict (deployment_id,gate_key) do update
    set gate_type='consensus',
        required=true,
        status='running',
        evidence_ref=excluded.evidence_ref,
        error_code=null,
        evaluated_at=null,
        metadata=excluded.metadata,
        updated_at=now();

  return v_id;
end;
$$;

create or replace function public.atlas_record_sovereign_consensus_opinion(
  p_run_id uuid,
  p_opinion_key text,
  p_agent_id text,
  p_status text,
  p_artifact_sha text,
  p_evidence_ref text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
declare
  v_run public.atlas_consensus_runs%rowtype;
  v_expected_agent text;
  v_id uuid;
  v_digest text;
begin
  select * into v_run
  from public.atlas_consensus_runs
  where id=p_run_id
  for update;

  if not found then raise exception 'consensus_run_not_found'; end if;
  if v_run.status <> 'running' then raise exception 'consensus_run_terminal'; end if;

  v_expected_agent := case p_opinion_key
    when 'codex_engineering' then 'codex'
    when 'gemini_independent_review' then 'gemini'
    when 'atlas_runtime_verifier' then 'atlas-runtime-verifier'
    else null
  end;

  if v_expected_agent is null then raise exception 'consensus_opinion_key_invalid'; end if;
  if p_agent_id is null or lower(p_agent_id) not like v_expected_agent||'%' then
    raise exception 'consensus_agent_role_mismatch';
  end if;
  if p_status not in ('passed','failed','blocked') then
    raise exception 'consensus_opinion_status_invalid';
  end if;
  if lower(coalesce(p_artifact_sha,'')) <> v_run.artifact_sha then
    raise exception 'consensus_artifact_mismatch';
  end if;
  if nullif(btrim(coalesce(p_evidence_ref,'')),'') is null then
    raise exception 'consensus_evidence_required';
  end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then
    raise exception 'metadata_object_required';
  end if;

  v_digest := encode(
    extensions.digest(
      p_run_id::text||'|'||p_opinion_key||'|'||lower(p_agent_id)||'|'||
      p_status||'|'||v_run.artifact_sha||'|'||p_evidence_ref||'|'||
      coalesce(p_metadata,'{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.atlas_consensus_opinions(
    run_id,opinion_key,agent_id,status,artifact_sha,evidence_ref,evidence_digest,metadata
  ) values (
    p_run_id,p_opinion_key,lower(p_agent_id),p_status,v_run.artifact_sha,
    p_evidence_ref,v_digest,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (run_id,opinion_key) do update
    set agent_id=excluded.agent_id,
        status=excluded.status,
        artifact_sha=excluded.artifact_sha,
        evidence_ref=excluded.evidence_ref,
        evidence_digest=excluded.evidence_digest,
        metadata=excluded.metadata,
        recorded_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.atlas_finalize_sovereign_consensus(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
declare
  v_run public.atlas_consensus_runs%rowtype;
  v_total integer;
  v_passed integer;
  v_failed integer;
  v_blocked integer;
  v_distinct_agents integer;
  v_digest text;
  v_status text;
begin
  select * into v_run
  from public.atlas_consensus_runs
  where id=p_run_id
  for update;

  if not found then raise exception 'consensus_run_not_found'; end if;
  if v_run.status <> 'running' then
    return jsonb_build_object(
      'ok',v_run.status='passed',
      'run_id',v_run.id,
      'status',v_run.status,
      'passed_count',v_run.passed_count,
      'required_count',v_run.required_count
    );
  end if;

  select
    count(*),
    count(*) filter (where status='passed'),
    count(*) filter (where status='failed'),
    count(*) filter (where status='blocked'),
    count(distinct agent_id)
  into v_total,v_passed,v_failed,v_blocked,v_distinct_agents
  from public.atlas_consensus_opinions
  where run_id=p_run_id
    and artifact_sha=v_run.artifact_sha;

  if v_total < 3 then
    return jsonb_build_object(
      'ok',false,'run_id',v_run.id,'status','running',
      'passed_count',v_passed,'required_count',3,'reason','opinions_incomplete'
    );
  end if;

  if v_distinct_agents <> 3 then
    raise exception 'consensus_independence_violation';
  end if;

  v_status := case
    when v_failed > 0 then 'failed'
    when v_blocked > 0 then 'blocked'
    when v_passed = 3 then 'passed'
    else 'blocked'
  end;

  select encode(
    extensions.digest(
      string_agg(opinion_key||':'||evidence_digest,'|' order by opinion_key),
      'sha256'
    ),
    'hex'
  ) into v_digest
  from public.atlas_consensus_opinions
  where run_id=p_run_id;

  update public.atlas_consensus_runs
  set status=v_status,
      passed_count=v_passed,
      evidence_digest=v_digest,
      completed_at=now()
  where id=p_run_id;

  update public.atlas_deployment_gates
  set status=v_status,
      evidence_ref='consensus:'||p_run_id::text,
      error_code=case when v_status='passed' then null else 'sovereign_consensus_not_passed' end,
      evaluated_at=now(),
      metadata=metadata || jsonb_build_object(
        'run_id',p_run_id,
        'artifact_sha',v_run.artifact_sha,
        'passed_count',v_passed,
        'required_count',3,
        'evidence_digest',v_digest,
        'github_actions_required',false
      ),
      updated_at=now()
  where deployment_id=v_run.deployment_id
    and gate_key='sovereign_consensus_3of3';

  return jsonb_build_object(
    'ok',v_status='passed',
    'run_id',v_run.id,
    'status',v_status,
    'passed_count',v_passed,
    'required_count',3,
    'evidence_digest',v_digest
  );
end;
$$;

create or replace function private.atlas_guard_sovereign_consensus_gate()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_run_id uuid;
  v_valid boolean;
begin
  if new.gate_key <> 'sovereign_consensus_3of3' or new.status <> 'passed' then
    return new;
  end if;

  if new.evidence_ref is null or new.evidence_ref !~ '^consensus:[0-9a-f-]{36}$' then
    raise exception 'sovereign_consensus_evidence_required';
  end if;

  v_run_id := replace(new.evidence_ref,'consensus:','')::uuid;

  select exists(
    select 1
    from public.atlas_consensus_runs r
    where r.id=v_run_id
      and r.deployment_id=new.deployment_id
      and r.status='passed'
      and r.required_count=3
      and r.passed_count=3
      and r.evidence_digest is not null
  ) into v_valid;

  if not v_valid then
    raise exception 'sovereign_consensus_not_verified';
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_guard_sovereign_consensus_gate
on public.atlas_deployment_gates;

create trigger atlas_guard_sovereign_consensus_gate
before insert or update of status,evidence_ref
on public.atlas_deployment_gates
for each row
execute function private.atlas_guard_sovereign_consensus_gate();

revoke all on function public.atlas_begin_sovereign_consensus(uuid,text,text,jsonb)
from public,anon,authenticated;
revoke all on function public.atlas_record_sovereign_consensus_opinion(uuid,text,text,text,text,text,jsonb)
from public,anon,authenticated;
revoke all on function public.atlas_finalize_sovereign_consensus(uuid)
from public,anon,authenticated;

grant execute on function public.atlas_begin_sovereign_consensus(uuid,text,text,jsonb) to service_role;
grant execute on function public.atlas_record_sovereign_consensus_opinion(uuid,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.atlas_finalize_sovereign_consensus(uuid) to service_role;
