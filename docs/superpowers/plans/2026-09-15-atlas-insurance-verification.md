# ATLAS Insurance Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first production slice of ATLAS Insurance: protected `/insurance` routes plus a real six-digit, tenant-scoped verification challenge/grant flow with truthful delivery states.

**Architecture:** Add a focused React module under `apps/web/src/modules/insurance`, reuse `ATLAS Identity` and `authorizedAtlasFetch`, and add one Supabase Edge Function plus RLS-backed challenge/grant/audit persistence. The browser never persists plaintext OTP codes, never trusts client-supplied organization IDs, and never presents delivery as successful unless the backend confirms it.

**Tech Stack:** React 18, React Router, TypeScript 5.7, Vite 6, Vitest 3, Testing Library, Supabase Postgres/RLS, Supabase Edge Functions/Deno.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-insurance-verification-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; canonical integration branch is `main`.
- Reuse existing ATLAS Identity, organization membership, session refresh, route shell, Supabase, and audit patterns.
- No insurer, policy, member, claim, premium, eligibility, or delivery success may be fabricated.
- OTP must be exactly six numeric digits; default expiry 10 minutes; maximum 5 verification attempts; resend cooldown 60 seconds; maximum 3 resends.
- Plaintext OTP codes must never be persisted.
- Authentication + active organization + permission/grant checks remain independent boundaries.
- No credentials, provider secrets, recovery codes, or server hashing secrets may be committed.
- Required final verification: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`.

---

## File Structure

- `apps/web/src/modules/insurance/InsuranceRoutes.tsx` — insurance route graph.
- `apps/web/src/modules/insurance/InsuranceHome.tsx` — Insurance Hub landing/configuration state.
- `apps/web/src/modules/insurance/InsuranceVerificationPage.tsx` — six-digit challenge UI/state machine.
- `apps/web/src/modules/insurance/insuranceApi.ts` — typed browser API and safe `returnTo` resolution.
- `apps/web/src/modules/insurance/insurance.css` — responsive/accessibility styles.
- `apps/web/src/App.tsx` — mount Insurance routes and Enterprise Home card.
- `apps/web/src/identity/IdentityPage.tsx` — permit safe `/insurance` destinations.
- `supabase/migrations/20260915124500_insurance_verification.sql` — challenge/grant/audit tables, constraints, indexes and RLS.
- `supabase/functions/atlas-insurance-verification/index.ts` — issue/verify/resend handler.
- `supabase/functions/atlas-insurance-verification/_shared/context.ts` — authenticated user + active organization resolution.
- `supabase/functions/atlas-insurance-verification/_shared/crypto.ts` — code generation/hash/constant-time comparison.
- `supabase/functions/atlas-insurance-verification/_shared/repository.ts` — server-only persistence operations.
- `supabase/functions/atlas-insurance-verification/_shared/delivery.ts` — explicit email delivery adapter/configuration boundary.
- `supabase/functions/atlas-insurance-verification/_shared/errors.ts` — stable JSON error contract.
- `tests/unit/atlas-insurance-routing.test.tsx` — identity and return-target sanitization.
- `tests/unit/atlas-insurance-verification-ui.test.tsx` — OTP validation/UI states.
- `tests/unit/atlas-insurance-verification-domain.test.ts` — expiry/attempt/resend/grant rules.
- `tests/integration/atlas-insurance-verification-edge.test.ts` — Edge Function source/integration contract and migration/RLS assertions.

---

### Task 1: Safe Insurance Routing and Identity Round-Trip

**Files:**
- Create: `apps/web/src/modules/insurance/InsuranceRoutes.tsx`
- Create: `apps/web/src/modules/insurance/InsuranceHome.tsx`
- Create: `apps/web/src/modules/insurance/insuranceApi.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/identity/IdentityPage.tsx`
- Test: `tests/unit/atlas-insurance-routing.test.tsx`

**Interfaces:**
- Consumes: `RequireAtlasIdentity`, `AtlasShell`, existing React Router graph, `authorizedAtlasFetch`.
- Produces: `InsuranceRoutes`, `resolveInsuranceReturnTo(rawTarget: string | null): string`, `/insurance`, `/insurance/verify`.

- [ ] **Step 1: Write failing routing tests**

```tsx
import { describe, expect, it } from 'vitest';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { resolveInsuranceReturnTo } from '../../apps/web/src/modules/insurance/insuranceApi';

describe('ATLAS Insurance routing boundaries', () => {
  it('allows insurance through ATLAS Identity', () => {
    expect(resolveAtlasIdentityTarget('/insurance')).toBe('/insurance');
    expect(resolveAtlasIdentityTarget('/insurance/verify?scope=insurance_access')).toBe('/insurance/verify?scope=insurance_access');
  });

  it('keeps insurance return targets inside insurance', () => {
    expect(resolveInsuranceReturnTo('/insurance')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/insurance/member/opaque-123')).toBe('/insurance/member/opaque-123');
    expect(resolveInsuranceReturnTo('https://evil.example')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('//evil.example')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/finance')).toBe('/insurance');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/atlas-insurance-routing.test.tsx`

Expected: FAIL because `/insurance` is not yet in the identity allow-list and `resolveInsuranceReturnTo` does not exist.

- [ ] **Step 3: Implement the route sanitizer and identity allow-list**

In `insuranceApi.ts`:

```ts
const INSURANCE_DEFAULT = '/insurance';

export function resolveInsuranceReturnTo(rawTarget: string | null) {
  if (!rawTarget) return INSURANCE_DEFAULT;
  let target = rawTarget.trim();
  try { target = decodeURIComponent(target); } catch { return INSURANCE_DEFAULT; }
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return INSURANCE_DEFAULT;
  const pathname = target.split(/[?#]/, 1)[0];
  return pathname === '/insurance' || pathname.startsWith('/insurance/') ? target : INSURANCE_DEFAULT;
}
```

Add `'/insurance'` to `SUPPORTED_PREFIXES` in `IdentityPage.tsx`.

- [ ] **Step 4: Add protected Insurance routes and Enterprise Home entry**

`InsuranceRoutes.tsx` must wrap its route graph with `RequireAtlasIdentity` and expose `/insurance` plus `/insurance/verify`. `App.tsx` must mount `<InsuranceRoutes />` and add an enabled ATLAS Insurance card only after those routes exist.

- [ ] **Step 5: Run the focused test**

Run: `npx vitest run tests/unit/atlas-insurance-routing.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/identity/IdentityPage.tsx apps/web/src/modules/insurance tests/unit/atlas-insurance-routing.test.tsx
git commit -m "feat: add protected ATLAS Insurance routes"
```

---

### Task 2: Six-Digit Verification UI and Browser API Contract

**Files:**
- Create: `apps/web/src/modules/insurance/InsuranceVerificationPage.tsx`
- Modify: `apps/web/src/modules/insurance/insuranceApi.ts`
- Create: `apps/web/src/modules/insurance/insurance.css`
- Modify: `apps/web/src/modules/insurance/InsuranceRoutes.tsx`
- Test: `tests/unit/atlas-insurance-verification-ui.test.tsx`

**Interfaces:**
- Consumes: `authorizedAtlasFetch(path, init)`, `resolveInsuranceReturnTo`.
- Produces: `issueInsuranceChallenge`, `verifyInsuranceChallenge`, `resendInsuranceChallenge`, `isSixDigitCode`, `InsuranceVerificationPage`.

- [ ] **Step 1: Write failing UI/domain tests**

```tsx
import { describe, expect, it } from 'vitest';
import { isSixDigitCode } from '../../apps/web/src/modules/insurance/insuranceApi';

describe('insurance OTP input', () => {
  it('accepts exactly six ASCII digits', () => {
    expect(isSixDigitCode('123456')).toBe(true);
    expect(isSixDigitCode('12345')).toBe(false);
    expect(isSixDigitCode('1234567')).toBe(false);
    expect(isSixDigitCode('12a456')).toBe(false);
  });
});
```

Add Testing Library coverage asserting Continue is disabled for fewer than six digits and enabled for six digits, and that `delivery_not_configured`, `invalid_code`, `challenge_expired`, `challenge_locked`, and `resend_cooldown` map to explicit user-visible states.

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/unit/atlas-insurance-verification-ui.test.tsx`

Expected: FAIL because the API helpers/page do not exist.

- [ ] **Step 3: Implement typed API helpers**

```ts
export type InsuranceVerificationScope = 'insurance_access' | 'member_policy';
export const isSixDigitCode = (value: string) => /^\d{6}$/.test(value);

export async function issueInsuranceChallenge(input: { scope: InsuranceVerificationScope; resource_id?: string | null }) {
  return callInsuranceVerification({ operation: 'issue', ...input });
}

export async function verifyInsuranceChallenge(input: { challenge_id: string; code: string }) {
  if (!isSixDigitCode(input.code)) throw new Error('invalid_code_format');
  return callInsuranceVerification({ operation: 'verify', ...input });
}

export async function resendInsuranceChallenge(input: { challenge_id: string }) {
  return callInsuranceVerification({ operation: 'resend', ...input });
}
```

`callInsuranceVerification` uses `authorizedAtlasFetch('/functions/v1/atlas-insurance-verification', { method: 'POST', body: JSON.stringify(payload) })` and propagates stable backend error codes.

- [ ] **Step 4: Implement the page state machine**

The page must support: initial issue, code entry, verify loading, invalid code, expiry, lockout, resend cooldown, resend limit, delivery-not-configured, delivery-failed, success redirect, and generic error. Use `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, an `aria-live` status region, and do not copy Athenahealth branding or artwork.

- [ ] **Step 5: Implement responsive styles**

Use existing ATLAS CSS variables/classes where available; keep a centered mobile-first verification card, readable focus states, reduced-motion behavior, and minimum 44px touch targets.

- [ ] **Step 6: Run the focused tests**

Run: `npx vitest run tests/unit/atlas-insurance-verification-ui.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/insurance tests/unit/atlas-insurance-verification-ui.test.tsx
git commit -m "feat: add ATLAS Insurance verification experience"
```

---

### Task 3: Tenant-Scoped Challenge and Grant Persistence

**Files:**
- Create: `supabase/migrations/20260915124500_insurance_verification.sql`
- Test: `tests/integration/atlas-insurance-verification-edge.test.ts`

**Interfaces:**
- Produces tables: `insurance_verification_challenges`, `insurance_verification_grants`, `insurance_verification_audit`.
- All records carry `org_id` and `user_id`; challenge hashes are inaccessible to browser roles.

- [ ] **Step 1: Write migration contract tests**

Assert the migration contains: RLS enabled on all three tables; `org_id`, `user_id`, challenge expiry/attempt/resend fields; `code_hash`; no plaintext `code` column; constraints for attempt/resend non-negativity; indexes for active challenge/grant lookup; policies that prevent cross-user/cross-tenant reads and browser-side challenge mutation.

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/integration/atlas-insurance-verification-edge.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the migration**

Core table shape:

```sql
create table if not exists public.insurance_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('insurance_access','member_policy')),
  resource_id text,
  code_hash text not null,
  delivery_channel text not null check (delivery_channel = 'email'),
  delivery_target_masked text not null default '',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  resend_count integer not null default 0 check (resend_count >= 0),
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Create equivalent grant and audit tables, enable RLS, deny direct anonymous access, and scope authenticated visibility to `auth.uid()` plus active organization membership. Direct inserts/updates of challenge/grant state remain server-controlled.

- [ ] **Step 4: Run migration contract tests**

Run: `npx vitest run tests/integration/atlas-insurance-verification-edge.test.ts`

Expected: PASS for schema/RLS assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915124500_insurance_verification.sql tests/integration/atlas-insurance-verification-edge.test.ts
git commit -m "feat: add insurance verification persistence"
```

---

### Task 4: Verification Domain and Supabase Edge Function

**Files:**
- Create: `packages/insurance/verification.ts`
- Create: `packages/insurance/types.ts`
- Create: `supabase/functions/atlas-insurance-verification/index.ts`
- Create: `supabase/functions/atlas-insurance-verification/_shared/context.ts`
- Create: `supabase/functions/atlas-insurance-verification/_shared/crypto.ts`
- Create: `supabase/functions/atlas-insurance-verification/_shared/repository.ts`
- Create: `supabase/functions/atlas-insurance-verification/_shared/delivery.ts`
- Create: `supabase/functions/atlas-insurance-verification/_shared/errors.ts`
- Test: `tests/unit/atlas-insurance-verification-domain.test.ts`
- Modify: `tests/integration/atlas-insurance-verification-edge.test.ts`

**Interfaces:**
- Produces pure policy helpers: `challengeState`, `canResend`, `nextAttemptState`.
- Edge operations: `{ operation: 'issue' | 'verify' | 'resend', ... }`.
- Stable errors exactly match the design spec.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, it } from 'vitest';
import { canResend, challengeState, nextAttemptState } from '../../packages/insurance/verification';

describe('insurance verification policy', () => {
  it('expires at ten minutes and locks on fifth failed attempt', () => {
    const created = new Date('2026-09-15T16:00:00Z');
    expect(challengeState({ now: new Date('2026-09-15T16:10:01Z'), expiresAt: new Date('2026-09-15T16:10:00Z'), consumedAt: null, attemptCount: 0 })).toBe('expired');
    expect(nextAttemptState(4)).toEqual({ attemptCount: 5, locked: true });
  });

  it('enforces 60 second cooldown and three resend limit', () => {
    expect(canResend({ elapsedSeconds: 59, resendCount: 0 })).toEqual({ allowed: false, reason: 'resend_cooldown' });
    expect(canResend({ elapsedSeconds: 61, resendCount: 3 })).toEqual({ allowed: false, reason: 'resend_limit_reached' });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/unit/atlas-insurance-verification-domain.test.ts`

Expected: FAIL because the domain package does not exist.

- [ ] **Step 3: Implement pure policy helpers**

Use constants `OTP_TTL_SECONDS = 600`, `OTP_MAX_ATTEMPTS = 5`, `OTP_RESEND_COOLDOWN_SECONDS = 60`, `OTP_MAX_RESENDS = 3`. Keep these helpers runtime-neutral so Vitest and Deno can share them.

- [ ] **Step 4: Implement cryptography boundary**

Generate a six-digit code from `crypto.getRandomValues`, hash `challengeId + ':' + code` with HMAC-SHA-256 using server-only `ATLAS_INSURANCE_OTP_SECRET`, store only the encoded digest, and compare decoded digests in constant time. Missing secret returns a configuration error rather than using a weak fallback.

- [ ] **Step 5: Implement authenticated context**

Resolve the bearer token against Supabase Auth, derive `userId`, query active `organization_members`, and expose `{ userId, orgId, role }`. Never trust `org_id` from request JSON.

- [ ] **Step 6: Implement delivery adapter**

Provide a narrow `deliverVerificationCode({ email, code })` interface. It may use an already-authorized server email provider if configuration exists. If none exists, throw `delivery_not_configured`; never log or return the OTP.

- [ ] **Step 7: Implement `issue`**

Validate scope/resource, create the challenge, deliver before returning success, write audit, and return only `{ ok, challenge_id, scope, resource_id, delivery_channel, delivery_target_masked, expires_at, resend_available_at }`.

- [ ] **Step 8: Implement `verify`**

Reject malformed input; load tenant/user challenge; enforce consumed/expiry/lockout; increment failed attempts atomically; compare the server-side digest; on success consume the challenge, create a short-lived scoped grant, audit success, and return `{ ok: true, grant: { scope, resource_id, verified_at, expires_at } }`.

- [ ] **Step 9: Implement `resend`**

Enforce cooldown and resend count server-side, rotate the hash and expiry, deliver the replacement, update counters/timestamps, audit the action, and return a masked delivery target plus new expiry/cooldown metadata only.

- [ ] **Step 10: Extend integration/source contract tests**

Assert all required error codes are present, the function has `issue|verify|resend`, uses authenticated context, never returns `code` or `code_hash`, and handles `delivery_not_configured` explicitly.

- [ ] **Step 11: Run focused tests**

Run:

```bash
npx vitest run tests/unit/atlas-insurance-verification-domain.test.ts
npx vitest run tests/integration/atlas-insurance-verification-edge.test.ts
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/insurance supabase/functions/atlas-insurance-verification tests/unit/atlas-insurance-verification-domain.test.ts tests/integration/atlas-insurance-verification-edge.test.ts
git commit -m "feat: add tenant scoped insurance OTP service"
```

---

### Task 5: End-to-End Module Wiring and Verification

**Files:**
- Modify as required only from Tasks 1–4.
- Test: all insurance tests plus existing repository test suites.

**Interfaces:**
- Consumes every earlier task.
- Produces a merge-ready ATLAS Insurance verification slice; production delivery remains explicitly blocked if the deployed email adapter is not configured.

- [ ] **Step 1: Verify focused Insurance tests**

Run:

```bash
npx vitest run tests/unit/atlas-insurance-routing.test.tsx
npx vitest run tests/unit/atlas-insurance-verification-ui.test.tsx
npx vitest run tests/unit/atlas-insurance-verification-domain.test.ts
npx vitest run tests/integration/atlas-insurance-verification-edge.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run repository typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 3: Run full unit suite**

Run: `npm run test:unit`

Expected: exit 0.

- [ ] **Step 4: Run full integration suite**

Run: `npm run test:integration`

Expected: exit 0.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: exit 0 and Vite production bundle created.

- [ ] **Step 6: Verify route and security behavior manually or with browser automation**

Verify `/insurance` and `/insurance/verify` do not 404/500, unauthenticated entry round-trips through `/identity`, external `returnTo` values are rejected, no plaintext OTP appears in browser storage/network responses, and delivery-not-configured is truthfully rendered.

- [ ] **Step 7: Confirm production dependency boundary**

If the deployed Supabase environment lacks an authorized email provider and `ATLAS_INSURANCE_OTP_SECRET`, record the module as code-complete but delivery-blocked; do not mark verification as live. If configuration exists, exercise issue → resend/verify → grant against the authorized test identity before production deployment.

- [ ] **Step 8: Final commit if verification required adjustments**

```bash
git add apps packages supabase tests
git commit -m "test: verify ATLAS Insurance verification flow"
```

- [ ] **Step 9: Integration gate**

Compare the feature branch against `main`, review only intended Insurance/Identity changes, and merge/deploy only after all required checks pass. After deployment, verify the production URLs and actual configured delivery behavior; never infer deployment success from a source commit alone.
