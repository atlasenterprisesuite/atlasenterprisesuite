-- ATLAS Local Agent hardening: mTLS identity + realtime bus metadata

alter table public.atlas_local_agents
  add column if not exists mtls_status text not null default 'unconfigured'
    check (mtls_status in ('unconfigured','pending','active','expired','revoked')),
  add column if not exists mtls_cert_fingerprint_sha256 text,
  add column if not exists mtls_cert_serial text,
  add column if not exists mtls_cloudflare_cert_id text,
  add column if not exists mtls_cert_expires_at timestamptz,
  add column if not exists realtime_last_connected_at timestamptz,
  add column if not exists installer_version text;

alter table public.atlas_local_agents
  drop constraint if exists atlas_local_agents_mtls_fingerprint_shape;

alter table public.atlas_local_agents
  add constraint atlas_local_agents_mtls_fingerprint_shape check (
    mtls_cert_fingerprint_sha256 is null
    or mtls_cert_fingerprint_sha256 ~ '^[a-f0-9]{64}$'
  );

create index if not exists atlas_local_agents_mtls_fingerprint_idx
  on public.atlas_local_agents (org_id, mtls_cert_fingerprint_sha256)
  where mtls_cert_fingerprint_sha256 is not null;

create index if not exists atlas_local_agents_realtime_seen_idx
  on public.atlas_local_agents (org_id, realtime_last_connected_at desc)
  where realtime_last_connected_at is not null;

comment on column public.atlas_local_agents.mtls_cert_fingerprint_sha256 is
  'SHA-256 fingerprint of the Cloudflare-validated client certificate bound to this agent. Public certificate metadata only; no private keys.';
comment on column public.atlas_local_agents.mtls_cert_serial is
  'Client certificate serial returned by the trusted mTLS edge.';
comment on column public.atlas_local_agents.mtls_cloudflare_cert_id is
  'Cloudflare client-certificate identifier used for provider-side revocation; public certificate metadata only.';
comment on column public.atlas_local_agents.realtime_last_connected_at is
  'Last successful mTLS realtime bus authorization; not a permanent online assertion.';
