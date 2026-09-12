# ATLAS Hospitality Wallet Hotel Key Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared ATLAS Hospitality domain, persistence, idempotency, policy, and service-layer primitives required for PMS-driven hotel wallet keys without yet implementing vendor-specific PMS ingress or guest wallet delivery.

**Architecture:** Extend the existing multi-provider Hospitality foundation instead of replacing it. Keep pure eligibility/idempotency logic in `packages/hospitality`, keep database access in a root Supabase shared repository usable by multiple Edge Functions, and extend `atlas-hospitality-access` only with authenticated management/read APIs. Automatic issuance remains fail-closed until later PMS-ingest and wallet-delivery plans provide verified events and provider-specific provisioning.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions, Deno, React 18/Vite 6 consumers, Cloudflare production web deployment.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Execution branch: `feat/hospitality-wallet-hotel-key` created from the then-current verified `main` in an isolated worktree.
- Preserve the existing six provider states: `not_configured`, `configured_unverified`, `ready`, `degraded`, `offline`, `disabled`.
- Never store or return raw NFC/RFID data, wallet private keys, vendor cryptographic seeds, encoder secrets, facility codes, master keys, decrypted provision tokens, or provider bearer tokens.
- Direct remote door unlock remains out of scope.
- All persisted rows are organization-scoped; hotel operational records are also property-scoped.
- Automatic issuance requires an explicit enabled, versioned property policy and all eligibility gates; configuration presence alone never means `ready`.
- Browser clients receive only normalized references/statuses and approved provisioning actions.
- Service-generated issuance must be distinguishable from a human user action in persistence and audit.
- Do not deploy migrations or Edge Functions to production until the exact branch head passes `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build`.

---

## File Structure

Create or modify these focused units:

- `packages/hospitality/types.ts` — extend permission/capability/wallet/stay types while preserving existing access-provider interfaces.
- `packages/hospitality/wallet-policy.ts` — pure automatic-wallet-key eligibility evaluation and deterministic event idempotency keys.
- `packages/hospitality/permissions.ts` — admin-equivalent behavior for new PMS/Wallet permissions.
- `supabase/migrations/20260912_hospitality_wallet_hotel_key.sql` — PMS instances, stays, room assignments, integration-event ledger, automation policies, provisioning sessions, and credential-reference extensions with RLS.
- `supabase/functions/_shared/hospitality/repository.ts` — reusable service-role repository for PMS/stay/event/policy/wallet persistence.
- `supabase/functions/atlas-hospitality-access/_shared/repository.ts` — keep current access-provider functions and re-export/use the new shared wallet repository where needed.
- `supabase/functions/atlas-hospitality-access/_shared/context.ts` — include new permission vocabulary in the current temporary role-to-permission boundary.
- `supabase/functions/atlas-hospitality-access/index.ts` — add authenticated read/configuration endpoints for stays, policies, PMS instances, and wallet credential references; do not expose vendor secrets.
- `tests/unit/hospitality-wallet-policy.test.ts` — policy gates, replacement rules, deterministic idempotency.
- `tests/integration/hospitality-wallet-schema-contract.test.ts` — migration/RLS/secret-material contract.
- `tests/integration/hospitality-wallet-core-edge-contract.test.ts` — authenticated API and repository scoping contract.

---

### Task 1: Extend the Hospitality domain, permissions, and policy evaluator

**Files:**
- Modify: `packages/hospitality/types.ts`
- Modify: `packages/hospitality/permissions.ts`
- Create: `packages/hospitality/wallet-policy.ts`
- Create: `tests/unit/hospitality-wallet-policy.test.ts`
- Modify: `tests/unit/hospitality-room-access.test.ts`

**Interfaces:**
- Produces `HospitalityPmsProviderType`, `HospitalityPmsCapability`, `WalletPlatform`, `WalletState`, `HospitalityIntegrationEventType`, `HospitalityStayStatus`, `HospitalityAutomationPolicySnapshot`.
- Extends `HospitalityCapability` with wallet/reservation/room-sync capabilities from the spec.
- Extends `HospitalityPermission` with PMS/Wallet permissions from the spec.
- Produces `evaluateWalletEligibility(input): WalletEligibilityDecision`.
- Produces `buildHospitalityIdempotencyKey(input): string`.

- [ ] **Step 1: Write failing domain tests**

Add exact assertions:

```ts
import {
  buildHospitalityIdempotencyKey,
  evaluateWalletEligibility
} from '../../packages/hospitality/wallet-policy';

it('blocks automatic issuance until every required gate is true', () => {
  const decision = evaluateWalletEligibility({
    pmsReady: true,
    providerReady: true,
    propertyMapped: true,
    roomMapped: true,
    stayStatus: 'checked_in',
    hasRoomAssignment: true,
    withinValidityWindow: true,
    hasEquivalentActiveCredential: false,
    policyEnabled: false,
    policyVersion: 3,
    requestedPlatform: 'apple_wallet',
    providerCapabilities: ['wallet.apple.issue', 'wallet.apple.provision'],
    supportedDeliveryPath: true
  });
  expect(decision).toEqual({ eligible: false, blocker: 'automation_policy_disabled', replacementRequired: false });
});

it('allows an eligible Apple Wallet issuance', () => {
  const decision = evaluateWalletEligibility({
    pmsReady: true,
    providerReady: true,
    propertyMapped: true,
    roomMapped: true,
    stayStatus: 'checked_in',
    hasRoomAssignment: true,
    withinValidityWindow: true,
    hasEquivalentActiveCredential: false,
    policyEnabled: true,
    policyVersion: 3,
    requestedPlatform: 'apple_wallet',
    providerCapabilities: ['wallet.apple.issue', 'wallet.apple.provision'],
    supportedDeliveryPath: true
  });
  expect(decision).toEqual({ eligible: true, blocker: null, replacementRequired: false });
});

it('builds the same key for the same PMS event identity', () => {
  const input = {
    organizationId: 'org-1', propertyId: 'hotel-1', providerInstanceId: 'pms-1',
    sourceEventId: 'evt-42', sourceVersion: '7'
  };
  expect(buildHospitalityIdempotencyKey(input)).toBe(buildHospitalityIdempotencyKey(input));
});
```

Also assert the new permission strings exist and that `hospitality.access.admin` satisfies them through `hasHospitalityPermission`.

- [ ] **Step 2: Run the focused tests and confirm RED**

```bash
npx vitest run tests/unit/hospitality-wallet-policy.test.ts tests/unit/hospitality-room-access.test.ts
```

Expected: FAIL because the wallet/PMS types and evaluator do not exist.

- [ ] **Step 3: Extend the normalized type vocabulary**

Add these exact unions without removing existing members:

```ts
export type HospitalityPmsProviderType =
  | 'oracle_opera_cloud'
  | 'mews'
  | 'cloudbeds'
  | 'infor_hms'
  | 'generic_certified_pms';

export type WalletPlatform = 'apple_wallet' | 'google_wallet' | 'provider_app' | 'none';
export type WalletState =
  | 'not_requested' | 'eligible' | 'provisioning_ready' | 'provisioned'
  | 'revoked' | 'expired' | 'failed' | 'unknown';

export type HospitalityStayStatus =
  | 'reserved' | 'checked_in' | 'checked_out' | 'cancelled' | 'unknown';

export type HospitalityIntegrationEventType =
  | 'reservation.created' | 'reservation.updated' | 'reservation.cancelled'
  | 'stay.checkin_confirmed' | 'stay.checkout_confirmed'
  | 'room.assigned' | 'room.changed' | 'room.unassigned'
  | 'wallet.credential.requested' | 'wallet.credential.issued'
  | 'wallet.provisioning.ready' | 'wallet.provisioning.completed'
  | 'wallet.credential.revoked' | 'wallet.credential.expired' | 'wallet.credential.failed';
```

Extend `HospitalityCapability` with exactly:

```ts
| 'wallet.apple.issue' | 'wallet.apple.provision'
| 'wallet.google.issue' | 'wallet.google.provision'
| 'wallet.revoke' | 'wallet.status'
| 'reservation.checkin.consume' | 'reservation.checkout.consume'
| 'room.assignment.sync' | 'room.assignment.change.consume'
| 'credential.replace'
```

Extend `HospitalityPermission` with exactly:

```ts
| 'hospitality.pms.read' | 'hospitality.pms.configure' | 'hospitality.pms.sync'
| 'hospitality.wallet.read' | 'hospitality.wallet.issue' | 'hospitality.wallet.revoke'
| 'hospitality.wallet.configure' | 'hospitality.wallet.audit'
| 'hospitality.wallet.automation.manage'
```

- [ ] **Step 4: Implement the pure eligibility and idempotency helpers**

Use a fail-closed ordered blocker list so the first failed gate is stable for audit/UI. The evaluator must return `replacementRequired: true` only when an equivalent active credential exists and the caller explicitly marks the event as a room-change/replacement flow; otherwise return blocker `active_credential_exists`.

Use a deterministic, reversible-free key input encoding:

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

### Task 2: Add the wallet-key persistence model and RLS

**Files:**
- Create: `supabase/migrations/20260912_hospitality_wallet_hotel_key.sql`
- Create: `tests/integration/hospitality-wallet-schema-contract.test.ts`

**Interfaces:**
- Produces tables `hospitality_pms_provider_instances`, `hospitality_stays`, `hospitality_room_assignments`, `hospitality_wallet_provisioning_sessions`, `hospitality_integration_events`, `hospitality_automation_policies`.
- Extends `hospitality_credential_references` with stay/assignment/wallet fields and service-issuance metadata.

- [ ] **Step 1: Write the failing schema contract**

Assert all six tables exist, all six enable RLS, `hospitality_integration_events.idempotency_key` is unique, and credential references contain wallet fields.

```ts
for (const table of [
  'hospitality_pms_provider_instances', 'hospitality_stays', 'hospitality_room_assignments',
  'hospitality_wallet_provisioning_sessions', 'hospitality_integration_events',
  'hospitality_automation_policies'
]) expect(sql).toContain(`create table if not exists public.${table}`);

expect(sql).toContain('unique (org_id, property_id, pms_provider_instance_id, idempotency_key)');
expect(sql).toContain('wallet_platform');
expect(sql).toContain('wallet_state');
expect(sql).not.toMatch(/\b(master_key|private_key|provider_token|key_bytes|encoder_secret|decrypted_token)\s+/);
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement tables and credential-reference extensions**

Use UUID primary keys and `org_id uuid references public.organizations(id) on delete cascade`. Use `property_id text not null` consistently with the current Hospitality schema.

Required credential changes:

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
```

Add explicit checks for wallet platform/state and `issuance_actor in ('user','service')`.

- [ ] **Step 4: Add indexes, RLS, and grants**

For every new table:

```sql
alter table public.<table> enable row level security;
revoke all on public.<table> from authenticated;
grant select on public.<table> to authenticated;
```

Create member-read policies using active `organization_members`, with `(select auth.uid())` rather than per-row `auth.uid()` to avoid the RLS performance issue already encountered. Mutations remain server-side through service-role repository functions.

Create indexes that support `(org_id, property_id, status)` and event-ledger lookup by `(org_id, property_id, pms_provider_instance_id, idempotency_key)`.

- [ ] **Step 5: Run schema contract and existing schema tests**

```bash
npx vitest run tests/integration/hospitality-wallet-schema-contract.test.ts tests/integration/hospitality-schema-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260912_hospitality_wallet_hotel_key.sql tests/integration/hospitality-wallet-schema-contract.test.ts
git commit -m "feat(hospitality): add wallet key persistence and RLS"
```

---

### Task 3: Add the reusable Hospitality wallet repository

**Files:**
- Create: `supabase/functions/_shared/hospitality/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/repository.ts`
- Create: `tests/integration/hospitality-wallet-repository-contract.test.ts`

**Interfaces:**
- Produces `loadPmsProviderInstance(orgId, propertyId, instanceId?)`.
- Produces `listStays(orgId, propertyId)`, `loadStay(orgId, propertyId, stayId)`.
- Produces `loadActiveRoomAssignment(orgId, propertyId, stayId)`.
- Produces `loadAutomationPolicy(orgId, propertyId)`.
- Produces `findActiveWalletCredential(orgId, propertyId, stayId)`.
- Produces `insertIntegrationEventOnce(row)` returning `{ inserted: boolean; event }`.
- Produces `markIntegrationEventProcessed(...)` and `markIntegrationEventFailed(...)`.
- Produces `insertWalletProvisioningSession(...)`, `updateWalletProvisioningSession(...)`.

- [ ] **Step 1: Write a failing repository contract test**

Read the shared repository and assert every public query path includes `org_id` and property scoping, and that event insertion uses an upsert/unique-conflict-safe path instead of a select-then-insert race.

```ts
expect(source).toContain(".eq('org_id', orgId)");
expect(source).toContain(".eq('property_id', propertyId)");
expect(source).toContain("onConflict: 'org_id,property_id,pms_provider_instance_id,idempotency_key'");
expect(source).not.toMatch(/select\([^)]*(provider_token|private_key|key_bytes)/i);
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-repository-contract.test.ts
```

- [ ] **Step 3: Implement a single root shared admin client and scoped repository helpers**

Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false`, and never accept `orgId`/`propertyId` from unverified external webhook body data. Functions must receive already-resolved scope as arguments.

For idempotency insertion, use one database upsert with `ignoreDuplicates: true`, then fetch the canonical row by the full unique key. Return `inserted: false` for a duplicate so callers cannot issue twice.

- [ ] **Step 4: Reuse the shared repository from `atlas-hospitality-access`**

Keep existing provider/room/credential functions in the current repository file; import/re-export only the new wallet/stay functions from `../../../_shared/hospitality/repository.ts` to avoid a broad rewrite of working access-provider code.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/integration/hospitality-wallet-repository-contract.test.ts tests/integration/hospitality-edge-contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/hospitality/repository.ts supabase/functions/atlas-hospitality-access/_shared/repository.ts tests/integration/hospitality-wallet-repository-contract.test.ts
git commit -m "refactor(hospitality): add shared wallet persistence repository"
```

---

### Task 4: Extend authenticated Hospitality context and management APIs

**Files:**
- Modify: `supabase/functions/atlas-hospitality-access/_shared/context.ts`
- Modify: `supabase/functions/atlas-hospitality-access/index.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/errors.ts`
- Create: `tests/integration/hospitality-wallet-core-edge-contract.test.ts`

**Interfaces:**
- Existing `resolveContext(req)` continues to authenticate Supabase user and active organization membership.
- Adds operations: `pms-providers`, `stays`, `automation-policy`, `wallet-credentials`.
- No vendor configuration secrets are returned.

- [ ] **Step 1: Write failing Edge Function contract assertions**

```ts
for (const operation of ['pms-providers', 'stays', 'automation-policy', 'wallet-credentials']) {
  expect(edgeSource).toContain(`'${operation}'`);
}
expect(contextSource).toContain("'hospitality.wallet.automation.manage'");
expect(edgeSource).not.toMatch(/provider_token|private_key|wallet_private_key|decrypted_token/i);
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-core-edge-contract.test.ts
```

- [ ] **Step 3: Extend the temporary role-to-permission mapping**

Until canonical fine-grained permission tables supersede it, owner/admin/platform_admin receive all access/PMS/Wallet permissions. Other active members keep read-only access permissions: `hospitality.access.read`, `hospitality.pms.read`, `hospitality.wallet.read`.

- [ ] **Step 4: Add read-only management endpoints**

Implement:

```text
GET ?api=pms-providers&property_id=...
GET ?api=stays&property_id=...
GET ?api=automation-policy&property_id=...
GET ?api=wallet-credentials&property_id=...
```

Require the corresponding read permission and explicit `property_id`. Return only normalized fields from the shared repository.

Do not add mutation endpoints for provider secrets in this task. Automation-policy mutation is deferred until wallet-delivery/admin UI work has its full validation contract.

- [ ] **Step 5: Extend safe error detail keys only for non-secret blockers**

Allow `correlation_id`, `policy_version`, and `wallet_platform` in safe details. Do not allow raw headers, signatures, tokens, provider response bodies, or guest PII.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run tests/integration/hospitality-wallet-core-edge-contract.test.ts tests/integration/hospitality-edge-contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-hospitality-access tests/integration/hospitality-wallet-core-edge-contract.test.ts
git commit -m "feat(hospitality): expose governed wallet key core APIs"
```

---

### Task 5: Verify the core milestone and record readiness evidence

**Files:**
- Modify: `docs/hospitality/ROOM_ACCESS_READINESS.md`
- Create: `docs/hospitality/WALLET_HOTEL_KEY_READINESS.md`
- Modify: `.github/workflows/hospitality-self-hosted-ci.yml`

**Interfaces:**
- Adds wallet-core tests to the Hospitality verification sequence.
- Documents exact external blockers rather than marking PMS/Wallet vendors ready.

- [ ] **Step 1: Extend CI test lists**

Add these focused tests to the Hospitality integration step:

```bash
npx vitest run \
  tests/integration/hospitality-wallet-schema-contract.test.ts \
  tests/integration/hospitality-wallet-repository-contract.test.ts \
  tests/integration/hospitality-wallet-core-edge-contract.test.ts
```

Update the workflow branch from the old completed feature branch to `feat/hospitality-wallet-hotel-key` if the workflow is still retained; do not remove the Cloudflare-native verification path.

- [ ] **Step 2: Write readiness evidence**

`WALLET_HOTEL_KEY_READINESS.md` must state the core milestone provides types, RLS, policy gates, idempotency primitives, and authenticated read APIs, while PMS webhook ingestion and Wallet provisioning remain blocked until Plans 2 and 3 complete. It must explicitly state that no provider is `ready` merely because schema/config exists.

- [ ] **Step 3: Run the complete repository gate**

```bash
npm ci
npm run typecheck
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-wallet-policy.test.ts
npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-wallet-schema-contract.test.ts tests/integration/hospitality-wallet-repository-contract.test.ts tests/integration/hospitality-edge-contract.test.ts tests/integration/hospitality-wallet-core-edge-contract.test.ts
npm run test:unit
npm run test:integration
npm run build
```

Expected: all commands exit 0. `npm audit --audit-level=high` remains part of `verify:cloudflare`; moderate-only findings do not fail that gate.

- [ ] **Step 4: Review database/security invariants before any deployment**

Confirm the migration contains no secret-material columns, every new table has RLS, authenticated has SELECT only, and all writes are service-side. Do not apply the migration to production during this task without a separate explicit deployment approval.

- [ ] **Step 5: Commit**

```bash
git add docs/hospitality .github/workflows/hospitality-self-hosted-ci.yml
git commit -m "docs(hospitality): record wallet key core readiness gates"
```
