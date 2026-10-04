-- ATLAS TrustPass Core Web persistence.
-- Security state is server-controlled; authenticated clients receive only scoped read views.

create table if not exists public.atlas_trust_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  policy_key text not null check (length(trim(policy_key)) > 0),
  version integer not null check (version > 0),
  action_class text not null check (action_class in ('P0', 'P1', 'P2', 'P3')),
  minimum_assurance text not null check (minimum_assurance in ('authenticated', 'aal2', 'phishing_resistant')),
  step_up_max_age_seconds integer not null default 300 check (step_up_max_age_seconds between 0 and 86400),
  grant_ttl_seconds integer not null default 300 check (grant_ttl_seconds between 1 and 86400),
  mode text not null default 'shadow' check (mode in ('shadow', 'enforce')),
  is_active boolean not null default true,
  policy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organization_id, policy_key, version)
);

create table if not exists public.atlas_trust_risk_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  action_type text not null,
  resource_id text,
  action_class text not null check (action_class in ('P0', 'P1', 'P2', 'P3')),
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_band text not null check (risk_band in ('low', 'medium', 'high', 'critical')),
  reason_codes text[] not null default '{}',
  policy_id uuid references public.atlas_trust_policies(id) on delete set null,
  policy_version integer not null check (policy_version > 0),
  decision text not null check (decision in ('allow', 'step_up_required', 'temporary_hold', 'deny')),
  recommended_decision text not null check (recommended_decision in ('allow', 'step_up_required', 'temporary_hold', 'deny')),
  mode text not null check (mode in ('shadow', 'enforce')),
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_trust_challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  method text not null check (method in ('webauthn', 'totp')),
  action_type text not null,
  action_class text not null check (action_class in ('P0', 'P1', 'P2', 'P3')),
  action_scope text not null,
  action_hash text,
  challenge_digest text not null,
  rp_id text,
  expected_origin text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  locked_at timestamptz,
  revoked_at timestamptz,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint atlas_trust_challenges_expiry_check check (expires_at > created_at)
);

create table if not exists public.atlas_trust_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  policy_id uuid references public.atlas_trust_policies(id) on delete set null,
  policy_version integer not null check (policy_version > 0),
  action_class text not null check (action_class in ('P0', 'P1', 'P2', 'P3')),
  action_scope text not null,
  action_hash text,
  assurance_level text not null check (assurance_level in ('authenticated', 'aal2', 'phishing_resistant')),
  authenticator_method text not null,
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_band text not null check (risk_band in ('low', 'medium', 'high', 'critical')),
  single_use boolean not null default false,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  correlation_id uuid not null,
  constraint atlas_trust_grants_expiry_check check (expires_at > issued_at)
);

create table if not exists public.atlas_webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rp_id text not null check (length(trim(rp_id)) > 0),
  credential_id text not null check (length(trim(credential_id)) > 0),
  public_key text not null check (length(trim(public_key)) > 0),
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  backup_eligible boolean not null default false,
  backup_state boolean not null default false,
  display_label text not null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (rp_id, user_id, credential_id)
);

create unique index if not exists atlas_trust_platform_policy_version_idx
  on public.atlas_trust_policies (policy_key, version)
  where organization_id is null;

create index if not exists atlas_trust_policies_active_idx
  on public.atlas_trust_policies (organization_id, policy_key, version desc)
  where is_active = true;

create index if not exists atlas_trust_risk_events_actor_idx
  on public.atlas_trust_risk_events (organization_id, user_id, created_at desc);

create index if not exists atlas_trust_challenges_active_idx
  on public.atlas_trust_challenges (organization_id, user_id, session_id, expires_at desc)
  where consumed_at is null and revoked_at is null and locked_at is null;

create index if not exists atlas_trust_grants_active_idx
  on public.atlas_trust_grants (organization_id, user_id, session_id, expires_at desc)
  where revoked_at is null;

create index if not exists atlas_webauthn_credentials_actor_idx
  on public.atlas_webauthn_credentials (organization_id, user_id, revoked_at, created_at desc);

alter table public.atlas_trust_policies enable row level security;
alter table public.atlas_trust_risk_events enable row level security;
alter table public.atlas_trust_challenges enable row level security;
alter table public.atlas_trust_grants enable row level security;
alter table public.atlas_webauthn_credentials enable row level security;

create policy atlas_trust_policies_member_read
  on public.atlas_trust_policies
  for select
  to authenticated
  using (
    organization_id is null
    or exists (
      select 1
      from public.organization_members om
      where om.org_id = atlas_trust_policies.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy atlas_trust_risk_events_actor_read
  on public.atlas_trust_risk_events
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = atlas_trust_risk_events.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy atlas_trust_challenges_actor_read
  on public.atlas_trust_challenges
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = atlas_trust_challenges.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy atlas_trust_grants_actor_read
  on public.atlas_trust_grants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = atlas_trust_grants.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy atlas_webauthn_credentials_actor_read
  on public.atlas_webauthn_credentials
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = atlas_webauthn_credentials.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

revoke all on public.atlas_trust_policies from anon, authenticated;
revoke all on public.atlas_trust_risk_events from anon, authenticated;
revoke all on public.atlas_trust_challenges from anon, authenticated;
revoke all on public.atlas_trust_grants from anon, authenticated;
revoke all on public.atlas_webauthn_credentials from anon, authenticated;

grant select (
  id, organization_id, policy_key, version, action_class, minimum_assurance,
  step_up_max_age_seconds, grant_ttl_seconds, mode, is_active, created_at
) on public.atlas_trust_policies to authenticated;

grant select (
  id, organization_id, user_id, session_id, action_type, resource_id, action_class,
  risk_score, risk_band, reason_codes, policy_id, policy_version, decision,
  recommended_decision, mode, correlation_id, created_at
) on public.atlas_trust_risk_events to authenticated;

grant select (
  id, organization_id, user_id, session_id, method, action_type, action_class,
  action_scope, action_hash, expires_at, consumed_at, locked_at, revoked_at,
  correlation_id, created_at
) on public.atlas_trust_challenges to authenticated;

grant select (
  id, organization_id, user_id, session_id, policy_id, policy_version,
  action_class, action_scope, action_hash, assurance_level, authenticator_method,
  risk_score, risk_band, single_use, issued_at, expires_at, consumed_at,
  revoked_at, correlation_id
) on public.atlas_trust_grants to authenticated;

grant select (
  id, organization_id, user_id, rp_id, credential_id, counter, transports,
  backup_eligible, backup_state, display_label, created_at, last_used_at, revoked_at
) on public.atlas_webauthn_credentials to authenticated;

comment on table public.atlas_trust_risk_events is 'Append-only TrustPass decision evidence written by server-side security services.';
comment on table public.atlas_trust_challenges is 'Short-lived server-controlled TrustPass verification challenges.';
comment on table public.atlas_trust_grants is 'Short-lived scoped TrustPass evidence; grants supplement rather than replace Identity and RBAC.';
comment on table public.atlas_webauthn_credentials is 'Public WebAuthn credential material and user-visible metadata; browser clients cannot mutate verification counters.';
