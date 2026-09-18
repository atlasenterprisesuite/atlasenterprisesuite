# ATLAS Hospitality Wallet Hotel Key Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared ATLAS Hospitality domain, persistence, idempotency, versioned automation policy, and service-layer primitives required for PMS-driven hotel wallet keys without yet implementing vendor-specific PMS webhook ingestion or guest Wallet provisioning.

**Architecture:** Extend the existing multi-provider Hospitality foundation instead of replacing it. Pure eligibility/idempotency logic lives in `packages/hospitality`. New PMS/stay/event/policy/provisioning persistence lives behind a reusable root Supabase service-role repository. `atlas-hospitality-access` gains authenticated read APIs only in this milestone. Automatic issuance remains fail-closed until the PMS-ingest and Wallet-delivery plans are complete.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions, Deno, React 18/Vite 6 consumers, Cloudflare production web deployment.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Execution branch: `feat/hospitality-wallet-hotel-key`, created from the then-current verified `main` in an isolated worktree.
- Preserve the existing provider states: `not_configured`, `configured_unverified`, `ready`, `degraded`, `offline`, `disabled`.
- Never store or return raw NFC/RFID data, wallet private keys, vendor cryptographic seeds, encoder secrets, facility codes, master keys, decrypted provision tokens, or provider bearer tokens.
- Direct remote door unlock remains out of scope.
- All new rows carry `org_id`; hotel operational rows also carry `property_id`.
- Automatic issuance is disabled by default and requires an enabled, versioned property policy plus all eligibility gates.
- Browser clients receive normalized references/statuses only in this plan.
- Service-generated actions use `user_id = null` in `audit_logs` and include `actor_type: 'service'` in safe audit metadata; never invent a user identity.
- Do not apply migrations or deploy Edge Functions to production until the exact implementation head passes the full verification gate and the user separately approves deployment.

---

## File Structure

- `packages/hospitality/types.ts` — add PMS, Wallet, stay, policy, event, permission, and capability types while preserving existing access-provider contracts.
- `packages/hospitality/wallet-policy.ts` — pure automatic-wallet-key eligibility and deterministic event-idempotency helpers.
- `packages/hospitality/permissions.ts` — preserve admin-equivalent permission semantics for the expanded permission vocabulary.
- `supabase/migrations/20260912_hospitality_wallet_hotel_key.sql` — six new tables plus credential-reference extensions, constraints, indexes, RLS, and authenticated SELECT grants.
- `supabase/functions/_shared/hospitality/repository.ts` — reusable service-role PMS/stay/assignment/event/policy/provisioning repository.
- `supabase/functions/atlas-hospitality-access/_shared/repository.ts` — retain working access-provider functions; re-export/import new shared read helpers rather than rewriting provider logic.
- `supabase/functions/atlas-hospitality-access/_shared/context.ts` — temporary role→permission mapping extended for PMS/Wallet permissions.
- `supabase/functions/atlas-hospitality-access/index.ts` — authenticated read endpoints for PMS instances, stays, assignments, policy, and wallet references.
- `tests/unit/hospitality-wallet-policy.test.ts`
- `tests/integration/hospitality-wallet-schema-contract.test.ts`
- `tests/integration/hospitality-wallet-repository-contract.test.ts`
- `tests/integration/hospitality-wallet-core-edge-contract.test.ts`
- `docs/hospitality/WALLET_HOTEL_KEY_READINESS.md`

---

### Task 1: Extend the Hospitality domain, permissions, and policy evaluator

**Files:**
- Modify: `packages/hospitality/types.ts`
- Modify: `packages/hospitality/permissions.ts`
- Create: `packages/hospitality/wallet-policy.ts`
- Create: `tests/unit/hospitality-wallet-policy.test.ts`
- Modify: `tests/unit/hospitality-room-access.test.ts`

**Interfaces:**
- `HospitalityPmsProviderType`
- `HospitalityPmsCapability`
- `WalletPlatform`
- `WalletState`
- `HospitalityStayStatus`
- `HospitalityIntegrationEventType`
- `HospitalityAutomationPolicySnapshot`
- `evaluateWalletEligibility(input): WalletEligibilityDecision`
- `buildHospitalityIdempotencyKey(input): string`

- [ ] **Step 1: Write failing domain tests**

```ts
import {
  buildHospitalityIdempotencyKey,
  evaluateWalletEligibility
} from '../../packages/hospitality/wallet-policy';

it('blocks automatic issuance when policy is disabled', () => {
  expect(evaluateWalletEligibility({
    pmsReady: true,
    providerReady: true,
    propertyMapped: true,
    roomMapped: true,
    stayStatus: 'checked_in',
    hasRoomAssignment: true,
    withinValidityWindow: true,
    hasEquivalentActiveCredential: false,
    replacementFlow: false,
    policyEnabled: false,
    emergencyKillSwitch: false,
    policyVersion: 3,
    requestedPlatform: 'apple_wallet',
    providerCapabilities: ['wallet.apple.issue', 'wallet.apple.provision'],
    supportedDeliveryPath: true
  })).toEqual({
    eligible: false,
    blocker: 'automation_policy_disabled',
    replacementRequired: false,
    deliveryReady: false
  });
});

it('allows issuance but reports delivery pending when no handoff exists yet', () => {
  expect(evaluateWalletEligibility({
    pmsReady: true,
    providerReady: true,
    propertyMapped: true,
    roomMapped: true,
    stayStatus: 'checked_in',
    hasRoomAssignment: true,
    withinValidityWindow: true,
    hasEquivalentActiveCredential: false,
    replacementFlow: false,
    policyEnabled: true,
    emergencyKillSwitch: false,
    policyVersion: 3,
    requestedPlatform: 'apple_wallet',
    providerCapabilities: ['wallet.apple.issue', 'wallet.apple.provision'],
    supportedDeliveryPath: false
  })).toEqual({
    eligible: true,
    blocker: null,
    replacementRequired: false,
    deliveryReady: false
  });
});

it('requires explicit replacement flow when an active equivalent credential exists', () => {
  const base = {
    pmsReady: true,
    providerReady: true,
    propertyMapped: true,
    roomMapped: true,
    stayStatus: 'checked_in' as const,
    hasRoomAssignment: true,
    withinValidityWindow: true,
    hasEquivalentActiveCredential: true,
    policyEnabled: true,
    emergencyKillSwitch: false,
    policyVersion: 3,
    requestedPlatform: 'apple_wallet' as const,
    providerCapabilities: ['wallet.apple.issue', 'wallet.apple.provision'] as const,
    supportedDeliveryPath: true
  };
  expect(evaluateWalletEligibility({ ...base, replacementFlow: false }).blocker)
    .toBe('active_credential_exists');
  expect(evaluateWalletEligibility({ ...base, replacementFlow: true }).replacementRequired)
    .toBe(true);
});

it('builds a stable PMS event idempotency key', () => {
  const input = {
    organizationId: 'org-1',
    propertyId: 'hotel-1',
    providerInstanceId: 'pms-1',
    sourceEventId: 'evt-42',
    sourceVersion: '7'
  };
  expect(buildHospitalityIdempotencyKey(input)).toBe(buildHospitalityIdempotencyKey(input));
});
```

Also assert `hospitality.access.admin` satisfies every new PMS/Wallet permission through `hasHospitalityPermission`.

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
npx vitest run tests/unit/hospitality-wallet-policy.test.ts tests/unit/hospitality-room-access.test.ts
```

Expected: FAIL because the new types/evaluator do not exist.

- [ ] **Step 3: Extend the normalized type vocabulary**

Add exactly:

```ts
export type HospitalityPmsProviderType =
  | 'oracle_opera_cloud'
  | 'mews'
  | 'cloudbeds'
  | 'infor_hms'
  | 'generic_certified_pms';

export type HospitalityPmsCapability =
  | 'reservation.read'
  | 'reservation.events'
  | 'guest.reference.read'
  | 'checkin.read'
  | 'checkout.read'
  | 'room.assignment.read'
  | 'room.change.events'
  | 'property.read';

export type WalletPlatform = 'apple_wallet' | 'google_wallet' | 'provider_app' | 'none';

export type WalletState =
  | 'not_requested'
  | 'eligible'
  | 'provisioning_ready'
  | 'provisioned'
  | 'revoked'
  | 'expired'
  | 'failed'
  | 'unknown';

export type HospitalityStayStatus =
  | 'reserved'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'unknown';

export type HospitalityIntegrationEventType =
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.cancelled'
  | 'stay.checkin_confirmed'
  | 'stay.checkout_confirmed'
  | 'room.assigned'
  | 'room.changed'
  | 'room.unassigned'
  | 'wallet.credential.requested'
  | 'wallet.credential.issued'
  | 'wallet.provisioning.ready'
  | 'wallet.provisioning.completed'
  | 'wallet.credential.revoked'
  | 'wallet.credential.expired'
  | 'wallet.credential.failed';

export type HospitalityAutomationPolicySnapshot = {
  id: string;
  organizationId: string;
  propertyId: string;
  version: number;
  enabled: boolean;
  autoWalletKeyOnCheckin: boolean;
  allowedPlatforms: Array<'apple_wallet' | 'google_wallet'>;
  allowedAccessScopes: string[];
  activationLeadMinutes: number;
  credentialExpiryOffsetMinutes: number;
  roomChangeMode: 'provider_safe_sequence';
  maxRetryAttempts: number;
  manualReviewOnFailure: boolean;
  emergencyKillSwitch: boolean;
};
```

Extend `HospitalityCapability` with exactly:

```ts
| 'wallet.apple.issue'
| 'wallet.apple.provision'
| 'wallet.google.issue'
| 'wallet.google.provision'
| 'wallet.revoke'
| 'wallet.status'
| 'reservation.checkin.consume'
| 'reservation.checkout.consume'
| 'room.assignment.sync'
| 'room.assignment.change.consume'
| 'credential.replace'
```

Extend `HospitalityPermission` with exactly:

```ts
| 'hospitality.pms.read'
| 'hospitality.pms.configure'
| 'hospitality.pms.sync'
| 'hospitality.wallet.read'
| 'hospitality.wallet.issue'
| 'hospitality.wallet.revoke'
| 'hospitality.wallet.configure'
| 'hospitality.wallet.audit'
| 'hospitality.wallet.automation.manage'
```

Do not remove existing access permissions/types.

- [ ] **Step 4: Implement the pure eligibility and idempotency helpers**

Blockers are evaluated in this stable order:

```text
emergency_kill_switch
automation_policy_disabled
pms_not_ready
wallet_provider_not_ready
property_mapping_missing
room_mapping_missing
stay_not_checked_in
room_assignment_missing
validity_window_invalid
wallet_platform_not_supported
active_credential_exists
```

For Apple require `wallet.apple.issue` + `wallet.apple.provision`; for Google require `wallet.google.issue` + `wallet.google.provision`. `supportedDeliveryPath=false` does not make issuance ineligible; it sets `deliveryReady=false` so state may stop at `provisioning_ready` without claiming guest delivery.

Build the canonical idempotency string:

```ts
export function buildHospitalityIdempotencyKey(input: {
  organizationId: string;
  propertyId: string;
  providerInstanceId: string;
  sourceEventId: string;
  sourceVersion: string;
}) {
  return [
    input.organizationId,
    input.propertyId,
    input.providerInstanceId,
    input.sourceEventId,
    input.sourceVersion
  ].map((value) => encodeURIComponent(value.trim())).join(':');
}
```

Reject any empty component before building the key.

- [ ] **Step 5: Run unit tests and typecheck**

```bash
npx vitest run tests/unit/hospitality-wallet-policy.test.ts tests/unit/hospitality-room-access.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hospitality tests/unit/hospitality-wallet-policy.test.ts tests/unit/hospitality-room-access.test.ts
git commit -m "feat(hospitality): add wallet key domain and policy gates"
```

---

### Task 2: Add the exact wallet-key persistence model and RLS

**Files:**
- Create: `supabase/migrations/20260912_hospitality_wallet_hotel_key.sql`
- Create: `tests/integration/hospitality-wallet-schema-contract.test.ts`

**Interfaces:**
- Creates six new organization/property-scoped tables.
- Extends `hospitality_credential_references` for stay/assignment/wallet/service issuance.

- [ ] **Step 1: Write the failing schema contract**

```ts
for (const table of [
  'hospitality_pms_provider_instances',
  'hospitality_stays',
  'hospitality_room_assignments',
  'hospitality_wallet_provisioning_sessions',
  'hospitality_integration_events',
  'hospitality_automation_policies'
]) expect(sql).toContain(`create table if not exists public.${table}`);

expect(sql).toContain('unique (org_id, property_id, pms_provider_instance_id, idempotency_key)');
expect(sql).toContain('wallet_platform');
expect(sql).toContain('wallet_state');
expect(sql).toContain("issuance_actor in ('user','service')");
expect(sql).not.toMatch(/\b(master_key|private_key|provider_token|key_bytes|encoder_secret|decrypted_token)\s+/);
```

Assert six new `enable row level security` statements and active `organization_members` checks using `(select auth.uid())`.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-schema-contract.test.ts
```

- [ ] **Step 3: Implement `hospitality_pms_provider_instances`**

```sql
create table if not exists public.hospitality_pms_provider_instances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null check (length(trim(property_id)) > 0),
  provider_type text not null check (provider_type in (
    'oracle_opera_cloud','mews','cloudbeds','infor_hms','generic_certified_pms'
  )),
  display_name text not null check (length(trim(display_name)) > 0),
  state text not null default 'not_configured' check (state in (
    'not_configured','configured_unverified','ready','degraded','offline','disabled'
  )),
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
```

- [ ] **Step 4: Implement stays and room assignments**

Create stays first without its circular current-assignment FK:

```sql
create table if not exists public.hospitality_stays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null check (length(trim(property_id)) > 0),
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
  property_id text not null check (length(trim(property_id)) > 0),
  stay_id uuid not null references public.hospitality_stays(id) on delete cascade,
  atlas_room_id text,
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
```

Allow `atlas_room_id`/`provider_room_mapping_id` to be null so ATLAS can persist a truthful PMS assignment even when mapping is unresolved; eligibility remains blocked until both are verified.

- [ ] **Step 5: Implement provisioning sessions, event ledger, and automation policy**

```sql
create table if not exists public.hospitality_wallet_provisioning_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null check (length(trim(property_id)) > 0),
  stay_id uuid not null references public.hospitality_stays(id) on delete cascade,
  credential_reference_id uuid not null references public.hospitality_credential_references(id) on delete cascade,
  wallet_platform text not null check (wallet_platform in ('apple_wallet','google_wallet','provider_app')),
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
  property_id text not null check (length(trim(property_id)) > 0),
  pms_provider_instance_id uuid not null references public.hospitality_pms_provider_instances(id) on delete restrict,
  source_event_id text not null check (length(trim(source_event_id)) > 0),
  source_version text not null default '1',
  event_type text not null,
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
  property_id text not null check (length(trim(property_id)) > 0),
  version integer not null default 1 check (version > 0),
  enabled boolean not null default false,
  auto_wallet_key_on_checkin boolean not null default false,
  allowed_platforms text[] not null default '{}'::text[]
    check (allowed_platforms <@ array['apple_wallet','google_wallet']::text[]),
  allowed_access_scopes text[] not null default array['room']::text[],
  activation_lead_minutes integer not null default 0 check (activation_lead_minutes between 0 and 1440),
  credential_expiry_offset_minutes integer not null default 0 check (credential_expiry_offset_minutes between 0 and 1440),
  room_change_mode text not null default 'provider_safe_sequence'
    check (room_change_mode = 'provider_safe_sequence'),
  max_retry_attempts integer not null default 0 check (max_retry_attempts between 0 and 3),
  manual_review_on_failure boolean not null default true,
  emergency_kill_switch boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, property_id)
);
```

- [ ] **Step 6: Extend credential references safely**

```sql
alter table public.hospitality_credential_references
  add column if not exists stay_id uuid references public.hospitality_stays(id) on delete set null,
  add column if not exists room_assignment_id uuid references public.hospitality_room_assignments(id) on delete set null,
  add column if not exists wallet_platform text not null default 'none',
  add column if not exists wallet_state text not null default 'not_requested',
  add column if not exists issuance_actor text not null default 'user';

alter table public.hospitality_credential_references alter column issued_by drop not null;

alter table public.hospitality_credential_references
  drop constraint if exists hospitality_credential_references_credential_type_check;
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_credential_type_check
  check (credential_type in ('wallet_mobile_key','mobile_key','rfid_reference','provider_reference'));

alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_wallet_platform_check
  check (wallet_platform in ('apple_wallet','google_wallet','provider_app','none'));
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_wallet_state_check
  check (wallet_state in ('not_requested','eligible','provisioning_ready','provisioned','revoked','expired','failed','unknown'));
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_issuance_actor_check
  check (issuance_actor in ('user','service'));
alter table public.hospitality_credential_references
  add constraint hospitality_credential_references_actor_identity_check
  check ((issuance_actor = 'user' and issued_by is not null) or (issuance_actor = 'service' and issued_by is null));
```

Before adding a named constraint, use `drop constraint if exists <same_name>` so replays in non-production development remain migration-safe.

- [ ] **Step 7: Add indexes, RLS, and grants**

Create indexes:

```sql
create index if not exists hospitality_pms_instances_org_property_state_idx
  on public.hospitality_pms_provider_instances (org_id, property_id, state);
create index if not exists hospitality_stays_org_property_status_idx
  on public.hospitality_stays (org_id, property_id, status, departure_at);
create index if not exists hospitality_assignments_org_property_stay_idx
  on public.hospitality_room_assignments (org_id, property_id, stay_id, status);
create index if not exists hospitality_wallet_sessions_org_property_state_idx
  on public.hospitality_wallet_provisioning_sessions (org_id, property_id, state, expires_at);
create index if not exists hospitality_events_scope_key_idx
  on public.hospitality_integration_events (org_id, property_id, pms_provider_instance_id, idempotency_key);
create index if not exists hospitality_wallet_credentials_stay_idx
  on public.hospitality_credential_references (org_id, property_id, stay_id, wallet_state);
```

For each new table, enable RLS; revoke all from authenticated; grant SELECT only. The SELECT policy is:

```sql
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = <table>.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
)
```

No authenticated INSERT/UPDATE/DELETE grants.

- [ ] **Step 8: Run schema tests and commit**

```bash
npx vitest run tests/integration/hospitality-wallet-schema-contract.test.ts tests/integration/hospitality-schema-contract.test.ts
git add supabase/migrations/20260912_hospitality_wallet_hotel_key.sql tests/integration/hospitality-wallet-schema-contract.test.ts
git commit -m "feat(hospitality): add wallet key persistence and RLS"
```

---

### Task 3: Add the reusable Hospitality wallet repository and service audit helper

**Files:**
- Create: `supabase/functions/_shared/hospitality/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/repository.ts`
- Create: `tests/integration/hospitality-wallet-repository-contract.test.ts`

**Interfaces:**
- `listPmsProviderInstances(orgId, propertyId?)`
- `loadPmsProviderInstance(orgId, propertyId, instanceId?)`
- `listStays(orgId, propertyId)`, `loadStay(orgId, propertyId, stayId)`
- `listRoomAssignments(orgId, propertyId, stayId?)`, `loadActiveRoomAssignment(orgId, propertyId, stayId)`
- `loadAutomationPolicy(orgId, propertyId)`
- `listWalletCredentials(orgId, propertyId)`, `findActiveWalletCredential(orgId, propertyId, stayId, platform?)`
- `insertIntegrationEventOnce(row): { inserted: boolean; event }`
- `markIntegrationEventProcessing/Processed/Failed(...)`
- `insertWalletProvisioningSession(...)`, `updateWalletProvisioningSession(...)`
- `writeHospitalityServiceAudit(orgId, action, recordId, payload)` using `user_id: null` and `actor_type: 'service'`.

- [ ] **Step 1: Write failing repository contract tests**

```ts
expect(source).toContain(".eq('org_id', orgId)");
expect(source).toContain(".eq('property_id', propertyId)");
expect(source).toContain("onConflict: 'org_id,property_id,pms_provider_instance_id,idempotency_key'");
expect(source).toContain("user_id: null");
expect(source).toContain("actor_type: 'service'");
expect(source).not.toMatch(/select\([^)]*(provider_token|private_key|key_bytes|decrypted_provision_token)/i);
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-repository-contract.test.ts
```

- [ ] **Step 3: Implement a single root shared admin client**

Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` with `persistSession:false`, `autoRefreshToken:false`. Every hotel query receives verified scope arguments and applies `org_id` + `property_id` before additional filters.

For event idempotency use one unique-conflict-safe write:

```ts
const { data, error } = await adminClient()
  .from('hospitality_integration_events')
  .upsert(row, {
    onConflict: 'org_id,property_id,pms_provider_instance_id,idempotency_key',
    ignoreDuplicates: true
  })
  .select('*');
```

If returned data is empty, fetch the canonical existing row by the complete unique key and return `inserted:false`. Callers must not process a duplicate.

- [ ] **Step 4: Implement safe service audit**

`audit_logs.user_id` is nullable in the canonical Supabase schema. Service actions insert:

```ts
{
  org_id: orgId,
  user_id: null,
  action,
  table_name: 'hospitality_wallet_key',
  record_id: recordId,
  new_data: { actor_type: 'service', ...safePayload }
}
```

Safe payload may include property/stay/assignment/reference IDs, policy version, normalized blocker/status, source event ID, and correlation ID. Never pass provider response bodies or secrets.

- [ ] **Step 5: Reuse shared functions from the existing access repository**

Keep the existing working provider/room/credential repository code. Import/re-export only new PMS/stay/assignment/policy/wallet functions from `../../../_shared/hospitality/repository.ts`.

- [ ] **Step 6: Run focused tests/typecheck and commit**

```bash
npx vitest run tests/integration/hospitality-wallet-repository-contract.test.ts tests/integration/hospitality-edge-contract.test.ts
npm run typecheck
git add supabase/functions/_shared/hospitality/repository.ts supabase/functions/atlas-hospitality-access/_shared/repository.ts tests/integration/hospitality-wallet-repository-contract.test.ts
git commit -m "refactor(hospitality): add shared wallet persistence repository"
```

---

### Task 4: Extend authenticated context and read-only wallet-core APIs

**Files:**
- Modify: `supabase/functions/atlas-hospitality-access/_shared/context.ts`
- Modify: `supabase/functions/atlas-hospitality-access/index.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/errors.ts`
- Create: `tests/integration/hospitality-wallet-core-edge-contract.test.ts`

**Interfaces:**
- Add operations: `pms-providers`, `stays`, `room-assignments`, `automation-policy`, `wallet-credentials`.
- No provider/PMS secret mutation or secret response is added.

- [ ] **Step 1: Write failing Edge Function contract assertions**

```ts
for (const operation of [
  'pms-providers', 'stays', 'room-assignments', 'automation-policy', 'wallet-credentials'
]) expect(edgeSource).toContain(`'${operation}'`);

expect(contextSource).toContain("'hospitality.wallet.automation.manage'");
expect(edgeSource).not.toMatch(/provider_token|private_key|wallet_private_key|decrypted_provision_token/i);
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-core-edge-contract.test.ts
```

- [ ] **Step 3: Extend temporary role-to-permission mapping**

Owner/admin/platform_admin receive all access/PMS/Wallet permissions. Other active members receive only:

```ts
[
  'hospitality.access.read',
  'hospitality.pms.read',
  'hospitality.wallet.read'
]
```

The domain remains permission-based; this temporary mapping is only the current context resolver boundary.

- [ ] **Step 4: Add read-only API operations**

```text
GET ?api=pms-providers&property_id=<optional filter>
GET ?api=stays&property_id=<required>
GET ?api=room-assignments&property_id=<required>&stay_id=<optional>
GET ?api=automation-policy&property_id=<required>
GET ?api=wallet-credentials&property_id=<required>
```

Require corresponding read permission and return only normalized persisted fields. If no automation policy exists, return `{ policy: null }`, not an implicitly enabled default.

- [ ] **Step 5: Extend normalized safe error details**

Allow only non-secret additions `correlation_id`, `policy_version`, `wallet_platform`. Do not include raw headers, signatures, bearer tokens, private certificates, provider payloads, or guest PII.

- [ ] **Step 6: Run focused tests/typecheck and commit**

```bash
npx vitest run tests/integration/hospitality-wallet-core-edge-contract.test.ts tests/integration/hospitality-edge-contract.test.ts
npm run typecheck
git add supabase/functions/atlas-hospitality-access tests/integration/hospitality-wallet-core-edge-contract.test.ts
git commit -m "feat(hospitality): expose governed wallet key core reads"
```

---

### Task 5: Verify the core milestone and record readiness evidence

**Files:**
- Modify: `docs/hospitality/ROOM_ACCESS_READINESS.md`
- Create: `docs/hospitality/WALLET_HOTEL_KEY_READINESS.md`
- Modify: `.github/workflows/hospitality-self-hosted-ci.yml`

- [ ] **Step 1: Extend Hospitality CI coverage**

Update the old feature branch trigger to `feat/hospitality-wallet-hotel-key` if the self-hosted workflow is retained. Add focused Wallet core tests without removing Cloudflare-native verification.

- [ ] **Step 2: Write truthful readiness evidence**

Document that this milestone provides types, schema/RLS, policy gates, idempotency primitives, service audit, and authenticated read APIs. PMS webhook ingestion and Wallet provisioning are still not production-ready until Plans 2 and 3 complete. No vendor is marked `ready` from configuration alone.

- [ ] **Step 3: Run the complete repository gate**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-wallet-policy.test.ts
npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-wallet-schema-contract.test.ts tests/integration/hospitality-wallet-repository-contract.test.ts tests/integration/hospitality-edge-contract.test.ts tests/integration/hospitality-wallet-core-edge-contract.test.ts
npm run test:unit
npm run test:integration
npm run build
```

Expected: every command exits 0. High/critical audit findings fail the gate; moderate findings are reported rather than misrepresented as high severity.

- [ ] **Step 4: Review database/security invariants before deployment**

Confirm: six new tables have RLS; authenticated receives SELECT only; writes are service-side; no raw secret columns exist; credential references preserve old rows; provider/access tables are not rewritten destructively.

Do not apply the migration or deploy an Edge Function to production in this task without a separate explicit deployment approval.

- [ ] **Step 5: Commit**

```bash
git add docs/hospitality .github/workflows/hospitality-self-hosted-ci.yml
git commit -m "docs(hospitality): record wallet key core readiness gates"
```
