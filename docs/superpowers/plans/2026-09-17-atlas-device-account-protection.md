# ATLAS Device & Account Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-enforced stolen-device/account-takeover protection layer to ATLAS Identity with risk decisions, trusted-device state, passkey step-up, security delays, recovery/revocation evidence, and truthful Identity/Security UI.

**Architecture:** Keep Supabase Auth as the primary identity/session authority and reuse active organization membership, `has_identity_permission`, RLS, and `audit_row_change()`. Implement a pure policy package first, then tenant-scoped persistence/RPCs, then a Supabase Edge Function using vetted WebAuthn verification, and finally React Identity/Security routes that consume only server-confirmed state.

**Tech Stack:** TypeScript 5.7, React 18, React Router 7, Vite 6, Vitest 3, Supabase Postgres/RLS/RPC, Supabase Edge Functions/Deno, `@simplewebauthn/browser` 14.0.0, `@simplewebauthn/server` 14.0.2.

**Spec:** `docs/superpowers/specs/2026-09-17-atlas-device-account-protection-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; integration branch is `main`; implementation branch is `feat/atlas-device-account-protection`.
- No production code before a failing test for the behavior being introduced.
- Reuse Supabase Auth, active organization membership, `has_identity_permission`, RLS, and `audit_row_change()`.
- Never store biometric templates, authenticator PINs, passkey private keys, passwords, plaintext recovery secrets, or service-role keys.
- RP ID and expected WebAuthn origin are server configuration and are never accepted from request bodies.
- WebAuthn registration/authentication requires user verification and 5-minute single-use challenges.
- Default step-up grant lifetime is 10 minutes.
- Default high-risk/untrusted security delay is 3600 seconds; configured delay range is 900–86400 seconds.
- Revoked/compromised device or session context is denied, not delayed.
- Missing provider-dependent signals are `unknown`; UI must not fabricate location/network/SIM/device confidence.
- Direct browser writes to privileged security state are revoked; guarded functions own transitions.
- Required final verification: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`; run `npm run verify:all` when the runner supports all verification dependencies.

---

## File Structure

- `packages/security-protection/package.json` — workspace registration for the pure policy package.
- `packages/security-protection/src/types.ts` — risk, signal, action and policy types.
- `packages/security-protection/src/policy.ts` — sensitive action catalog and default delay policy.
- `packages/security-protection/src/risk.ts` — deterministic risk evaluation.
- `packages/security-protection/src/index.ts` — public exports.
- `supabase/migrations/20260917110000_security_protection_core.sql` — security tables, indexes, constraints, RLS, audit triggers and RBAC permissions.
- `supabase/migrations/20260917110500_security_protection_governance.sql` — guarded security state transitions and delay authorization RPCs.
- `supabase/functions/atlas-security-protection/index.ts` — operation router.
- `supabase/functions/atlas-security-protection/_shared/context.ts` — authenticated user and active organization resolution.
- `supabase/functions/atlas-security-protection/_shared/errors.ts` — stable error contract.
- `supabase/functions/atlas-security-protection/_shared/repository.ts` — database access through authenticated/user-scoped calls plus guarded RPCs.
- `supabase/functions/atlas-security-protection/_shared/webauthn.ts` — WebAuthn generation/verification using `@simplewebauthn/server` 14.0.2.
- `supabase/functions/atlas-security-protection/_shared/risk.ts` — Edge-to-domain normalization and protected-action authorization.
- `apps/web/src/identity/security/SecurityRoutes.tsx` — Identity/Security route graph.
- `apps/web/src/identity/security/SecurityHomePage.tsx` — protection overview.
- `apps/web/src/identity/security/SecurityDevicesPage.tsx` — devices and revoke/trust actions.
- `apps/web/src/identity/security/SecurityPasskeysPage.tsx` — passkey registration/removal/auth state.
- `apps/web/src/identity/security/SecurityActivityPage.tsx` — risk/audit activity.
- `apps/web/src/identity/security/SecurityRecoveryPage.tsx` — recovery and delayed-action status.
- `apps/web/src/identity/security/securityApi.ts` — typed browser API and WebAuthn browser ceremony.
- `apps/web/src/identity/security/security.css` — responsive/accessibility styles.
- `apps/web/src/App.tsx` — mount protected Identity/Security routes.
- `apps/web/src/identity/IdentityPage.tsx` — allow safe `/identity/security...` return destinations without recursive `/identity` redirect loops.
- `apps/web/package.json` / `package-lock.json` — add `@simplewebauthn/browser` 14.0.0.
- `tests/unit/atlas-security-risk.test.ts` — risk engine tests.
- `tests/unit/atlas-security-policy.test.ts` — action/delay policy tests.
- `tests/integration/atlas-security-schema.test.ts` — table/RLS/RBAC/audit contract.
- `tests/integration/atlas-security-governance.test.ts` — guarded RPC lifecycle contract.
- `tests/integration/atlas-security-edge.test.ts` — Edge/WebAuthn/security contract.
- `tests/unit/atlas-security-ui.test.tsx` — safe routing and truthful UI state contract.
- `tests/integration/atlas-security-invariants.test.ts` — cross-domain/security invariants.

---

### Task 1: Pure Risk and Protected-Action Policy

**Files:**
- Create: `tests/unit/atlas-security-risk.test.ts`
- Create: `tests/unit/atlas-security-policy.test.ts`
- Create: `packages/security-protection/package.json`
- Create: `packages/security-protection/src/types.ts`
- Create: `packages/security-protection/src/policy.ts`
- Create: `packages/security-protection/src/risk.ts`
- Create: `packages/security-protection/src/index.ts`
- Modify: `package-lock.json` only through npm lock synchronization.

**Interfaces:**
- Produces `RiskDecision`, `RiskSignalInput`, `RiskEvaluation`, `ProtectedActionCode`, `ProtectedActionPolicy`.
- Produces `ATLAS_PROTECTED_ACTION_POLICY_V1`.
- Produces `evaluateSecurityRisk(input: RiskEvaluationInput): RiskEvaluation`.
- Produces `getProtectedActionPolicy(action: ProtectedActionCode): ProtectedActionPolicy`.

- [ ] **Step 1: Write failing risk tests**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateSecurityRisk } from '../../packages/security-protection/src';

describe('ATLAS security risk engine', () => {
  it('denies a revoked device', () => {
    expect(evaluateSecurityRisk({ action: 'account.password.change', deviceStatus: 'revoked', passkeyVerified: true, recoveryHold: false, sessionRevoked: false, recentCriticalChange: false }).decision).toBe('deny');
  });

  it('requires step-up for a sensitive action without fresh passkey verification', () => {
    expect(evaluateSecurityRisk({ action: 'api_key.create_privileged', deviceStatus: 'trusted', passkeyVerified: false, recoveryHold: false, sessionRevoked: false, recentCriticalChange: false }).decision).toBe('step_up');
  });

  it('delays an account-critical change from an untrusted device after step-up', () => {
    const result = evaluateSecurityRisk({ action: 'account.recovery.change', deviceStatus: 'untrusted', passkeyVerified: true, recoveryHold: false, sessionRevoked: false, recentCriticalChange: false });
    expect(result.decision).toBe('delay');
    expect(result.delaySeconds).toBe(3600);
  });

  it('does not turn unknown provider signals into trusted evidence', () => {
    const result = evaluateSecurityRisk({ action: 'account.password.change', deviceStatus: 'unknown', passkeyVerified: true, recoveryHold: false, sessionRevoked: false, recentCriticalChange: false, networkReputation: 'unknown', locationConsistency: 'unknown', simEvidence: 'unknown' });
    expect(result.signalsUnknown).toEqual(expect.arrayContaining(['network_reputation', 'location_consistency', 'sim_evidence']));
  });
});
```

- [ ] **Step 2: Write failing policy tests**

Assert the exact action catalog from the spec, `requiresPasskey: true` for every protected action, delayed action set, default delay 3600, min 900, max 86400, and rejection of unknown action strings.

- [ ] **Step 3: Run RED**

Run: `npx vitest run tests/unit/atlas-security-risk.test.ts tests/unit/atlas-security-policy.test.ts`

Expected: FAIL because `packages/security-protection/src` does not exist.

- [ ] **Step 4: Implement minimal domain package**

Use these core types:

```ts
export type RiskDecision = 'allow' | 'step_up' | 'delay' | 'deny';
export type DeviceSecurityStatus = 'trusted' | 'untrusted' | 'revoked' | 'compromised' | 'unknown';
export type OptionalRiskSignal = 'positive' | 'negative' | 'unknown';
export type ProtectedActionCode =
  | 'account.password.change'
  | 'account.recovery.change'
  | 'account.passkey.remove'
  | 'account.protection.disable'
  | 'account.delete'
  | 'admin.role.grant'
  | 'admin.role.revoke'
  | 'payout.destination.change'
  | 'api_key.create_privileged'
  | 'api_key.revoke_privileged'
  | 'session.revoke_others'
  | 'device.trust'
  | 'device.revoke';
```

`evaluateSecurityRisk` applies precedence: revoked/compromised/session-revoked/recovery-hold deny; missing passkey step-up; delayed action + non-trusted or high-risk context delay; otherwise allow. Unknown external signals are recorded, not treated as negative or positive evidence.

- [ ] **Step 5: Run GREEN and workspace regression**

Run: `npx vitest run tests/unit/atlas-security-risk.test.ts tests/unit/atlas-security-policy.test.ts`

Then: `npm run test:unit`.

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(security): add device protection risk policy`.

---

### Task 2: Tenant-Scoped Security Persistence, RLS and RBAC

**Files:**
- Create: `tests/integration/atlas-security-schema.test.ts`
- Create: `supabase/migrations/20260917110000_security_protection_core.sql`

**Interfaces:**
- Produces tables `security_devices`, `security_passkeys`, `security_webauthn_challenges`, `security_risk_events`, `security_step_up_grants`, `security_action_delays`, `security_recovery_events`, `security_session_revocations`.
- Produces permissions from the spec.

- [ ] **Step 1: Write failing schema contract tests**

Tests must assert all eight table names, `org_id`/`user_id` scoping, RLS enabled, active-organization/self or elevated permission policies, direct privileged mutation revokes, append-only risk/recovery evidence, unique passkey credential IDs, challenge expiry/consumed fields, and audit triggers on mutable privileged tables using `public.audit_row_change()`.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/integration/atlas-security-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

Required invariants:

- `security_devices.status` check: `untrusted|trusted|revoked|compromised`.
- `security_passkeys.credential_id` unique and `credential_public_key bytea not null`; no private-key column.
- WebAuthn challenges: `purpose in ('registration','authentication')`, `challenge text not null`, `expires_at`, `consumed_at`, optional action code.
- Risk events append-only with JSONB known/unknown signals and stable policy version.
- Step-up grants include method `passkey`, action scope, `expires_at`, `revoked_at`.
- Delays include state check `pending|ready|executed|cancelled|expired|denied`, immutable `not_before`, action code and target reference.
- Session revocations distinguish `requested|provider_succeeded|provider_failed`; never equate a DB insert with provider success.
- Insert exact security permissions into `identity_permissions`; assign org permissions to owner/admin and self permissions to active member roles according to current role patterns.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run tests/integration/atlas-security-schema.test.ts` then `npm run test:integration`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(security): add protected device security schema`.

---

### Task 3: Guarded Security Governance RPCs

**Files:**
- Create: `tests/integration/atlas-security-governance.test.ts`
- Create: `supabase/migrations/20260917110500_security_protection_governance.sql`

**Interfaces:**
- Produces `record_security_risk_event(...)`.
- Produces `grant_security_step_up(...)`.
- Produces `trust_security_device(device_uuid uuid, reason text, grant_uuid uuid)`.
- Produces `revoke_security_device(device_uuid uuid, reason text, grant_uuid uuid)`.
- Produces `authorize_security_protected_action(action_code text, device_uuid uuid, grant_uuid uuid, target_reference text)`.
- Produces `transition_security_action_delay(delay_uuid uuid, next_state text, reason text)`.
- Produces `record_security_session_revocation(...)`.

- [ ] **Step 1: Write failing governance tests**

Assert that direct privileged mutation stays revoked; trust/revoke require authenticated matching actor plus fresh valid passkey grant; revoked devices cannot self-trust; protected-action authorization enforces valid action code and risk decision; delayed records receive server-calculated `not_before`; transition to `executed` requires explicit downstream success evidence; paid/financial/domain permissions are not granted by security RPCs.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/integration/atlas-security-governance.test.ts`

Expected: FAIL because governance migration/RPCs are absent.

- [ ] **Step 3: Implement guarded functions**

Use `security definer`, fixed `search_path`, `auth.uid()` checks, `public.is_org_member(...)`, and `public.has_identity_permission(...)` according to the requested scope. Validate the supplied grant belongs to the authenticated user/org, is method `passkey`, not expired/revoked, and covers the action. Never accept caller-supplied risk score as authoritative.

- [ ] **Step 4: Run GREEN**

Run: focused governance test then `npm run test:integration`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(security): enforce protected action governance`.

---

### Task 4: WebAuthn Passkey Registration and Step-Up Edge Operations

**Files:**
- Create: `tests/integration/atlas-security-edge.test.ts`
- Create: `supabase/functions/atlas-security-protection/_shared/context.ts`
- Create: `supabase/functions/atlas-security-protection/_shared/errors.ts`
- Create: `supabase/functions/atlas-security-protection/_shared/repository.ts`
- Create: `supabase/functions/atlas-security-protection/_shared/webauthn.ts`
- Create: `supabase/functions/atlas-security-protection/index.ts`

**Interfaces:**
- Edge operations: `passkeys.registration.options`, `passkeys.registration.verify`, `passkeys.authentication.options`, `passkeys.authentication.verify`.
- Server configuration: `ATLAS_WEBAUTHN_RP_ID`, `ATLAS_WEBAUTHN_RP_NAME`, `ATLAS_WEBAUTHN_ORIGIN`.

- [ ] **Step 1: Write failing Edge/WebAuthn source contract tests**

Assert authenticated bearer requirement, active org resolution, server-only RP ID/origin, `@simplewebauthn/server@14.0.2` (or JSR/NPM import pinned to equivalent 14.0.2), `residentKey: 'required'`, `userVerification: 'required'`, `requireUserVerification: true`, 5-minute challenge expiry, challenge consumption on verification attempt, passkey counter update only after successful verification, and stable `webauthn_not_configured` / `webauthn_verification_failed` errors.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/integration/atlas-security-edge.test.ts`

Expected: FAIL because Edge files are absent.

- [ ] **Step 3: Implement context/errors/repository**

Resolve bearer user via Supabase Auth, resolve an active organization membership, and keep user/org IDs server-derived. Repository methods may call guarded RPCs and table reads but must not expose service credentials to the browser.

- [ ] **Step 4: Implement WebAuthn operations**

Use `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, and `verifyAuthenticationResponse`. Persist registration/authentication challenge server-side, consume it before returning verification outcome, store only verified credential public material, and issue a 10-minute passkey step-up grant after successful authentication.

- [ ] **Step 5: Run GREEN**

Run: focused Edge test then `npm run test:integration` and `npm run verify:edge`.

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(security): add WebAuthn passkey step-up`.

---

### Task 5: Risk, Device, Session and Protected-Action Edge API

**Files:**
- Modify: `supabase/functions/atlas-security-protection/index.ts`
- Create: `supabase/functions/atlas-security-protection/_shared/risk.ts`
- Modify: `supabase/functions/atlas-security-protection/_shared/repository.ts`
- Modify: `tests/integration/atlas-security-edge.test.ts`

**Interfaces:**
- Adds operations: `summary`, `devices.list`, `devices.trust`, `devices.revoke`, `sessions.revoke`, `risk.evaluate`, `protected_action.authorize`, `delays.list`, `delays.cancel`, `recovery.status`.

- [ ] **Step 1: Add failing API contract tests**

Tests assert operation allowlist, authenticated/tenant-scoped reads, no caller-supplied actor/user authority, unknown external signals remain unknown, revoked context denies, trust requires passkey grant, session revocation has requested/succeeded/failed truth states, and protected-action authorize returns one of `allow|step_up|delay|deny` with server evidence ID.

- [ ] **Step 2: Run RED**

Run focused Edge tests and confirm failures are only for the new operations.

- [ ] **Step 3: Implement operation router and risk normalization**

Normalize database/provider evidence into the pure risk package input. Provider-dependent signals must default to `unknown`. `sessions.revoke` may report `provider_succeeded` only after a real Supabase/admin revocation call succeeds; otherwise record `provider_failed` and return a truthful failure state.

- [ ] **Step 4: Run GREEN**

Run focused Edge tests, integration tests and edge verification.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(security): add protected action security API`.

---

### Task 6: Identity/Security UI and Browser Passkey Ceremony

**Files:**
- Create: `tests/unit/atlas-security-ui.test.tsx`
- Create: `apps/web/src/identity/security/SecurityRoutes.tsx`
- Create: `apps/web/src/identity/security/SecurityHomePage.tsx`
- Create: `apps/web/src/identity/security/SecurityDevicesPage.tsx`
- Create: `apps/web/src/identity/security/SecurityPasskeysPage.tsx`
- Create: `apps/web/src/identity/security/SecurityActivityPage.tsx`
- Create: `apps/web/src/identity/security/SecurityRecoveryPage.tsx`
- Create: `apps/web/src/identity/security/securityApi.ts`
- Create: `apps/web/src/identity/security/security.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/identity/IdentityPage.tsx`
- Modify: `apps/web/package.json`
- Modify: `package-lock.json` through npm lock synchronization.

**Interfaces:**
- Produces routes `/identity/security`, `/identity/security/devices`, `/identity/security/passkeys`, `/identity/security/activity`, `/identity/security/recovery`.
- Uses `@simplewebauthn/browser` 14.0.0 `startRegistration()` and `startAuthentication()`.

- [ ] **Step 1: Write failing routing/UI tests**

Assert safe `/identity/security...` return handling without allowing generic `/identity` recursion or open redirects; browser API rejects unsafe server shapes; unknown signal renders `Unknown`/`Not configured`; destructive controls do not show success until API confirms; delayed operation uses server `not_before`; WebAuthn unsupported/error states are explicit.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/atlas-security-ui.test.tsx`

Expected: FAIL because Identity/Security module does not exist.

- [ ] **Step 3: Add browser dependency and typed API**

Pin `@simplewebauthn/browser` to `14.0.0`, synchronize lockfile, call `authorizedAtlasFetch('/functions/v1/atlas-security-protection', ...)`, and wrap registration/authentication ceremonies. No RP ID/origin is generated in the browser.

- [ ] **Step 4: Implement routes/pages/styles**

Use existing ATLAS shell/identity styles. All pages need loading, empty, error and success states; 44px touch targets; keyboard/focus support; `aria-live` for security action status; reduced-motion behavior; no Apple branding/artwork; no fake device names/locations/networks.

- [ ] **Step 5: Run GREEN and build**

Run focused UI tests, `npm run test:unit`, `npm run typecheck`, `npm run build`.

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(security): add Identity protection center`.

---

### Task 7: Security Invariants, Cross-Domain Regression and Final Verification

**Files:**
- Create: `tests/integration/atlas-security-invariants.test.ts`
- Modify security implementation only if RED tests expose violations.

**Interfaces:**
- Verifies the complete subsystem against the design spec and existing ATLAS permission boundaries.

- [ ] **Step 1: Write failing invariant tests for uncovered guarantees**

Cover: revoked context cannot authorize any protected action; permission possession cannot bypass passkey/risk; security permission cannot grant Accounting/Network financial authority; passkey private/biometric fields do not exist; challenge cannot be replayed; expired grant cannot authorize; delayed action cannot become executed without downstream-success evidence; DB-only session revocation cannot be represented as provider success; unknown location/network/SIM signals remain unknown; cross-org device/passkey/risk reads are blocked; recovery evidence is append-only.

- [ ] **Step 2: Run RED**

Run the focused invariant test and verify any failures correspond to real missing behavior.

- [ ] **Step 3: Make only the minimal security fixes required by the invariant tests**

Do not broaden permissions, add fake provider data, or weaken fail-closed behavior to satisfy tests.

- [ ] **Step 4: Run complete verification**

Run in order:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run verify:all
```

If `verify:all` cannot run because the environment lacks a declared external verifier, record that exact limitation while keeping all available component gates green.

- [ ] **Step 5: Review dependency/security output**

Record npm audit output, CodeQL/CI status, any pre-existing findings, and any new finding introduced by the WebAuthn dependency. Do not claim zero vulnerabilities unless verified.

- [ ] **Step 6: Commit**

Commit message: `test(security): verify device protection invariants`.

- [ ] **Step 7: Finish branch without merging/deploying**

Use `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch`. Present verified results and keep merge/production deployment as an explicit human checkpoint.