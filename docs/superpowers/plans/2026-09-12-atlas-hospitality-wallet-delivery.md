# ATLAS Hospitality Wallet Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn an eligible, verified hotel stay into a provider-backed Apple Wallet or Google Wallet room-key provisioning flow, safely handle room changes and checkout revocation, and expose truthful admin/guest delivery UX without leaking lock or wallet secrets.

**Architecture:** Add a provider-specific wallet adapter layer beside the existing room-access adapters, plus a server-side Wallet Credential Orchestrator used by PMS event processing and authorized admin actions. Provider credential issuance/revocation stays behind official vendor contracts. Guest handoff uses short-lived ATLAS delivery sessions whose raw bearer token is never persisted; the public exchange function validates a SHA-256 token hash and generates the provider-approved Add-to-Wallet action just in time. Authenticated configuration/operations remain in `atlas-hospitality-access`; the token-exchange boundary is isolated in `atlas-hospitality-wallet-delivery` because secure front-desk/SMS/QR links cannot require an ATLAS staff JWT.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions/Deno, React 18, Vite 6, official SALTO Space Hospitality/WalletHub, authorized Vingcard and dormakaba wallet contracts, Google Hotel Key provider-approved handoff.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`

**Depends on:**
- `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-key-core.md`
- `docs/superpowers/plans/2026-09-12-atlas-hospitality-pms-ingest.md`

## Global Constraints

- Apple Wallet and Google Wallet are separate capabilities; never collapse them into a generic `wallet_ready` flag.
- Google Hotel Key is not a generic Google Wallet pass. Do not synthesize a generic pass as a substitute.
- SALTO KS does not inherit SALTO Space Hospitality wallet capabilities.
- Vingcard/dormakaba wallet capability is property-specific and requires official supported contract, compatible hardware/firmware, entitlement, and live verification.
- No raw NFC/RFID/key bytes, master keys, private keys, provider bearer tokens, decrypted provision tokens, wallet authorization blobs, or encoder secrets may be stored in business tables, logs, browser state, or Git.
- If a provider can only return a non-regenerable provisioning secret at credential issuance and no approved encrypted transient-secret store exists, that provider remains `configured_unverified` with blocker `wallet_transient_secret_storage_required`.
- Provider provisioning actions are generated just in time wherever the official contract permits.
- Automatic issuance requires the enabled versioned property policy and the eligibility decision from the core plan.
- Room change follows provider-safe sequencing: create replacement first, confirm the provider-defined acceptable state, then revoke old credential. Never report partial replacement as complete.
- Checkout/cancellation revokes/invalidate active guest credentials through provider APIs; local terminal state requires provider evidence or explicit reconciliation.
- Remote door unlock remains out of scope.
- `atlas-hospitality-access` stays `verify_jwt=true` in production.
- `atlas-hospitality-wallet-delivery` uses custom short-lived delivery-token authentication and therefore is deployed with `verify_jwt=false`; its function code must reject every request that does not pass token hash, expiry, state, and one-purpose checks.
- No production migration/function deployment occurs without a separate explicit approval after the exact implementation head passes the full verification gate.

---

## File Structure

- `packages/hospitality/wallet.ts` — wallet adapter/provisioning/action types plus platform capability helpers.
- `packages/hospitality/delivery-token.ts` — raw-token generation/encoding and SHA-256 hashing helpers with no persistence.
- `supabase/functions/_shared/hospitality/wallet-registry.ts` — access-provider instance to wallet-adapter selection.
- `supabase/functions/_shared/hospitality/wallet-orchestrator.ts` — issue/replace/revoke lifecycle orchestration.
- `supabase/functions/_shared/hospitality/wallet/apple.ts` — Apple capability/action validation; no credential cryptography.
- `supabase/functions/_shared/hospitality/wallet/google.ts` — Google Hotel Key capability/action validation; no generic-pass generation.
- `supabase/functions/_shared/hospitality/wallet-providers/salto-space.ts` — SALTO Space/WalletHub adapter using verified official contract.
- `supabase/functions/_shared/hospitality/wallet-providers/vingcard.ts` — Vingcard wallet adapter boundary, fail-closed without authorized contract.
- `supabase/functions/_shared/hospitality/wallet-providers/dormakaba.ts` — dormakaba/Saflok wallet adapter boundary, fail-closed without authorized contract.
- `supabase/functions/_shared/hospitality/wallet-providers/generic.ts` — certified aggregator/provider fallback only.
- `supabase/migrations/20260912_hospitality_wallet_delivery.sql` — hashed delivery-token/session lifecycle fields and supporting indexes/constraints.
- `supabase/functions/atlas-hospitality-wallet-delivery/index.ts` — guest secure-link token exchange and just-in-time provisioning action.
- `supabase/functions/atlas-hospitality-access/index.ts` — policy update, wallet revoke/status, secure delivery-link minting for authorized staff.
- `supabase/functions/atlas-hospitality-pms-ingest/_shared/process-event.ts` — call orchestrator after eligible check-in/room-change/checkout events.
- `apps/web/src/lib/hospitalityApi.ts` — PMS/stay/wallet/policy admin client calls.
- `apps/web/src/modules/hospitality/PmsPage.tsx` — PMS status/readiness.
- `apps/web/src/modules/hospitality/StaysPage.tsx` — normalized stays and assignments.
- `apps/web/src/modules/hospitality/WalletKeysPage.tsx` — wallet lifecycle/admin delivery controls.
- `apps/web/src/modules/hospitality/AutomationPage.tsx` — versioned property policy controls and kill switch.
- `apps/web/src/modules/hospitality/WalletDeliveryPage.tsx` — guest delivery page using `#token=` fragment.
- `apps/web/src/modules/hospitality/HospitalityRoutes.tsx` — new admin routes.
- `apps/web/src/modules/hospitality/HospitalitySubnav.tsx` — Overview/PMS/Providers/Rooms/Stays/Wallet Keys/Automation/Audit.
- `apps/web/src/modules/hospitality/RoomsPage.tsx` — include PMS ↔ ATLAS ↔ access-provider mapping context.
- `apps/web/src/modules/hospitality/ProvidersPage.tsx` — show platform-specific wallet capabilities/blockers.
- `apps/web/src/modules/hospitality/hospitality.css` — responsive admin/guest states.
- `apps/web/src/main.tsx` — route guest handoff outside the staff shell.
- `docs/hospitality/providers/SALTO_SPACE_WALLET.md` — public/authorized contract evidence used by adapter.
- `docs/hospitality/providers/VINGCARD_WALLET.md` — safe contract/version/reference and blockers; no private secret content.
- `docs/hospitality/providers/DORMAKABA_WALLET.md` — safe contract/version/reference and blockers.
- `docs/hospitality/providers/GOOGLE_HOTEL_KEY.md` — Google Hotel Key onboarding/capability boundary.
- `tests/unit/hospitality-wallet-adapters.test.ts` — platform/provider adapter tests.
- `tests/unit/hospitality-delivery-token.test.ts` — token generation/hash properties.
- `tests/integration/hospitality-wallet-orchestrator.test.ts` — check-in/replace/revoke/reconciliation lifecycle.
- `tests/integration/hospitality-wallet-delivery-contract.test.ts` — guest token boundary and secret-redaction contract.
- `tests/integration/hospitality-wallet-routes.test.tsx` — admin/guest UI routes and truthful states.
- `tests/integration/hospitality-wallet-e2e.test.ts` — deterministic end-to-end lifecycle.

---

### Task 1: Define the wallet adapter contract, platform gating, and delivery-token primitives

**Files:**
- Create: `packages/hospitality/wallet.ts`
- Create: `packages/hospitality/delivery-token.ts`
- Create: `supabase/functions/_shared/hospitality/wallet/apple.ts`
- Create: `supabase/functions/_shared/hospitality/wallet/google.ts`
- Create: `tests/unit/hospitality-wallet-adapters.test.ts`
- Create: `tests/unit/hospitality-delivery-token.test.ts`

**Interfaces:**

```ts
export type WalletProvisioningAction = {
  platform: WalletPlatform;
  kind: 'provider_url' | 'provider_handoff';
  url: string;
  expiresAt: string;
};

export type WalletIssueRequest = {
  propertyId: string;
  roomId: string;
  providerRoomId: string;
  stayId: string;
  roomAssignmentId: string;
  sourceEventId: string;
  startsAt: string;
  expiresAt: string;
  platform: Exclude<WalletPlatform, 'none'>;
};

export type WalletIssueResult = {
  providerCredentialId: string;
  state: 'issued';
  providerStatusCode?: number | null;
};

export interface HospitalityWalletAdapter {
  readonly providerType: HospitalityProviderType;
  readonly capabilities: readonly HospitalityCapability[];
  readiness(context: ProviderContext, platform: WalletPlatform): Promise<ProviderReadiness>;
  issueWalletCredential(context: ProviderContext, request: WalletIssueRequest): Promise<WalletIssueResult>;
  createProvisioningAction(
    context: ProviderContext,
    input: { providerCredentialId: string; platform: WalletPlatform; expiresAt: string }
  ): Promise<WalletProvisioningAction>;
  revokeWalletCredential(
    context: ProviderContext,
    input: { providerCredentialId: string; propertyId: string; roomId: string; reason: string }
  ): Promise<RevokeCredentialResult>;
  walletStatus?(context: ProviderContext, providerCredentialId: string): Promise<CredentialStatusResult>;
}
```

Token helpers:

```ts
export function createDeliveryToken(randomBytes?: Uint8Array): string;
export async function hashDeliveryToken(token: string): Promise<string>;
```

- [ ] **Step 1: Write failing platform/token tests**

```ts
expect(requiredWalletCapabilities('apple_wallet')).toEqual(['wallet.apple.issue', 'wallet.apple.provision']);
expect(requiredWalletCapabilities('google_wallet')).toEqual(['wallet.google.issue', 'wallet.google.provision']);
expect(() => validateWalletProvisioningAction({
  platform: 'google_wallet', kind: 'provider_url', url: 'http://example.com/key', expiresAt: future
})).toThrow('wallet_provisioning_url_invalid');

const token = createDeliveryToken(new Uint8Array(32).fill(7));
expect(token).not.toContain('=');
expect(await hashDeliveryToken(token)).toHaveLength(64);
expect(await hashDeliveryToken(token)).toBe(await hashDeliveryToken(token));
```

Also assert Google helper code contains no generic-pass class/object generation.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-wallet-adapters.test.ts tests/unit/hospitality-delivery-token.test.ts
```

- [ ] **Step 3: Implement platform capability helpers**

`requiredWalletCapabilities` returns the exact issue/provision capability pair per platform. `validateWalletProvisioningAction` requires HTTPS, matching platform, finite future expiry, and `provider_url|provider_handoff`. It validates transport shape only; provider adapters remain responsible for allowed host/issuer contract.

Apple helper must never build a generic room key. Google helper must throw `wallet_program_onboarding_required` unless the provider adapter has verified the Google Hotel Key contract for that property.

- [ ] **Step 4: Implement 256-bit bearer-token helpers**

`createDeliveryToken()` uses `crypto.getRandomValues(new Uint8Array(32))`, encodes base64url without padding, and accepts injected bytes only for deterministic tests. `hashDeliveryToken()` uses `crypto.subtle.digest('SHA-256', TextEncoder(token))` and returns lowercase hex. Raw token is returned to the caller once and is never written by these helpers.

- [ ] **Step 5: Run tests/typecheck and commit**

```bash
npx vitest run tests/unit/hospitality-wallet-adapters.test.ts tests/unit/hospitality-delivery-token.test.ts
npm run typecheck
git add packages/hospitality/wallet.ts packages/hospitality/delivery-token.ts supabase/functions/_shared/hospitality/wallet tests/unit/hospitality-wallet-adapters.test.ts tests/unit/hospitality-delivery-token.test.ts
git commit -m "feat(hospitality): add wallet adapter and delivery token contracts"
```

---

### Task 2: Implement SALTO Space Hospitality / WalletHub Apple Wallet adapter from official contract evidence

**Files:**
- Create: `docs/hospitality/providers/SALTO_SPACE_WALLET.md`
- Create: `supabase/functions/_shared/hospitality/wallet-providers/salto-space.ts`
- Create: `supabase/functions/_shared/hospitality/wallet-registry.ts`
- Modify: `tests/unit/hospitality-wallet-adapters.test.ts`

**Interfaces:**
- `createSaltoSpaceWalletAdapter(config, fetchImpl)` implements `HospitalityWalletAdapter` for `salto_space_hospitality`.
- Registry exports `walletProviderFor(instance, runtimeConfig?, fetchImpl?)`.

- [ ] **Step 1: Record the exact official SALTO contract before network implementation**

`SALTO_SPACE_WALLET.md` must record current official SALTO Space Hospitality/WalletHub URLs, required Space version/license/hardware prerequisites, authentication scheme, exact room-key create/revoke/status request/response fields, and the exact server-side step that produces the Apple Wallet provisioning action/reference. Record access date and public documentation URLs. If an exact required field is available only under an authorized private contract, record only the contract/version identifier and blocker; never commit the private secret/material.

If the issue/provision contract is still incomplete, the adapter must remain `configured_unverified` with `salto_space_wallet_contract_required`; do not infer request bodies from examples for another SALTO product.

- [ ] **Step 2: Write deterministic failing SALTO tests**

Cover: readiness prerequisites, wrong Space mode, auth rejection, property/room mismatch, successful issue reference, just-in-time provisioning action, revoke, status, malformed provider response, and no raw token persistence.

```ts
expect(adapter.capabilities).toContain('wallet.apple.issue');
expect(adapter.capabilities).toContain('wallet.apple.provision');
expect(adapter.capabilities).not.toContain('wallet.google.issue');
expect(result).toEqual({ providerCredentialId: 'salto-room-key-7', state: 'issued', providerStatusCode: 201 });
```

- [ ] **Step 3: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-wallet-adapters.test.ts
```

- [ ] **Step 4: Implement only the verified SALTO contract**

Reuse the provider instance/property/room scope already verified by ATLAS. `createProvisioningAction` generates/retrieves the provisioning action just in time and returns it without writing its raw token/URL to business persistence. Reject non-HTTPS or host/config mismatches. SALTO KS returns `wallet_platform_not_supported` through the registry.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/hospitality-wallet-adapters.test.ts
npm run typecheck
git add docs/hospitality/providers/SALTO_SPACE_WALLET.md supabase/functions/_shared/hospitality/wallet-providers/salto-space.ts supabase/functions/_shared/hospitality/wallet-registry.ts tests/unit/hospitality-wallet-adapters.test.ts
git commit -m "feat(hospitality): add governed SALTO Space wallet adapter"
```

---

### Task 3: Add Vingcard, dormakaba, Google Hotel Key, and certified-provider wallet boundaries

**Files:**
- Create: `docs/hospitality/providers/VINGCARD_WALLET.md`
- Create: `docs/hospitality/providers/DORMAKABA_WALLET.md`
- Create: `docs/hospitality/providers/GOOGLE_HOTEL_KEY.md`
- Create: `supabase/functions/_shared/hospitality/wallet-providers/vingcard.ts`
- Create: `supabase/functions/_shared/hospitality/wallet-providers/dormakaba.ts`
- Create: `supabase/functions/_shared/hospitality/wallet-providers/generic.ts`
- Modify: `supabase/functions/_shared/hospitality/wallet-registry.ts`
- Modify: `tests/unit/hospitality-wallet-adapters.test.ts`

**Interfaces:**
- Each adapter implements `HospitalityWalletAdapter` only when a reviewed property-specific contract is configured.

- [ ] **Step 1: Write failing fail-closed tests**

For Vingcard and dormakaba, assert brand/config presence alone does not produce wallet capabilities. For Google, assert a provider cannot return `wallet.google.issue/provision` unless `googleHotelKeyProgramVerified === true` and an approved provider contract version is configured.

```ts
expect((await adapter.readiness(ctx, 'google_wallet')).state).toBe('configured_unverified');
expect((await adapter.readiness(ctx, 'google_wallet')).blocker).toBe('wallet_program_onboarding_required');
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-wallet-adapters.test.ts
```

- [ ] **Step 3: Record safe provider contract metadata**

Each provider doc records public official references, supported product modes, hardware/firmware/entitlement prerequisites, safe contract/version identifiers, and explicit missing prerequisites. Do not commit private API credentials, certificates, or confidential contract bodies.

- [ ] **Step 4: Implement adapters as verified-or-blocked boundaries**

If exact issue/revoke/provision semantics are not available through authorized documentation, methods throw `wallet_provider_not_ready` with a safe blocker such as `official_wallet_contract_required`. If a contract is available, implement only that exact version with injected `fetch` and non-destructive readiness. Generic adapter additionally requires `certified === true` and exact compatible lock/provider metadata.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run tests/unit/hospitality-wallet-adapters.test.ts
npm run typecheck
git add docs/hospitality/providers supabase/functions/_shared/hospitality/wallet-providers supabase/functions/_shared/hospitality/wallet-registry.ts tests/unit/hospitality-wallet-adapters.test.ts
git commit -m "feat(hospitality): add property-scoped wallet provider boundaries"
```

---

### Task 4: Implement automatic wallet issuance, room-change replacement, and checkout revocation orchestration

**Files:**
- Create: `supabase/functions/_shared/hospitality/wallet-orchestrator.ts`
- Modify: `supabase/functions/_shared/hospitality/repository.ts`
- Modify: `supabase/functions/atlas-hospitality-pms-ingest/_shared/process-event.ts`
- Create: `tests/integration/hospitality-wallet-orchestrator.test.ts`

**Interfaces:**

```ts
export async function issueWalletForEligibleStay(input: WalletOrchestrationInput): Promise<WalletOrchestrationResult>;
export async function replaceWalletForRoomChange(input: WalletReplacementInput): Promise<WalletOrchestrationResult>;
export async function revokeWalletForTerminalStay(input: WalletRevocationInput): Promise<WalletOrchestrationResult>;
```

Result states are normalized: `blocked | issued | provisioning_ready | replaced | revoked | reconciliation_required`.

- [ ] **Step 1: Write failing lifecycle tests**

Use injected repository/provider doubles to assert:

- eligible checked-in stay issues exactly one provider credential and one credential reference;
- duplicate/previously processed event does not issue again;
- provider success + persistence failure returns `reconciliation_required` and never claims success;
- room change issues replacement first, then revokes old credential;
- replacement issue failure leaves old credential active;
- replacement succeeds but old revoke fails => `reconciliation_required`, not `replaced`;
- checkout/cancellation revokes all active wallet credentials and sessions;
- provider revoke failure leaves local credential non-terminal and visible for manual review.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-orchestrator.test.ts
```

- [ ] **Step 3: Implement issue orchestration**

Strict sequence:

```text
load current stay + active assignment + policy + access provider
→ evaluateWalletEligibility
→ load verified room mapping
→ select wallet adapter and live platform readiness
→ fail if equivalent active credential exists
→ audit wallet.credential.requested with source event + policy version
→ provider issueWalletCredential
→ persist credential reference with issuance_actor='service', stay_id, room_assignment_id,
  credential_type='wallet_mobile_key', wallet_platform, wallet_state='eligible'
→ create provisioning session state='ready' with expiry only; no raw provisioning URL/token
→ set credential wallet_state='provisioning_ready'
→ audit safe provider reference/status
```

If provider succeeds but persistence/audit cannot complete, mark the integration event failed with `reconciliation_required`; do not automatically call provider issue again on retry.

- [ ] **Step 4: Implement room-change safe sequencing**

Issue the new-room credential first. Only after it reaches `issued/provisioning_ready` may the old credential be revoked. Record old/new credential and assignment IDs in audit, not raw provider payloads. If old revoke fails, preserve both references truthfully and set manual-review blocker.

- [ ] **Step 5: Implement checkout/cancellation revocation**

For every active wallet credential for the stay: call official provider revoke/invalidate, then set local `status='revoked'` and `wallet_state='revoked'` only on provider success. Mark provisioning sessions revoked/expired. Failures remain non-terminal with safe error code.

- [ ] **Step 6: Wire PMS processing to the orchestrator**

`stay.checkin_confirmed` invokes auto issue only when policy says enabled and eligibility is true. `room.changed` invokes replacement. `stay.checkout_confirmed` and `reservation.cancelled` invoke revocation. Other events update projection only.

- [ ] **Step 7: Run tests/typecheck and commit**

```bash
npx vitest run tests/integration/hospitality-wallet-orchestrator.test.ts tests/integration/hospitality-pms-projection.test.ts
npm run typecheck
git add supabase/functions/_shared/hospitality supabase/functions/atlas-hospitality-pms-ingest/_shared/process-event.ts tests/integration/hospitality-wallet-orchestrator.test.ts
git commit -m "feat(hospitality): orchestrate wallet key lifecycle"
```

---

### Task 5: Add secure guest delivery-token persistence and token-exchange Edge Function

**Files:**
- Create: `supabase/migrations/20260912_hospitality_wallet_delivery.sql`
- Create: `supabase/functions/atlas-hospitality-wallet-delivery/index.ts`
- Modify: `supabase/functions/_shared/hospitality/repository.ts`
- Create: `tests/integration/hospitality-wallet-delivery-contract.test.ts`

**Interfaces:**
- `mintWalletDeliverySession(orgId, propertyId, provisioningSessionId)` returns `{ token, expiresAt }` once; database stores only `delivery_token_hash`.
- Public Edge Function accepts `POST { token, action: 'inspect' | 'provision' }`.
- `inspect` returns only platform/session state/expiry and safe property-facing metadata.
- `provision` validates token then calls provider adapter `createProvisioningAction` just in time, marks `consumed_at`, and returns `WalletProvisioningAction`.

- [ ] **Step 1: Write failing migration/Edge Function security tests**

Assert migration adds:

```sql
delivery_token_hash text,
delivery_token_expires_at timestamptz,
delivery_revoked_at timestamptz,
delivery_opened_at timestamptz
```

with a unique partial index on non-null `delivery_token_hash`. Assert no `delivery_token` raw column exists.

Assert function source contains token hashing, expiry/revocation/consumed checks, CORS limited to ATLAS production origins, and no ATLAS user-session requirement.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-delivery-contract.test.ts
```

- [ ] **Step 3: Implement migration and repository helpers**

The repository generates a raw 256-bit token, hashes it, stores only hash/expiry, and returns the raw token once. Re-minting explicitly revokes/replaces any prior hash for the same provisioning session. Default delivery expiry must never exceed the earlier of provisioning-session expiry or credential expiry.

- [ ] **Step 4: Implement the token exchange boundary**

Function sequence:

```text
POST only
→ parse token/action with fixed maximum lengths
→ SHA-256 token
→ load session by hash
→ require state ready/provisioning_ready, not revoked, not expired, not consumed
→ action=inspect: set delivery_opened_at if null; return safe state only
→ action=provision: load credential/provider scope server-side; call wallet adapter createProvisioningAction
→ validate action; set consumed_at; return action with cache-control:no-store
```

For invalid/expired/revoked tokens return a uniform `wallet_delivery_unavailable` response; do not reveal whether a hash existed. Never log the raw token or returned provider URL.

CORS permits only `https://atlasenterprisesuite.com` and `https://www.atlasenterprisesuite.com`, methods `POST, OPTIONS`, headers `content-type`.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run tests/unit/hospitality-delivery-token.test.ts tests/integration/hospitality-wallet-delivery-contract.test.ts
npm run typecheck
git add supabase/migrations/20260912_hospitality_wallet_delivery.sql supabase/functions/atlas-hospitality-wallet-delivery supabase/functions/_shared/hospitality/repository.ts tests/integration/hospitality-wallet-delivery-contract.test.ts
git commit -m "feat(hospitality): add secure guest wallet delivery exchange"
```

---

### Task 6: Add versioned automation-policy mutation and authorized delivery/revoke operations

**Files:**
- Modify: `supabase/functions/atlas-hospitality-access/index.ts`
- Modify: `supabase/functions/_shared/hospitality/repository.ts`
- Modify: `apps/web/src/lib/hospitalityApi.ts`
- Create: `tests/integration/hospitality-wallet-admin-contract.test.ts`

**Interfaces:**
- Adds authenticated operations `automation-policy-update`, `wallet-delivery-link`, `wallet-revoke`, `wallet-status`, `room-assignments`.
- `automation-policy-update` requires `hospitality.wallet.automation.manage`.
- `wallet-delivery-link` requires `hospitality.wallet.issue` and only mints a link for an existing `provisioning_ready` credential/session.
- `wallet-revoke` requires `hospitality.wallet.revoke`.

- [ ] **Step 1: Write failing admin API contract tests**

Assert operations are explicit, permission checks use the exact wallet permissions, and no API returns provider runtime config/secret fields.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-admin-contract.test.ts
```

- [ ] **Step 3: Implement optimistic versioned policy updates**

Accepted body shape:

```ts
{
  property_id: string;
  expected_version: number;
  enabled: boolean;
  auto_wallet_key_on_checkin: boolean;
  allowed_platforms: Array<'apple_wallet' | 'google_wallet'>;
  allowed_access_scopes: string[];
  activation_lead_minutes: number;
  credential_expiry_offset_minutes: number;
  room_change_mode: 'provider_safe_sequence';
  max_retry_attempts: number;
  manual_review_on_failure: boolean;
  emergency_kill_switch: boolean;
}
```

Validate integer ranges: lead/expiry offset 0..1440, max retries 0..3, arrays capped at 20 items/80 chars each. Repository update includes `.eq('version', expectedVersion)` and writes `version = expectedVersion + 1`; zero updated rows throws `policy_version_conflict`. Audit old/new version and safe policy values.

`emergency_kill_switch=true` blocks new automatic issuance immediately but does not revoke existing credentials by itself.

- [ ] **Step 4: Implement secure link minting and revoke/status APIs**

`wallet-delivery-link` returns:

```ts
{
  url: `https://atlasenterprisesuite.com/guest/hotel-key#token=${encodeURIComponent(rawToken)}`,
  expires_at: expiresAt
}
```

The raw token is returned only in this authenticated response and is not audited/persisted. Never put it in query parameters.

`wallet-revoke` uses the wallet orchestrator/provider adapter, not direct database status mutation. `wallet-status` may use provider status when available; otherwise report ATLAS reference state with source label.

- [ ] **Step 5: Run tests/typecheck and commit**

```bash
npx vitest run tests/integration/hospitality-wallet-admin-contract.test.ts tests/integration/hospitality-edge-contract.test.ts
npm run typecheck
git add supabase/functions/atlas-hospitality-access supabase/functions/_shared/hospitality/repository.ts apps/web/src/lib/hospitalityApi.ts tests/integration/hospitality-wallet-admin-contract.test.ts
git commit -m "feat(hospitality): add governed wallet admin operations"
```

---

### Task 7: Build truthful PMS/Stays/Wallet/Automation admin UI and guest handoff page

**Files:**
- Modify: `apps/web/src/lib/hospitalityApi.ts`
- Create: `apps/web/src/modules/hospitality/PmsPage.tsx`
- Create: `apps/web/src/modules/hospitality/StaysPage.tsx`
- Create: `apps/web/src/modules/hospitality/WalletKeysPage.tsx`
- Create: `apps/web/src/modules/hospitality/AutomationPage.tsx`
- Create: `apps/web/src/modules/hospitality/WalletDeliveryPage.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalitySubnav.tsx`
- Modify: `apps/web/src/modules/hospitality/RoomAccessPage.tsx`
- Modify: `apps/web/src/modules/hospitality/RoomsPage.tsx`
- Modify: `apps/web/src/modules/hospitality/ProvidersPage.tsx`
- Modify: `apps/web/src/modules/hospitality/hospitality.css`
- Modify: `apps/web/src/main.tsx`
- Create: `tests/integration/hospitality-wallet-routes.test.tsx`

**Interfaces:**
- Admin routes:
  - `/hospitality/access/pms`
  - `/hospitality/access/stays`
  - `/hospitality/access/wallet`
  - `/hospitality/access/automation`
- Public guest route: `/guest/hotel-key`, rendered without `AtlasShell`; raw token is read only from URL fragment `#token=` and then removed from the visible URL using `history.replaceState` after extraction.

- [ ] **Step 1: Write failing UI route/state tests**

Test subnav labels exactly: `Overview`, `PMS`, `Providers`, `Rooms`, `Stays`, `Wallet Keys`, `Automation`, `Audit`.

Test:
- PMS shows `configured_unverified` blockers truthfully;
- Stays shows normalized stay/room labels, not raw IDs where display labels exist;
- Wallet Keys never renders `Add to Wallet` for state before `provisioning_ready`;
- Automation starts disabled and control is hidden/disabled without `hospitality.wallet.automation.manage`;
- guest page rejects missing token, calls delivery `inspect`, shows exact platform CTA only when ready, and removes hash fragment after extraction;
- guest page never renders provider credential ID, raw token, API key, or lock identifiers.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-wallet-routes.test.tsx
```

- [ ] **Step 3: Implement typed browser API methods**

Add: `listHospitalityPmsProviders`, `listHospitalityStays`, `listHospitalityRoomAssignments`, `getHospitalityAutomationPolicy`, `updateHospitalityAutomationPolicy`, `listHospitalityWalletCredentials`, `mintHospitalityWalletDeliveryLink`, `revokeHospitalityWalletCredential`, `getHospitalityWalletStatus`.

Add a separate `hospitalityWalletDeliveryRequest` that calls `atlas-hospitality-wallet-delivery` without ATLAS bearer JWT and sends only `{token, action}` with `content-type: application/json`.

- [ ] **Step 4: Implement admin pages and navigation**

Reuse existing feature-card/table/message components/styles. Providers page renders separate Apple/Google capability chips. Rooms page shows current access-provider mapping plus active PMS assignment context. Automation page requires explicit save; it never auto-enables based on available providers.

- [ ] **Step 5: Implement guest page**

On mount:

```ts
const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const token = params.get('token') || '';
window.history.replaceState(null, '', '/guest/hotel-key');
```

Keep token only in component memory. Call `inspect`; if ready, render `Add to Apple Wallet` or `Add to Google Wallet` according to server platform. On click, call `provision`; only then navigate to the returned validated HTTPS action URL. Do not put raw token into localStorage/sessionStorage.

- [ ] **Step 6: Make guest/admin layouts responsive**

At `<=900px`, cards/tables stack; at `<=640px`, forms/buttons become one-column/full-width. Guest page must have a focused single-action layout and no staff shell/sidebar.

- [ ] **Step 7: Run UI tests/typecheck/build and commit**

```bash
npx vitest run tests/integration/hospitality-wallet-routes.test.tsx tests/integration/hospitality-routes.test.tsx
npm run typecheck
npm run build
git add apps/web tests/integration/hospitality-wallet-routes.test.tsx
git commit -m "feat(hospitality): add wallet key admin and guest delivery UI"
```

---

### Task 8: Verify end-to-end lifecycle, security, mobile truthfulness, and readiness evidence

**Files:**
- Create: `tests/integration/hospitality-wallet-e2e.test.ts`
- Modify: `tests/integration/hospitality-security-contract.test.ts`
- Modify: `docs/hospitality/WALLET_HOTEL_KEY_READINESS.md`
- Modify: `.github/workflows/hospitality-self-hosted-ci.yml`

**Interfaces:**
- Deterministic fake PMS + fake certified wallet provider exercise the normalized lifecycle; no physical credential is generated.

- [ ] **Step 1: Write deterministic E2E lifecycle tests**

Cover exact sequences:

```text
unique check-in → stay/assignment projected → eligibility true → one provider issue → provisioning_ready
→ delivery token inspect → provision action → session consumed → wallet state provisioned only when provider/platform callback/status evidence exists
```

Also cover:

```text
duplicate check-in → zero additional issue calls
room change → replacement issue first → old revoke second
replacement failure → old remains active
checkout → provider revoke → local revoked
checkout revoke failure → local not falsely revoked + manual-review blocker
expired/revoked delivery token → uniform unavailable response
cross-org/property references → denied
```

- [ ] **Step 2: Extend secret-leakage/security contract**

Scan new server/browser code for prohibited persisted/exposed names:

```ts
const prohibited = /master_key|private_key|key_bytes|rfid_dump|encoder_secret|wallet_private_key|decrypted_provision_token/i;
expect(browserAndApiFacingSource).not.toMatch(prohibited);
```

Allow words only in tests/docs that explicitly prohibit them. Assert guest delivery function does not log request body/token/action URL.

- [ ] **Step 3: Run the full verification gate**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-wallet-policy.test.ts tests/unit/hospitality-pms-connectors.test.ts tests/unit/hospitality-wallet-adapters.test.ts tests/unit/hospitality-delivery-token.test.ts
npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-wallet-schema-contract.test.ts tests/integration/hospitality-wallet-repository-contract.test.ts tests/integration/hospitality-pms-ingest-contract.test.ts tests/integration/hospitality-pms-projection.test.ts tests/integration/hospitality-wallet-orchestrator.test.ts tests/integration/hospitality-wallet-delivery-contract.test.ts tests/integration/hospitality-wallet-admin-contract.test.ts tests/integration/hospitality-wallet-routes.test.tsx tests/integration/hospitality-wallet-e2e.test.ts tests/integration/hospitality-security-contract.test.ts
npm run test:unit
npm run test:integration
npm run build
```

Expected: all commands exit 0. High/critical audit findings fail the gate; moderate findings are reported and tracked but do not pass as high severity.

- [ ] **Step 4: Record production-readiness matrix**

`WALLET_HOTEL_KEY_READINESS.md` must report separately per PMS/access-provider/wallet combination:

- PMS contract verified?
- property authorization verified?
- provider wallet capability verified?
- room mapping verified?
- Apple Wallet verified?
- Google Hotel Key verified?
- end-to-end device/physical-access test completed?
- checkout/revocation completed?
- blocker/evidence reference.

No combination is labeled production-ready until every required row is evidence-backed. If only deterministic mocks passed, label it `implementation_verified / production_external_gates_pending`.

- [ ] **Step 5: Production deployment checklist — stop for explicit approval**

After exact branch-head verification is green, present but do not execute this order until explicit user approval:

```text
1. apply 20260912_hospitality_wallet_hotel_key.sql
2. apply 20260912_hospitality_wallet_delivery.sql
3. verify RLS/security advisors and new table constraints
4. deploy atlas-hospitality-access with verify_jwt=true
5. deploy atlas-hospitality-pms-ingest with verify_jwt=false and verified vendor-auth enforcement
6. deploy atlas-hospitality-wallet-delivery with verify_jwt=false and delivery-token enforcement
7. build/deploy Cloudflare web from the exact verified commit
8. verify authenticated admin routes, guest token flow, and /healthz
9. perform controlled provider/property validation; never mark a combination ready before evidence
```

- [ ] **Step 6: Commit readiness evidence**

```bash
git add tests docs/hospitality/WALLET_HOTEL_KEY_READINESS.md .github/workflows/hospitality-self-hosted-ci.yml
git commit -m "test(hospitality): verify wallet hotel key lifecycle and readiness"
```
