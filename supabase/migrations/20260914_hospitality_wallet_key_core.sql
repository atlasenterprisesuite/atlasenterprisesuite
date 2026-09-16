create table if not exists public.hospitality_pms_provider_instances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  provider_type text not null check (provider_type in ('oracle_opera_cloud','mews','cloudbeds','infor_hms','generic_certified_pms')),
  display_name text not null check (length(trim(display_name)) > 0),
  state text not null default 'not_configured' check (state in ('not_configured','configured_unverified','ready','degraded','offline','disabled')),
  external_property_id text,
  capabilities text[] not null default '{}'::text[],
  configuration_version integer not null default 1 check (configuration_version > 0),
  last_verified_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, property_id, provider_type)
);

create table if not exists public.hospitality_stays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  pms_provider_instance_id uuid not null references public.hospitality_pms_provider_instances(id) on delete restrict,
  external_reservation_id text not null check (length(trim(external_reservation_id)) > 0),
  external_guest_reference text,
  status text not null default 'reserved' check (status in ('reserved','checked_in','checked_out','cancelled','unknown')),
  arrival_at timestamptz not null,
  departure_at timestamptz not null,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  source_version text not null default '1',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure_at > arrival_at),
  unique (org_id, property_id, pms_provider_instance_id, external_reservation_id)
);

create table if not exists public.hospitality_room_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  stay_id uuid not null references public.hospitality_stays(id) on delete cascade,
  room_id uuid references public.hospitality_rooms(id) on delete set null,
  external_pms_room_id text not null check (length(trim(external_pms_room_id)) > 0),
  provider_room_mapping_id uuid references public.hospitality_room_mappings(id) on delete set null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','superseded','checked_out','cancelled')),
  assigned_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

alter table public.hospitality_stays
  add column if not exists room_assignment_id uuid references public.hospitality_room_assignments(id) on delete set null;

create table if not exists public.hospitality_wallet_provisioning_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  stay_id uuid not null references public.hospitality_stays(id) on delete cascade,
  credential_reference_id uuid not null references public.hospitality_credential_references(id) on delete cascade,
  wallet_platform text not null check (wallet_platform in ('apple_wallet','google_wallet','provider_app')),
  transport text not null check (transport in ('nfc','ble')),
  provider_type text not null check (length(trim(provider_type)) > 0),
  state text not null default 'created' check (state in ('created','ready','consumed','revoked','expired','failed')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credential_reference_id)
);

create table if not exists public.hospitality_integration_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  pms_provider_instance_id uuid not null references public.hospitality_pms_provider_instances(id) on delete restrict,
  source_event_id text not null check (length(trim(source_event_id)) > 0),
  source_version text not null default '1',
  event_type text not null check (length(trim(event_type)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received','processing','processed','failed','dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  last_error_code text,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, property_id, pms_provider_instance_id, idempotency_key)
);

create table if not exists public.hospitality_automation_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hospitality_properties(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  enabled boolean not null default false,
  auto_wallet_key_on_checkin boolean not null default false,
  allowed_platforms text[] not null default '{}'::text[] check (allowed_platforms <@ array['apple_wallet','google_wallet','provider_app']::text[]),
  allowed_transports text[] not null default '{}'::text[] check (allowed_transports <@ array['nfc','ble']::text[]),
  allowed_access_scopes text[] not null default array['room']::text[],
  activation_lead_minutes integer not null default 0 check (activation_lead_minutes between 0 and 1440),
  credential_expiry_offset_minutes integer not null default 0 check (credential_expiry_offset_minutes between 0 and 1440),
  room_change_mode text not null default 'provider_safe_sequence' check (room_change_mode = 'provider_safe_sequence'),
  max_retry_attempts integer not null default 0 check (max_retry_attempts between 0 and 3),
  manual_review_on_failure boolean not null default true,
  emergency_kill_switch boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, property_id)
);

alter table public.hospitality_credential_references
  add column if not exists stay_id uuid references public.hospitality_stays(id) on delete set null,
  add column if not exists room_assignment_id uuid references public.hospitality_room_assignments(id) on delete set null,
  add column if not exists wallet_platform text not null default 'none',
  add column if not exists wallet_state text not null default 'not_requested',
  add column if not exists access_transport text,
  add column if not exists issuance_actor text not null default 'user';

alter table public.hospitality_credential_references
  drop constraint if exists hospitality_credential_references_wallet_platform_check;
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_wallet_platform_check
  check (wallet_platform in ('apple_wallet','google_wallet','provider_app','none'));
alter table public.hospitality_credential_references
  drop constraint if exists hospitality_credential_references_wallet_state_check;
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_wallet_state_check
  check (wallet_state in ('not_requested','eligible','provisioning_ready','provisioned','revoked','expired','failed','unknown'));
alter table public.hospitality_credential_references
  drop constraint if exists hospitality_credential_references_access_transport_check;
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_access_transport_check
  check (access_transport is null or access_transport in ('nfc','ble'));
alter table public.hospitality_credential_references
  drop constraint if exists hospitality_credential_references_issuance_actor_check;
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_issuance_actor_check
  check (issuance_actor in ('user','service'));

create index if not exists hospitality_pms_instances_property_state_idx on public.hospitality_pms_provider_instances (property_id, state);
create index if not exists hospitality_stays_property_status_idx on public.hospitality_stays (property_id, status, departure_at);
create index if not exists hospitality_assignments_property_stay_idx on public.hospitality_room_assignments (property_id, stay_id, status);
create index if not exists hospitality_wallet_sessions_property_state_idx on public.hospitality_wallet_provisioning_sessions (property_id, state, expires_at);
create index if not exists hospitality_integration_events_idempotency_idx on public.hospitality_integration_events (org_id, property_id, pms_provider_instance_id, idempotency_key);

alter table public.hospitality_pms_provider_instances enable row level security;
alter table public.hospitality_stays enable row level security;
alter table public.hospitality_room_assignments enable row level security;
alter table public.hospitality_wallet_provisioning_sessions enable row level security;
alter table public.hospitality_integration_events enable row level security;
alter table public.hospitality_automation_policies enable row level security;

-- All recovered wallet/PMS tables require explicit property scope or privileged corporate scope.
create policy hospitality_pms_provider_instances_property_read on public.hospitality_pms_provider_instances for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_pms_provider_instances.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_pms_provider_instances.org_id and hpm.property_id = hospitality_pms_provider_instances.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);
create policy hospitality_stays_property_read on public.hospitality_stays for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_stays.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_stays.org_id and hpm.property_id = hospitality_stays.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);
create policy hospitality_room_assignments_property_read on public.hospitality_room_assignments for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_room_assignments.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_room_assignments.org_id and hpm.property_id = hospitality_room_assignments.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);
create policy hospitality_wallet_provisioning_sessions_property_read on public.hospitality_wallet_provisioning_sessions for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_wallet_provisioning_sessions.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_wallet_provisioning_sessions.org_id and hpm.property_id = hospitality_wallet_provisioning_sessions.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);
create policy hospitality_integration_events_property_read on public.hospitality_integration_events for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_integration_events.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_integration_events.org_id and hpm.property_id = hospitality_integration_events.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);
create policy hospitality_automation_policies_property_read on public.hospitality_automation_policies for select to authenticated using (
  exists (select 1 from public.organization_members om where om.org_id = hospitality_automation_policies.org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('owner','admin','platform_admin'))
  or exists (select 1 from public.hospitality_property_memberships hpm where hpm.org_id = hospitality_automation_policies.org_id and hpm.property_id = hospitality_automation_policies.property_id and hpm.user_id = auth.uid() and hpm.status = 'active')
);

revoke all on public.hospitality_pms_provider_instances from authenticated;
revoke all on public.hospitality_stays from authenticated;
revoke all on public.hospitality_room_assignments from authenticated;
revoke all on public.hospitality_wallet_provisioning_sessions from authenticated;
revoke all on public.hospitality_integration_events from authenticated;
revoke all on public.hospitality_automation_policies from authenticated;
grant select on public.hospitality_pms_provider_instances to authenticated;
grant select on public.hospitality_stays to authenticated;
grant select on public.hospitality_room_assignments to authenticated;
grant select on public.hospitality_wallet_provisioning_sessions to authenticated;
grant select on public.hospitality_integration_events to authenticated;
grant select on public.hospitality_automation_policies to authenticated;

comment on table public.hospitality_wallet_provisioning_sessions is 'Wallet/provider-app lifecycle metadata only; no decrypted tokens or raw credential material.';
comment on table public.hospitality_integration_events is 'Property-scoped integration event idempotency and processing ledger.';
