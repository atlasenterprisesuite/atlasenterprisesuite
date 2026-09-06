# ATLAS Core Platform Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `packages/core` into the shared ATLAS authorization, audit, integration-state, authentication-policy, and provider-endpoint authority without breaking existing Accounting behavior.

**Architecture:** Split focused provider-neutral contracts out of the current single `packages/core/src/index.ts` while keeping its public exports backward compatible. Permissions remain namespaced, tenant and organization scope stay mandatory, integration health is evidence-based, and endpoint logic is centralized so feature code never depends on stale provider instance URLs.

**Tech Stack:** TypeScript 5.7, npm workspaces, Vitest 3.2, existing `@atlas/core` package.

**Spec:** `docs/superpowers/specs/2026-09-06-winter27-atlas-platform-controls-design.md`

## Global Constraints
- Preserve current Accounting permission strings and `accounting.admin` behavior.
- Preserve the approved granular ATLAS Voice permission vocabulary.
- Do not create Salesforce-specific security primitives in core.
- New enterprise integration authentication defaults to OAuth/OIDC or explicitly approved modern token flows.
- Never report `connected` without real provider verification.
- Tenant and organization scope must be enforced together.
- Secrets never live in source code, tests, logs, or audit payloads.
- ATLAS Manager remains deployment/infrastructure authority.

---

### Task 1: Extract shared tenant scope and namespaced authorization

**Files:**
- Create: `packages/core/src/scope.ts`
- Create: `packages/core/src/permissions.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/core-permissions.test.ts`

**Interfaces:**
- Produces: `TenantScope`, `sameScope`, `AccountingPermission`, `VoicePermission`, `IntegrationPermission`, `AgentPermission`, `SecurityPermission`, `AuditPermission`, `AtlasPermission`, `hasPermission`, `authorize`.

- [ ] **Step 1: Write the failing authorization tests**

```ts
import { describe, expect, it } from 'vitest';
import { authorize, hasPermission } from '../../packages/core/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

describe('ATLAS shared authorization', () => {
  it('preserves accounting admin behavior', () => {
    expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
  });

  it('does not let accounting admin grant another namespace', () => {
    expect(hasPermission(['accounting.admin'], 'voice.personal.use')).toBe(false);
  });

  it('grants explicit granular voice permission', () => {
    expect(hasPermission(['voice.personal.record'], 'voice.personal.record')).toBe(true);
  });

  it('rejects organization mismatch before permission evaluation', () => {
    expect(authorize({ scope, permissions: ['integrations.admin'] }, {
      scope: { tenantId: 'tenant-a', organizationId: 'org-b' },
      permission: 'integrations.write'
    })).toEqual({ ok: false, reason: 'scope_mismatch' });
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/unit/core-permissions.test.ts`

Expected: FAIL because shared permission namespaces and `authorize` do not exist.

- [ ] **Step 3: Create exact shared permission contracts**

```ts
// packages/core/src/permissions.ts
import type { TenantScope } from './scope';

export type AccountingPermission =
  | 'accounting.read' | 'accounting.write' | 'accounting.post'
  | 'accounting.close' | 'accounting.admin';

export type VoicePermission =
  | 'voice.personal.read' | 'voice.personal.create' | 'voice.personal.record'
  | 'voice.personal.generate' | 'voice.personal.use' | 'voice.personal.delete'
  | 'voice.apple.request' | 'voice.apple.use' | 'voice.integration.manage'
  | 'voice.transcript.read';

export type IntegrationPermission =
  | 'integrations.read' | 'integrations.write' | 'integrations.admin';

export type AgentPermission =
  | 'agents.read' | 'agents.write' | 'agents.publish' | 'agents.admin';

export type SecurityPermission = 'security.admin';
export type AuditPermission = 'audit.read';

export type AtlasPermission = AccountingPermission | VoicePermission |
  IntegrationPermission | AgentPermission | SecurityPermission | AuditPermission;

export function hasPermission(granted: readonly AtlasPermission[], required: AtlasPermission) {
  if (granted.includes(required)) return true;
  const namespace = required.split('.')[0];
  const admin = `${namespace}.admin` as AtlasPermission;
  return granted.includes(admin);
}

export type AuthorizationContext = {
  scope: TenantScope;
  permissions: readonly AtlasPermission[];
};

export function authorize(
  actor: AuthorizationContext,
  request: { scope: TenantScope; permission: AtlasPermission }
): { ok: true } | { ok: false; reason: 'scope_mismatch' | 'permission_denied' } {
  if (actor.scope.tenantId !== request.scope.tenantId || actor.scope.organizationId !== request.scope.organizationId) {
    return { ok: false, reason: 'scope_mismatch' };
  }
  return hasPermission(actor.permissions, request.permission)
    ? { ok: true }
    : { ok: false, reason: 'permission_denied' };
}
```

```ts
// packages/core/src/scope.ts
export type TenantScope = { tenantId: string; organizationId: string };
export const sameScope = (a: TenantScope, b: TenantScope) =>
  a.tenantId === b.tenantId && a.organizationId === b.organizationId;
```

- [ ] **Step 4: Re-export without breaking existing imports**

```ts
// packages/core/src/index.ts
export * from './scope';
export * from './permissions';

import type { AtlasPermission, TenantScope } from './index';

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AtlasPermission[],
  environment: 'demo' as const
};
```

If the self-import above is rejected by TypeScript, import the types directly from `./scope` and `./permissions`; do not duplicate their definitions.

- [ ] **Step 5: Run permission and Accounting regression tests**

Run: `npm test -- tests/unit/core-permissions.test.ts tests/unit/accounting-payables.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src tests/unit/core-permissions.test.ts
git commit -m "refactor: generalize ATLAS authorization contracts"
```

---

### Task 2: Add metadata-only audit primitives

**Files:**
- Create: `packages/core/src/audit.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/core-audit.test.ts`

**Interfaces:**
- Produces: `AuditResult`, `AtlasAuditEvent`, `createAuditEvent`.

- [ ] **Step 1: Write failing audit tests**

```ts
import { expect, it } from 'vitest';
import { createAuditEvent } from '../../packages/core/src';

it('creates scoped metadata-only audit evidence', () => {
  const event = createAuditEvent({
    scope: { tenantId: 't1', organizationId: 'o1' },
    actorId: 'user-1',
    action: 'integration.credentials.changed',
    resource: 'salesforce:primary',
    result: 'success',
    occurredAt: '2026-09-06T18:00:00.000Z',
    evidenceRef: 'provider-check:123'
  });
  expect(event.scope.tenantId).toBe('t1');
  expect(JSON.stringify(event)).not.toContain('secret');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/core-audit.test.ts`

- [ ] **Step 3: Implement the audit contract**

```ts
import type { TenantScope } from './scope';

export type AuditResult = 'success' | 'denied' | 'failed';
export type AtlasAuditEvent = {
  scope: TenantScope;
  actorId: string;
  action: string;
  resource: string;
  result: AuditResult;
  occurredAt: string;
  evidenceRef?: string;
};

export function createAuditEvent(event: AtlasAuditEvent): AtlasAuditEvent {
  return Object.freeze({ ...event, scope: Object.freeze({ ...event.scope }) });
}
```

- [ ] **Step 4: Export and run tests**

Run: `npm test -- tests/unit/core-audit.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit.ts packages/core/src/index.ts tests/unit/core-audit.test.ts
git commit -m "feat: add ATLAS audit contract primitives"
```

---

### Task 3: Add OAuth/OIDC-first integration policy and truthful connection state

**Files:**
- Create: `packages/core/src/integrations.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/core-integrations.test.ts`

**Interfaces:**
- Produces: `IntegrationConnectionState`, `IntegrationAuthKind`, `IntegrationAuthPolicy`, `validateIntegrationAuthPolicy`, `canReportConnected`.

- [ ] **Step 1: Write failing integration-policy tests**

```ts
import { describe, expect, it } from 'vitest';
import { canReportConnected, validateIntegrationAuthPolicy } from '../../packages/core/src';

describe('integration policy', () => {
  it('accepts oauth2 by default', () => {
    expect(validateIntegrationAuthPolicy({ kind: 'oauth2' })).toEqual({ ok: true });
  });

  it('rejects password auth without an approved exception', () => {
    expect(validateIntegrationAuthPolicy({ kind: 'password' })).toEqual({
      ok: false, reason: 'legacy_auth_not_approved'
    });
  });

  it('requires provider verification before connected', () => {
    expect(canReportConnected({ authorized: true, providerVerified: false })).toBe(false);
    expect(canReportConnected({ authorized: true, providerVerified: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/core-integrations.test.ts`

- [ ] **Step 3: Implement exact policy types**

```ts
export type IntegrationConnectionState =
  | 'unconfigured' | 'authorizing' | 'connected' | 'degraded'
  | 'expired' | 'revoked' | 'error';

export type IntegrationAuthKind = 'oauth2' | 'oidc' | 'service_jwt' | 'signed_token' | 'password';

export type LegacyAuthException = {
  reason: string;
  approvedByActorId: string;
  approvedAt: string;
};

export type IntegrationAuthPolicy = {
  kind: IntegrationAuthKind;
  legacyException?: LegacyAuthException;
};

export function validateIntegrationAuthPolicy(policy: IntegrationAuthPolicy) {
  if (policy.kind !== 'password') return { ok: true as const };
  return policy.legacyException
    ? { ok: true as const }
    : { ok: false as const, reason: 'legacy_auth_not_approved' as const };
}

export function canReportConnected(input: { authorized: boolean; providerVerified: boolean }) {
  return input.authorized && input.providerVerified;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/unit/core-integrations.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations.ts packages/core/src/index.ts tests/unit/core-integrations.test.ts
git commit -m "feat: enforce OAuth-first integration policy"
```

---

### Task 4: Add provider endpoint resolution without hard-coded instance hosts

**Files:**
- Create: `packages/core/src/endpoints.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/core-endpoints.test.ts`

**Interfaces:**
- Produces: `ResolvedProviderEndpoint`, `resolveProviderEndpoint`, `applyVerifiedEndpointMigration`.

- [ ] **Step 1: Write failing endpoint tests**

```ts
import { expect, it } from 'vitest';
import { applyVerifiedEndpointMigration, resolveProviderEndpoint } from '../../packages/core/src';

it('normalizes a secure provider URL', () => {
  expect(resolveProviderEndpoint('https://example.my.salesforce.com/')).toEqual({
    origin: 'https://example.my.salesforce.com',
    verified: false
  });
});

it('rejects insecure remote URLs', () => {
  expect(() => resolveProviderEndpoint('http://example.com')).toThrow('insecure_provider_endpoint');
});

it('updates only after migration verification', () => {
  const current = { origin: 'https://old.example.com', verified: true };
  expect(applyVerifiedEndpointMigration(current, 'https://new.example.com', false)).toEqual(current);
  expect(applyVerifiedEndpointMigration(current, 'https://new.example.com', true)).toEqual({
    origin: 'https://new.example.com', verified: true
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/core-endpoints.test.ts`

- [ ] **Step 3: Implement resolver**

```ts
export type ResolvedProviderEndpoint = { origin: string; verified: boolean };

export function resolveProviderEndpoint(input: string): ResolvedProviderEndpoint {
  const url = new URL(input);
  if (url.protocol !== 'https:') throw new Error('insecure_provider_endpoint');
  return { origin: url.origin, verified: false };
}

export function applyVerifiedEndpointMigration(
  current: ResolvedProviderEndpoint,
  candidate: string,
  providerVerified: boolean
): ResolvedProviderEndpoint {
  if (!providerVerified) return current;
  return { ...resolveProviderEndpoint(candidate), verified: true };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/core-endpoints.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/endpoints.ts packages/core/src/index.ts tests/unit/core-endpoints.test.ts
git commit -m "feat: add verified provider endpoint resolution"
```

---

### Task 5: Verify core platform-control regressions and public API

**Files:**
- Modify only if required by test/type errors: `packages/core/src/index.ts`
- Test: all `tests/unit/core-*.test.ts` plus existing Accounting tests.

- [ ] **Step 1: Run the complete core and Accounting regression set**

Run: `npm test -- tests/unit/core-permissions.test.ts tests/unit/core-audit.test.ts tests/unit/core-integrations.test.ts tests/unit/core-endpoints.test.ts tests/unit/accounting-payables.test.ts`

Expected: PASS.

- [ ] **Step 2: Run repository-wide typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run repository-wide unit tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Inspect diff for secrets or duplicate authorization implementations**

Run: `git diff --check && git grep -nE '(password|client_secret|access_token)\s*[:=]\s*["'\''][^"'\'']+' -- ':!package-lock.json' || true`

Expected: no committed credential values and no whitespace errors.

- [ ] **Step 6: Commit any compatibility-only corrections**

```bash
git add packages/core tests/unit
git commit -m "test: verify ATLAS core platform controls"
```

Do not create an empty commit if no correction was needed.
