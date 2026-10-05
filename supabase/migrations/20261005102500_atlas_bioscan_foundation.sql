-- ATLAS BioScan + Human Digital Twin Phase 1 foundation.
-- NO DATA -> NO CLAIM. Canonical BioScan data is organization + subject scoped,
-- browser read-only, provenance-aware, and mutated only through governed server workflows.

insert into public.identity_permissions (code, description)
values
  ('health.bioscan.read', 'Read subject-scoped ATLAS BioScan sessions, snapshots and observations.'),
  ('health.bioscan.capture', 'Create and advance a consented ATLAS BioScan capture through governed server workflows.'),
  ('health.bioscan.manage', 'Manage another subject''s ATLAS BioScan data within an authorized organization.'),
  ('health.bioscan.audit', 'Review ATLAS BioScan audit evidence without exposing raw capture media.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'health.bioscan.read'),
  ('owner', 'health.bioscan.capture'),
  ('owner', 'health.bioscan.manage'),
  ('owner', 'health.bioscan.audit'),
  ('admin', 'health.bioscan.read'),
  ('admin', 'health.bioscan.capture'),
  ('admin', 'health.bioscan.manage'),
  ('admin', 'health.bioscan.audit'),
  ('manager', 'health.bioscan.read'),
  ('manager', 'health.bioscan.capture'),
  ('staff', 'health.bioscan.read'),
  ('staff', 'health.bioscan.capture')
on conflict do nothing;

create table if not exists public.bioscan_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'body_scan' check (scope = 'body_scan'),
  status text not null default 'granted' check (status in ('granted','revoked','expired')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  policy_version text not null default 'bioscan-consent-v1' check (char_length(btrim(policy_version)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint bioscan_consents_tenant_scope check (tenant_id = org_id),
  constraint bioscan_consents_revocation_time check (status <> 'revoked' or revoked_at is not null),
  constraint bioscan_consents_expiry_time check (status <> 'expired' or expires_at is not null),
  constraint bioscan_consents_id_org_key unique (id, org_id),
  constraint bioscan_consents_id_org_subject_key unique (id, org_id, subject_user_id)
);

create table if not exists public.bioscan_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  consent_record_id uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'preparing'
    check (status in ('preparing','capturing','processing','complete','partial','failed','cancelled')),
  capture_mode text not null default 'camera'
    check (capture_mode in ('camera','camera_depth','lidar')),
  device_id text,
  quality_score double precision check (quality_score is null or quality_score between 0 and 1),
  coverage_score double precision check (coverage_score is null or coverage_score between 0 and 1),
  failure_reason text,
  idempotency_key text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bioscan_sessions_tenant_scope check (tenant_id = org_id),
  constraint bioscan_sessions_consent_scope_fkey
    foreign key (consent_record_id, org_id, subject_user_id)
    references public.bioscan_consents(id, org_id, subject_user_id)
    on delete restrict,
  constraint bioscan_sessions_id_org_key unique (id, org_id),
  constraint bioscan_sessions_id_org_subject_key unique (id, org_id, subject_user_id),
  constraint bioscan_sessions_org_idempotency_key unique (org_id, idempotency_key)
);

create table if not exists public.human_twin_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  bioscan_session_id uuid not null,
  captured_at timestamptz not null default now(),
  geometry_version text not null check (char_length(btrim(geometry_version)) > 0),
  coordinate_system text not null check (char_length(btrim(coordinate_system)) > 0),
  mesh_ref text,
  confidence_summary jsonb not null default '{}'::jsonb,
  source_summary jsonb not null default '{}'::jsonb,
  idempotency_key text not null check (char_length(btrim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  constraint human_twin_snapshots_tenant_scope check (tenant_id = org_id),
  constraint human_twin_snapshots_confidence_object check (jsonb_typeof(confidence_summary) = 'object'),
  constraint human_twin_snapshots_source_object check (jsonb_typeof(source_summary) = 'object'),
  constraint human_twin_snapshots_session_scope_fkey
    foreign key (bioscan_session_id, org_id, subject_user_id)
    references public.bioscan_sessions(id, org_id, subject_user_id)
    on delete cascade,
  constraint human_twin_snapshots_id_org_key unique (id, org_id),
  constraint human_twin_snapshots_id_org_subject_key unique (id, org_id, subject_user_id),
  constraint human_twin_snapshots_session_unique unique (org_id, bioscan_session_id),
  constraint human_twin_snapshots_idempotency_unique unique (org_id, idempotency_key)
);

create table if not exists public.body_landmarks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null,
  landmark_key text not null check (char_length(btrim(landmark_key)) > 0),
  coordinates jsonb not null,
  confidence double precision not null check (confidence between 0 and 1),
  source_sensor text not null check (char_length(btrim(source_sensor)) > 0),
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint body_landmarks_tenant_scope check (tenant_id = org_id),
  constraint body_landmarks_coordinates_object check (jsonb_typeof(coordinates) = 'object'),
  constraint body_landmarks_snapshot_scope_fkey
    foreign key (snapshot_id, org_id, subject_user_id)
    references public.human_twin_snapshots(id, org_id, subject_user_id)
    on delete cascade,
  constraint body_landmarks_snapshot_key unique (snapshot_id, landmark_key)
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null,
  metric_key text not null check (char_length(btrim(metric_key)) > 0),
  value double precision not null,
  unit text not null check (char_length(btrim(unit)) > 0),
  source_type text not null
    check (source_type in ('camera_estimate','depth_sensor','lidar_measurement','wearable','smart_scale','clinical_device','medical_record','user_entered','derived_from_verified_sources')),
  source_ref text not null check (char_length(btrim(source_ref)) > 0),
  confidence double precision not null check (confidence between 0 and 1),
  measured_at timestamptz not null,
  is_estimate boolean not null,
  method_version text not null check (char_length(btrim(method_version)) > 0),
  created_at timestamptz not null default now(),
  constraint body_measurements_tenant_scope check (tenant_id = org_id),
  constraint body_measurements_camera_estimate_truth check (source_type <> 'camera_estimate' or is_estimate = true),
  constraint body_measurements_snapshot_scope_fkey
    foreign key (snapshot_id, org_id, subject_user_id)
    references public.human_twin_snapshots(id, org_id, subject_user_id)
    on delete cascade,
  constraint body_measurements_snapshot_metric_source unique (snapshot_id, metric_key, source_type, source_ref)
);

create table if not exists public.sensor_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  metric_key text not null check (char_length(btrim(metric_key)) > 0),
  value jsonb not null,
  unit text not null check (char_length(btrim(unit)) > 0),
  source_type text not null
    check (source_type in ('camera_estimate','depth_sensor','lidar_measurement','wearable','smart_scale','clinical_device','medical_record','user_entered','derived_from_verified_sources')),
  source_ref text not null check (char_length(btrim(source_ref)) > 0),
  confidence double precision not null check (confidence between 0 and 1),
  measured_at timestamptz not null,
  is_estimate boolean not null,
  method_version text not null check (char_length(btrim(method_version)) > 0),
  created_at timestamptz not null default now(),
  constraint sensor_observations_tenant_scope check (tenant_id = org_id),
  constraint sensor_observations_camera_estimate_truth check (source_type <> 'camera_estimate' or is_estimate = true)
);

create table if not exists public.posture_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null,
  observation_key text not null check (char_length(btrim(observation_key)) > 0),
  value double precision not null,
  unit text,
  source_type text not null
    check (source_type in ('camera_estimate','depth_sensor','lidar_measurement','wearable','smart_scale','clinical_device','medical_record','user_entered','derived_from_verified_sources')),
  source_ref text not null check (char_length(btrim(source_ref)) > 0),
  confidence double precision not null check (confidence between 0 and 1),
  measured_at timestamptz not null,
  is_estimate boolean not null,
  method_version text not null check (char_length(btrim(method_version)) > 0),
  created_at timestamptz not null default now(),
  constraint posture_observations_tenant_scope check (tenant_id = org_id),
  constraint posture_observations_camera_estimate_truth check (source_type <> 'camera_estimate' or is_estimate = true),
  constraint posture_observations_snapshot_scope_fkey
    foreign key (snapshot_id, org_id, subject_user_id)
    references public.human_twin_snapshots(id, org_id, subject_user_id)
    on delete cascade
);

create index if not exists bioscan_consents_subject_status_idx
  on public.bioscan_consents(org_id, subject_user_id, scope, status, granted_at desc);
create index if not exists bioscan_sessions_subject_time_idx
  on public.bioscan_sessions(org_id, subject_user_id, started_at desc);
create index if not exists bioscan_sessions_status_idx
  on public.bioscan_sessions(org_id, status, updated_at desc);
create index if not exists human_twin_snapshots_subject_time_idx
  on public.human_twin_snapshots(org_id, subject_user_id, captured_at desc);
create index if not exists body_landmarks_snapshot_idx
  on public.body_landmarks(org_id, snapshot_id, landmark_key);
create index if not exists body_measurements_snapshot_idx
  on public.body_measurements(org_id, snapshot_id, metric_key);
create index if not exists sensor_observations_subject_time_idx
  on public.sensor_observations(org_id, subject_user_id, measured_at desc);
create index if not exists posture_observations_snapshot_idx
  on public.posture_observations(org_id, snapshot_id, observation_key);

create or replace function public.atlas_bioscan_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bioscan_sessions_touch on public.bioscan_sessions;
create trigger bioscan_sessions_touch
before update on public.bioscan_sessions
for each row execute function public.atlas_bioscan_touch_updated_at();

create or replace function public.atlas_bioscan_reject_snapshot_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'human_twin_snapshot_immutable';
end;
$$;

drop trigger if exists human_twin_snapshots_immutable on public.human_twin_snapshots;
create trigger human_twin_snapshots_immutable
before update on public.human_twin_snapshots
for each row execute function public.atlas_bioscan_reject_snapshot_update();

-- Service-only transactional subject erasure. Authorization is performed by the
-- JWT-protected control plane before its service client invokes this function.
create or replace function public.atlas_bioscan_delete_subject_data(
  p_org_id uuid,
  p_subject_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_posture integer := 0;
  v_sensors integer := 0;
  v_measurements integer := 0;
  v_landmarks integer := 0;
  v_snapshots integer := 0;
  v_sessions integer := 0;
  v_consents integer := 0;
begin
  delete from public.posture_observations where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_posture = row_count;
  delete from public.sensor_observations where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_sensors = row_count;
  delete from public.body_measurements where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_measurements = row_count;
  delete from public.body_landmarks where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_landmarks = row_count;
  delete from public.human_twin_snapshots where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_snapshots = row_count;
  delete from public.bioscan_sessions where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_sessions = row_count;
  delete from public.bioscan_consents where org_id = p_org_id and subject_user_id = p_subject_user_id;
  get diagnostics v_consents = row_count;

  return jsonb_build_object(
    'posture_observations', v_posture,
    'sensor_observations', v_sensors,
    'body_measurements', v_measurements,
    'body_landmarks', v_landmarks,
    'human_twin_snapshots', v_snapshots,
    'bioscan_sessions', v_sessions,
    'bioscan_consents', v_consents
  );
end;
$$;

revoke all on function public.atlas_bioscan_delete_subject_data(uuid, uuid) from public;
revoke all on function public.atlas_bioscan_delete_subject_data(uuid, uuid) from anon;
revoke all on function public.atlas_bioscan_delete_subject_data(uuid, uuid) from authenticated;
grant execute on function public.atlas_bioscan_delete_subject_data(uuid, uuid) to service_role;

alter table public.bioscan_consents enable row level security;
alter table public.bioscan_sessions enable row level security;
alter table public.human_twin_snapshots enable row level security;
alter table public.body_landmarks enable row level security;
alter table public.body_measurements enable row level security;
alter table public.sensor_observations enable row level security;
alter table public.posture_observations enable row level security;

revoke all on public.bioscan_consents from anon;
revoke all on public.bioscan_sessions from anon;
revoke all on public.human_twin_snapshots from anon;
revoke all on public.body_landmarks from anon;
revoke all on public.body_measurements from anon;
revoke all on public.sensor_observations from anon;
revoke all on public.posture_observations from anon;

revoke insert, update, delete on public.bioscan_consents from authenticated;
revoke insert, update, delete on public.bioscan_sessions from authenticated;
revoke insert, update, delete on public.human_twin_snapshots from authenticated;
revoke insert, update, delete on public.body_landmarks from authenticated;
revoke insert, update, delete on public.body_measurements from authenticated;
revoke insert, update, delete on public.sensor_observations from authenticated;
revoke insert, update, delete on public.posture_observations from authenticated;

grant select on public.bioscan_consents to authenticated;
grant select on public.bioscan_sessions to authenticated;
grant select on public.human_twin_snapshots to authenticated;
grant select on public.body_landmarks to authenticated;
grant select on public.body_measurements to authenticated;
grant select on public.sensor_observations to authenticated;
grant select on public.posture_observations to authenticated;

grant all on public.bioscan_consents to service_role;
grant all on public.bioscan_sessions to service_role;
grant all on public.human_twin_snapshots to service_role;
grant all on public.body_landmarks to service_role;
grant all on public.body_measurements to service_role;
grant all on public.sensor_observations to service_role;
grant all on public.posture_observations to service_role;

-- Same-organization membership alone is intentionally insufficient. The subject
-- must be the authenticated user unless health.bioscan.manage is present.
drop policy if exists bioscan_consents_read on public.bioscan_consents;
create policy bioscan_consents_read on public.bioscan_consents
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = bioscan_consents.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

drop policy if exists bioscan_sessions_read on public.bioscan_sessions;
create policy bioscan_sessions_read on public.bioscan_sessions
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = bioscan_sessions.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

drop policy if exists human_twin_snapshots_read on public.human_twin_snapshots;
create policy human_twin_snapshots_read on public.human_twin_snapshots
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = human_twin_snapshots.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

drop policy if exists body_landmarks_read on public.body_landmarks;
create policy body_landmarks_read on public.body_landmarks
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = body_landmarks.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

drop policy if exists body_measurements_read on public.body_measurements;
create policy body_measurements_read on public.body_measurements
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = body_measurements.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

drop policy if exists sensor_observations_read on public.sensor_observations;
create policy sensor_observations_read on public.sensor_observations
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = sensor_observations.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

drop policy if exists posture_observations_read on public.posture_observations;
create policy posture_observations_read on public.posture_observations
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = posture_observations.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
  and (
    (
      subject_user_id = (select auth.uid())
      and public.has_identity_permission(org_id, 'health.bioscan.read')
    )
    or public.has_identity_permission(org_id, 'health.bioscan.manage')
  )
);

comment on table public.bioscan_consents is 'Explicit subject consent for ATLAS BioScan body capture. Revocation is fail-closed for subsequent transitions.';
comment on table public.bioscan_sessions is 'Governed BioScan capture state. A session never implies a measurement exists.';
comment on table public.human_twin_snapshots is 'Immutable Human Digital Twin history derived from a completed or partial BioScan session.';
comment on table public.body_landmarks is 'Spatial body landmarks with confidence and source sensor; not a clinical diagnosis.';
comment on table public.body_measurements is 'Provenance-aware body measurements. camera_estimate rows must remain explicitly estimated.';
comment on table public.sensor_observations is 'Authorized external observations preserving original source identity and timestamps.';
comment on table public.posture_observations is 'Geometric posture observations only; no medical diagnosis is implied.';
