-- ATLAS Certificate Lifecycle: tenant-scoped public certificate metadata only.
-- No private keys, client secrets, CSR private material or bearer tokens may be stored here.
create table if not exists public.atlas_certificate_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 140),
  hostname text not null check (
    hostname = lower(hostname)
    and length(hostname) between 3 and 253
    and hostname ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'
    and hostname not like '%.local'
    and hostname not like '%.internal'
    and hostname not like 'localhost%'
  ),
  port integer not null default 443 check (port between 1 and 65535),
  provider text not null default 'other' check (length(provider) between 1 and 80),
  environment text not null default 'production' check (environment in ('production','staging','development')),
  purpose text not null default 'server_tls' check (purpose in ('server_tls','mtls_client','mtls_server')),
  monitoring_approved boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint atlas_certificate_targets_org_key unique (id, org_id),
  constraint atlas_certificate_targets_unique unique (org_id,hostname,port,purpose,environment)
);

create table if not exists public.atlas_certificate_observations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  target_id uuid not null,
  observed_at timestamptz not null default now(),
  observation_status text not null check (observation_status in ('verified_tls','tls_failure','unknown')),
  source text not null check (source in ('github_actions_oidc','approved_internal_agent')),
  certificate_sha256 text check (certificate_sha256 ~ '^[0-9a-f]{64}$'),
  certificate_subject text check (length(certificate_subject) <= 512),
  certificate_issuer text check (length(certificate_issuer) <= 512),
  not_before timestamptz,
  not_after timestamptz,
  tls_protocol text check (length(tls_protocol) <= 40),
  hostname_verified boolean not null default false,
  chain_verified boolean not null default false,
  mtls_verified boolean not null default false,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_ref text not null check (length(evidence_ref) between 6 and 700),
  created_at timestamptz not null default now(),
  constraint atlas_certificate_observations_target_fk foreign key(target_id,org_id)
    references public.atlas_certificate_targets(id,org_id) on delete cascade,
  constraint atlas_certificate_observations_verified_requires_proof check (
    observation_status <> 'verified_tls'
    or (certificate_sha256 is not null and hostname_verified and chain_verified
        and not_before is not null and not_after is not null
        and not_after > observed_at)
  ),
  constraint atlas_certificate_observations_unique_evidence unique (org_id, target_id, evidence_sha256)
);
create index if not exists atlas_cert_targets_org_idx on public.atlas_certificate_targets(org_id);
create index if not exists atlas_cert_observations_org_target_date_idx on public.atlas_certificate_observations(org_id,target_id,observed_at desc);

alter table public.atlas_certificate_targets enable row level security;
alter table public.atlas_certificate_observations enable row level security;
-- Read access is restricted to active organization owners/admins via the existing ATLAS identity helper.
create policy atlas_certificate_targets_owner_read on public.atlas_certificate_targets
  for select to authenticated
  using (public.has_org_role(org_id, array['owner','admin']::text[]));
create policy atlas_certificate_targets_owner_intake on public.atlas_certificate_targets
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['owner','admin']::text[])
    and created_by = (select auth.uid()) and monitoring_approved = false
  );
create policy atlas_certificate_observations_owner_read on public.atlas_certificate_observations
  for select to authenticated
  using (public.has_org_role(org_id, array['owner','admin']::text[]));

revoke all on public.atlas_certificate_targets from public, anon, authenticated;
revoke all on public.atlas_certificate_observations from public, anon, authenticated;
grant select, insert on public.atlas_certificate_targets to authenticated;
grant select on public.atlas_certificate_observations to authenticated;
-- Ingestion of observations and approval of targets are strictly service-role/server operations.
comment on table public.atlas_certificate_targets is 'Tenant-scoped monitor intake; only server-approved targets are eligible for certificate probes.';
comment on table public.atlas_certificate_observations is 'Append-only server evidence with SHA256 provenance; clients have read-only access under org owner/admin RLS.';
