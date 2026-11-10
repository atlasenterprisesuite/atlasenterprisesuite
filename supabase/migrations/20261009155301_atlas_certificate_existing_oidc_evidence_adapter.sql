-- Capture only signed GitHub Actions OIDC certificate-monitor evidence emitted by
-- the already deployed atlas-infra-evidence endpoint.
-- The receiver verifies GitHub's JWT signature and an exact main-branch workflow_ref.
-- A separate Edge Function is not required; all existing infrastructure evidence
-- entrypoints and schemas remain unchanged.
create or replace function atlas_private.capture_certificate_from_infra_evidence()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_org_id uuid;
  v_target_id uuid;
  v_observed_at timestamptz;
  v_not_before timestamptz;
  v_not_after timestamptz;
  v_success boolean;
  v_fingerprint text;
  v_evidence_ref text;
begin
  -- No work on unrelated infrastructure evidence.
  if new.verification_type is distinct from 'public-edge-verification'
     or new.target_service is distinct from 'atlas-certificate-monitor'
     or new.provider is distinct from 'cloudflare' then
    return new;
  end if;

  -- Never accept the ordinary native runtime invocation path as a TLS issuer.
  if new.metadata->>'source' is distinct from 'github-actions-oidc'
     or new.metadata->>'workflow' is distinct from
       'atlasenterprisesuite/atlasenterprisesuite/.github/workflows/cloudflare-deploy.yml@refs/heads/main'
     or new.metadata->>'ref' is distinct from 'refs/heads/main'
     or coalesce(new.metadata->>'run_id','') !~ '^[0-9]+$'
     or coalesce(new.metadata->>'run_attempt','') !~ '^[0-9]+$' then
    raise exception 'certificate_trusted_issuer_required';
  end if;

  if new.status not in ('passed','failed')
     or jsonb_typeof(new.checks) is distinct from 'object'
     or new.checks->>'hostname' is distinct from 'www.atlasenterprisesuite.com'
     or new.checks->>'port' is distinct from '443'
     or new.checks->>'mtls_verified' is distinct from 'false'
     or new.environment is distinct from 'production' then
    raise exception 'certificate_observation_contract_invalid';
  end if;

  select t.org_id,t.id
    into strict v_org_id,v_target_id
    from public.atlas_certificate_targets t
    join public.organizations o on o.id = t.org_id
   where o.name = 'ATLAS' and o.active
     and t.hostname = 'www.atlasenterprisesuite.com'
     and t.port = 443
     and t.environment = 'production'
     and t.purpose = 'server_tls'
     and t.monitoring_approved = true;

  v_observed_at := (new.checks->>'observed_at')::timestamptz;
  if v_observed_at is null
     or abs(extract(epoch from (new.completed_at-v_observed_at))) > 300 then
    raise exception 'certificate_observation_stale';
  end if;

  v_success := new.status = 'passed';
  v_fingerprint := new.checks->>'certificate_sha256';
  if v_success then
    v_not_before := (new.checks->>'not_before')::timestamptz;
    v_not_after := (new.checks->>'not_after')::timestamptz;
    if new.checks->>'hostname_verified' is distinct from 'true'
       or new.checks->>'chain_verified' is distinct from 'true'
       or v_fingerprint is null
       or v_fingerprint !~ '^[0-9a-f]{64}$'
       or v_not_before is null
       or v_not_after is null
       or v_not_before > v_observed_at
       or v_not_after <= v_observed_at then
      raise exception 'certificate_tls_validation_not_proven';
    end if;
  end if;

  v_evidence_ref := 'github-actions:atlasenterprisesuite/atlasenterprisesuite:'
       || new.metadata->>'run_id' || ':' || new.metadata->>'run_attempt';

  insert into public.atlas_certificate_observations (
    org_id,target_id,observed_at,observation_status,source,
    certificate_sha256,certificate_subject,certificate_issuer,
    not_before,not_after,tls_protocol,
    hostname_verified,chain_verified,mtls_verified,
    evidence_sha256,evidence_ref
  ) values (
    v_org_id,v_target_id,v_observed_at,
    case when v_success then 'verified_tls' else 'tls_failure' end,
    'github_actions_oidc',
    case when v_success then v_fingerprint else null end,
    case when v_success then left(new.checks->>'certificate_subject',512) else null end,
    case when v_success then left(new.checks->>'certificate_issuer',512) else null end,
    case when v_success then v_not_before else null end,
    case when v_success then v_not_after else null end,
    case when v_success then left(new.checks->>'tls_protocol',40) else null end,
    v_success,v_success,false,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(new.id::text,'UTF8')),'hex'),
    v_evidence_ref
  );
  -- Duplicate GitHub run references fail with a UNIQUE constraint; no replay overwrite.
  return new;
end;
$function$;

revoke all on function atlas_private.capture_certificate_from_infra_evidence()
  from public,anon,authenticated;

drop trigger if exists atlas_certificate_from_infra_evidence
  on public.atlas_runtime_verification_runs;
create trigger atlas_certificate_from_infra_evidence
after insert on public.atlas_runtime_verification_runs
for each row execute function atlas_private.capture_certificate_from_infra_evidence();
