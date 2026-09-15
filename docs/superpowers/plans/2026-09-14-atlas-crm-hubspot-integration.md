# ATLAS CRM + HubSpot Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-safe, tenant-isolated ATLAS CRM module that connects to HubSpot through server-side OAuth and exposes read-only Contacts, Accounts, Opportunities, Service Cases, Activities, search, associations, pagination, connection status, and disconnect/revoke behavior without exposing provider credentials or fabricating CRM data.

**Architecture:** Extend the existing ATLAS integration gateway instead of introducing a parallel CRM stack. HubSpot remains the P0 CRM system of record; ATLAS owns identity, tenant/org scope, RBAC, provider-neutral view models, credential custody, orchestration, audit, sync/read evidence, and UI. The browser talks only to the ATLAS Supabase boundary; HubSpot credentials and provider calls remain server-side.

**Tech Stack:** React 18, React Router, TypeScript 5.7, Vite 6, Vitest 3, Supabase/Postgres/RLS, Supabase Edge Functions (Deno), Web Crypto AES-GCM, HubSpot OAuth + CRM APIs.

**Spec:** `docs/superpowers/specs/2026-09-14-atlas-crm-hubspot-integration-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/atlas-crm-hubspot-integration`.
- Do not merge to `main` or deploy as part of task execution unless separately approved.
- P0 HubSpot business-data access is read-only: no create, edit, delete, merge, pipeline mutation, property mutation, or custom-object mutation.
- Preserve Google Workspace integration behavior.
- Do not rewrite historical Supabase migrations; add a new migration.
- No access token, refresh token, HubSpot client secret, encryption key, or plaintext provider credential may reach browser state, client logs, audit rows, sync-run rows, or committed files.
- `connected` is evidence-based: OAuth completion alone is insufficient; token/provider verification and a live HubSpot probe must succeed.
- Every persisted integration record is organization-scoped and protected by RLS or service-only access as defined by the spec.
- CRM searches must query the provider; do not fake full-dataset search by filtering a single client page.
- Unsupported scopes/objects render truthful degraded/forbidden states rather than fabricated values.
- Completion gates from repository root: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.

---

## File Structure

**Core domain**
- Modify `packages/core/src/integrations.ts` — canonical provider identifiers and connection truth rules.
- Modify `packages/core/src/permissions.ts` — canonical integration + CRM permission vocabulary and compatibility alias logic.
- Create `packages/core/src/crm.ts` — provider-neutral CRM object, page, association, error, and connection view types.
- Modify `packages/core/src/index.ts` — export CRM/core integration contracts and remove duplicated provider typing where necessary without breaking existing imports.

**Database/security**
- Create `supabase/migrations/20260914170000_atlas_crm_hubspot_integration.sql` — permissions, provider constraint extension, connection metadata, encrypted credential rows, object links, sync runs, indexes, RLS, grants.

**Server-only shared integration code**
- Create `supabase/functions/_shared/integration-credential-vault.ts` — AES-GCM seal/open/destroy helpers and payload validation.
- Create `supabase/functions/_shared/hubspot-oauth.ts` — authorization URL, code exchange, refresh, introspection, revoke, safe error mapping.
- Create `supabase/functions/_shared/hubspot-crm.ts` — normalized HubSpot read adapter, search translation, associations, cursor mapping, rate/error normalization.
- Create `supabase/functions/atlas-crm-hubspot/index.ts` — operation router for OAuth lifecycle, connection state, read operations, refresh metadata, disconnect, authorization, audit, and tenant isolation.

**Web CRM**
- Create `apps/web/src/modules/business/crm/crmApi.ts` — authenticated ATLAS backend client only.
- Create `apps/web/src/modules/business/crm/CrmRoutes.tsx` — CRM nested routes.
- Create `apps/web/src/modules/business/crm/CrmHomePage.tsx` — truthful module landing and provider state.
- Create `apps/web/src/modules/business/crm/CrmObjectListPage.tsx` — provider-backed list/search/pagination.
- Create `apps/web/src/modules/business/crm/CrmRecordPage.tsx` — normalized record and associations.
- Create `apps/web/src/modules/business/crm/HubSpotIntegrationPage.tsx` — connect/status/retry/disconnect UI.
- Create `apps/web/src/modules/business/crm/crm.css` — responsive CRM presentation and state styling.
- Modify `apps/web/src/App.tsx` — mount `/crm/*` under authenticated ATLAS shell.
- Modify `apps/web/src/components/AtlasShell.tsx` — add CRM navigation entry.

**Tests**
- Modify `tests/unit/integration-gateway.test.ts`.
- Create `tests/unit/crm-core.test.ts`.
- Create `tests/unit/hubspot-oauth.test.ts`.
- Create `tests/unit/integration-credential-vault.test.ts`.
- Create `tests/unit/hubspot-crm-adapter.test.ts`.
- Create `tests/integration/atlas-crm-hubspot-schema.test.ts`.
- Create `tests/integration/atlas-crm-hubspot-function.test.ts`.
- Create `tests/unit/crm-routes.test.tsx`.

---

### Task 1: Reconcile provider and permission contracts

**Files:**
- Modify: `packages/core/src/integrations.ts`
- Modify: `packages/core/src/permissions.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `tests/unit/integration-gateway.test.ts`
- Create: `tests/unit/crm-core.test.ts`

**Interfaces:**
- Produces `IntegrationProvider = 'google' | 'hubspot'`.
- Produces canonical permissions `integrations.read`, `integrations.write`, `integrations.admin`, `crm.read`, `crm.sync`, `crm.admin`.
- Produces `hasAtlasPermission(granted, required)` with admin-namespace escalation and a server compatibility helper that recognizes legacy `integrations.manage` only as an alias for `integrations.admin`.
- Preserves `canReportConnected({authorized, providerVerified})`.

- [ ] **Step 1: Write failing tests for provider extension and permission separation**

```ts
expect(createIntegrationConnection({
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  provider: 'hubspot'
})).toEqual({
  scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  provider: 'hubspot',
  status: 'disconnected'
});

expect(hasPermission(['crm.admin'], 'crm.read')).toBe(true);
expect(hasPermission(['integrations.admin'], 'crm.read')).toBe(false);
expect(hasLegacyIntegrationAdmin(['integrations.manage'])).toBe(true);
expect(hasLegacyIntegrationAdmin(['crm.admin'])).toBe(false);
```

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
npm test -- tests/unit/integration-gateway.test.ts tests/unit/crm-core.test.ts
```

Expected: FAIL because `hubspot`, CRM permissions, or the compatibility helper are not yet defined.

- [ ] **Step 3: Implement the minimal core contract**

```ts
export type IntegrationProvider = 'google' | 'hubspot';

export type CrmPermission = 'crm.read' | 'crm.sync' | 'crm.admin';

export function hasLegacyIntegrationAdmin(granted: readonly string[]) {
  return granted.includes('integrations.admin') || granted.includes('integrations.manage');
}
```

Keep Google permission-to-OAuth-scope mapping provider-specific; `integrations.admin` must not grant Google Gmail/Calendar/Drive scopes and must not grant `crm.read`.

- [ ] **Step 4: Run focused tests**

```bash
npm test -- tests/unit/integration-gateway.test.ts tests/unit/crm-core.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/integrations.ts packages/core/src/permissions.ts packages/core/src/index.ts tests/unit/integration-gateway.test.ts tests/unit/crm-core.test.ts
git commit -m "feat(crm): add HubSpot provider and CRM permissions"
```

---

### Task 2: Add provider-neutral CRM domain models

**Files:**
- Create: `packages/core/src/crm.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `tests/unit/crm-core.test.ts`

**Interfaces:**
- Produces `CrmObjectType`, `CrmRecord`, `CrmPage`, `CrmAssociation`, `CrmAssociationPage`, `CrmProviderErrorCode`, `CrmConnectionView`.
- No HubSpot property names appear in UI-facing model names.

- [ ] **Step 1: Add failing normalization-contract tests**

```ts
const page: CrmPage = {
  records: [{ provider: 'hubspot', objectType: 'contact', providerId: '101', displayName: 'Ada Lovelace', fields: {}, updatedAt: null }],
  nextCursor: 'opaque-next'
};
expect(page.records[0].objectType).toBe('contact');
expect(page.nextCursor).toBe('opaque-next');
```

Also assert the allowed error codes include `expired_credential`, `forbidden_scope`, `rate_limited`, `upstream_unavailable`, `malformed_provider_response`, and `unknown_upstream_error`.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/crm-core.test.ts
```

- [ ] **Step 3: Implement exact provider-neutral types**

```ts
export type CrmObjectType = 'contact' | 'company' | 'deal' | 'ticket' | 'task' | 'call' | 'meeting' | 'note' | 'email';

export type CrmRecord = {
  provider: 'hubspot';
  objectType: CrmObjectType;
  providerId: string;
  displayName: string;
  fields: Record<string, string | number | boolean | null>;
  updatedAt: string | null;
};

export type CrmPage = { records: CrmRecord[]; nextCursor: string | null };
```

Define association and error types in the same file and export them from `packages/core/src/index.ts`.

- [ ] **Step 4: Run test**

```bash
npm test -- tests/unit/crm-core.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/crm.ts packages/core/src/index.ts tests/unit/crm-core.test.ts
git commit -m "feat(crm): add provider-neutral CRM contracts"
```

---

### Task 3: Add HubSpot persistence, RLS, and permission migration

**Files:**
- Create: `supabase/migrations/20260914170000_atlas_crm_hubspot_integration.sql`
- Create: `tests/integration/atlas-crm-hubspot-schema.test.ts`

**Interfaces:**
- Produces tables `atlas_integration_connections`, `atlas_integration_credentials`, `atlas_external_object_links`, `atlas_integration_sync_runs`.
- Extends `atlas_oauth_states.provider` to allow `google` and `hubspot`.
- Keeps credential table inaccessible to `anon` and `authenticated`.

- [ ] **Step 1: Write schema-contract tests that inspect migration text**

```ts
expect(sql).toContain("'crm.read'");
expect(sql).toContain('atlas_integration_connections');
expect(sql).toContain('atlas_integration_credentials');
expect(sql).toContain('atlas_external_object_links');
expect(sql).toContain('atlas_integration_sync_runs');
expect(sql).toMatch(/provider.*hubspot/s);
expect(sql).toMatch(/revoke all on public\.atlas_integration_credentials from anon, authenticated/i);
```

Also assert a unique `(org_id, provider)` connection constraint and the object-link compound uniqueness from the spec.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/integration/atlas-crm-hubspot-schema.test.ts
```

- [ ] **Step 3: Implement migration**

The migration must insert/update permission descriptions, grant canonical integration/CRM permissions to owner/admin through existing identity tables, replace only the current provider check constraint on `atlas_oauth_states`, create the four P0 tables, indexes, comments, updated timestamps where repository convention supports them, enable RLS, and create organization-scoped select policies for safe metadata tables. Credential rows remain service-only with no browser policy.

Use constraints equivalent to:

```sql
unique (org_id, provider)
```

and:

```sql
unique (org_id, provider, provider_account_id, provider_object_type, provider_object_id)
```

- [ ] **Step 4: Run schema test**

```bash
npm test -- tests/integration/atlas-crm-hubspot-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260914170000_atlas_crm_hubspot_integration.sql tests/integration/atlas-crm-hubspot-schema.test.ts
git commit -m "feat(crm): add HubSpot integration schema and RLS"
```

---

### Task 4: Implement the server-only credential vault

**Files:**
- Create: `supabase/functions/_shared/integration-credential-vault.ts`
- Create: `tests/unit/integration-credential-vault.test.ts`

**Interfaces:**
- Produces `sealCredential`, `openCredential`, `destroyCredentialPayload` helpers.
- AES-GCM with a 256-bit key loaded only from server environment material.
- Associated data binds ciphertext to organization + provider.

- [ ] **Step 1: Write failing crypto tests**

```ts
const sealed = await sealCredential({ organizationId: 'org-a', provider: 'hubspot', credential, key });
expect(JSON.stringify(sealed)).not.toContain(credential.accessToken);
expect(await openCredential({ organizationId: 'org-a', provider: 'hubspot', sealed, key })).toEqual(credential);
await expect(openCredential({ organizationId: 'org-b', provider: 'hubspot', sealed, key })).rejects.toThrow();
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/integration-credential-vault.test.ts
```

- [ ] **Step 3: Implement AES-GCM helpers**

Use `crypto.subtle.encrypt/decrypt`, random 12-byte IV, JSON UTF-8 payload, and authenticated additional data equal to `atlas:<organizationId>:<provider>`. Reject malformed keys, unsupported algorithm labels, or organization/provider mismatch.

- [ ] **Step 4: Run test**

```bash
npm test -- tests/unit/integration-credential-vault.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/integration-credential-vault.ts tests/unit/integration-credential-vault.test.ts
git commit -m "feat(integrations): add encrypted provider credential vault"
```

---

### Task 5: Implement HubSpot OAuth client and safe error mapping

**Files:**
- Create: `supabase/functions/_shared/hubspot-oauth.ts`
- Create: `tests/unit/hubspot-oauth.test.ts`

**Interfaces:**
- Produces `buildHubSpotAuthorizationUrl`, `exchangeHubSpotCode`, `refreshHubSpotToken`, `introspectHubSpotToken`, `revokeHubSpotToken`.
- All HTTP calls receive an injected `fetch` for deterministic tests.

- [ ] **Step 1: Write failing OAuth tests**

```ts
const url = new URL(buildHubSpotAuthorizationUrl({ clientId: 'client', redirectUri: 'https://www.atlasenterprisesuite.com/api/integrations/hubspot/callback', state: 'state-1', scopes: ['crm.objects.contacts.read'] }));
expect(url.searchParams.get('client_id')).toBe('client');
expect(url.searchParams.get('state')).toBe('state-1');
expect(url.searchParams.get('scope')).toContain('crm.objects.contacts.read');
```

Add mocked tests for successful code exchange, refresh, introspection, revoke, `401/403`, and `429` with retry metadata. Assert returned error objects never include raw response bodies when those bodies contain token strings.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/hubspot-oauth.test.ts
```

- [ ] **Step 3: Implement the OAuth helper**

Centralize endpoint constants and request encoding. Validate non-empty `clientId`, `redirectUri`, `state`, code/refresh token inputs. Normalize errors to safe typed codes rather than throwing provider payloads verbatim.

- [ ] **Step 4: Run test**

```bash
npm test -- tests/unit/hubspot-oauth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/hubspot-oauth.ts tests/unit/hubspot-oauth.test.ts
git commit -m "feat(crm): add HubSpot OAuth client"
```

---

### Task 6: Implement HubSpot read adapter and normalization

**Files:**
- Create: `supabase/functions/_shared/hubspot-crm.ts`
- Create: `tests/unit/hubspot-crm-adapter.test.ts`

**Interfaces:**
- Produces `HubSpotCrmAdapter` with `readiness`, `getAccountIdentity`, `listObjects`, `searchObjects`, `getObject`, `listAssociations`.
- Produces normalized `CrmPage`, `CrmRecord`, and association results.

- [ ] **Step 1: Write failing adapter tests using fixture responses**

```ts
expect(contact).toMatchObject({
  provider: 'hubspot',
  objectType: 'contact',
  providerId: '101',
  displayName: 'Ada Lovelace'
});
expect(page.nextCursor).toBe('after-102');
```

Cover Contacts, Companies, Deals, Tickets, one activity type, missing optional properties, associations, search query translation, `429`, forbidden scope, and malformed provider response.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/hubspot-crm-adapter.test.ts
```

- [ ] **Step 3: Implement mapping tables and request functions**

Use explicit per-object requested properties. Map HubSpot Contact -> `contact`, Company -> `company`, Deal -> `deal`, Ticket -> `ticket`, engagements -> the corresponding activity type. Never synthesize absent fields. Preserve provider IDs and update timestamps. Keep pagination cursor opaque.

- [ ] **Step 4: Run test**

```bash
npm test -- tests/unit/hubspot-crm-adapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/hubspot-crm.ts tests/unit/hubspot-crm-adapter.test.ts
git commit -m "feat(crm): add HubSpot read adapter"
```

---

### Task 7: Build the ATLAS CRM HubSpot Edge Function security boundary

**Files:**
- Create: `supabase/functions/atlas-crm-hubspot/index.ts`
- Create: `tests/integration/atlas-crm-hubspot-function.test.ts`

**Interfaces:**
- Accepts operation names from the spec: `oauth.prepare`, `oauth.callback`, `connection.status`, `connection.disconnect`, `crm.list`, `crm.search`, `crm.get`, `crm.associations`, `crm.refresh`.
- Produces JSON only; no provider credential fields.

- [ ] **Step 1: Write failing request-router/auth tests**

Test `OPTIONS`, wrong method, disallowed origin, missing bearer token for authenticated operations, invalid organization UUID, permission denial, and unknown operation.

```ts
expect((await invoke({ operation: 'crm.list', token: null })).status).toBe(401);
expect((await invoke({ operation: 'unknown', token: validToken })).status).toBe(400);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/integration/atlas-crm-hubspot-function.test.ts
```

- [ ] **Step 3: Implement shared request gates**

Reuse the existing Google Edge Function CORS/session patterns: allowed ATLAS production origins, bearer extraction, `supabase.auth.getUser`, organization UUID validation, `has_identity_permission`, and server-side service-role access only after user/org authorization. Map `integrations.manage` only as the deprecated compatibility alias when checking integration-admin access.

- [ ] **Step 4: Run auth/router tests**

```bash
npm test -- tests/integration/atlas-crm-hubspot-function.test.ts
```

Expected: PASS for request gating cases.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-crm-hubspot/index.ts tests/integration/atlas-crm-hubspot-function.test.ts
git commit -m "feat(crm): add secured HubSpot Edge Function boundary"
```

---

### Task 8: Implement OAuth state, connection verification, refresh, and disconnect

**Files:**
- Modify: `supabase/functions/atlas-crm-hubspot/index.ts`
- Modify: `tests/integration/atlas-crm-hubspot-function.test.ts`

**Interfaces:**
- `oauth.prepare` creates one-time state bound to user/org and returns authorization URL.
- `oauth.callback` validates state, exchanges code, introspects/probes provider, seals credentials, and records `connected` only after verification.
- `connection.disconnect` revokes provider token where possible, destroys credential material, then records local `revoked`.

- [ ] **Step 1: Add failing lifecycle tests**

Cover expired state, consumed state, cross-org state, token exchange failure, introspection failure, provider probe failure, successful connected state, refresh failure -> `expired/error`, and disconnect cleanup. Assert callback success response contains account label/id but no tokens.

- [ ] **Step 2: Run focused tests**

```bash
npm test -- tests/integration/atlas-crm-hubspot-function.test.ts
```

Expected: FAIL on unimplemented lifecycle cases.

- [ ] **Step 3: Implement lifecycle transaction ordering**

Required success order:

```text
validate state -> exchange code -> introspect -> live CRM probe -> seal credential -> persist credential row -> upsert connection metadata -> consume state -> audit success
```

On any failure, do not report `connected`. On disconnect, remote revoke is best-effort but local credential destruction is mandatory.

- [ ] **Step 4: Run lifecycle tests**

```bash
npm test -- tests/integration/atlas-crm-hubspot-function.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-crm-hubspot/index.ts tests/integration/atlas-crm-hubspot-function.test.ts
git commit -m "feat(crm): implement HubSpot connection lifecycle"
```

---

### Task 9: Implement read/search/get/association operations and evidence metadata

**Files:**
- Modify: `supabase/functions/atlas-crm-hubspot/index.ts`
- Modify: `tests/integration/atlas-crm-hubspot-function.test.ts`

**Interfaces:**
- CRM read operations require `crm.read` or `crm.admin`.
- Manual refresh metadata operation requires `crm.sync` or `crm.admin`.
- Every operation loads credentials only for the same organization and records safe sync/audit metadata.

- [ ] **Step 1: Add failing operation tests**

Assert tenant A cannot use tenant B connection/credential reference, pagination cursor round-trips, search calls adapter search rather than list+client-filter, object links upsert by compound provider key, sync runs contain counts/cursors but no CRM payload, and provider throttling maps to a safe `429` response with retry metadata.

- [ ] **Step 2: Run focused tests**

```bash
npm test -- tests/integration/atlas-crm-hubspot-function.test.ts
```

- [ ] **Step 3: Implement operation handlers**

For each handler: authorize -> load same-org connection -> open credential -> refresh if needed -> provider call -> normalize -> upsert linkage metadata only -> record sync/audit evidence -> return normalized data. Never persist complete contact/company/deal/ticket/activity payloads.

- [ ] **Step 4: Run test**

```bash
npm test -- tests/integration/atlas-crm-hubspot-function.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-crm-hubspot/index.ts tests/integration/atlas-crm-hubspot-function.test.ts
git commit -m "feat(crm): expose tenant-safe HubSpot read operations"
```

---

### Task 10: Add authenticated CRM web client and routing

**Files:**
- Create: `apps/web/src/modules/business/crm/crmApi.ts`
- Create: `apps/web/src/modules/business/crm/CrmRoutes.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Create: `tests/unit/crm-routes.test.tsx`

**Interfaces:**
- `crmApi` sends ATLAS bearer session + organization ID to ATLAS Edge Function only.
- `/crm/*` is protected by existing `RequireAtlasIdentity` context.

- [ ] **Step 1: Write failing route/navigation tests**

```ts
expect(screen.getByRole('link', { name: /CRM/i })).toHaveAttribute('href', '/crm');
```

Assert `/crm`, `/crm/contacts`, `/crm/companies`, `/crm/deals`, `/crm/service`, `/crm/activities`, `/crm/integrations`, and `/crm/integrations/hubspot` resolve to CRM routes while unauthenticated context remains governed by existing identity behavior.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/crm-routes.test.tsx
```

- [ ] **Step 3: Mount CRM route tree and shell navigation**

`App.tsx` should import `CrmRoutes` and mount:

```tsx
<Route path="/crm/*" element={<RequireAtlasIdentity><CrmRoutes /></RequireAtlasIdentity>} />
```

Add `{ to: '/crm', label: 'CRM' }` to `AtlasShell` navigation.

- [ ] **Step 4: Run route tests**

```bash
npm test -- tests/unit/crm-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/business/crm/crmApi.ts apps/web/src/modules/business/crm/CrmRoutes.tsx apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx tests/unit/crm-routes.test.tsx
git commit -m "feat(crm): mount authenticated CRM routes"
```

---

### Task 11: Build CRM home, provider-backed lists, details, and truthful states

**Files:**
- Create: `apps/web/src/modules/business/crm/CrmHomePage.tsx`
- Create: `apps/web/src/modules/business/crm/CrmObjectListPage.tsx`
- Create: `apps/web/src/modules/business/crm/CrmRecordPage.tsx`
- Create: `apps/web/src/modules/business/crm/crm.css`
- Modify: `apps/web/src/modules/business/crm/CrmRoutes.tsx`
- Modify: `tests/unit/crm-routes.test.tsx`

**Interfaces:**
- Lists call provider-backed `crm.list`/`crm.search` and use returned opaque cursor.
- Detail pages call `crm.get` and `crm.associations`.
- States: loading, empty, connected, degraded, expired, revoked, error.

- [ ] **Step 1: Add failing UI tests**

Test loading text, empty state, returned rows, search dispatch, next-page cursor dispatch, degraded banner, provider source indicator, detail associations, and omission of fields not returned by provider.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/crm-routes.test.tsx
```

- [ ] **Step 3: Implement UI**

Use accessible forms and tables/cards. Search submits to backend rather than filtering `records` locally. Next-page button is disabled when `nextCursor === null`. No production demo metrics or invented pipeline totals are rendered.

- [ ] **Step 4: Run UI tests**

```bash
npm test -- tests/unit/crm-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/business/crm/CrmHomePage.tsx apps/web/src/modules/business/crm/CrmObjectListPage.tsx apps/web/src/modules/business/crm/CrmRecordPage.tsx apps/web/src/modules/business/crm/crm.css apps/web/src/modules/business/crm/CrmRoutes.tsx tests/unit/crm-routes.test.tsx
git commit -m "feat(crm): add provider-backed CRM workspace"
```

---

### Task 12: Build HubSpot connection settings and disconnect confirmation

**Files:**
- Create: `apps/web/src/modules/business/crm/HubSpotIntegrationPage.tsx`
- Modify: `apps/web/src/modules/business/crm/CrmRoutes.tsx`
- Modify: `apps/web/src/modules/business/crm/crm.css`
- Modify: `tests/unit/crm-routes.test.tsx`

**Interfaces:**
- `Connect HubSpot` calls `oauth.prepare` and navigates to returned provider authorization URL.
- Status calls `connection.status`.
- Retry verification calls backend verification/status logic; it does not set local fake connected state.
- Disconnect requires explicit user confirmation and calls `connection.disconnect`.

- [ ] **Step 1: Write failing integration-page tests**

Assert every connection state label, token material is never rendered, Connect is disabled while authorizing, disconnect dialog has Cancel/Disconnect actions, failed disconnect keeps truthful prior/error state, and successful disconnect renders `Revoked`.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/unit/crm-routes.test.tsx
```

- [ ] **Step 3: Implement connection page**

Render only provider account ID/label, granted-scope summary, verification timestamp, safe error code, and connection state. Never store provider access/refresh tokens in React state, localStorage, sessionStorage, query parameters created by ATLAS, or logs.

- [ ] **Step 4: Run UI tests**

```bash
npm test -- tests/unit/crm-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/business/crm/HubSpotIntegrationPage.tsx apps/web/src/modules/business/crm/CrmRoutes.tsx apps/web/src/modules/business/crm/crm.css tests/unit/crm-routes.test.tsx
git commit -m "feat(crm): add HubSpot connection controls"
```

---

### Task 13: Security regression, accessibility, and repository-wide verification

**Files:**
- Modify tests only where a discovered regression requires a concrete fix in the owning production file.
- Update: `docs/superpowers/specs/2026-09-14-atlas-crm-hubspot-integration-design.md` only if implementation reveals a real spec correction; otherwise leave it unchanged.

**Interfaces:**
- Produces verification evidence; no new product API.

- [ ] **Step 1: Run focused suites**

```bash
npm test -- tests/unit/integration-gateway.test.ts tests/unit/crm-core.test.ts tests/unit/integration-credential-vault.test.ts tests/unit/hubspot-oauth.test.ts tests/unit/hubspot-crm-adapter.test.ts tests/integration/atlas-crm-hubspot-schema.test.ts tests/integration/atlas-crm-hubspot-function.test.ts tests/unit/crm-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Scan repository changes for secret leakage and prohibited write semantics**

```bash
git diff --check
git diff --name-only main...HEAD
git grep -nE "access[_-]?token|refresh[_-]?token|client[_-]?secret" -- ':!package-lock.json'
git grep -nE "crm\.objects\..*\.write|/batch/create|/batch/update|DELETE .*crm" -- supabase/functions/atlas-crm-hubspot supabase/functions/_shared/hubspot-*.ts || true
```

Review every match. Test fixtures may use clearly fake token strings; production files must not contain committed real secrets or P0 CRM-write calls.

- [ ] **Step 3: Run canonical repository gates**

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Perform accessibility and route smoke verification in the built app**

Verify keyboard reachability and visible focus for CRM navigation, search, pagination, record links, Connect, Retry, and Disconnect dialog. Verify direct navigation to every P0 CRM route returns the SPA rather than 404 in the configured hosting environment. Verify loading, empty, error, degraded, expired, revoked, and success states are distinguishable by text, not color alone.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add -A
git commit -m "test(crm): complete HubSpot security and regression verification"
```

Skip this commit only if Step 1-4 required no file changes.

---

## Production Dependency Boundary

Code completion does **not** equal production connection. Before any production-ready claim, independently verify all of the following external dependencies:

1. authorized HubSpot public/project app configuration exists;
2. production HubSpot client ID/secret are supplied server-side;
3. production callback URI exactly matches ATLAS configuration;
4. credential-encryption key material exists server-side and is not committed;
5. migration is applied to the intended Supabase project;
6. `atlas-crm-hubspot` Edge Function is deployed to the intended project;
7. ATLAS production identity/RBAC recognizes canonical integration/CRM permissions;
8. live OAuth completes for an authorized ATLAS organization;
9. introspection returns the expected HubSpot account;
10. live provider probe succeeds before UI reports `connected`;
11. Contacts, Companies, and Deals return real authorized data; unsupported Ticket/activity scopes degrade truthfully;
12. a second organization cannot read or use the first organization's connection;
13. disconnect revokes/destroys credentials and changes state to `revoked`;
14. browser network payloads, console, storage, HTML, and logs expose no provider credential material;
15. `/crm` and all P0 child routes return no 404/500 errors.

If any dependency above is absent, stop at that exact boundary and report it. Do not simulate success.

## Self-Review Result

- Spec coverage: provider model, permissions compatibility, schema/RLS, credential custody, OAuth, adapter, connection lifecycle, read/search/get/associations, pagination, audit/sync metadata, tenant isolation, UI routes/states, disconnect, tests, and production gates are each assigned to a task.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified generic error-handling steps remain.
- Type consistency: tasks consistently use `IntegrationProvider`, `CrmObjectType`, `CrmRecord`, `CrmPage`, canonical CRM permissions, and the same `/crm/*` route family.
