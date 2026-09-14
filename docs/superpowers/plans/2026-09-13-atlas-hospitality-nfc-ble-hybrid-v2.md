# ATLAS Hospitality NFC + BLE Hybrid Access V2.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend ATLAS Hospitality so one governed credential-reference model supports official NFC Wallet hotel-key flows and official BLE provider-mobile-key flows, adding Onity DirectKey as a dedicated fail-closed provider target without storing raw access material.

**Architecture:** Extend the existing `hospitality_provider_instances` and `hospitality_credential_references` model instead of creating a parallel credential table. Add a normalized transport router above provider adapters, add a dedicated Onity adapter that remains `configured_unverified` until an authorized official runtime contract exists, and expose only normalized readiness/lifecycle state to APIs and UI.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS, Supabase Edge Functions/Deno, React 18/Vite 6, existing ATLAS Hospitality provider adapter architecture.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-hospitality-nfc-ble-hybrid-v2-design.md`

**Prerequisite:** `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-hotel-key-implementation.md` must be implementation-verified on the execution branch before this delta plan is marked complete. If that prerequisite is not present on the branch, execute its binding Core → PMS Ingest → Wallet Delivery plans first, preserving this V2.1 spec and plan.

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Execution branch: `feat/hospitality-wallet-hotel-key` or an isolated recovery/implementation branch based on its latest verified state.
- Preserve provider readiness states exactly: `not_configured`, `configured_unverified`, `ready`, `degraded`, `offline`, `disabled`.
- Add `onity_directkey` as a dedicated provider type; do not map it to `generic_certified`.
- Transport values are exactly `nfc` and `ble`.
- Wallet/platform values remain exactly `apple_wallet`, `google_wallet`, `provider_app`, `none`.
- Do not create `hospitality_device_credentials`.
- Do not add `payload_data` or any generic reusable credential-payload column.
- Never store or return raw NFC/RFID dumps, card UIDs for reproduction, BLE unlock frames, facility/master keys, encoder secrets, private keys, provider bearer tokens, decrypted provisioning tokens, or reusable guest unlock secrets.
- Direct remote unlock remains out of scope.
- Onity DirectKey remains fail-closed until an official, authorized property/provider contract and runtime configuration are verified.
- Visual identification of Onity hardware is discovery evidence only; it never sets provider readiness to `ready`.
- No production migration, Edge Function deployment, Cloudflare deployment/routing change, production-secret mutation, provider spend, live-hotel automation enablement, or real guest-key issuance without explicit human approval.
- Mock/sandbox verification may set `implementation_verified`; it may not set `production_ready`.

---

## File Structure

- `packages/hospitality/types.ts` — add transport and Onity provider vocabulary while preserving current Wallet/PMS types.
- `packages/hospitality/hybrid-access.ts` — pure transport/platform/provider route validation and lifecycle transition helpers.
- `supabase/migrations/20260913_hospitality_nfc_ble_hybrid.sql` — extend provider type constraint and credential-reference lifecycle columns safely.
- `supabase/functions/atlas-hospitality-access/providers/onity.ts` — dedicated fail-closed Onity DirectKey adapter.
- `supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts` — register Onity and normalize runtime configuration selection.
- `supabase/functions/atlas-hospitality-access/_shared/repository.ts` — preserve access-provider repository behavior and map normalized hybrid reference reads.
- `supabase/functions/_shared/hospitality/repository.ts` — shared Wallet/PMS credential lifecycle persistence produced by the prerequisite plan.
- `supabase/functions/_shared/hospitality/wallet-orchestrator.ts` — provider-safe hybrid replacement/revocation orchestration produced by the prerequisite plan and extended here.
- `supabase/functions/atlas-hospitality-access/index.ts` — expose normalized hybrid readiness/reference state only.
- `apps/web/src/lib/hospitalityApi.ts` — typed hybrid metadata from authenticated API.
- `apps/web/src/modules/hospitality/RoomAccessPage.tsx` — hybrid access overview.
- `apps/web/src/modules/hospitality/ProvidersPage.tsx` — Onity readiness truth states.
- `apps/web/src/modules/hospitality/WalletKeysPage.tsx` — existing Wallet credential page from the prerequisite plan, extended to show NFC/BLE/platform/lifecycle metadata.
- `tests/unit/hospitality-hybrid-access.test.ts`
- `tests/unit/hospitality-onity-adapter.test.ts`
- `tests/integration/hospitality-hybrid-schema-contract.test.ts`
- `tests/integration/hospitality-hybrid-api-contract.test.ts`
- `tests/integration/hospitality-hybrid-lifecycle.test.ts`
- `tests/integration/hospitality-hybrid-ui-contract.test.tsx`
- `tests/integration/hospitality-security-contract.test.ts` — extend forbidden-material assertions.
- `docs/hospitality/providers/ONITY_DIRECTKEY.md` — verified-contract/readiness evidence and explicit external blockers.
- `docs/hospitality/NFC_BLE_HYBRID_READINESS.md` — implementation/external/production readiness matrix.

---

### Task 1: Add normalized hybrid transport and route-decision domain

**Files:**
- Modify: `packages/hospitality/types.ts`
- Create: `packages/hospitality/hybrid-access.ts`
- Create: `tests/unit/hospitality-hybrid-access.test.ts`
- Modify: `tests/unit/hospitality-room-access.test.ts`

**Interfaces:**

```ts
export type HospitalityAccessTransport = 'nfc' | 'ble';

export type HybridAccessRouteInput = {
  providerType: HospitalityProviderType;
  providerState: HospitalityProviderState;
  transport: HospitalityAccessTransport;
  walletPlatform: WalletPlatform;
  providerCapabilities: readonly HospitalityCapability[];
};

export type HybridAccessRouteDecision = {
  allowed: boolean;
  blocker: null |
    'provider_not_ready' |
    'transport_not_supported' |
    'wallet_platform_not_supported' |
    'provider_route_mismatch';
};

export function evaluateHybridAccessRoute(
  input: HybridAccessRouteInput
): HybridAccessRouteDecision;

export type HybridProvisioningState =
  | 'eligible'
  | 'provisioning_ready'
  | 'issued'
  | 'active'
  | 'revocation_pending'
  | 'revoked'
  | 'expired'
  | 'failed'
  | 'unknown';

export function canTransitionHybridProvisioningState(
  from: HybridProvisioningState,
  to: HybridProvisioningState
): boolean;
```

- [ ] **Step 1: Write failing route/lifecycle tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  canTransitionHybridProvisioningState,
  evaluateHybridAccessRoute
} from '../../packages/hospitality/hybrid-access';

describe('ATLAS Hospitality hybrid access routing', () => {
  it('allows Onity DirectKey only as BLE provider_app when ready', () => {
    expect(evaluateHybridAccessRoute({
      providerType: 'onity_directkey',
      providerState: 'ready',
      transport: 'ble',
      walletPlatform: 'provider_app',
      providerCapabilities: ['mobile_key.issue', 'credential.status', 'credential.revoke']
    })).toEqual({ allowed: true, blocker: null });
  });

  it('rejects NFC Wallet routing through Onity DirectKey without an explicit verified capability', () => {
    expect(evaluateHybridAccessRoute({
      providerType: 'onity_directkey',
      providerState: 'ready',
      transport: 'nfc',
      walletPlatform: 'apple_wallet',
      providerCapabilities: ['mobile_key.issue']
    })).toEqual({ allowed: false, blocker: 'provider_route_mismatch' });
  });

  it('blocks every route when the provider is not ready', () => {
    expect(evaluateHybridAccessRoute({
      providerType: 'onity_directkey',
      providerState: 'configured_unverified',
      transport: 'ble',
      walletPlatform: 'provider_app',
      providerCapabilities: ['mobile_key.issue']
    }).blocker).toBe('provider_not_ready');
  });

  it('permits safe lifecycle transitions and rejects optimistic revocation', () => {
    expect(canTransitionHybridProvisioningState('eligible', 'provisioning_ready')).toBe(true);
    expect(canTransitionHybridProvisioningState('issued', 'active')).toBe(true);
    expect(canTransitionHybridProvisioningState('active', 'revocation_pending')).toBe(true);
    expect(canTransitionHybridProvisioningState('active', 'revoked')).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-hybrid-access.test.ts tests/unit/hospitality-room-access.test.ts
```

Expected: FAIL because `onity_directkey`, `HospitalityAccessTransport`, and `hybrid-access.ts` do not exist.

- [ ] **Step 3: Extend `HospitalityProviderType` exactly**

Add:

```ts
| 'onity_directkey'
```

Add:

```ts
export type HospitalityAccessTransport = 'nfc' | 'ble';
```

Do not remove or rename any existing provider, Wallet, PMS, permission, or capability type.

- [ ] **Step 4: Implement deterministic hybrid route selection**

Rules in stable order:

```text
provider_not_ready
transport_not_supported
wallet_platform_not_supported
provider_route_mismatch
```

Required normalized routes:

```text
onity_directkey + ble + provider_app
apple_wallet + nfc only when wallet.apple.issue and wallet.apple.provision are present
google_wallet + nfc only when wallet.google.issue and wallet.google.provision are present
```

No automatic fallback between Wallet and provider-app routes.

- [ ] **Step 5: Implement explicit lifecycle transition table**

Allowed transitions:

```text
eligible -> provisioning_ready | failed
provisioning_ready -> issued | failed
issued -> active | revocation_pending | failed
active -> revocation_pending | expired | failed
revocation_pending -> revoked | failed
failed -> provisioning_ready only through a fresh explicit retry/reconciliation call
unknown -> provisioning_ready | revocation_pending | expired | failed
```

`active -> revoked` is not directly allowed because revocation must first be requested/confirmed.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/hospitality-hybrid-access.test.ts tests/unit/hospitality-room-access.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/hospitality/types.ts packages/hospitality/hybrid-access.ts tests/unit/hospitality-hybrid-access.test.ts tests/unit/hospitality-room-access.test.ts
git commit -m "feat(hospitality): add hybrid NFC BLE routing domain"
```

---

### Task 2: Extend provider and credential persistence without creating a parallel credential table

**Files:**
- Create: `supabase/migrations/20260913_hospitality_nfc_ble_hybrid.sql`
- Create: `tests/integration/hospitality-hybrid-schema-contract.test.ts`

**Interfaces:**
- Extends `hospitality_provider_instances.provider_type` to accept `onity_directkey`.
- Extends `hospitality_credential_references` with `stay_id`, `transport`, `wallet_platform`, `issuance_actor`, `provisioning_state`.
- Makes `issued_by` nullable only for service issuance if it is still `NOT NULL` after the prerequisite Wallet migration.

- [ ] **Step 1: Write failing schema-contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260913_hospitality_nfc_ble_hybrid.sql',
  'utf8'
).toLowerCase();

describe('Hospitality NFC/BLE hybrid migration', () => {
  it('extends the canonical credential table and does not create a second credential table', () => {
    expect(sql).toContain('alter table public.hospitality_credential_references');
    expect(sql).not.toContain('create table if not exists public.hospitality_device_credentials');
    expect(sql).not.toMatch(/\bpayload_data\b/);
  });

  it('adds normalized hybrid fields and Onity provider vocabulary', () => {
    for (const token of ['stay_id', 'transport', 'wallet_platform', 'issuance_actor', 'provisioning_state', 'onity_directkey']) {
      expect(sql).toContain(token);
    }
  });

  it('does not introduce forbidden credential-material columns', () => {
    expect(sql).not.toMatch(/\b(master_key|private_key|provider_token|encoder_secret|decrypted_token|key_bytes|ble_frame|nfc_dump)\b/);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-hybrid-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration idempotently**

Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for:

```sql
stay_id uuid,
transport text,
wallet_platform text not null default 'none',
issuance_actor text not null default 'user',
provisioning_state text not null default 'eligible'
```

Add checks:

```sql
transport is null or transport in ('nfc','ble')
wallet_platform in ('apple_wallet','google_wallet','provider_app','none')
issuance_actor in ('user','service')
provisioning_state in (
  'eligible','provisioning_ready','issued','active',
  'revocation_pending','revoked','expired','failed','unknown'
)
```

The prerequisite Wallet Hotel Key migration creates `public.hospitality_stays`; add a foreign key from `stay_id` to `hospitality_stays(id)` using an idempotent `DO $$ ... $$` constraint-existence check. If `hospitality_stays` is absent, fail the migration rather than creating a second stay model.

Replace the provider-type check constraint using the existing provider vocabulary plus `onity_directkey`. Preserve every existing provider value.

If `issued_by` remains non-nullable, drop only its `NOT NULL`; do not drop its foreign key. Add a check equivalent to:

```sql
(issuance_actor = 'service' and issued_by is null)
or
(issuance_actor = 'user' and issued_by is not null)
```

- [ ] **Step 4: Preserve RLS and indexes**

Do not disable or replace existing tenant RLS. Add a hybrid lookup index:

```sql
create index if not exists hospitality_credential_refs_hybrid_idx
  on public.hospitality_credential_references
  (org_id, property_id, transport, wallet_platform, provisioning_state, expires_at);
```

- [ ] **Step 5: Run schema/security contracts**

```bash
npx vitest run tests/integration/hospitality-hybrid-schema-contract.test.ts tests/integration/hospitality-security-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260913_hospitality_nfc_ble_hybrid.sql tests/integration/hospitality-hybrid-schema-contract.test.ts tests/integration/hospitality-security-contract.test.ts
git commit -m "feat(hospitality): extend credential references for NFC BLE"
```

---

### Task 3: Add the dedicated fail-closed Onity DirectKey adapter

**Files:**
- Create: `supabase/functions/atlas-hospitality-access/providers/onity.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts`
- Create: `tests/unit/hospitality-onity-adapter.test.ts`
- Create: `docs/hospitality/providers/ONITY_DIRECTKEY.md`

**Interfaces:**

```ts
export type OnityDirectKeyAdapterConfig = {
  providerType: 'onity_directkey';
  contractVerified: boolean;
  propertyIntegrationVerified: boolean;
};

export function createOnityDirectKeyAdapter(
  config: OnityDirectKeyAdapterConfig
): HospitalityAccessAdapter;
```

Until official authorized network details are available, the adapter contains no guessed URLs, BLE protocol values, card data, token formats, or signing material.

- [ ] **Step 1: Write failing Onity adapter tests**

```ts
import { describe, expect, it } from 'vitest';
import { createOnityDirectKeyAdapter } from '../../supabase/functions/atlas-hospitality-access/providers/onity';

const context = {
  organizationId: 'org-1',
  propertyId: 'hotel-1',
  userId: 'user-1',
  providerInstanceId: 'provider-1',
  providerPropertyId: 'property-external-1'
};

describe('Onity DirectKey adapter', () => {
  it('remains configured_unverified without verified official contract/configuration', async () => {
    const adapter = createOnityDirectKeyAdapter({
      providerType: 'onity_directkey',
      contractVerified: false,
      propertyIntegrationVerified: false
    });
    expect(await adapter.readiness(context)).toMatchObject({
      state: 'configured_unverified',
      blocker: 'onity_directkey_official_configuration_required'
    });
  });

  it('fails closed for credential issuance while unverified', async () => {
    const adapter = createOnityDirectKeyAdapter({
      providerType: 'onity_directkey',
      contractVerified: false,
      propertyIntegrationVerified: false
    });
    await expect(adapter.issueCredential(context, {
      propertyId: 'hotel-1',
      roomId: '101',
      assignmentReference: 'stay-1',
      startsAt: '2026-09-13T20:00:00.000Z',
      expiresAt: '2026-09-14T15:00:00.000Z',
      reason: 'guest_checkin',
      providerRoomId: 'room-ext-101',
      credentialType: 'mobile_key'
    })).rejects.toThrow('provider_not_ready');
  });
});
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-onity-adapter.test.ts
```

- [ ] **Step 3: Implement the adapter as an explicit external-gate boundary**

The adapter capabilities are limited to normalized capabilities ATLAS can represent safely:

```ts
[
  'mobile_key.issue',
  'credential.revoke',
  'credential.status'
]
```

If either `contractVerified` or `propertyIntegrationVerified` is false, readiness is `configured_unverified` with blocker `onity_directkey_official_configuration_required`, and issue/revoke throw `provider_not_ready`.

Do not implement a fake `ready` branch. A future verified official contract changes this file under a separate reviewed task with sanitized fixtures.

- [ ] **Step 4: Register Onity explicitly**

Add `onity_directkey` to `KNOWN_PROVIDER_TYPES`, extend the runtime-config union, and route only that provider type to `createOnityDirectKeyAdapter`.

Missing runtime config continues to use the registry's fail-closed `MissingRuntimeConfigAdapter`.

- [ ] **Step 5: Write `ONITY_DIRECTKEY.md`**

Record exactly:

```text
provider_type: onity_directkey
current ATLAS readiness: configured_unverified
supported modeled transport: ble
modeled guest platform: provider_app
production blocker: official authorized DirectKey contract + property integration verification required
raw credential/card/BLE protocol material: never stored or reverse engineered by ATLAS
```

Include official documentation references only when independently verified; otherwise state that provider onboarding material is an external prerequisite.

- [ ] **Step 6: Run focused tests/typecheck**

```bash
npx vitest run tests/unit/hospitality-onity-adapter.test.ts tests/unit/hospitality-provider-adapters.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-hospitality-access/providers/onity.ts supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts tests/unit/hospitality-onity-adapter.test.ts docs/hospitality/providers/ONITY_DIRECTKEY.md
git commit -m "feat(hospitality): add fail closed Onity DirectKey provider"
```

---

### Task 4: Persist and expose normalized hybrid lifecycle metadata

**Files:**
- Modify: `supabase/functions/atlas-hospitality-access/_shared/repository.ts`
- Modify: `supabase/functions/_shared/hospitality/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-access/index.ts`
- Modify: `apps/web/src/lib/hospitalityApi.ts`
- Create: `tests/integration/hospitality-hybrid-api-contract.test.ts`

**Interfaces:**

```ts
export type HybridCredentialReference = {
  id: string;
  propertyId: string;
  roomId: string;
  stayId: string | null;
  providerInstanceId: string;
  providerCredentialReference: string;
  transport: HospitalityAccessTransport | null;
  walletPlatform: WalletPlatform;
  issuanceActor: 'user' | 'service';
  provisioningState: HybridProvisioningState;
  startsAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
```

- [ ] **Step 1: Write failing API contract tests**

Assert authenticated credential-reference responses include normalized hybrid metadata and exclude raw material:

```ts
expect(JSON.stringify(response)).toContain('transport');
expect(JSON.stringify(response)).toContain('walletPlatform');
expect(JSON.stringify(response)).toContain('provisioningState');
expect(JSON.stringify(response)).not.toMatch(/payload_data|master_key|private_key|provider_token|ble_frame|nfc_dump/i);
```

Assert browser requests cannot submit a raw credential payload or arbitrary provider-lock frame.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-hybrid-api-contract.test.ts
```

- [ ] **Step 3: Extend repository mapping**

Map database snake_case fields to the exact `HybridCredentialReference` shape in `supabase/functions/_shared/hospitality/repository.ts`. Keep `supabase/functions/atlas-hospitality-access/_shared/repository.ts` as the existing provider/access facade and delegate shared lifecycle persistence rather than duplicating write logic.

Add explicit shared functions:

```ts
listHybridCredentialReferences(...)
updateHybridProvisioningState(...)
```

`updateHybridProvisioningState` validates transitions with `canTransitionHybridProvisioningState` before writing.

- [ ] **Step 4: Preserve provider-confirmed revocation semantics**

A revoke orchestration path writes `revocation_pending` before calling the provider. It writes `revoked` only after a confirmed provider result. Provider failure writes `failed` plus sanitized status/error metadata.

- [ ] **Step 5: Extend the authenticated API response only**

Return normalized reference fields. Do not return runtime provider configuration, provider tokens, headers, raw vendor responses, or any cryptographic material.

- [ ] **Step 6: Run focused API/security tests**

```bash
npx vitest run tests/integration/hospitality-hybrid-api-contract.test.ts tests/integration/hospitality-security-contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-hospitality-access supabase/functions/_shared/hospitality/repository.ts apps/web/src/lib/hospitalityApi.ts tests/integration/hospitality-hybrid-api-contract.test.ts tests/integration/hospitality-security-contract.test.ts
git commit -m "feat(hospitality): expose normalized hybrid credential lifecycle"
```

---

### Task 5: Add provider-safe room-change, checkout, and reconciliation behavior

**Files:**
- Modify: `supabase/functions/_shared/hospitality/wallet-orchestrator.ts`
- Modify: `packages/hospitality/hybrid-access.ts`
- Create: `tests/integration/hospitality-hybrid-lifecycle.test.ts`

**Interfaces:**

```ts
export type HybridReplacementResult = {
  replacementReferenceId: string;
  priorReferenceId: string;
  replacementState: HybridProvisioningState;
  priorState: HybridProvisioningState;
};

export async function replaceHybridCredential(...): Promise<HybridReplacementResult>;
export async function revokeHybridCredentialForCheckout(...): Promise<void>;
export async function reconcileHybridCredentialStatus(...): Promise<HybridProvisioningState>;
```

- [ ] **Step 1: Write failing lifecycle tests**

Tests must prove:

```text
new room validated before issuance
replacement confirmed before old revoke
failed replacement does not revoke old active reference
checkout writes revocation_pending before provider call
provider-confirmed revoke -> revoked
provider failure -> failed, never optimistic revoked
external expiry -> expired
```

Example:

```ts
expect(events).toEqual([
  'replacement_requested',
  'replacement_confirmed',
  'prior_revocation_requested',
  'prior_revoked'
]);
```

and on failed replacement:

```ts
expect(events).not.toContain('prior_revocation_requested');
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-hybrid-lifecycle.test.ts
```

- [ ] **Step 3: Implement provider-safe replacement sequence**

Extend `supabase/functions/_shared/hospitality/wallet-orchestrator.ts` so the verified provider adapter issues the replacement only after the new assignment/room mapping passes existing eligibility checks. If a future adapter exposes a documented atomic replacement operation, that capability is added in a separate reviewed change; do not infer atomicity here.

- [ ] **Step 4: Implement checkout/cancellation revoke semantics**

Never mark revoked before provider confirmation. Audit every transition with safe identifiers and sanitized provider status only.

- [ ] **Step 5: Implement reconciliation**

Map normalized provider status `issued|revoked|expired|failed|unknown` to hybrid state without exposing raw provider bodies.

- [ ] **Step 6: Run lifecycle and security suites**

```bash
npx vitest run tests/integration/hospitality-hybrid-lifecycle.test.ts tests/integration/hospitality-security-contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/hospitality/hybrid-access.ts supabase/functions/_shared/hospitality/wallet-orchestrator.ts tests/integration/hospitality-hybrid-lifecycle.test.ts tests/integration/hospitality-security-contract.test.ts
git commit -m "feat(hospitality): govern hybrid credential lifecycle"
```

---

### Task 6: Surface truthful NFC/BLE/Onity readiness in the Hospitality UI

**Files:**
- Modify: `apps/web/src/modules/hospitality/RoomAccessPage.tsx`
- Modify: `apps/web/src/modules/hospitality/ProvidersPage.tsx`
- Modify: `apps/web/src/modules/hospitality/WalletKeysPage.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Create: `tests/integration/hospitality-hybrid-ui-contract.test.tsx`

**Interfaces:**
- Display-only labels derive from normalized API state, never from hardcoded demo readiness.
- Provider discovery evidence is distinct from provider readiness.

- [ ] **Step 1: Write failing UI contract tests**

Assert rendered state includes:

```text
NFC / Apple Wallet
NFC / Google Wallet
BLE / Provider App
Configured — verification required
Revocation pending
```

Assert an Onity provider with `configured_unverified` does not render `Ready` and does not enable an issue action.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-hybrid-ui-contract.test.tsx
```

- [ ] **Step 3: Implement truthful transport badges/state**

Use existing ATLAS Hospitality styles. Do not create a separate visual application. The same protected Hospitality shell must render hybrid status.

- [ ] **Step 4: Implement Onity external-gate messaging**

For `onity_directkey + configured_unverified`, show:

```text
Onity DirectKey detected/configured, but official property integration is not verified. Digital-key issuance remains blocked.
```

Do not state that BLE/DirectKey is available merely because an Onity lock was observed.

- [ ] **Step 5: Keep actions permission/readiness gated**

Issue/replacement/revoke actions reuse existing Hospitality permissions and are disabled when provider/property route readiness is not satisfied.

- [ ] **Step 6: Run UI tests and build**

```bash
npx vitest run tests/integration/hospitality-hybrid-ui-contract.test.tsx tests/integration/hospitality-routes.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/hospitality apps/web/src/lib/hospitalityApi.ts tests/integration/hospitality-hybrid-ui-contract.test.tsx tests/integration/hospitality-routes.test.tsx
git commit -m "feat(hospitality): surface hybrid access readiness"
```

---

### Task 7: Harden audit/security contracts and publish readiness evidence

**Files:**
- Modify: `tests/integration/hospitality-security-contract.test.ts`
- Create: `docs/hospitality/NFC_BLE_HYBRID_READINESS.md`

**Interfaces:**
- Readiness classifications are exactly `implementation_verified`, `external_gates_pending`, `production_ready`.

- [ ] **Step 1: Add forbidden-material regression assertions**

Scan executable migrations and API DTOs for prohibited persistence/interface names:

```ts
const forbidden = [
  'payload_data',
  'master_key',
  'private_key',
  'encoder_secret',
  'decrypted_token',
  'ble_unlock_frame',
  'nfc_dump'
];
```

Do not treat documentation sentences such as “must not store” as failures; inspect executable schema/API surfaces directly.

- [ ] **Step 2: Verify service audit identity semantics**

Service actions must use real `actor_type = 'service'` evidence and null user identity where supported; no synthetic UUID or invented username may be written as the user.

- [ ] **Step 3: Write readiness matrix**

`NFC_BLE_HYBRID_READINESS.md` must state:

```text
implementation_verified = yes only after final exact-SHA gate passes
external_gates_pending = yes while Onity/property/Wallet official onboarding is incomplete
production_ready = no until authorized physical-property validation passes
```

List the ten controlled-property validation evidence items from the spec.

- [ ] **Step 4: Run security and focused hybrid suite**

```bash
npx vitest run \
  tests/unit/hospitality-hybrid-access.test.ts \
  tests/unit/hospitality-onity-adapter.test.ts \
  tests/integration/hospitality-hybrid-schema-contract.test.ts \
  tests/integration/hospitality-hybrid-api-contract.test.ts \
  tests/integration/hospitality-hybrid-lifecycle.test.ts \
  tests/integration/hospitality-hybrid-ui-contract.test.tsx \
  tests/integration/hospitality-security-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/hospitality-security-contract.test.ts docs/hospitality/NFC_BLE_HYBRID_READINESS.md
git commit -m "test(hospitality): harden hybrid access security readiness"
```

---

### Task 8: Run the exact-SHA final branch gate and perform whole-branch review

**Files:**
- No production mutations.
- Update only `docs/hospitality/NFC_BLE_HYBRID_READINESS.md` if final evidence requires correction.

**Interfaces:**
- Final report separates implementation state from external provider/property readiness.

- [ ] **Step 1: Confirm the prerequisite Wallet Hotel Key implementation is present**

Verify the files/tests from `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-hotel-key-implementation.md` exist on the current branch and its final gate has been rerun after V2.1 changes. If the prerequisite implementation is absent, stop this task, execute that binding plan first, then resume Task 8. Do not mark V2.1 complete on a partial Wallet baseline.

- [ ] **Step 2: Run dependency/security gate**

```bash
npm ci
npm audit --audit-level=high
```

Expected: install succeeds; no high/critical audit failure.

- [ ] **Step 3: Run repository verification**

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: PASS on the same final feature-branch SHA.

- [ ] **Step 4: Run the focused hybrid suite again on the exact final SHA**

```bash
npx vitest run \
  tests/unit/hospitality-hybrid-access.test.ts \
  tests/unit/hospitality-onity-adapter.test.ts \
  tests/integration/hospitality-hybrid-schema-contract.test.ts \
  tests/integration/hospitality-hybrid-api-contract.test.ts \
  tests/integration/hospitality-hybrid-lifecycle.test.ts \
  tests/integration/hospitality-hybrid-ui-contract.test.tsx \
  tests/integration/hospitality-security-contract.test.ts
```

- [ ] **Step 5: Perform final independent spec/security review**

Reviewer verifies:

```text
one credential source of truth
no hospitality_device_credentials table
no payload_data/raw credential fields
Onity dedicated provider path
Onity fail-closed without official verified configuration
no route claims readiness from a lock photograph
provider-confirmed revocation semantics
room replacement does not revoke old credential before replacement confirmation
RLS/tenant boundaries preserved
browser responses contain normalized references only
no remote unlock
no production side effects performed
```

Fix any blocker/major finding and rerun the scoped affected tests plus final gate.

- [ ] **Step 6: Record final classification**

If all code/test/review gates pass but official Onity/property onboarding is still unavailable, record:

```text
implementation_verified = true
external_gates_pending = true
production_ready = false
```

Do not call this 100% production-ready.

- [ ] **Step 7: Commit any final evidence-only correction if needed**

If no file changes were required, do not create an empty commit. If readiness evidence changed:

```bash
git add docs/hospitality/NFC_BLE_HYBRID_READINESS.md
git commit -m "docs(hospitality): record NFC BLE verification evidence"
```

## Completion Report

The execution report must include:

- final feature-branch SHA;
- prerequisite Wallet Hotel Key gate status;
- Task 1–8 commit/status ledger;
- exact final verification command results;
- independent review verdict;
- Onity provider readiness and blocker;
- Wallet/NFC external onboarding blockers;
- production actions intentionally not performed;
- explicit `implementation_verified`, `external_gates_pending`, `production_ready` values.

No merge or production deployment occurs as part of this plan.
