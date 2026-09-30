-- ATLAS Device OS trust hardening
-- Enrollment is not reachability. Active mTLS is provider-backed evidence only.

update public.atlas_local_agents
set status = 'offline'
where status = 'online'
  and last_seen_at is null;

alter table public.atlas_local_agents
  alter column status set default 'offline';

update public.atlas_local_agents
set mtls_status = 'pending',
    realtime_last_connected_at = null,
    updated_at = now()
where mtls_status = 'active'
  and (
    mtls_cloudflare_cert_id is null
    or mtls_cert_fingerprint_sha256 is null
    or mtls_cert_serial is null
    or mtls_cert_expires_at is null
  );

alter table public.atlas_local_agents
  drop constraint if exists atlas_local_agents_online_requires_heartbeat;

alter table public.atlas_local_agents
  add constraint atlas_local_agents_online_requires_heartbeat
  check (status <> 'online' or last_seen_at is not null);

alter table public.atlas_local_agents
  drop constraint if exists atlas_local_agents_active_mtls_requires_provider_evidence;

alter table public.atlas_local_agents
  add constraint atlas_local_agents_active_mtls_requires_provider_evidence
  check (
    mtls_status <> 'active'
    or (
      mtls_cloudflare_cert_id is not null
      and mtls_cert_fingerprint_sha256 is not null
      and mtls_cert_serial is not null
      and mtls_cert_expires_at is not null
    )
  );

comment on constraint atlas_local_agents_online_requires_heartbeat on public.atlas_local_agents is
  'An agent may be reported online only after heartbeat evidence exists. Enrollment alone remains offline.';

comment on constraint atlas_local_agents_active_mtls_requires_provider_evidence on public.atlas_local_agents is
  'Active mTLS requires Cloudflare provider certificate identity plus certificate metadata synchronized by the signed provisioning workflow.';
