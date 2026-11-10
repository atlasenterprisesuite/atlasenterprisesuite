# ATLAS TrustPass Core Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first production-capable TrustPass web slice: deterministic risk/policy evaluation, tenant-scoped security evidence, WebAuthn/passkey enrollment and step-up, continuous grant revocation, a real Security Center, and measurable shadow mode without weakening existing ATLAS Identity/RBAC/AAL controls.

**Architecture:** Add a focused `packages/trustpass` domain and one Supabase Edge Function backed by RLS tables. The first rollout runs adaptive scoring in shadow mode while authenticator-management operations use real WebAuthn step-up and action-bound grants; broad Finance/Payroll/Health/Tax enforcement remains out of scope until shadow evidence is calibrated. Existing ATLAS Identity, active-organization resolution, RLS/RBAC, AtlasShell, audit conventions, and exact-release verification remain authoritative.

**Tech Stack:** React 18.3.1, React Router 7.18.3, TypeScript 5.7.x, Vite 6.4.x, Vitest 5.0.x, Supabase Postgres/RLS + Edge Functions/Deno, WebAuthn Level 3, `@simplewebauthn/browser@14.0.0`, `@simplewebauthn/server@14.0.3` subject to the repository dependency/build gate.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-trustpass-design.md`

## Global Constraints

- TrustPass applies only to ATLAS-controlled systems; external CAPTCHA/MFA/reauthentication/consent/provider controls remain human/provider boundaries.
- Reuse existing ATLAS Identity, active-organization resolution, Supabase RLS/RBAC, audit/event patterns, AtlasShell, design tokens, accessibility styles, and release verification.
- Risk may increase required controls; it must never reduce an action's minimum assurance requirement.
- P0 grants are one-time, tenant/user/session/action-bound, short-lived, and atomically consumed with the protected mutation where enforcement is enabled.
- TrustPass never stores raw biometric templates, passwords, private WebAuthn key material, full browser fingerprints, or unnecessary request payloads.
- WebAuthn production baseline is W3C Level 3; Level 4 is not a required production dependency.
- TOTP is fallback/recovery only and must not be labeled phishing-resistant.
- Core Web defaults to `shadow`; risk recommendations do not broadly block existing authorized business actions until later measured enforcement.
- Replay, tenant mismatch, session mismatch, action-hash mismatch, expired/consumed grant use, and invalid WebAuthn challenge/origin/RP binding fail closed.
- Existing browser `localStorage` session custody is not represented as HttpOnly/BFF protection; BFF migration is a separate architecture project.
- No provider/integration state is labeled connected, verified, trusted, or production-ready without authenticated evidence.
- Required final repository gate: `npm run verify:all` plus TrustPass-specific verification and exact-release deployment/runtime evidence before any `VERIFIED IN PRODUCTION` claim.

## Review Focus

- Cross-tenant replay: a challenge/grant created under organization A must never validate or consume under organization B; owning migration/server tests must prove this.
- Payload drift after step-up: changing any material P0 action field after verification must produce `trust_action_mismatch`; action-hash tests must pin canonicalization behavior.
- Recovery downgrade: removing the final viable privileged authenticator must be rejected unless an approved replacement/recovery method remains; Security Center/server tests must cover this.
- Shadow/enforcement confusion: shadow decisions may be recorded but must not silently block ordinary authorized P2/P3 traffic; explicit mode tests must prove this.
- WebAuthn replay/origin mistakes: reused challenges, wrong RP ID, wrong origin, wrong user credential, or expired challenge must fail closed and create security evidence.

---

## File Structure

- `packages/trustpass/src/types.ts` — canonical TrustPass types and stable reason/error vocabulary.
- `packages/trustpass/src/risk.ts` — deterministic risk normalization and reason-weight aggregation.
- `packages/trustpass/src/policy.ts` — action-class/minimum-assurance decision logic.
- `packages/trustpass/src/actionHash.ts` — canonical high-value action serialization and SHA-256 digest contract.
- `packages/trustpass/src/signals.ts` — internal continuous-trust event types and revocation targeting.
- `packages/trustpass/src/index.ts` — public domain exports.
- `supabase/migrations/20261004120000_atlas_trustpass_core.sql` — policies, risk events, challenges, grants, WebAuthn credentials, indexes, constraints, RLS.
- `supabase/functions/atlas-trustpass/index.ts` — authenticated TrustPass API operations.
- `supabase/functions/atlas-trustpass/_shared/context.ts` — authenticated user/session/active-organization resolution.
- `supabase/functions/atlas-trustpass/_shared/repository.ts` — server-controlled persistence with explicit scope predicates.
- `supabase/functions/atlas-trustpass/_shared/webauthn.ts` — registration/authentication option generation and verification.
- `supabase/functions/atlas-trustpass/_shared/risk.ts` — request-signal normalization into domain inputs.
- `supabase/functions/atlas-trustpass/_shared/errors.ts` — stable safe error responses.
- `apps/web/src/modules/settings/security/TrustPassSecurityPage.tsx` — Security Center overview.
- `apps/web/src/modules/settings/security/PasskeysPage.tsx` — real passkey enrollment/removal/step-up surface.
- `apps/web/src/modules/settings/security/trustpassApi.ts` — typed browser calls using `authorizedAtlasFetch`.
- `apps/web/src/modules/settings/security/trustpass.css` — ATLAS-token, responsive, accessible UI.
- `apps/web/src/security/TrustPassStepUp.tsx` — reusable passkey step-up interaction.
- `apps/web/src/App.tsx` — protected Security Center route graph.
- `apps/web/src/components/AtlasShell.tsx` — Security Center navigation entry.
- `apps/web/src/identity/IdentityPage.tsx` — safe `/settings/security` identity round-trip.
- `apps/web/package.json` / root lockfile — pinned WebAuthn browser dependency.
- `scripts/verify-trustpass.mjs` — static/source contract verifier for critical TrustPass invariants.
- `package.json` — `verify:trustpass` and `verify:all` integration.
- `tests/unit/atlas-trustpass-risk.test.ts` — deterministic scoring and bands.
- `tests/unit/atlas-trustpass-policy.test.ts` — assurance/risk/action-class decisions.
- `tests/unit/atlas-trustpass-action-hash.test.ts` — canonical transaction binding.
- `tests/unit/atlas-trustpass-signals.test.ts` — continuous revocation targeting.
- `tests/unit/atlas-trustpass-security-ui.test.tsx` — Security Center/accessibility/state tests.
- `tests/integration/atlas-trustpass-migration.test.ts` — schema/RLS/source constraints.
- `tests/integration/atlas-trustpass-edge.test.ts` — Edge operation/source/WebAuthn boundary contracts.
- `tests/integration/atlas-trustpass-verifier.test.ts` — repository verifier contract.

---

### Task 1: Deterministic Risk, Assurance, and Action-Binding Domain

**Files:**
- Create: `packages/trustpass/src/types.ts`
- Create: `packages/trustpass/src/risk.ts`
- Create: `packages/trustpass/src/policy.ts`
- Create: `packages/trustpass/src/actionHash.ts`
- Create: `packages/trustpass/src/index.ts`
- Test: `tests/unit/atlas-trustpass-risk.test.ts`
- Test: `tests/unit/atlas-trustpass-policy.test.ts`
- Test: `tests/unit/atlas-trustpass-action-hash.test.ts`

**Interfaces:**
- Produces: `type RiskBand = 'low' | 'medium' | 'high' | 'critical'`.
- Produces: `type ActionClass = 'P0' | 'P1' | 'P2' | 'P3'`.
- Produces: `riskBand(score: number): RiskBand` using exact boundaries `0-25`, `26-55`, `56-80`, `81-100`.
- Produces: `calculateRisk(reasons: readonly RiskReason[]): RiskResult` with a clamped integer score `0..100` and stable reason codes.
- Produces: `evaluateTrustDecision(input: TrustDecisionInput): TrustDecision` where risk may escalate but never downgrade `minimumAssurance`.
- Produces: `canonicalizeTrustAction(input: TrustActionInput): string` and `hashTrustAction(input: TrustActionInput): Promise<string>`.

- [ ] **Step 1: Write failing risk-band and clamping tests**

Assert `0,25 -> low`; `26,55 -> medium`; `56,80 -> high`; `81,100 -> critical`; values outside the range clamp to `0..100`; duplicate reason codes cannot inflate a score twice unless explicitly marked repeatable.

- [ ] **Step 2: Run focused risk tests**

Run: `npx vitest run tests/unit/atlas-trustpass-risk.test.ts`

Expected: FAIL because the TrustPass domain does not exist.

- [ ] **Step 3: Implement `types.ts` and `risk.ts`**

Use explicit, deterministic reason weights supplied by a policy fixture; do not embed anonymous-user-facing weight disclosure in UI contracts.

- [ ] **Step 4: Write failing assurance tests**

Required assertions:

- P0 with low risk and insufficient assurance returns `step_up_required`, never `allow`.
- P0 with required phishing-resistant assurance and critical risk returns `deny` or `temporary_hold` according to policy, never a downgraded challenge.
- P3 low-risk read with baseline auth satisfied returns `allow`.
- P2 high risk escalates to `step_up_required` in enforcement mode.
- The same P2 high-risk input in shadow mode returns the existing-authorization-compatible outcome plus `recommendedDecision='step_up_required'`.

- [ ] **Step 5: Implement `policy.ts`**

Signature: `evaluateTrustDecision(input: TrustDecisionInput): TrustDecision`.

Keep `minimumAssurance`, `observedAssurance`, `decision`, `recommendedDecision`, `policyId`, `policyVersion`, `riskScore`, `riskBand`, `reasonCodes`, and `correlationId` explicit.

- [ ] **Step 6: Write failing canonical action-hash tests**

Assert stable property-order-independent output, tenant/action/resource separation, normalized primitive handling, rejection of unsupported values, and digest change when any material field changes.

- [ ] **Step 7: Implement `canonicalizeTrustAction` and `hashTrustAction`**

Use canonical JSON-like serialization with sorted object keys and SHA-256. Never include secrets that are not required to bind the protected mutation.

- [ ] **Step 8: Run all Task 1 tests**

Run: `npx vitest run tests/unit/atlas-trustpass-risk.test.ts tests/unit/atlas-trustpass-policy.test.ts tests/unit/atlas-trustpass-action-hash.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/trustpass tests/unit/atlas-trustpass-*.test.ts
git commit -m "feat: add TrustPass risk and policy domain"
```

---

### Task 2: RLS-Backed TrustPass Persistence

**Files:**
- Create: `supabase/migrations/20261004120000_atlas_trustpass_core.sql`
- Test: `tests/integration/atlas-trustpass-migration.test.ts`

**Interfaces:**
- Produces tables: `atlas_trust_policies`, `atlas_trust_risk_events`, `atlas_trust_challenges`, `atlas_trust_grants`, `atlas_webauthn_credentials`.
- Every user-controlled record is scoped by authenticated user and organization where applicable.
- Browser roles never receive direct write authority over challenge/grant verification state or credential public-key/counter state.

- [ ] **Step 1: Write failing migration contract tests**

Assert all five tables exist, RLS is enabled, required indexes/constraints exist, score constraint is `0..100`, challenge/grant expirations exist, challenge/grant consumed/revoked states exist, credential IDs are unique per relying party/user scope, and no raw biometric/private-key/TOTP secret columns exist.

- [ ] **Step 2: Add cross-tenant/RLS source assertions**

Tests must require policies or helper predicates that bind authenticated reads to `auth.uid()` and active organization membership, while server-controlled mutations remain unavailable to anonymous/browser direct writes.

- [ ] **Step 3: Run migration test and verify failure**

Run: `npx vitest run tests/integration/atlas-trustpass-migration.test.ts`

Expected: FAIL because the migration is absent.

- [ ] **Step 4: Implement migration**

Use existing `organizations`, `organization_members`, and `auth.users` relationships where compatible with current schema. Add append-only semantics for risk events at the application/RLS boundary. Store WebAuthn credential public data only: credential ID, public key, counter, transports/backup metadata, display label, timestamps, revoke state.

- [ ] **Step 5: Run migration contract tests**

Run: `npx vitest run tests/integration/atlas-trustpass-migration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261004120000_atlas_trustpass_core.sql tests/integration/atlas-trustpass-migration.test.ts
git commit -m "feat: add TrustPass RLS persistence"
```

---

### Task 3: Authenticated TrustPass Evaluation and Shadow-Mode API

**Files:**
- Create: `supabase/functions/atlas-trustpass/index.ts`
- Create: `supabase/functions/atlas-trustpass/_shared/context.ts`
- Create: `supabase/functions/atlas-trustpass/_shared/repository.ts`
- Create: `supabase/functions/atlas-trustpass/_shared/risk.ts`
- Create: `supabase/functions/atlas-trustpass/_shared/errors.ts`
- Test: `tests/integration/atlas-trustpass-edge.test.ts`

**Interfaces:**
- Operation: `{ operation: 'evaluate', action_type, resource_id?, action_class, action_payload? }`.
- Server derives `user_id`, session identity, and active organization; client-supplied user/org identity is ignored/rejected.
- Response: `{ decision, recommended_decision, risk_score, risk_band, reason_codes, policy_id, policy_version, correlation_id, mode }`.
- Default mode: `shadow` unless a reviewed environment setting explicitly enables a narrower enforcement policy.

- [ ] **Step 1: Write failing source/integration contract tests**

Require authenticated user resolution, active-organization lookup, no trust of client org/user identifiers, stable error codes, versioned policy lookup, risk-event persistence, and `mode='shadow'` default.

- [ ] **Step 2: Add shadow-mode behavior tests**

Assert P2/P3 risk recommendations are logged in shadow mode without introducing a new denial into otherwise authorized traffic; replay/tenant/session/action integrity failures are not softened by shadow mode.

- [ ] **Step 3: Run Edge tests**

Run: `npx vitest run tests/integration/atlas-trustpass-edge.test.ts`

Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 4: Implement context, repository, risk adapter, errors, and `evaluate` handler**

Reuse the repository's Supabase user-client/service-client conventions and the pure `packages/trustpass` policy domain. Do not duplicate scoring rules in frontend code.

- [ ] **Step 5: Run Edge tests**

Run: `npx vitest run tests/integration/atlas-trustpass-edge.test.ts`

Expected: PASS for evaluation/shadow contracts.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-trustpass tests/integration/atlas-trustpass-edge.test.ts
git commit -m "feat: add TrustPass shadow evaluation API"
```

---

### Task 4: WebAuthn Registration and Step-Up Verification

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `supabase/functions/atlas-trustpass/_shared/webauthn.ts`
- Modify: `supabase/functions/atlas-trustpass/index.ts`
- Modify: `supabase/functions/atlas-trustpass/_shared/repository.ts`
- Create: `apps/web/src/modules/settings/security/trustpassApi.ts`
- Create: `apps/web/src/security/TrustPassStepUp.tsx`
- Modify: `tests/integration/atlas-trustpass-edge.test.ts`
- Test: `tests/unit/atlas-trustpass-security-ui.test.tsx`

**Interfaces:**
- Browser dependency: `@simplewebauthn/browser@14.0.0`.
- Server verifier: `@simplewebauthn/server@14.0.3`; build/bundle gate must prove Edge compatibility before merge.
- Operations: `webauthn.register.options`, `webauthn.register.verify`, `webauthn.stepup.options`, `webauthn.stepup.verify`.
- Browser helpers: `beginPasskeyRegistration()`, `completePasskeyRegistration()`, `beginTrustPassStepUp(input)`, `completeTrustPassStepUp(input)`.

- [ ] **Step 1: Add dependency and compatibility test first**

Update the locked browser dependency and import the pinned server verifier in the Edge source. Add a source/build test that requires exact pinned versions and fails if the Edge bundle cannot resolve the server package.

- [ ] **Step 2: Write failing WebAuthn negative-path tests**

Require failure for expired/reused challenge, wrong expected origin, wrong RP ID, credential not owned by authenticated user, wrong action hash, cross-tenant challenge, and failed user verification.

- [ ] **Step 3: Write failing success-path tests**

Registration success persists only public credential metadata; step-up success creates a short-lived scoped grant; P0-style grant includes `action_hash` and is single-use.

- [ ] **Step 4: Implement server WebAuthn boundary**

Generate cryptographically random, single-use challenges server-side. Store challenge state scoped to user/session/org/method/action. Verify expected RP ID/origin/user verification and update credential counter/backup metadata according to WebAuthn semantics.

- [ ] **Step 5: Implement browser WebAuthn helpers and reusable step-up component**

Use SimpleWebAuthn browser APIs. The component must expose loading, unsupported-browser, user-cancelled, expired, verification-failed, success, and fallback-not-permitted states with semantic live regions.

- [ ] **Step 6: Run WebAuthn tests and production build**

Run: `npx vitest run tests/integration/atlas-trustpass-edge.test.ts tests/unit/atlas-trustpass-security-ui.test.tsx && npm run build`

Expected: PASS; no dependency/bundle error.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/security apps/web/src/modules/settings/security/trustpassApi.ts supabase/functions/atlas-trustpass tests/integration/atlas-trustpass-edge.test.ts tests/unit/atlas-trustpass-security-ui.test.tsx
git commit -m "feat: add TrustPass WebAuthn step-up"
```

---

### Task 5: Continuous Grant Revocation Signals

**Files:**
- Create: `packages/trustpass/src/signals.ts`
- Modify: `packages/trustpass/src/index.ts`
- Modify: `supabase/functions/atlas-trustpass/index.ts`
- Modify: `supabase/functions/atlas-trustpass/_shared/repository.ts`
- Test: `tests/unit/atlas-trustpass-signals.test.ts`
- Modify: `tests/integration/atlas-trustpass-edge.test.ts`

**Interfaces:**
- Produces `TrustSecuritySignalType` values: `session_revoked`, `credential_changed`, `assurance_level_changed`, `device_compliance_changed`, `account_recovery_completed`, `privileged_role_changed`.
- Produces `revocationScopeForSignal(signal): GrantRevocationScope`.
- Internal server operation: `signal.apply`; it must not be callable as an unauthenticated public bypass.

- [ ] **Step 1: Write failing pure signal-to-revocation tests**

Assert session revocation targets that session's grants; credential/recovery changes revoke or attenuate affected user grants; privileged-role changes invalidate grants whose policy decision depended on prior role/assurance context.

- [ ] **Step 2: Write failing Edge authorization/revocation tests**

Anonymous/user-controlled arbitrary `signal.apply` must fail. Authorized internal invocation records correlation/audit evidence and marks matching live grants revoked.

- [ ] **Step 3: Implement signal domain and server revocation**

Keep these as internal CAEP-like semantics. Do not implement external OpenID SSF transport in this plan.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/atlas-trustpass-signals.test.ts tests/integration/atlas-trustpass-edge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/trustpass supabase/functions/atlas-trustpass tests/unit/atlas-trustpass-signals.test.ts tests/integration/atlas-trustpass-edge.test.ts
git commit -m "feat: add continuous TrustPass revocation"
```

---

### Task 6: Real Security Center and Passkey Management

**Files:**
- Create: `apps/web/src/modules/settings/security/TrustPassSecurityPage.tsx`
- Create: `apps/web/src/modules/settings/security/PasskeysPage.tsx`
- Create: `apps/web/src/modules/settings/security/trustpass.css`
- Modify: `apps/web/src/modules/settings/security/trustpassApi.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/identity/IdentityPage.tsx`
- Modify: `tests/unit/atlas-trustpass-security-ui.test.tsx`

**Interfaces:**
- Routes: `/settings/security` and `/settings/security/passkeys`, both behind `RequireAtlasIdentity`.
- UI reads current mode, enrolled passkeys, recent user-visible trust events, and truthful unavailable/error states from backend APIs.
- Passkey removal is a protected action; removing the final viable privileged authenticator is rejected unless server policy confirms an approved recovery/replacement path.

- [ ] **Step 1: Write failing route/identity/UI tests**

Assert `/settings/security` survives Identity return-target sanitization, routes are protected, AtlasShell has a Security entry, no fake passkey rows exist, and empty/loading/error/unsupported/success states are visible and accessible.

- [ ] **Step 2: Write failing authenticator-management tests**

Require recent strong step-up for privileged removal, explicit confirmation of the credential being removed, and rejection of final-authenticator removal when no approved replacement/recovery method remains.

- [ ] **Step 3: Implement Security Center routes and pages**

Use existing ATLAS design tokens and shell. Show score bands/reason categories only to authorized users and never expose hidden weight details. Do not claim a device/passkey is verified unless backend evidence says so.

- [ ] **Step 4: Implement real enrollment/removal interactions**

Enrollment calls the WebAuthn registration flow. Removal calls `evaluate` + step-up when required, then a server operation bound to the credential/action digest.

- [ ] **Step 5: Run UI/typecheck tests**

Run: `npx vitest run tests/unit/atlas-trustpass-security-ui.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/settings/security apps/web/src/security apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/identity/IdentityPage.tsx tests/unit/atlas-trustpass-security-ui.test.tsx
git commit -m "feat: add ATLAS TrustPass Security Center"
```

---

### Task 7: Shadow Observability and Repository TrustPass Verifier

**Files:**
- Create: `scripts/verify-trustpass.mjs`
- Modify: `package.json`
- Test: `tests/integration/atlas-trustpass-verifier.test.ts`
- Modify: `supabase/functions/atlas-trustpass/index.ts`
- Modify: `supabase/functions/atlas-trustpass/_shared/repository.ts`

**Interfaces:**
- Script: `node scripts/verify-trustpass.mjs` exits non-zero on a broken critical invariant.
- npm command: `verify:trustpass`.
- Required shadow metrics: decision/action-class counts, band distribution, reason categories, silent-pass rate, step-up recommendation rate, passkey outcomes, fallback rate, latency, replay, cross-tenant mismatch, temporary hold, recovery event, policy version.

- [ ] **Step 1: Write failing verifier tests**

Require the verifier to assert: TrustPass migration exists; RLS is enabled; risk/policy package exports exist; Edge Function defaults to shadow; external CAPTCHA bypass text/operations are absent; Security Center routes are Identity-protected; WebAuthn expected-origin/RP/challenge checks exist; `verify:all` invokes `verify:trustpass`.

- [ ] **Step 2: Run verifier test and confirm failure**

Run: `npx vitest run tests/integration/atlas-trustpass-verifier.test.ts`

Expected: FAIL because the verifier/script wiring is absent.

- [ ] **Step 3: Implement privacy-preserving metrics projection**

Expose aggregate/admin metrics through authenticated server operations. Do not return raw request payloads, raw biometric data, secrets, or public anonymous scoring weights.

- [ ] **Step 4: Implement `verify-trustpass.mjs` and npm wiring**

Add `verify:trustpass` and insert it into `verify:all` after unit/integration tests and before production build.

- [ ] **Step 5: Run TrustPass verifier tests**

Run: `npx vitest run tests/integration/atlas-trustpass-verifier.test.ts && npm run verify:trustpass`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-trustpass.mjs package.json supabase/functions/atlas-trustpass tests/integration/atlas-trustpass-verifier.test.ts
git commit -m "test: add TrustPass shadow verification gate"
```

---

### Task 8: Full Verification, Evidence Classification, and PR

**Files:**
- Modify only files proven necessary by failing verification.
- Add an audit note only after commands produce evidence.

**Interfaces:**
- Produces a branch whose highest truthful pre-deploy state is `TESTED` or `SHADOW VERIFIED` only if corresponding runtime shadow evidence exists.

- [ ] **Step 1: Run dependency/security audit**

Run: `npm audit --audit-level=high`

Expected: exit 0. Any high/critical issue in the new WebAuthn dependency chain blocks merge until resolved or explicitly reviewed according to repository policy.

- [ ] **Step 2: Run focused TrustPass suites**

Run: `npx vitest run tests/unit/atlas-trustpass-*.test.ts tests/integration/atlas-trustpass-*.test.ts`

Expected: PASS.

- [ ] **Step 3: Run canonical repository gate**

Run: `npm run verify:all`

Expected: PASS with TrustPass verifier included.

- [ ] **Step 4: Inspect diff for security regressions**

Confirm no credentials/secrets/private keys/raw biometrics were added; no existing Identity/RLS/RBAC/AAL gate was weakened; no external CAPTCHA/MFA bypass behavior exists; no fake provider/trust state is introduced.

- [ ] **Step 5: Create final implementation commit if verification repairs were needed**

```bash
git add <verified-files-only>
git commit -m "fix: close TrustPass verification findings"
```

Skip the commit if the tree is already clean.

- [ ] **Step 6: Open PR to `main`**

PR body must distinguish `IMPLEMENTED`/`TESTED` from `DEPLOYED`/`VERIFIED IN PRODUCTION`, list migration/Edge deployment requirements, and state that broad adaptive enforcement remains shadow-only.

- [ ] **Step 7: Require CI/review gates before merge**

Do not merge on failed tests, dependency audit, CodeQL/security checks, or unresolved review findings.

- [ ] **Step 8: Post-merge deployment/runtime verification**

Deploy only through authorized ATLAS production paths. Verify exact release SHA, Supabase migration/function availability, `/settings/security`, passkey registration/step-up with an authorized test identity, shadow-event persistence, and no regression of Identity/RBAC/tenant isolation. A missing provider/human prerequisite remains `EXTERNAL DEPENDENCY`, not complete.

---

## Follow-On Projects Explicitly Outside This Plan

1. **ATLAS Browser BFF Session Custody** — move access/refresh token custody out of browser `localStorage` into a server/BFF architecture with hardened session cookies, CSRF, refresh rotation, revocation, and regression tests aligned with RFC 10017 and the existing `ATLAS_BROWSER_SESSION_MODEL.md` target.
2. **TrustPass P0 Business Enforcement** — atomic action-bound grant consumption for selected Finance/Payroll/Admin/Health/Tax mutations after shadow evidence is calibrated.
3. **TrustPass Native Integrity** — Apple App Attest and Android Play Integrity request-binding adapters.
4. **TrustPass Shared Signals Federation** — external OpenID SSF/CAEP transmitter/receiver integration.
5. **Sender-Constrained Non-BFF OAuth Clients** — evaluate DPoP for suitable native/public API clients.
6. **Anomaly Model** — only after sufficient verified production telemetry and measured false-positive/false-negative baselines exist.

## Self-Review Result

- Spec coverage: Core Web risk/policy, data/RLS, WebAuthn, grants, internal continuous revocation, Security Center, shadow mode, accessibility states, verification, and evidence semantics are covered. Native attestation, BFF, external CAEP, broad business enforcement, and ML are intentionally split into follow-on projects.
- Type consistency: risk/action/policy/grant concepts use one `packages/trustpass` domain and one server API boundary; frontend does not own scoring truth.
- Review focus: cross-tenant replay, action drift, recovery downgrade, shadow/enforcement confusion, and WebAuthn replay/origin/RP failures each have explicit owning tests.
- Proportion: tasks specify interfaces/tests/decisions without writing implementation bodies.
