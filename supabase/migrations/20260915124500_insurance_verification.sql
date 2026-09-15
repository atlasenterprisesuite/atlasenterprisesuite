create table if not exists public.insurance_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('insurance_access', 'member_policy')),
  resource_id text,
  code_hash text not null,
  delivery_channel text not null default 'email' check (delivery_channel = 'email'),
  delivery_target_masked text not null default '',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 5),
  resend_count integer not null default 0 check (resend_count >= 0 and resend_count <= 3),
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_verification_challenges_resource_scope_check check (
    (scope = 'insurance_access' and resource_id is null)
    or
    (scope = 'member_policy' and resource_id is not null and length(trim(resource_id)) > 0)
  ),
  constraint insurance_verification_challenges_expiry_check check (expires_at > created_at)
);

create table if not exists public.insurance_verification_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('insurance_access', 'member_policy')),
  resource_id text,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  challenge_id uuid not null unique references public.insurance_verification_challenges(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint insurance_verification_grants_resource_scope_check check (
    (scope = 'insurance_access' and resource_id is null)
    or
    (scope = 'member_policy' and resource_id is not null and length(trim(resource_id)) > 0)
  ),
  constraint insurance_verification_grants_expiry_check check (expires_at > verified_at)
);

create table if not exists public.insurance_verification_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid references public.insurance_verification_challenges(id) on delete set null,
  scope text not null check (scope in ('insurance_access', 'member_policy')),
  resource_id text,
  action text not null check (action in (
    'issue',
    'resend',
    'verify_success',
    'verify_failure',
    'lockout',
    'delivery_configuration_failure',
    'delivery_failure'
  )),
  error_code text,
  created_at timestamptz not null default now(),
  constraint insurance_verification_audit_resource_scope_check check (
    (scope = 'insurance_access' and resource_id is null)
    or
    (scope = 'member_policy' and resource_id is not null and length(trim(resource_id)) > 0)
  )
);

create index if not exists insurance_verification_challenges_active_idx
  on public.insurance_verification_challenges (org_id, user_id, scope, resource_id, expires_at desc)
  where consumed_at is null;

create index if not exists insurance_verification_grants_active_idx
  on public.insurance_verification_grants (org_id, user_id, scope, resource_id, expires_at desc);

create index if not exists insurance_verification_audit_actor_idx
  on public.insurance_verification_audit (org_id, user_id, created_at desc);

alter table public.insurance_verification_challenges enable row level security;
alter table public.insurance_verification_grants enable row level security;
alter table public.insurance_verification_audit enable row level security;

create policy insurance_verification_challenges_member_read
  on public.insurance_verification_challenges
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = insurance_verification_challenges.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy insurance_verification_grants_member_read
  on public.insurance_verification_grants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = insurance_verification_grants.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy insurance_verification_audit_member_read
  on public.insurance_verification_audit
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = insurance_verification_audit.org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

revoke all on public.insurance_verification_challenges from anon;
revoke all on public.insurance_verification_challenges from authenticated;
revoke all on public.insurance_verification_grants from anon;
revoke all on public.insurance_verification_grants from authenticated;
revoke all on public.insurance_verification_audit from anon;
revoke all on public.insurance_verification_audit from authenticated;

grant select (
  id,
  org_id,
  user_id,
  scope,
  resource_id,
  delivery_channel,
  delivery_target_masked,
  expires_at,
  consumed_at,
  attempt_count,
  resend_count,
  last_sent_at,
  created_at,
  updated_at
) on public.insurance_verification_challenges to authenticated;

grant select (
  id,
  org_id,
  user_id,
  scope,
  resource_id,
  verified_at,
  expires_at,
  challenge_id,
  created_at
) on public.insurance_verification_grants to authenticated;

grant select (
  id,
  org_id,
  user_id,
  challenge_id,
  scope,
  resource_id,
  action,
  error_code,
  created_at
) on public.insurance_verification_audit to authenticated;

comment on table public.insurance_verification_challenges is 'Server-controlled, tenant-scoped ATLAS Insurance OTP challenges. Plaintext OTP values are never stored.';
comment on column public.insurance_verification_challenges.code_hash is 'Server-derived OTP digest. This column is not granted to authenticated browser roles.';
comment on table public.insurance_verification_grants is 'Short-lived scoped verification grants that supplement, never replace, ATLAS authentication and authorization.';
comment on table public.insurance_verification_audit is 'Tenant-scoped audit trail for Insurance verification lifecycle events. No OTP or digest material is stored here.';
