# ATLAS Connect Social Accounts Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-aware ATLAS Connect Accounts Center that securely connects external social/business identities, verifies provider state, exposes auditable account management, and supplies eligible publishing destinations to ATLAS Studio.

**Architecture:** ATLAS Identity remains the authentication and active-organization gate. ATLAS Connect owns provider authorizations, external assets, normalized connection state, capability checks, lifecycle actions, and audit events behind a Supabase Edge Function boundary. React clients receive only sanitized metadata and invoke ATLAS APIs; OAuth codes, provider tokens, client secrets, and refresh material never enter browser-visible state.

**Tech Stack:** React 18.3, TypeScript 5.7, React Router 7.18, Vite 6.4, Vitest 3.2, Supabase Auth/Postgres/RLS/Edge Functions, Deno, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-connect-social-accounts-center-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/atlas-connect-social-accounts-center`.
- Eventual integration target: `main`.
- Do not merge, deploy, publish, or consume paid-provider credits as part of plan execution without separate explicit approval.
- Re-scan the branch before introducing schema, APIs, utilities, or routes; reuse any equivalent work that has landed.
- External identities are organization-scoped assets, never ATLAS users.
- Connection state is exactly one of `unconfigured`, `authorization_required`, `connecting`, `connected`, `degraded`, `expired`, `revoked`, or `error`.
- `connected` is allowed only after server-side/provider verification succeeds.
- Provider credentials, OAuth authorization codes, client secrets, raw access tokens, refresh tokens, passwords, recovery codes, and private keys must never be returned to the browser, written to audit payloads, or committed to Git.
- Every server read/write must be organization-scoped; frontend visibility is not an authorization boundary.
- Reuse the existing `audit_logs` table as the audit source of truth.
- Unsupported personal Facebook, Instagram, or WhatsApp capabilities must not be exposed as supported business API capabilities.
- Meta provider production use requires authorized provider configuration; absent configuration must render `Configuration required`, not a fake connection.
- Required completion checks: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`.

---

## File Structure

Create or modify these focused units:

- `packages/connect/types.ts` — shared connection state, provider, account, capability, actor, and adapter types.
- `packages/connect/permissions.ts` — explicit Connect permission checks.
- `packages/connect/domain.ts` — state normalization, provider capability mapping, publishing eligibility, and safe redirect helpers that do not depend on React.
- `supabase/migrations/20260912_atlas_connect_social_accounts.sql` — provider connections, external assets, OAuth transactions, indexes, constraints, and RLS.
- `supabase/functions/atlas-connect-accounts/index.ts` — thin server operation router.
- `supabase/functions/atlas-connect-accounts/_shared/context.ts` — authenticated user/organization/permission resolution.
- `supabase/functions/atlas-connect-accounts/_shared/errors.ts` — safe normalized errors and CORS helpers.
- `supabase/functions/atlas-connect-accounts/_shared/repository.ts` — organization-scoped persistence and `audit_logs` integration.
- `supabase/functions/atlas-connect-accounts/_shared/provider-registry.ts` — adapter selection and truthful readiness behavior.
- `supabase/functions/atlas-connect-accounts/providers/meta.ts` — Meta OAuth, discovery, verification, revoke, and capability normalization.
- `apps/web/src/lib/connectApi.ts` — authenticated browser API client using the existing ATLAS session model.
- `apps/web/src/modules/connect/ConnectRoutes.tsx` — protected Connect route graph.
- `apps/web/src/modules/connect/AccountsCenterPage.tsx` — accounts overview and lifecycle actions.
- `apps/web/src/modules/connect/AccountDetailPage.tsx` — selected account detail.
- `apps/web/src/modules/connect/AccountPermissionsPage.tsx` — provider capabilities/scopes and ATLAS-use policy view.
- `apps/web/src/modules/connect/AccountActivityPage.tsx` — account-scoped audit activity.
- `apps/web/src/modules/connect/ConnectProvidersPage.tsx` — provider readiness/configuration boundary.
- `apps/web/src/modules/connect/connect.css` — responsive ATLAS-native Connect layout and states.
- `apps/web/src/modules/creator/CreatorPublishPage.tsx` — ATLAS Connect-backed destination selection.
- `apps/web/src/modules/creator/CreatorStudioPage.tsx` — navigation into publishing without owning social-account state.
- `apps/web/src/identity/IdentityPage.tsx` — add `/connect` as a safe internal post-auth target.
- `apps/web/src/components/AtlasShell.tsx` — expose ATLAS Connect in canonical navigation.
- `apps/web/src/App.tsx` — mount Connect and publish routes.
- `tests/unit/atlas-connect-domain.test.ts` — state, permission, capability, redirect, and eligibility tests.
- `tests/unit/atlas-connect-meta-adapter.test.ts` — deterministic Meta adapter tests with fake fetch.
- `tests/integration/atlas-connect-schema-contract.test.ts` — migration/RLS/no-secret-column contract.
- `tests/integration/atlas-connect-edge-contract.test.ts` — Edge Function routing, auth, tenant, OAuth-state, audit, and redaction contract.
- `tests/integration/atlas-connect-routes.test.tsx` — protected routes, states, actions, navigation, and accessibility.
- `tests/integration/atlas-connect-creator-publish.test.tsx` — Creator destination integration and truthful disabled states.
- `.github/workflows/atlas-connect-self-hosted-ci.yml` — branch-focused verification on the existing self-hosted runner pattern.

---

### Task 1: Define the ATLAS Connect domain, permissions, and eligibility rules

**Files:**
- Create: `packages/connect/types.ts`
- Create: `packages/connect/permissions.ts`
- Create: `packages/connect/domain.ts`
- Create: `tests/unit/atlas-connect-domain.test.ts`

**Interfaces:**
- Produces `ConnectProvider`, `ConnectState`, `ConnectCapability`, `ConnectPermission`, `ConnectActorContext`, `ExternalAccount`, `ProviderReadiness`, `ProviderAdapter`.
- Produces `hasConnectPermission(context, permission): boolean`.
- Produces `requireConnectPermission(context, permission): void`.
- Produces `normalizeConnectState(input): ConnectState`.
- Produces `isPublishingEligible(account, capability): boolean`.
- Produces `isSafeAtlasReturnTarget(path): boolean`.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  CONNECT_STATES,
  isPublishingEligible,
  isSafeAtlasReturnTarget,
  normalizeConnectState
} from '../../packages/connect/domain';
import { hasConnectPermission, requireConnectPermission } from '../../packages/connect/permissions';

const admin = {
  userId: 'user-1',
  organizationId: 'org-1',
  role: 'admin',
  permissions: ['connect.accounts.admin']
} as const;

describe('ATLAS Connect domain', () => {
  it('uses the approved state vocabulary', () => {
    expect(CONNECT_STATES).toEqual([
      'unconfigured','authorization_required','connecting','connected',
      'degraded','expired','revoked','error'
    ]);
  });

  it('fails unknown provider state closed', () => {
    expect(normalizeConnectState('ready')).toBe('error');
  });

  it('allows admin to satisfy account-use permission', () => {
    expect(hasConnectPermission(admin, 'connect.accounts.use')).toBe(true);
  });

  it('throws on unauthorized management', () => {
    expect(() => requireConnectPermission({ ...admin, permissions: [] }, 'connect.accounts.manage'))
      .toThrow('authorization_denied');
  });

  it('only selects verified connected destinations with capability', () => {
    expect(isPublishingEligible({ status: 'connected', capabilities: ['publish.image'] }, 'publish.image')).toBe(true);
    expect(isPublishingEligible({ status: 'degraded', capabilities: ['publish.image'] }, 'publish.image')).toBe(false);
  });

  it('allows only approved internal identity targets', () => {
    expect(isSafeAtlasReturnTarget('/connect/accounts')).toBe(true);
    expect(isSafeAtlasReturnTarget('/studio/publish')).toBe(true);
    expect(isSafeAtlasReturnTarget('https://example.org')).toBe(false);
    expect(isSafeAtlasReturnTarget('//example.org')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
npx vitest run tests/unit/atlas-connect-domain.test.ts
```

Expected: FAIL because `packages/connect` does not exist.

- [ ] **Step 3: Implement normalized types and permissions**

Use this permission vocabulary exactly:

```ts
export type ConnectPermission =
  | 'connect.accounts.read'
  | 'connect.accounts.manage'
  | 'connect.accounts.capabilities'
  | 'connect.accounts.use'
  | 'connect.accounts.audit'
  | 'connect.accounts.admin';
```

Use this state constant exactly:

```ts
export const CONNECT_STATES = [
  'unconfigured','authorization_required','connecting','connected',
  'degraded','expired','revoked','error'
] as const;
```

`isPublishingEligible` must require `status === 'connected'` and the requested normalized capability.

- [ ] **Step 4: Run the focused test and typecheck**

```bash
npx vitest run tests/unit/atlas-connect-domain.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connect tests/unit/atlas-connect-domain.test.ts
git commit -m "feat(connect): define account connection domain"
```

---

### Task 2: Add organization-scoped persistence, OAuth transactions, and RLS

**Files:**
- Create: `supabase/migrations/20260912_atlas_connect_social_accounts.sql`
- Create: `tests/integration/atlas-connect-schema-contract.test.ts`

**Interfaces:**
- Produces `connect_provider_connections`.
- Produces `connect_external_accounts`.
- Produces `connect_oauth_transactions`.
- Reuses `organizations`, `organization_members`, and `audit_logs`.

- [ ] **Step 1: Write the failing schema contract test**

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync('supabase/migrations/20260912_atlas_connect_social_accounts.sql', 'utf8');

describe('ATLAS Connect schema', () => {
  it('creates the required organization-scoped tables', () => {
    expect(sql).toContain('public.connect_provider_connections');
    expect(sql).toContain('public.connect_external_accounts');
    expect(sql).toContain('public.connect_oauth_transactions');
    expect(sql.match(/enable row level security/g)?.length).toBe(3);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
  });

  it('does not create plaintext secret columns', () => {
    expect(sql).not.toMatch(/access_token\s+text/i);
    expect(sql).not.toMatch(/refresh_token\s+text/i);
    expect(sql).not.toMatch(/client_secret\s+text/i);
    expect(sql).not.toMatch(/password\s+text/i);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-connect-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the tables and constraints**

Use the approved state check on provider connections and external accounts. Persist only `credential_reference` as an opaque server-side reference, never raw provider tokens. OAuth transactions must include `state_hash`, `user_id`, `org_id`, `provider`, `return_target`, `expires_at`, `consumed_at`, `created_at`; enforce one-time consumption and expiry server-side.

Core SQL shape:

```sql
create table if not exists public.connect_provider_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('meta')),
  provider_connection_id text,
  status text not null default 'authorization_required' check (status in (
    'unconfigured','authorization_required','connecting','connected','degraded','expired','revoked','error'
  )),
  credential_reference text,
  granted_scopes text[] not null default '{}'::text[],
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  created_by uuid not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, provider_connection_id)
);
```

- [ ] **Step 4: Add RLS and grants**

Allow authenticated reads only for active organization members. Keep sensitive mutations behind the Edge Function/service-role path and explicitly revoke direct authenticated insert/update/delete on provider connections, OAuth transactions, and external accounts.

- [ ] **Step 5: Run schema test and integration suite**

```bash
npx vitest run tests/integration/atlas-connect-schema-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260912_atlas_connect_social_accounts.sql tests/integration/atlas-connect-schema-contract.test.ts
git commit -m "feat(connect): add tenant scoped social account persistence"
```

---

### Task 3: Build the authenticated Edge Function boundary and truthful provider readiness

**Files:**
- Create: `supabase/functions/atlas-connect-accounts/index.ts`
- Create: `supabase/functions/atlas-connect-accounts/_shared/context.ts`
- Create: `supabase/functions/atlas-connect-accounts/_shared/errors.ts`
- Create: `supabase/functions/atlas-connect-accounts/_shared/repository.ts`
- Create: `supabase/functions/atlas-connect-accounts/_shared/provider-registry.ts`
- Create: `tests/integration/atlas-connect-edge-contract.test.ts`

**Interfaces:**
- `resolveContext(req)` returns authenticated `userId`, `orgId`, `role`, and `ConnectPermission[]`.
- `providerFor('meta')` returns the Meta adapter from Task 4.
- Server operations: `providers`, `accounts`, `account`, `capabilities`, `activity`, `authorize`, `callback`, `verify`, `disconnect`, `eligible-destinations`.

- [ ] **Step 1: Write failing Edge Function contract assertions**

Assert the source contains the explicit operation list, calls `resolveContext`, writes to `audit_logs`, scopes repository queries by `org_id`, and never returns fields named `access_token`, `refresh_token`, or `client_secret`.

```ts
expect(source).toContain("'eligible-destinations'");
expect(source).toContain('resolveContext');
expect(repository).toContain(".from('audit_logs')");
expect(repository).toContain(".eq('org_id', orgId)");
expect(source).not.toMatch(/access_token\s*:/i);
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-connect-edge-contract.test.ts
```

- [ ] **Step 3: Implement authenticated context**

Mirror the existing Hospitality boundary: validate bearer token through Supabase Auth, resolve the current active `organization_members` row, then derive permissions. Owners/admins/platform_admins receive all Connect permissions; other active members receive `connect.accounts.read` only until a canonical fine-grained permission source exists.

- [ ] **Step 4: Implement repository and audit helpers**

Use service-role only inside the Edge Function. Every query must include `org_id`. Audit writes use:

```ts
await adminClient().from('audit_logs').insert({
  org_id: orgId,
  user_id: userId,
  action,
  table_name: 'connect_external_accounts',
  record_id: recordId,
  new_data: sanitizedPayload
});
```

- [ ] **Step 5: Implement truthful readiness**

If Meta environment/configuration is absent, return:

```json
{
  "provider": "meta",
  "state": "unconfigured",
  "blocker": "meta_oauth_configuration_required",
  "capabilities": []
}
```

Environment presence alone must not yield `connected` or `ready` semantics.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run tests/integration/atlas-connect-edge-contract.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-connect-accounts tests/integration/atlas-connect-edge-contract.test.ts
git commit -m "feat(connect): add governed account connection service"
```

---

### Task 4: Implement the Meta adapter and secure OAuth state lifecycle

**Files:**
- Create: `supabase/functions/atlas-connect-accounts/providers/meta.ts`
- Modify: `supabase/functions/atlas-connect-accounts/index.ts`
- Modify: `supabase/functions/atlas-connect-accounts/_shared/repository.ts`
- Create: `tests/unit/atlas-connect-meta-adapter.test.ts`
- Modify: `tests/integration/atlas-connect-edge-contract.test.ts`

**Interfaces:**
- `metaAdapter.readiness()`.
- `metaAdapter.authorizationUrl(transaction)`.
- `metaAdapter.exchangeCode(code, redirectUri)`.
- `metaAdapter.discoverAccounts(credential)`.
- `metaAdapter.verifyConnection(credential)`.
- `metaAdapter.revoke(credential)`.
- OAuth state is random, stored only as a hash, bound to user/org/provider/return target, expiring, and single-use.

- [ ] **Step 1: Write failing deterministic Meta adapter tests**

Use injected/fake `fetch` and environment getters. Assert unconfigured state, successful authorization URL construction, normalized discovery of Facebook Page / Instagram professional / WhatsApp Business assets, and rejection of unsupported personal assets.

```ts
expect(readinessWithoutConfig.state).toBe('unconfigured');
expect(discovered.every((item) => item.provider === 'meta')).toBe(true);
expect(discovered.some((item) => item.accountType === 'facebook_personal_profile')).toBe(false);
```

- [ ] **Step 2: Add OAuth-state security tests**

Assert callback fails for expired, consumed, missing, cross-user, cross-org, or mismatched state. The callback must consume the transaction before persisting a usable connection so the same state cannot be replayed.

- [ ] **Step 3: Run and verify failure**

```bash
npx vitest run tests/unit/atlas-connect-meta-adapter.test.ts tests/integration/atlas-connect-edge-contract.test.ts
```

- [ ] **Step 4: Implement server-side OAuth flow**

Use environment names exactly:

```text
ATLAS_META_APP_ID
ATLAS_META_APP_SECRET
ATLAS_META_REDIRECT_URI
ATLAS_META_GRAPH_VERSION
```

Never expose `ATLAS_META_APP_SECRET`. Generate state using Web Crypto, persist only SHA-256 hash, set a short expiration, validate and consume on callback, exchange the authorization code server-side, and store only an encrypted/approved credential reference. If the current runtime has no approved encrypted credential store, stop persistence at `authorization_required` with blocker `secure_credential_store_required`; do not substitute plaintext database storage.

- [ ] **Step 5: Implement capability mapping**

Normalize only capabilities proven by returned asset type and granted scopes. Use examples such as `publish.facebook_page`, `publish.instagram_media`, `manage.whatsapp_business`; do not grant personal-profile publishing.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run tests/unit/atlas-connect-meta-adapter.test.ts tests/integration/atlas-connect-edge-contract.test.ts
```

Expected: PASS without real provider credentials by using deterministic fixtures and truthful unconfigured behavior.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-connect-accounts tests/unit/atlas-connect-meta-adapter.test.ts tests/integration/atlas-connect-edge-contract.test.ts
git commit -m "feat(connect): add secure Meta provider adapter"
```

---

### Task 5: Add the protected ATLAS Connect route graph and Accounts Center UI

**Files:**
- Create: `apps/web/src/lib/connectApi.ts`
- Create: `apps/web/src/modules/connect/ConnectRoutes.tsx`
- Create: `apps/web/src/modules/connect/AccountsCenterPage.tsx`
- Create: `apps/web/src/modules/connect/AccountDetailPage.tsx`
- Create: `apps/web/src/modules/connect/AccountPermissionsPage.tsx`
- Create: `apps/web/src/modules/connect/AccountActivityPage.tsx`
- Create: `apps/web/src/modules/connect/ConnectProvidersPage.tsx`
- Create: `apps/web/src/modules/connect/connect.css`
- Modify: `apps/web/src/identity/IdentityPage.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `tests/integration/atlas-connect-routes.test.tsx`
- Modify: `tests/integration/atlas-identity-route.test.tsx`

**Interfaces:**
- Protected routes: `/connect/accounts`, `/connect/accounts/:accountId`, `/connect/accounts/:accountId/permissions`, `/connect/accounts/:accountId/activity`, `/connect/providers`.
- Browser API methods: `listConnectProviders`, `listConnectAccounts`, `getConnectAccount`, `getConnectCapabilities`, `getConnectActivity`, `beginConnectAuthorization`, `verifyConnectAccount`, `disconnectConnectAccount`.

- [ ] **Step 1: Write failing route and identity tests**

```tsx
render(<MemoryRouter initialEntries={['/connect/accounts']}><App /></MemoryRouter>);
expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
expect(screen.getByText('/connect/accounts')).toBeInTheDocument();
```

Add a signed-in flow proving `/identity?app=%2Fconnect%2Faccounts` returns internally to Accounts Center, while external URLs remain rejected.

- [ ] **Step 2: Write failing UI-state tests**

Mock `fetch` to return provider `unconfigured` and no accounts. Assert heading `Accounts Center`, visible text `Configuration required`, zero fabricated accounts, and disabled connect action when the server says configuration is unavailable.

- [ ] **Step 3: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-connect-routes.test.tsx tests/integration/atlas-identity-route.test.tsx
```

- [ ] **Step 4: Implement route graph and navigation**

`ConnectRoutes` must follow the existing protected module pattern with `AtlasShell` and `RequireAtlasIdentity`. Add `{ to: '/connect/accounts', label: 'Connect' }` to the canonical shell navigation. Extend the Identity safe-prefix allowlist with `/connect` only; keep external/open-redirect protections intact.

- [ ] **Step 5: Implement Accounts Center states and actions**

Render real server states for loading, empty, unconfigured, authorization-required, connected, degraded, expired, revoked, and error. Each account row/card includes display name, provider, handle if present, account type, status text, last verification timestamp, capabilities, and functional navigation to detail/permissions/activity. `Disconnect` requires a confirmation UI and calls the Edge Function; `Refresh status` calls verification and updates from the returned state.

- [ ] **Step 6: Implement responsive/accessibility baseline**

Buttons and links require accessible names, status text may not rely only on color, focus states must be visible, and the mobile layout must keep all lifecycle actions reachable without horizontal clipping.

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run tests/integration/atlas-connect-routes.test.tsx tests/integration/atlas-identity-route.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/connectApi.ts apps/web/src/modules/connect apps/web/src/identity/IdentityPage.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/App.tsx tests/integration/atlas-connect-routes.test.tsx tests/integration/atlas-identity-route.test.tsx
git commit -m "feat(connect): add protected social accounts center"
```

---

### Task 6: Complete reconnect, disconnect, verification, permissions, and audit behavior

**Files:**
- Modify: `supabase/functions/atlas-connect-accounts/index.ts`
- Modify: `supabase/functions/atlas-connect-accounts/_shared/repository.ts`
- Modify: `apps/web/src/lib/connectApi.ts`
- Modify: `apps/web/src/modules/connect/AccountsCenterPage.tsx`
- Modify: `apps/web/src/modules/connect/AccountDetailPage.tsx`
- Modify: `apps/web/src/modules/connect/AccountPermissionsPage.tsx`
- Modify: `apps/web/src/modules/connect/AccountActivityPage.tsx`
- Modify: `tests/integration/atlas-connect-edge-contract.test.ts`
- Modify: `tests/integration/atlas-connect-routes.test.tsx`

**Interfaces:**
- `verify` returns provider-verified normalized state and `checked_at`.
- `disconnect` locally invalidates account usability even if remote revocation cannot be confirmed.
- Audit actions use `connect.authorization.*`, `connect.account.*`, and `connect.publish.*` names.

- [ ] **Step 1: Add failing lifecycle/audit tests**

Assert `verify` cannot transition to `connected` without adapter verification. Assert `disconnect` changes local state to `revoked` and writes an audit record. Assert reconnect creates a new one-time OAuth transaction instead of reusing an old state.

- [ ] **Step 2: Add permission-enforcement tests**

Read-only users may list accounts but must receive authorization failure for authorize/reconnect/disconnect. Audit view requires `connect.accounts.audit` or admin.

- [ ] **Step 3: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-connect-edge-contract.test.ts tests/integration/atlas-connect-routes.test.tsx
```

- [ ] **Step 4: Implement lifecycle operations**

Every lifecycle operation must call `requireConnectPermission` server-side. Persist sanitized `last_error_code`, `last_verified_at`, and state. Audit payloads may contain provider/account IDs, scopes, status, and correlation/request IDs, but no token or authorization-code material.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/integration/atlas-connect-edge-contract.test.ts tests/integration/atlas-connect-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-connect-accounts apps/web/src/lib/connectApi.ts apps/web/src/modules/connect tests/integration/atlas-connect-edge-contract.test.ts tests/integration/atlas-connect-routes.test.tsx
git commit -m "feat(connect): complete account lifecycle and audit"
```

---

### Task 7: Integrate ATLAS Studio publishing destinations without duplicating social-account state

**Files:**
- Create: `apps/web/src/modules/creator/CreatorPublishPage.tsx`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/modules/creator/creator.css`
- Modify: `apps/web/src/App.tsx`
- Create: `tests/integration/atlas-connect-creator-publish.test.tsx`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Route: `/studio/publish`.
- Data source: `connectApi` `eligible-destinations` operation only.
- No Creator-owned OAuth, connection table, token cache, or provider account store.

- [ ] **Step 1: Write failing publishing-destination tests**

```tsx
expect(screen.getByRole('heading', { name: 'Publish with ATLAS' })).toBeInTheDocument();
expect(screen.getByText(/No eligible destinations/i)).toBeInTheDocument();
expect(screen.getByRole('link', { name: /Manage connected accounts/i }))
  .toHaveAttribute('href', '/connect/accounts');
```

With a fixture containing one `connected` Instagram professional account with `publish.instagram_media`, assert it is selectable. With `expired`, `revoked`, or `degraded` fixtures, assert the destination is not selectable.

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-connect-creator-publish.test.tsx tests/integration/atlas-creator-route.test.tsx
```

- [ ] **Step 3: Implement the publishing destination page**

Fetch eligible destinations from ATLAS Connect. The page may prepare destination selection and content intent, but must not claim a publish succeeded unless a provider publishing operation exists and returns a confirmed result. If actual provider publishing is outside current configured capability, show a truthful disabled action such as `Publishing provider action not configured` while still allowing destination inspection.

- [ ] **Step 4: Add Studio navigation**

Add a functional `Publish` destination from Creator Home or Library to `/studio/publish` without changing existing generation-provider truthfulness.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npx vitest run tests/integration/atlas-connect-creator-publish.test.tsx tests/integration/atlas-creator-route.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/creator apps/web/src/App.tsx tests/integration/atlas-connect-creator-publish.test.tsx tests/integration/atlas-creator-route.test.tsx
git commit -m "feat(creator): consume ATLAS Connect publishing destinations"
```

---

### Task 8: Harden privacy, redaction, tenant isolation, and error behavior

**Files:**
- Modify: `supabase/functions/atlas-connect-accounts/_shared/errors.ts`
- Modify: `supabase/functions/atlas-connect-accounts/_shared/repository.ts`
- Modify: `supabase/functions/atlas-connect-accounts/providers/meta.ts`
- Create: `tests/integration/atlas-connect-security-contract.test.ts`

**Interfaces:**
- Error responses expose `error`, safe `message`, optional `correlation_id`, safe `state`, and safe blocker metadata only.
- Cross-organization resource IDs return not-found/authorization failure without leaking existence.

- [ ] **Step 1: Write failing secret-redaction tests**

Scan all Connect source files and assert response/log/audit construction never includes raw `access_token`, `refresh_token`, `client_secret`, `authorization_code`, `password`, or `recovery_code` keys. Add runtime-style fixtures proving a provider error body containing a token is reduced to a safe normalized error.

- [ ] **Step 2: Write cross-tenant tests**

Assert repository methods always accept and filter `orgId`. Assert an account ID from another organization cannot be loaded, verified, disconnected, or returned as an eligible publishing destination.

- [ ] **Step 3: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-connect-security-contract.test.ts
```

- [ ] **Step 4: Implement redaction and fail-closed behavior**

Use a fixed allowlist for error metadata; never serialize unknown provider response objects directly. Bound provider retries and return `degraded`/`error` rather than retrying indefinitely or guessing state.

- [ ] **Step 5: Run security and full integration tests**

```bash
npx vitest run tests/integration/atlas-connect-security-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-connect-accounts tests/integration/atlas-connect-security-contract.test.ts
git commit -m "security(connect): harden tenant and secret boundaries"
```

---

### Task 9: Add branch CI and run complete verification

**Files:**
- Create: `.github/workflows/atlas-connect-self-hosted-ci.yml`
- Modify only if verification discovers a Connect-specific defect: files owned by Tasks 1–8.

**Interfaces:**
- CI runs on `feat/atlas-connect-social-accounts-center` and `workflow_dispatch`.
- No deployment step.

- [ ] **Step 1: Add self-hosted CI workflow**

Use:

```yaml
name: ATLAS Connect Self-Hosted CI

on:
  push:
    branches:
      - feat/atlas-connect-social-accounts-center
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    runs-on: self-hosted
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Connect unit tests
        run: npx vitest run tests/unit/atlas-connect-domain.test.ts tests/unit/atlas-connect-meta-adapter.test.ts
      - name: Connect integration tests
        run: npx vitest run tests/integration/atlas-connect-schema-contract.test.ts tests/integration/atlas-connect-edge-contract.test.ts tests/integration/atlas-connect-routes.test.tsx tests/integration/atlas-connect-creator-publish.test.tsx tests/integration/atlas-connect-security-contract.test.ts
      - name: Unit suite
        run: npm run test:unit
      - name: Integration suite
        run: npm run test:integration
      - name: Production build
        run: npm run build
```

- [ ] **Step 2: Install from the lockfile**

```bash
npm ci
```

Expected: successful reproducible install with no Connect-specific dependency addition required.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run all tests**

```bash
npm run test:unit
npm run test:integration
```

Expected: PASS.

- [ ] **Step 5: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Verify route and security acceptance criteria manually in local dev**

Run `npm run dev` and verify `/connect/accounts`, account detail, permissions, activity, providers, and `/studio/publish` navigate without 404/500. Confirm unauthenticated Connect routes redirect to Identity. Confirm mobile-width layout keeps actions reachable. Confirm no UI labels a provider `connected` unless the server fixture/state is verified connected.

- [ ] **Step 7: Verify provider dependency boundary**

If authorized Meta configuration and an approved secure credential store are unavailable, record final verification as `provider E2E blocked by external configuration`; keep provider state `unconfigured` or `authorization_required`. Do not insert dummy credentials and do not claim a live Meta connection.

- [ ] **Step 8: Commit CI/verification-only changes**

```bash
git add .github/workflows/atlas-connect-self-hosted-ci.yml
git commit -m "ci(connect): verify social accounts center"
```

---

## Plan Self-Review Results

- Spec coverage: routes, state model, provider adapter boundary, OAuth state, persistence, RLS, RBAC, audit, lifecycle operations, Creator integration, accessibility, truthful provider states, security, and full verification are each mapped to Tasks 1–9.
- Placeholder scan: the plan contains no deferred implementation markers; external Meta credentials and secure credential storage are explicit runtime dependency boundaries rather than simulated functionality.
- Type consistency: `ConnectState`, `ConnectPermission`, `ConnectCapability`, `ExternalAccount`, `ProviderAdapter`, and `eligible-destinations` are defined once and consumed consistently by later tasks.
- Scope: this remains one cohesive ATLAS Connect subsystem with one secondary Creator consumer; no additional social providers are included in this implementation.

## Completion Boundary

Execution is complete only when Tasks 1–9 pass their focused tests and the full repository typecheck, unit suite, integration suite, and production build pass. Real Meta end-to-end authorization may remain externally blocked when credentials/provider approval or an approved secure credential store are absent; that limitation must be reported precisely and must not be represented as a successful connection.

Do not merge to `main` and do not deploy to production during execution unless the repository owner separately approves those actions.