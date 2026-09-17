-- ATLAS Device & Account Protection core persistence.
-- Tenant-scoped, fail-closed security evidence. Provider-dependent signals remain unknown
-- until a real provider returns evidence; biometric/private passkey material is never stored.

create table if not exists public.security_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  display_name text,
  platform_label text,
  browser_label text,
  status text not null default 'untrusted'
    check (status in ('untrusted','trusted','revoked','compromised')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  trusted_at timestamptz,
  trusted_by_user_id uuid references auth.users(id) on delete set null,
  trust_expires_at timestamptz,
  revoked_at timestamptz,
  compromised_at timestamptz,
  trust_reason text,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, device_key),
  check ((status <> 'trusted') or (trusted_at is not null and trusted_by_user_id is not null)),
  check ((status <> 'revoked') or revoked_at is not null),
  check ((status <> 'compromised') or compromised_at is not null),
  check (trust_expires_at is null or trusted_at is null or trust_expires_at > trusted_at)
);

create index if not exists security_devices_user_status_idx
  on public.security_devices(org_id, user_id, status, last_seen_at desc);

create table if not exists public.security_passkeys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null,
  credential_public_key bytea not null,
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}'::text[],
  device_type text,
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

create unique index if not exists security_passkeys_credential_id_uidx
  on public.security_passkeys(credential_id);
create index if not exists security_passkeys_user_idx
  on public.security_passkeys(org_id, user_id, revoked_at, created_at desc);

create table if not exists public.security_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null
    check (purpose in ('registration','authentication')),
  challenge text not null,
  expected_action text,
  device_id uuid references public.security_devices(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  verification_attempted_at timestamptz,
  unique (challenge),
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '5 minutes'),
  check (consumed_at is null or consumed_at >= created_at)
);

create index if not exists security_webauthn_challenges_active_idx
  on public.security_webauthn_challenges(org_id, user_id, purpose, expires_at)
  where consumed_at is null;

create table if not exists public.security_risk_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.security_devices(id) on delete set null,
  session_reference text,
  action_code text not null,
  decision text not null
    check (decision in ('allow','step_up','delay','deny')),
  score integer not null check (score between 0 and 100),
  reasons text[] not null default '{}'::text[],
  signals_used jsonb not null default '[]'::jsonb,
  signals_unknown jsonb not null default '[]'::jsonb,
  provider_evidence_json jsonb not null default '{}'::jsonb,
  policy_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists security_risk_events_user_created_idx
  on public.security_risk_events(org_id, user_id, created_at desc);
create index if not exists security_risk_events_action_idx
  on public.security_risk_events(org_id, action_code, decision, created_at desc);

create table if not exists public.security_step_up_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.security_devices(id) on delete set null,
  risk_event_id uuid references public.security_risk_events(id) on delete set null,
  passkey_id uuid references public.security_passkeys(id) on delete set null,
  action_code text not null,
  method text not null default 'passkey' check (method = 'passkey'),
  created_at timestamptz not null default now(),
  assurance_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '10 minutes'),
  check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists security_step_up_grants_active_idx
  on public.security_step_up_grants(org_id, user_id, action_code, expires_at)
  where revoked_at is null;

create table if not exists public.security_action_delays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.security_devices(id) on delete set null,
  risk_event_id uuid not null references public.security_risk_events(id) on delete restrict,
  step_up_grant_id uuid not null references public.security_step_up_grants(id) on delete restrict,
  action_code text not null,
  target_reference text,
  state text not null default 'pending'
    check (state in ('pending','ready','executed','cancelled','expired','denied')),
  policy_version text not null,
  created_at timestamptz not null default now(),
  not_before timestamptz not null,
  expires_at timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  denied_at timestamptz,
  downstream_success_evidence jsonb,
  transition_reason text,
  updated_at timestamptz not null default now(),
  check (not_before > created_at),
  check (expires_at is null or expires_at > not_before),
  check ((state <> 'executed') or (executed_at is not null and downstream_success_evidence is not null)),
  check ((state <> 'cancelled') or cancelled_at is not null),
  check ((state <> 'denied') or denied_at is not null)
);

create index if not exists security_action_delays_user_state_idx
  on public.security_action_delays(org_id, user_id, state, not_before);

create table if not exists public.security_recovery_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  state text not null
    check (state in ('initiated','verification_required','held','completed','cancelled','failed')),
  evidence_json jsonb not null default '{}'::jsonb,
  reason text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists security_recovery_events_user_idx
  on public.security_recovery_events(org_id, user_id, created_at desc);

create table if not exists public.security_session_revocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_session_reference text not null,
  provider_status text not null default 'requested'
    check (provider_status in ('requested','provider_succeeded','provider_failed')),
  provider_reference text,
  failure_code text,
  reason text not null,
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((provider_status <> 'provider_succeeded') or (provider_reference is not null and completed_at is not null)),
  check ((provider_status <> 'provider_failed') or (failure_code is not null and completed_at is not null))
);

create index if not exists security_session_revocations_user_idx
  on public.security_session_revocations(org_id, user_id, requested_at desc);

-- Security permission registry. Self-service permissions do not bypass passkey/risk policy.
insert into public.identity_permissions (code, description)
values
  ('security.protection.view_self','View the authenticated user own ATLAS device and account protection state.'),
  ('security.protection.manage_self','Request governed changes to the authenticated user own protection state.'),
  ('security.protection.audit_self','Read the authenticated user own security evidence and risk history.'),
  ('security.protection.view_org','View organization-scoped ATLAS protection state.'),
  ('security.protection.manage_org','Administer governed organization-scoped protection state.'),
  ('security.protection.audit_org','Read organization-scoped ATLAS security evidence and risk history.'),
  ('security.protection.policy_manage','Manage organization ATLAS protection policy within server-enforced bounds.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','security.protection.view_self'),
  ('owner','security.protection.manage_self'),
  ('owner','security.protection.audit_self'),
  ('owner','security.protection.view_org'),
  ('owner','security.protection.manage_org'),
  ('owner','security.protection.audit_org'),
  ('owner','security.protection.policy_manage'),
  ('admin','security.protection.view_self'),
  ('admin','security.protection.manage_self'),
  ('admin','security.protection.audit_self'),
  ('admin','security.protection.view_org'),
  ('admin','security.protection.manage_org'),
  ('admin','security.protection.audit_org'),
  ('admin','security.protection.policy_manage'),
  ('member','security.protection.view_self'),
  ('member','security.protection.manage_self'),
  ('member','security.protection.audit_self')
on conflict do nothing;

-- Row-level security. Every protection table is organization scoped and self/elevated-read only.
alter table public.security_devices enable row level security;
alter table public.security_passkeys enable row level security;
alter table public.security_webauthn_challenges enable row level security;
alter table public.security_risk_events enable row level security;
alter table public.security_step_up_grants enable row level security;
alter table public.security_action_delays enable row level security;
alter table public.security_recovery_events enable row level security;
alter table public.security_session_revocations enable row level security;

drop policy if exists security_devices_read on public.security_devices;
create policy security_devices_read
on public.security_devices for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'security.protection.view_org')
    or public.has_identity_permission(org_id,'security.protection.manage_org')
  )
);

drop policy if exists security_passkeys_read on public.security_passkeys;
create policy security_passkeys_read
on public.security_passkeys for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'security.protection.view_org')
    or public.has_identity_permission(org_id,'security.protection.manage_org')
  )
);

drop policy if exists security_webauthn_challenges_read on public.security_webauthn_challenges;
create policy security_webauthn_challenges_read
on public.security_webauthn_challenges for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'security.protection.manage_org')
  )
);

drop policy if exists security_risk_events_read on public.security_risk_events;
create policy security_risk_events_read
on public.security_risk_events for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    (user_id = auth.uid() and public.has_identity_permission(org_id,'security.protection.audit_self'))
    or public.has_identity_permission(org_id,'security.protection.audit_org')
  )
);

drop policy if exists security_step_up_grants_read on public.security_step_up_grants;
create policy security_step_up_grants_read
on public.security_step_up_grants for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'security.protection.audit_org')
  )
);

drop policy if exists security_action_delays_read on public.security_action_delays;
create policy security_action_delays_read
on public.security_action_delays for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'security.protection.audit_org')
    or public.has_identity_permission(org_id,'security.protection.manage_org')
  )
);

drop policy if exists security_recovery_events_read on public.security_recovery_events;
create policy security_recovery_events_read
on public.security_recovery_events for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    (user_id = auth.uid() and public.has_identity_permission(org_id,'security.protection.audit_self'))
    or public.has_identity_permission(org_id,'security.protection.audit_org')
  )
);

drop policy if exists security_session_revocations_read on public.security_session_revocations;
create policy security_session_revocations_read
on public.security_session_revocations for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'security.protection.audit_org')
    or public.has_identity_permission(org_id,'security.protection.manage_org')
  )
);

-- Reads are RLS-scoped. All security state mutations are server/RPC governed.
grant select on public.security_devices to authenticated;
grant select on public.security_passkeys to authenticated;
grant select on public.security_webauthn_challenges to authenticated;
grant select on public.security_risk_events to authenticated;
grant select on public.security_step_up_grants to authenticated;
grant select on public.security_action_delays to authenticated;
grant select on public.security_recovery_events to authenticated;
grant select on public.security_session_revocations to authenticated;

revoke insert, update, delete on public.security_devices from anon, authenticated;
revoke insert, update, delete on public.security_passkeys from anon, authenticated;
revoke insert, update, delete on public.security_webauthn_challenges from anon, authenticated;
revoke insert, update, delete on public.security_risk_events from anon, authenticated;
revoke insert, update, delete on public.security_step_up_grants from anon, authenticated;
revoke insert, update, delete on public.security_action_delays from anon, authenticated;
revoke insert, update, delete on public.security_recovery_events from anon, authenticated;
revoke insert, update, delete on public.security_session_revocations from anon, authenticated;

revoke all on public.security_devices from anon;
revoke all on public.security_passkeys from anon;
revoke all on public.security_webauthn_challenges from anon;
revoke all on public.security_risk_events from anon;
revoke all on public.security_step_up_grants from anon;
revoke all on public.security_action_delays from anon;
revoke all on public.security_recovery_events from anon;
revoke all on public.security_session_revocations from anon;

-- Canonical audit evidence for mutable and governed state. Append-only event tables are
-- also audited on insert; direct authenticated mutation remains revoked above.
drop trigger if exists security_devices_audit on public.security_devices;
create trigger security_devices_audit
after insert or update or delete on public.security_devices
for each row execute function public.audit_row_change();

drop trigger if exists security_passkeys_audit on public.security_passkeys;
create trigger security_passkeys_audit
after insert or update or delete on public.security_passkeys
for each row execute function public.audit_row_change();

drop trigger if exists security_webauthn_challenges_audit on public.security_webauthn_challenges;
create trigger security_webauthn_challenges_audit
after insert or update or delete on public.security_webauthn_challenges
for each row execute function public.audit_row_change();

drop trigger if exists security_risk_events_audit on public.security_risk_events;
create trigger security_risk_events_audit
after insert or update or delete on public.security_risk_events
for each row execute function public.audit_row_change();

drop trigger if exists security_step_up_grants_audit on public.security_step_up_grants;
create trigger security_step_up_grants_audit
after insert or update or delete on public.security_step_up_grants
for each row execute function public.audit_row_change();

drop trigger if exists security_action_delays_audit on public.security_action_delays;
create trigger security_action_delays_audit
after insert or update or delete on public.security_action_delays
for each row execute function public.audit_row_change();

drop trigger if exists security_recovery_events_audit on public.security_recovery_events;
create trigger security_recovery_events_audit
after insert or update or delete on public.security_recovery_events
for each row execute function public.audit_row_change();

drop trigger if exists security_session_revocations_audit on public.security_session_revocations;
create trigger security_session_revocations_audit
after insert or update or delete on public.security_session_revocations
for each row execute function public.audit_row_change();
