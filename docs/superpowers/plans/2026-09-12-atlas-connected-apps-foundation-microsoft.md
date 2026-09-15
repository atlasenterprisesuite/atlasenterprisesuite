# ATLAS Connected Apps Foundation + Microsoft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared ATLAS Connected Apps / Integration Gateway foundation and complete the first truthful end-to-end Microsoft connection lifecycle without exposing provider credentials to the browser.

**Architecture:** Add a provider-independent integrations domain under `packages/integrations`, persist tenant/organization-scoped connection metadata in Supabase with RLS, keep credential material behind a server-only vault abstraction, and expose authenticated Edge Function operations through one Integration Gateway. The web app adds Settings → Security → Connected Apps routes that consume sanitized metadata only. Microsoft is the first adapter and must implement connect, callback, verification, capability execution, refresh/reconnect, revoke, and audit using the common contract.

**Tech Stack:** React 18.3.1, React Router 7.18.3, TypeScript 5.7+, Vitest 3.2.6, Supabase/Postgres/RLS, Supabase Edge Functions (Deno), Microsoft identity platform OAuth 2.0 / OpenID Connect, Microsoft Graph.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-connected-apps-integration-gateway-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Target integration branch: `main`; implement on an isolated worktree from `feat/atlas-connected-apps-integration-gateway` or a child implementation branch.
- No merge, production deploy, provider-credit spend, or destructive provider operation without explicit user approval.
- Reuse `apps/web`, `packages/*`, Supabase functions/migrations, existing ATLAS Identity, organization membership, and `identity_role_permissions` before introducing parallel infrastructure.
- `verified` requires a real authenticated provider probe; a DB row, env var, or credential reference is insufficient.
- Provider access tokens, refresh tokens, API keys, client secrets, certificates, recovery codes, and provider passwords must never be client-readable application data.
- No provider secret in LocalStorage, SessionStorage, URLs, frontend logs, analytics, audit events, source control, or persistent React state.
- ATLAS Assistant and modules request named capabilities; they never receive provider tokens.
- Missing capability, scope, credential store, provider configuration, approval dependency, or provider availability fails closed.
- Tenant/organization boundaries are enforced server-side. The current repository resolves active organization membership as the concrete isolation authority; do not invent a separate live tenant registry. Preserve the domain-level tenant field and use the organization-scoped tenancy mode until a distinct trusted tenant mapping exists.
- Default Microsoft consent is least-privilege: `openid profile email offline_access User.Read`. Additional scopes such as `Mail.Read`, `Calendars.Read`, or `Files.Read` require explicit reauthorization.
- Existing ATLAS session refresh behavior may remain in `apps/web/src/lib/atlasSession.ts`; external provider credentials must not use that browser persistence model.
- Run TDD for every behavior change.
- Required final validation: `npm run typecheck`, `npm test`, `npm run build`.
- This plan implements design Milestones 1 and 2 only: shared integration foundation + Microsoft end-to-end. Google/GitHub and Cloudflare/Supabase infrastructure profiles are separate implementation plans after this shared contract is proven.

---

## File Structure Locked by This Plan

Create shared domain files:

- `packages/integrations/types.ts` — provider-independent status, capability, connection, request/result, context, audit types.
- `packages/integrations/permissions.ts` — `integrations.view/use/manage` and `infrastructure.integrations.manage` checks.
- `packages/integrations/provider-registry.ts` — provider catalog and capability metadata, no secrets.
- `packages/integrations/gateway.ts` — pure fail-closed authorization/state/grant decision logic.
- `packages/integrations/index.ts` — public exports.

Create persistence/security files:

- `supabase/migrations/20260912_connected_apps_integrations.sql` — provider, connection, credential-reference, OAuth transaction, grant, audit tables; RLS; service-role-only secret RPC boundaries when Vault is available.
- `supabase/functions/_shared/integrations/context.ts` — authenticated user + organization + DB-backed permissions resolver.
- `supabase/functions/_shared/integrations/repository.ts` — service-side connection/grant/audit persistence.
- `supabase/functions/_shared/integrations/vault.ts` — opaque credential reference operations; throws `credential_vault_not_configured` if no protected store is available.
- `supabase/functions/_shared/integrations/audit.ts` — metadata-only audit helper.
- `supabase/functions/_shared/integrations/approval.ts` — fail-closed Approval Center boundary; never fabricates approval.

Create Microsoft files:

- `supabase/functions/_shared/integrations/providers/microsoft.ts` — provider adapter, OAuth endpoints, scope mapping, verification, refresh/revoke, capability execution, error sanitization.
- `supabase/functions/atlas-integration-oauth/index.ts` — authenticated authorization start + provider callback handling.
- `supabase/functions/atlas-integrations/index.ts` — list/detail/verify/execute/revoke API.

Create web files:

- `apps/web/src/lib/integrationsApi.ts` — sanitized Connected Apps API client.
- `apps/web/src/modules/settings/connected-apps/ConnectedAppsRoutes.tsx` — route family.
- `apps/web/src/modules/settings/connected-apps/ConnectedAppsPage.tsx` — provider list.
- `apps/web/src/modules/settings/connected-apps/ProviderDetailPage.tsx` — tabs and actions.
- `apps/web/src/modules/settings/connected-apps/connectedApps.css` — responsive provider UI.

Modify:

- `apps/web/src/lib/atlasSession.ts` — export the existing authenticated fetch helper or expose an equivalent narrow function-invocation helper without changing session semantics.
- `apps/web/src/App.tsx` — register Connected Apps route delegation.
- `apps/web/src/components/AtlasShell.tsx` — add Settings navigation entry.
- `apps/web/src/styles.css` only for shared shell primitives if a style cannot remain module-local.
- `supabase/functions/atlas-copilot/index.ts` — only in Task 8, to add a capability-request boundary; do not pass provider secrets into the intelligence runtime.

Create tests:

- `tests/unit/integrations-domain.test.ts`
- `tests/integration/connected-apps-schema.test.ts`
- `tests/unit/integrations-edge-security.test.ts`
- `tests/unit/microsoft-integration-adapter.test.ts`
- `tests/integration/connected-apps-api-contract.test.ts`
- `tests/integration/connected-apps-route.test.tsx`
- `tests/integration/atlas-copilot-integration-capability.test.ts`
- `tests/integration/connected-apps-secret-boundary.test.ts`

---

### Task 1: Shared Integration Domain, Provider Registry, and Fail-Closed Gateway Policy

**Files:**
- Create: `packages/integrations/types.ts`
- Create: `packages/integrations/permissions.ts`
- Create: `packages/integrations/provider-registry.ts`
- Create: `packages/integrations/gateway.ts`
- Create: `packages/integrations/index.ts`
- Test: `tests/unit/integrations-domain.test.ts`

**Interfaces:**
- Produces: `IntegrationConnectionStatus`, `IntegrationCapability`, `IntegrationPermission`, `IntegrationActorContext`, `IntegrationConnection`, `IntegrationGrant`, `CapabilityRequest`, `CapabilityDecision`, `ProviderDefinition`, `providerDefinitionFor()`, `requireIntegrationPermission()`, `evaluateCapabilityRequest()`.
- Consumers: Tasks 3–8.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  evaluateCapabilityRequest,
  providerDefinitionFor,
  requireIntegrationPermission,
  type IntegrationActorContext,
  type IntegrationConnection
} from '../../packages/integrations';

const actor: IntegrationActorContext = {
  tenantId: 'org-1',
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'owner',
  permissions: ['integrations.view', 'integrations.use', 'integrations.manage']
};

const connection: IntegrationConnection = {
  id: 'conn-1', tenantId: 'org-1', organizationId: 'org-1', userId: 'user-1',
  providerKey: 'microsoft', connectorClass: 'user_oauth', environment: null,
  status: 'verified', grantedScopes: ['User.Read'], maskedIdentity: 'w***u@example.com',
  lastVerifiedAt: '2026-09-12T12:00:00.000Z'
};

describe('integration gateway policy', () => {
  it('fails closed across organization scope', () => {
    expect(() => evaluateCapabilityRequest({
      actor: { ...actor, organizationId: 'org-2', tenantId: 'org-2' }, connection,
      grant: { connectionId: 'conn-1', principalType: 'user', principalId: 'user-1', module: 'settings', capability: 'microsoft.profile.read' },
      request: { module: 'settings', capability: 'microsoft.profile.read' }
    })).toThrow('integration_scope_mismatch');
  });

  it('requires verified state, grant, ATLAS permission, and provider scope', () => {
    const decision = evaluateCapabilityRequest({
      actor, connection,
      grant: { connectionId: 'conn-1', principalType: 'user', principalId: 'user-1', module: 'settings', capability: 'microsoft.profile.read' },
      request: { module: 'settings', capability: 'microsoft.profile.read' }
    });
    expect(decision).toEqual({ allowed: true });
  });

  it('does not treat connected_unverified as executable', () => {
    expect(() => evaluateCapabilityRequest({
      actor, connection: { ...connection, status: 'connected_unverified' },
      grant: { connectionId: 'conn-1', principalType: 'user', principalId: 'user-1', module: 'settings', capability: 'microsoft.profile.read' },
      request: { module: 'settings', capability: 'microsoft.profile.read' }
    })).toThrow('integration_not_verified');
  });

  it('registers Microsoft without provider secrets', () => {
    expect(providerDefinitionFor('microsoft')).toMatchObject({ connectorClass: 'user_oauth' });
    expect(JSON.stringify(providerDefinitionFor('microsoft'))).not.toMatch(/client_secret|access_token|refresh_token/i);
  });

  it('separates infrastructure management permission', () => {
    expect(() => requireIntegrationPermission(actor, 'infrastructure.integrations.manage')).toThrow('authorization_denied');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/integrations-domain.test.ts`

Expected: FAIL because `packages/integrations` does not exist.

- [ ] **Step 3: Implement minimal shared contracts**

`packages/integrations/types.ts` must define these exact unions:

```ts
export type IntegrationPermission =
  | 'integrations.view'
  | 'integrations.use'
  | 'integrations.manage'
  | 'infrastructure.integrations.manage';

export type IntegrationConnectionStatus =
  | 'not_connected' | 'authorizing' | 'connected_unverified' | 'verified'
  | 'degraded' | 'expired' | 'reconnect_required' | 'revoked' | 'error';

export type IntegrationCapability =
  | 'microsoft.profile.read' | 'microsoft.mail.read'
  | 'microsoft.calendar.read' | 'microsoft.files.read'
  | 'google.gmail.read' | 'google.calendar.read' | 'google.drive.read'
  | 'github.repositories.read' | 'github.pull_requests.read'
  | 'cloudflare.dns.read' | 'cloudflare.workers.read'
  | 'supabase.project.read';

export type IntegrationActorContext = {
  tenantId: string; organizationId: string; userId: string; role: string;
  permissions: IntegrationPermission[];
};

export type IntegrationConnection = {
  id: string; tenantId: string; organizationId: string; userId: string | null;
  providerKey: string; connectorClass: 'user_oauth' | 'infrastructure';
  environment: 'development' | 'staging' | 'production' | null;
  status: IntegrationConnectionStatus; grantedScopes: string[]; maskedIdentity: string | null;
  lastVerifiedAt: string | null;
};

export type IntegrationGrant = {
  connectionId: string; principalType: 'user' | 'role' | 'module'; principalId: string;
  module: string; capability: IntegrationCapability;
};

export type CapabilityRequest = { module: string; capability: IntegrationCapability };
export type CapabilityDecision = { allowed: true };
```

`provider-registry.ts` must map capability → required provider scope. For Microsoft initial milestone:

```ts
const microsoftCapabilities = {
  'microsoft.profile.read': ['User.Read'],
  'microsoft.mail.read': ['Mail.Read'],
  'microsoft.calendar.read': ['Calendars.Read'],
  'microsoft.files.read': ['Files.Read']
} as const;
```

`gateway.ts` must reject, in order: organization/tenant mismatch, missing `integrations.use`, non-`verified` state, missing matching grant, missing required provider scope. It must return `{ allowed: true }` only after all checks pass.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npx vitest run tests/unit/integrations-domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/integrations tests/unit/integrations-domain.test.ts
git commit -m "feat: add integration gateway domain contracts"
```

---

### Task 2: Supabase Integration Metadata Schema, RLS, OAuth Transactions, and Vault Boundary

**Files:**
- Create: `supabase/migrations/20260912_connected_apps_integrations.sql`
- Test: `tests/integration/connected-apps-schema.test.ts`

**Interfaces:**
- Produces tables: `integration_providers`, `integration_connections`, `integration_credentials`, `integration_oauth_transactions`, `integration_grants`, `integration_events`.
- Produces service-role-only RPC contract: `atlas_store_integration_secret(secret_value text, secret_name text) returns uuid`, `atlas_read_integration_secret(secret_id uuid) returns text` only when Supabase Vault is installed.
- Consumers: Tasks 3–5.

- [ ] **Step 1: Write schema contract test before SQL exists**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20260912_connected_apps_integrations.sql';

describe('Connected Apps schema', () => {
  it('defines tenant/org scoped metadata tables with RLS and no raw token columns', () => {
    const sql = readFileSync(path, 'utf8');
    for (const table of ['integration_providers','integration_connections','integration_credentials','integration_oauth_transactions','integration_grants','integration_events']) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql).toMatch(/enable row level security/gi);
    expect(sql).toContain('organization_members');
    expect(sql).not.toMatch(/access_token\s+text|refresh_token\s+text|client_secret\s+text/i);
  });

  it('keeps vault RPC inaccessible to authenticated users', () => {
    const sql = readFileSync(path, 'utf8');
    expect(sql).toMatch(/revoke all on function public\.atlas_store_integration_secret/i);
    expect(sql).toMatch(/grant execute on function public\.atlas_store_integration_secret.*service_role/is);
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/integration/connected-apps-schema.test.ts`

Expected: FAIL with missing migration file.

- [ ] **Step 3: Implement schema with explicit truth-state checks**

The migration must include status constraint values exactly matching Task 1. Connection metadata uses `tenant_id text not null` plus `organization_id uuid not null references public.organizations(id)`. In the current organization-scoped tenancy mode, Edge Functions write `tenant_id = organization_id::text`; this is explicit compatibility behavior, not a claim that a separate tenant registry exists.

`integration_oauth_transactions` must store only `state_hash`, `code_verifier_secret_ref`, actor/provider/org metadata, `expires_at`, and one-time consumption timestamp. Never store raw OAuth state or verifier in plaintext.

RLS read policies for user-facing tables must require active membership through `organization_members`; authenticated users get SELECT only. All writes occur through authenticated Edge Functions using verified context and service-role persistence. `integration_credentials` and `integration_oauth_transactions` must not grant SELECT to authenticated users.

Vault handling must be defensive:

```sql
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'supabase_vault') then
    create extension if not exists supabase_vault;
  end if;
end $$;
```

Define `atlas_store_integration_secret` and `atlas_read_integration_secret` only against Vault APIs available in the target Supabase runtime. Revoke from `anon` and `authenticated`; grant execute only to `service_role`. If Vault is unavailable, the Edge vault adapter in Task 3 must return `credential_vault_not_configured` and keep connection state non-live.

- [ ] **Step 4: Run schema contract test**

Run: `npx vitest run tests/integration/connected-apps-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add supabase/migrations/20260912_connected_apps_integrations.sql tests/integration/connected-apps-schema.test.ts
git commit -m "feat: add connected apps metadata schema and RLS"
```

---

### Task 3: Authenticated Edge Context, Repository, Audit, Vault, and Approval Boundary

**Files:**
- Create: `supabase/functions/_shared/integrations/context.ts`
- Create: `supabase/functions/_shared/integrations/repository.ts`
- Create: `supabase/functions/_shared/integrations/vault.ts`
- Create: `supabase/functions/_shared/integrations/audit.ts`
- Create: `supabase/functions/_shared/integrations/approval.ts`
- Test: `tests/unit/integrations-edge-security.test.ts`

**Interfaces:**
- Produces: `resolveIntegrationContext(req)`, `integrationAdminClient()`, `loadConnection()`, `listConnections()`, `loadGrant()`, `writeIntegrationEvent()`, `storeCredentialSecret()`, `readCredentialSecret()`, `requireApprovalIfConfigured()`.
- Consumers: Tasks 4–5 and Task 8.

- [ ] **Step 1: Write failing security tests using injected fetch/client dependencies**

Test the following exact behaviors: bearer token required; active org membership required; permissions loaded from `identity_role_permissions`; requested foreign organization rejected; secret payload never appears in thrown/loggable error; approval-required policy throws `approval_required` when no real Approval Center adapter exists.

Example assertion:

```ts
await expect(resolveIntegrationContext(request, { fetchFn })).rejects.toMatchObject({ code: 'permission_denied' });
expect(JSON.stringify(error)).not.toContain('super-secret-refresh-token');
```

- [ ] **Step 2: Run test and verify RED**

Run: `npx vitest run tests/unit/integrations-edge-security.test.ts`

Expected: FAIL because shared integration Edge helpers do not exist.

- [ ] **Step 3: Implement context by reusing current repository auth patterns**

Use the same authoritative sequence already present in `atlas-copilot/atlas-intelligence-auth.mjs`: bearer → `/auth/v1/user` → active `organization_members` → `identity_role_permissions`. Do not hardcode owner/admin permissions in the new integrations context.

Return:

```ts
{
  tenantId: organizationId,
  organizationId,
  userId,
  role,
  permissions,
  requestId,
  sessionId
}
```

`tenantId = organizationId` is the explicit current `organization_scoped` tenancy mode until a separate trusted tenant mapping exists.

- [ ] **Step 4: Implement service-side repository and audit sanitization**

`writeIntegrationEvent()` accepts only metadata fields defined by the spec. Before insert, recursively reject keys matching `/token|secret|password|authorization|cookie/i` except safe names such as `credential_ref` or `provider_error_code` that contain no raw secret value.

- [ ] **Step 5: Implement Vault and Approval boundaries**

`storeCredentialSecret()` and `readCredentialSecret()` use service-role RPC only. Missing RPC/Vault maps to `credential_vault_not_configured` with HTTP 503 semantics.

`requireApprovalIfConfigured()` behavior:

```ts
if (!policy.requiresApproval) return { approved: true as const, approvalId: null };
if (!approvalAdapter) throw integrationError('approval_required', 409);
return approvalAdapter.requireApproved(operation);
```

Never manufacture `approved: true` for an approval-required action.

- [ ] **Step 6: Run focused test and verify GREEN**

Run: `npx vitest run tests/unit/integrations-edge-security.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add supabase/functions/_shared/integrations tests/unit/integrations-edge-security.test.ts
git commit -m "feat: add integration security and persistence boundary"
```

---

### Task 4: Microsoft Adapter with Least-Privilege OAuth, Verification, Refresh, Revoke, and Capability Mapping

**Files:**
- Create: `supabase/functions/_shared/integrations/providers/microsoft.ts`
- Test: `tests/unit/microsoft-integration-adapter.test.ts`

**Interfaces:**
- Produces: `createMicrosoftAdapter(config, fetchFn)`, `microsoftDefaultScopes`, `scopesForCapabilities()`, adapter methods `authorizationUrl()`, `exchangeCode()`, `verify()`, `refresh()`, `executeCapability()`, `revokeLocalAuthorization()`, `sanitizeIdentity()`, `mapError()`.
- Consumers: Task 5.

- [ ] **Step 1: Write failing adapter tests**

Required cases:

```ts
expect(microsoftDefaultScopes).toEqual(['openid','profile','email','offline_access','User.Read']);
expect(scopesForCapabilities(['microsoft.mail.read'])).toContain('Mail.Read');
expect(scopesForCapabilities(['microsoft.profile.read'])).not.toContain('Mail.Read');
```

Probe test must inject `fetchFn`, return a fake Microsoft Graph `/me` response, and assert sanitized identity contains no access token. Error test must include a fake token in the thrown network error and assert mapped output omits it.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/microsoft-integration-adapter.test.ts`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement Microsoft endpoints and scope map**

Use:

```ts
const authority = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const graphBase = 'https://graph.microsoft.com/v1.0';
```

Authorization parameters: `client_id`, `response_type=code`, `redirect_uri`, `response_mode=query`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`.

Token exchange/refresh uses form-urlencoded server-side POST to `${authority}/token`.

Verification uses authenticated Graph `GET /me?$select=id,displayName,userPrincipalName,mail` and returns sanitized metadata only:

```ts
{ externalSubjectId, maskedIdentity, displayName, verifiedAt, scopes }
```

The adapter must never return `access_token` or `refresh_token` from public result methods. Internal token-exchange return type stays inside the server-only adapter/callback pipeline.

- [ ] **Step 4: Implement capability execution for first acceptance slice**

Implement `microsoft.profile.read` against Graph `/me` and map the response to sanitized fields. Implement scope checks for mail/calendar/files now, but return `capability_not_implemented` until their provider operations are built in the later provider-capability plan; do not pretend they work because scope exists.

- [ ] **Step 5: Run adapter tests and verify GREEN**

Run: `npx vitest run tests/unit/microsoft-integration-adapter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add supabase/functions/_shared/integrations/providers/microsoft.ts tests/unit/microsoft-integration-adapter.test.ts
git commit -m "feat: add Microsoft integration adapter"
```

---

### Task 5: OAuth Start/Callback and Authenticated Integration Gateway Edge APIs

**Files:**
- Create: `supabase/functions/atlas-integration-oauth/index.ts`
- Create: `supabase/functions/atlas-integrations/index.ts`
- Test: `tests/integration/connected-apps-api-contract.test.ts`

**Interfaces:**
- OAuth start: `POST /functions/v1/atlas-integration-oauth?action=start` body `{ provider_key:'microsoft', return_to:'/settings/security/connected-apps/microsoft', capabilities:['microsoft.profile.read'] }` → `{ authorization_url }`.
- OAuth callback: provider redirect to the configured Edge callback with `code` and `state`; server validates one-time hashed state + PKCE verifier and redirects to an internal ATLAS route containing only safe status parameters.
- Gateway operations: `GET ?action=connections`, `GET ?action=connection&provider=microsoft`, `POST ?action=verify`, `POST ?action=execute`, `POST ?action=revoke`.
- Consumers: Tasks 6–8.

- [ ] **Step 1: Write contract tests before functions exist**

Static/source-level assertions plus pure handler tests must verify:

- allowed action list is explicit;
- bearer auth is required for start/list/detail/verify/execute/revoke;
- callback validates state hash, expiry, one-time consumption, provider, user and organization binding;
- callback does not put provider `code`, access token, refresh token, or verifier into redirect URL;
- `verify` changes state to `verified` only after Microsoft `verify()` succeeds;
- `execute` calls shared `evaluateCapabilityRequest()` before provider adapter execution;
- `revoke` removes/invalidates the credential reference and sets state `revoked` even if Microsoft has no generic token-revocation endpoint suitable for the stored grant; user-facing provider-management URL is returned separately as metadata.

- [ ] **Step 2: Run focused contract test and verify RED**

Run: `npx vitest run tests/integration/connected-apps-api-contract.test.ts`

Expected: FAIL because Edge Functions do not exist.

- [ ] **Step 3: Implement OAuth start transaction**

Generate 32+ random bytes for OAuth `state` and PKCE verifier server-side. Store only SHA-256 state hash in `integration_oauth_transactions`; store verifier through Vault and persist only its secret reference. Set expiry to 10 minutes. Authorization URL may contain the raw one-time state and PKCE challenge; it must not contain ATLAS session tokens or provider client secret.

If `MICROSOFT_CLIENT_ID`, `MICROSOFT_REDIRECT_URI`, or protected Vault storage is missing, return `provider_not_configured` / `credential_vault_not_configured`; do not return a fake authorization URL.

- [ ] **Step 4: Implement callback exchange and verification**

On callback: hash state → find unconsumed nonexpired transaction → read PKCE verifier from Vault → exchange code → store access/refresh payload as protected secret → create/update sanitized connection as `connected_unverified` → run Microsoft verification → transition to `verified` only on successful Graph probe → write correlated audit events → consume/delete OAuth transaction secrets → redirect to `/settings/security/connected-apps/microsoft?oauth=success`.

On provider cancellation, redirect with `oauth=cancelled`; on safe failure, `oauth=error&code=<sanitized_code>`. Never append provider error description verbatim if it can contain sensitive material.

- [ ] **Step 5: Implement list/detail/verify/execute/revoke operations**

All operations resolve integration context and enforce `integrations.view/use/manage` as appropriate. `execute` requires connection + grant + capability policy. `verify` uses current server-side credential. Refresh may occur server-side on 401/expired response, then verification must run again before restoring `verified`.

- [ ] **Step 6: Run contract tests and verify GREEN**

Run: `npx vitest run tests/integration/connected-apps-api-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add supabase/functions/atlas-integration-oauth supabase/functions/atlas-integrations tests/integration/connected-apps-api-contract.test.ts
git commit -m "feat: add connected apps OAuth and gateway APIs"
```

---

### Task 6: Web API Client and Connected Apps Routes/UI

**Files:**
- Create: `apps/web/src/lib/integrationsApi.ts`
- Create: `apps/web/src/modules/settings/connected-apps/ConnectedAppsRoutes.tsx`
- Create: `apps/web/src/modules/settings/connected-apps/ConnectedAppsPage.tsx`
- Create: `apps/web/src/modules/settings/connected-apps/ProviderDetailPage.tsx`
- Create: `apps/web/src/modules/settings/connected-apps/connectedApps.css`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/integration/connected-apps-route.test.tsx`

**Interfaces:**
- Produces UI routes `/settings/security/connected-apps` and `/settings/security/connected-apps/:providerKey`.
- `integrationsApi.ts`: `listIntegrationConnections()`, `getIntegrationConnection(providerKey)`, `beginIntegrationAuthorization(providerKey, capabilities)`, `verifyIntegration(providerKey)`, `executeIntegrationCapability(providerKey, capability)`, `revokeIntegration(providerKey)`.

- [ ] **Step 1: Write route/UI tests before implementation**

Use `MemoryRouter`, existing ATLAS Identity/session patterns, and mocked fetch. Required assertions:

- unauthenticated access routes through ATLAS Identity;
- authenticated route renders heading `Connected Apps`;
- Microsoft with no connection renders `Not connected` and `Connect`;
- `connected_unverified` does not render `Verified`;
- verified response renders masked identity, last verified timestamp, scopes/capabilities, and `Manage`;
- Manage detail exposes tabs `Overview`, `Permissions`, `Used By`, `Activity`, `Security`;
- mobile-safe markup has no hidden functional action variant; use semantic buttons/links rather than viewport-specific duplication;
- raw token-shaped strings in mocked server payload are not rendered even if malicious metadata tries to include them.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/integration/connected-apps-route.test.tsx`

Expected: FAIL because routes/components do not exist.

- [ ] **Step 3: Expose narrow authenticated request helper**

In `atlasSession.ts`, export the existing `authorizedFetch` or a wrapper:

```ts
export async function invokeAtlasFunction(path: string, init: RequestInit = {}) {
  return authorizedFetch(`/functions/v1/${path}`, init);
}
```

Do not alter ATLAS session persistence semantics in this task.

- [ ] **Step 4: Implement `integrationsApi.ts` with response allow-listing**

Normalize only known safe fields: provider key/name, status, masked identity, connected/verified/expiry timestamps, scopes, capabilities, module grants, sanitized audit metadata. Discard unknown response keys rather than spreading raw provider payloads into UI objects.

- [ ] **Step 5: Implement Connected Apps list/detail UI**

Provider list must include Microsoft, Google, GitHub, Cloudflare, and Supabase catalog entries, but only Microsoft can expose Connect in this plan. Others display truthful `Not configured`/`Not connected` state with disabled actions and explanatory copy; no `Coming Soon` if the state can be expressed more accurately as configuration not implemented in this milestone.

The Microsoft detail actions:

- `Connect` → calls OAuth start and then `window.location.assign(authorization_url)`.
- `Verify now` → server verify, refresh local detail.
- `Reconnect` → new OAuth start.
- `Manage at Microsoft` → use adapter-provided official management URL metadata or a static official account-app management destination defined server-side; never infer from user data.
- `Revoke from ATLAS` → confirmation UI → server revoke → render `Revoked`.

- [ ] **Step 6: Register navigation and responsive styles**

In `AtlasShell.tsx`, add `{ to: '/settings/security/connected-apps', label: 'Settings' }` without removing existing modules.

In `App.tsx`, delegate `/settings/security/connected-apps` routes through `ConnectedAppsRoutes` under the existing authenticated shell pattern. Keep Hospitality special routing intact.

Module CSS must implement card grid and horizontally usable detail tabs at ≤760px; do not add new arbitrary brand colors outside the existing blue/dark ATLAS system.

- [ ] **Step 7: Run route tests and typecheck**

Run:

```bash
npx vitest run tests/integration/connected-apps-route.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add apps/web/src/lib/atlasSession.ts apps/web/src/lib/integrationsApi.ts apps/web/src/modules/settings/connected-apps apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx tests/integration/connected-apps-route.test.tsx
git commit -m "feat: add Connected Apps settings experience"
```

---

### Task 7: Integration Grants, Used-By View, Audit Activity, and Real First Capability Execution

**Files:**
- Modify: `supabase/functions/atlas-integrations/index.ts`
- Modify: `supabase/functions/_shared/integrations/repository.ts`
- Modify: `apps/web/src/lib/integrationsApi.ts`
- Modify: `apps/web/src/modules/settings/connected-apps/ProviderDetailPage.tsx`
- Test: `tests/integration/connected-apps-api-contract.test.ts`
- Test: `tests/integration/connected-apps-route.test.tsx`

**Interfaces:**
- Adds gateway actions `grants`, `grant`, `revoke-grant`, `audit`.
- First operational capability: `microsoft.profile.read`.

- [ ] **Step 1: Add failing tests for grant enforcement**

Test that a verified Microsoft connection without a matching active grant returns `integration_grant_required`. Add a grant for principal user `user-1`, module `settings`, capability `microsoft.profile.read`, then assert execution succeeds through the adapter and audit records only sanitized result metadata.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/integration/connected-apps-api-contract.test.ts tests/integration/connected-apps-route.test.tsx
```

Expected: FAIL on missing grant management behavior.

- [ ] **Step 3: Implement grant CRUD through server-side authorization**

`grant` and `revoke-grant` require `integrations.manage`. A user may grant only a capability supported by the provider and actually covered by current provider scopes. Write audit event for create/revoke.

- [ ] **Step 4: Implement Used By and Activity tabs**

Used By reads active grants. Activity reads `integration_events` ordered newest first. UI never exposes raw provider response payloads.

- [ ] **Step 5: Execute `microsoft.profile.read` through gateway**

Execution path must be exactly:

`context → permission → connection scope/state → grant → provider scope → vault credential → Microsoft adapter → sanitized result → audit`.

A provider 401 triggers one refresh attempt if refresh token exists; after refresh, run verification before executing. A second 401 becomes `reconnect_required`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/integration/connected-apps-api-contract.test.ts tests/integration/connected-apps-route.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add supabase/functions/atlas-integrations supabase/functions/_shared/integrations/repository.ts apps/web/src/lib/integrationsApi.ts apps/web/src/modules/settings/connected-apps/ProviderDetailPage.tsx tests/integration/connected-apps-api-contract.test.ts tests/integration/connected-apps-route.test.tsx
git commit -m "feat: enforce integration grants and capability execution"
```

---

### Task 8: ATLAS Assistant Capability Boundary Without Credential Exposure

**Files:**
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Create: `supabase/functions/atlas-copilot/integration-capability.mjs`
- Test: `tests/integration/atlas-copilot-integration-capability.test.ts`

**Interfaces:**
- Produces an Assistant-side tool boundary that sends capability requests to the Integration Gateway using the authenticated ATLAS request context; no provider token crosses into model prompt/input/output.

- [ ] **Step 1: Write failing tests**

Tests must assert:

- requesting `microsoft.profile.read` without connection/grant produces structured blocked state `integration_grant_required` or `provider_not_connected`;
- successful integration result is sanitized provider data only;
- a fake `access_token: "secret-token"` returned by a malicious mock is removed/rejected before Assistant runtime receives it;
- Assistant cannot request scope expansion through this boundary.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/integration/atlas-copilot-integration-capability.test.ts`

Expected: FAIL because capability bridge does not exist.

- [ ] **Step 3: Implement the bridge as a narrow gateway client**

`integration-capability.mjs` accepts:

```js
executeIntegrationCapability({ request, organizationId, module, capability, fetchFn })
```

It forwards the ATLAS bearer token and `x-atlas-org-id` to `atlas-integrations?action=execute`. It rejects response keys matching secret names and returns only `{ ok, capability, data, blocked_reason, connection_state }`.

- [ ] **Step 4: Bind bridge into `atlas-copilot` without changing model-provider routing**

Do not insert external provider credentials into OpenAI request content. The Assistant may call the bridge only when the incoming ATLAS request explicitly asks for an integration capability and the server-side policy approves it. Existing intelligence provider selection remains unchanged.

- [ ] **Step 5: Run focused test and verify GREEN**

Run: `npx vitest run tests/integration/atlas-copilot-integration-capability.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add supabase/functions/atlas-copilot/index.ts supabase/functions/atlas-copilot/integration-capability.mjs tests/integration/atlas-copilot-integration-capability.test.ts
git commit -m "feat: add assistant integration capability boundary"
```

---

### Task 9: Secret-Boundary Regression Tests, Full Validation, and Evidence Handoff

**Files:**
- Create: `tests/integration/connected-apps-secret-boundary.test.ts`
- Modify only if failures require scoped corrections to files from Tasks 1–8.

**Interfaces:**
- Produces final verification evidence for Milestones 1–2.

- [ ] **Step 1: Write secret-boundary regression test**

The test reads all newly created Connected Apps web/domain/Edge source files and fails on suspicious client-visible persistence or response patterns. It must allow server-side internal variable names where necessary but assert that public DTOs/UI code do not contain token fields and that migration has no plaintext token columns.

Minimum assertions:

```ts
expect(webSource).not.toMatch(/localStorage.*(access_token|refresh_token).*microsoft/i);
expect(webSource).not.toMatch(/client_secret|refresh_token/i);
expect(migration).not.toMatch(/access_token\s+text|refresh_token\s+text|client_secret\s+text/i);
expect(auditSource).not.toMatch(/event.*access_token/i);
```

Also test that OAuth callback redirect construction cannot include `code`, `state`, PKCE verifier, access token, or refresh token.

- [ ] **Step 2: Run new regression test**

Run: `npx vitest run tests/integration/connected-apps-secret-boundary.test.ts`

Expected: PASS after Tasks 1–8; if RED, fix only the violating boundary and rerun.

- [ ] **Step 3: Run complete unit and integration suites**

Run:

```bash
npm run test:unit
npm run test:integration
```

Expected: PASS.

- [ ] **Step 4: Run repository-required verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Verify acceptance without faking provider configuration**

If real Microsoft OAuth configuration and protected Vault storage are available in the authorized environment, manually verify:

`Connected Apps → Microsoft → Connect → consent → callback → Verified → grant microsoft.profile.read → execute → Activity → Revoke → subsequent execute blocked`.

If any real dependency is absent, record the exact boundary instead of claiming completion, using one of:

- `provider_not_configured` — missing Microsoft client/redirect configuration;
- `credential_vault_not_configured` — protected server-side credential store unavailable;
- `approval_required` — policy requires a real Approval Center adapter that is not present;
- `provider_unavailable` — Microsoft endpoint cannot be verified;
- `reconnect_required` — stored authorization cannot be refreshed/used.

- [ ] **Step 6: Commit verification test/fixes**

```bash
git add tests/integration/connected-apps-secret-boundary.test.ts packages/integrations supabase/functions apps/web/src supabase/migrations/20260912_connected_apps_integrations.sql
git commit -m "test: verify connected apps security and acceptance gates"
```

- [ ] **Step 7: Independent final review before any PR/merge/deploy**

Reviewer must compare implementation against every section of `docs/superpowers/specs/2026-09-12-atlas-connected-apps-integration-gateway-design.md`, with special attention to: truthful states, tenant/org isolation, RBAC, Integration Grants, secret boundaries, Approval Center fail-closed behavior, Assistant token isolation, mobile behavior, and Microsoft end-to-end evidence.

Do not merge or deploy from this plan without explicit user approval.

---

## Plan Self-Review

### Spec coverage

This plan covers shared provider contracts, truthful connection states, tenancy/org isolation, DB-backed RBAC, Integration Grants, metadata-only audit, protected credential references, OAuth state/PKCE, Connected Apps UI/routes, Microsoft end-to-end lifecycle, Assistant capability boundary, Approval Center fail-closed boundary, responsive UI, secret regression tests, and required repository validation.

Intentionally excluded from this plan because they are independent provider/infrastructure subsystems:

- Google end-to-end adapter and Gmail/Calendar/Drive execution;
- GitHub end-to-end adapter and repository/PR execution;
- Cloudflare infrastructure credential lifecycle;
- Supabase infrastructure credential lifecycle;
- a standalone Approval Center product if one is still absent from the canonical repository.

Those must use the contracts established here and receive their own plans after this milestone passes review; they must not fork the gateway architecture.

### Placeholder scan

The plan contains no `TBD`, `TODO`, fake production states, placeholder buttons, or instructions to invent provider data. Missing external dependencies have explicit fail-closed states.

### Type consistency

`IntegrationConnectionStatus`, `IntegrationCapability`, `IntegrationPermission`, `IntegrationActorContext`, `IntegrationConnection`, `IntegrationGrant`, `CapabilityRequest`, `evaluateCapabilityRequest()`, and Microsoft capability names are defined in Task 1 and reused with the same names throughout later tasks.
