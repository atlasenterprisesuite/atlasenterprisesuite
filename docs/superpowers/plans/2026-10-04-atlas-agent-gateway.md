# ATLAS Agent Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/work/connections` into an evidence-backed universal Agent Gateway that discovers provider connection paths, reuses existing provider integrations such as HubSpot, attests provider/account identity and capabilities, routes execution through verified API/MCP/browser transports, and fails closed on tenant, health, or permission mismatches.

**Architecture:** Keep `execution_connection_refs` as the Work/Universal Execution registry, but federate provider-specific authorization state from existing integration subsystems instead of rebuilding it. For HubSpot, bridge the existing `atlas-crm-hubspot`, encrypted credential vault, lifecycle, OAuth 2026-03, health and live-verification stack into normalized Agent Gateway summaries and actions; browser profiles remain opaque external/session substrates and never become ATLAS identity truth. Add a small shared gateway contract in `packages/execution`, a server adapter registry inside `atlas-execution`, additive metadata on `execution_connection_refs`, and an upgraded `/work/connections` UI.

**Tech Stack:** TypeScript 5.7, React 18, Vite 6, Vitest 5, Supabase Edge Functions/Deno, Postgres/RLS, existing ATLAS Universal Execution Engine, existing HubSpot OAuth/CRM/Vault subsystem, GitHub Actions, Cloudflare production verification.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-agent-gateway-design.md`

## Global Constraints

- Reuse `/work/connections`, `execution_connection_refs`, Universal Execution, Approval Center, audit/evidence, runtime and provider integration foundations; do not create parallel systems.
- `external_ref` remains opaque and must never contain raw tokens, passwords, cookies, recovery codes, private keys or other secret material.
- Authentication mechanism stays `oauth | session | vault`; execution transports are normalized separately as `api | mcp | browser`.
- `active` lifecycle must never be presented as equivalent to `healthy`, `verified` or `ready`.
- Cross-tenant and cross-organization access fails closed using the canonical `orgId` + `tenantId` scope.
- Native structured routes are preferred over browser automation when the requested capability is available and authorized.
- HubSpot provider authorization must reuse the existing `atlas-crm-hubspot` stack and current `/oauth/2026-03/*` endpoints; do not introduce legacy OAuth v1 paths.
- TinyFish or any future browser provider is only a browser/session substrate; saved session state is not provider identity attestation.
- MFA, CAPTCHA, passkey, provider consent and other human-only gates return `human_action_required`; ATLAS must not bypass them.
- A connection is ready only after provider/account attestation and at least one verified capability route.
- Production completion remains fail-closed: P0 production verification must pass before the feature is considered deployed.

## Review Focus

- A spoofed provider URL such as `https://hubspot.com.evil.example` must not resolve as HubSpot; exact host/suffix rules must fail closed.
- An `active` connection whose health is expired, reauth-required, account-changed or runtime-unavailable must not satisfy execution routing.
- Tenant/org mismatch must return no connection/runtime and must never fall back to an organization ID as tenant identity.
- An already-connected HubSpot organization must be federated into Work without starting a duplicate OAuth flow or copying credentials.
- Secret-looking fields, provider error bodies and browser/session material must remain rejected or sanitized in UI, audit and normalized gateway responses.

---

## File Structure

### New shared contract files

- `packages/execution/src/agent-gateway.ts` — normalized discovery, health, attestation and route-selection domain types plus pure helpers.
- `supabase/functions/atlas-execution/agent-gateway.ts` — server gateway orchestration and provider adapter registry.
- `supabase/functions/atlas-execution/agent-gateway-hubspot.ts` — bridge from existing HubSpot provider subsystem to normalized gateway semantics.
- `supabase/migrations/20261004_atlas_agent_gateway.sql` — additive `execution_connection_refs` metadata and constraints/indexes.
- `tests/unit/agent-gateway.test.ts` — pure discovery/health/readiness contract tests.
- `tests/unit/atlas-agent-gateway-migration.test.ts` — schema/RLS/constraint contract tests.
- `tests/unit/atlas-execution-agent-gateway.test.ts` — edge/server gateway tests.

### Existing files to modify

- `packages/execution/src/index.ts` — export Agent Gateway contracts.
- `supabase/functions/atlas-execution/work-policy.ts` — carry canonical `tenantId`; reject unhealthy/unverified routes.
- `supabase/functions/atlas-execution/work-connections.ts` — normalized persistence reads/writes and metadata updates.
- `supabase/functions/atlas-execution/index.ts` — expose governed gateway operations and permissions.
- `apps/web/src/work/api.ts` — Agent Gateway request/response types and functions.
- `apps/web/src/work/WorkConnectionsPage.tsx` — discovery-first connection center, evidence-backed cards and repair/test actions.
- `tests/unit/atlas-execution-work-policy-edge.test.ts` — P0 tenant fix and readiness policy.
- `tests/integration/work-runtime-pages.test.tsx` — new connection UX/state behaviors.
- `tests/unit/work-runtime-migration.test.ts` — ensure migration remains compatible with existing runtime registry.
- `data/ops/global-production-verification.json` — keep `/work/connections` as a P0 route and add any exact response marker needed for Agent Gateway verification.
- `tests/unit/work-production-verification.test.ts` — assert Agent Gateway route remains in P0 production verification.
- `tests/integration/global-production-verification.test.ts` — assert route/marker verification contract.

### Existing HubSpot subsystem explicitly reused, not duplicated

- `supabase/functions/atlas-crm-hubspot/index.ts`
- `supabase/functions/_shared/hubspot-connection-store.ts`
- `supabase/functions/_shared/hubspot-connection-lifecycle.ts`
- `supabase/functions/_shared/hubspot-oauth.ts`
- `supabase/functions/_shared/hubspot-crm.ts`
- `supabase/functions/_shared/integration-credential-vault.ts`
- `supabase/functions/atlas-hubspot-live-verify/index.ts`
- existing CRM HubSpot UI under `/crm/integrations/hubspot`

---

### Task 1: Add the normalized Agent Gateway contract and discovery rules

**Files:**
- Create: `packages/execution/src/agent-gateway.ts`
- Modify: `packages/execution/src/index.ts`
- Test: `tests/unit/agent-gateway.test.ts`

**Interfaces:**
- Consumes: no new runtime dependencies; pure TypeScript only.
- Produces:
  - `ConnectionMechanism = 'oauth' | 'session' | 'vault'`
  - `ConnectionTransport = 'api' | 'mcp' | 'browser'`
  - `ConnectionHealth = 'unknown' | 'healthy' | 'degraded' | 'reauth_required' | 'insufficient_scope' | 'account_changed' | 'runtime_unavailable' | 'unavailable'`
  - `ConnectionPath = 'native_api_oauth' | 'native_api_vault' | 'native_mcp_oauth' | 'authorized_browser_session' | 'unsupported'`
  - `ConnectionDiscoveryResult`
  - `ConnectionAttestation`
  - `normalizeProviderTarget(input: string): { provider: string | null; canonicalDomain: string | null }`
  - `connectionIsReady(input: { lifecycle: string; health: ConnectionHealth; verifiedAt: string | null; transports: ConnectionTransport[] }): boolean`

- [ ] **Step 1: Write failing pure contract tests**

Add tests that assert:

```ts
expect(normalizeProviderTarget('https://app-na2.hubspot.com/settings')).toEqual({
  provider: 'hubspot',
  canonicalDomain: 'hubspot.com'
});
expect(normalizeProviderTarget('https://hubspot.com.evil.example')).toEqual({
  provider: null,
  canonicalDomain: null
});
expect(connectionIsReady({ lifecycle: 'active', health: 'healthy', verifiedAt: '2026-10-04T12:00:00Z', transports: ['api'] })).toBe(true);
expect(connectionIsReady({ lifecycle: 'active', health: 'reauth_required', verifiedAt: '2026-10-04T12:00:00Z', transports: ['api'] })).toBe(false);
```

Also pin empty input, bare domains, mixed-case hostnames, `www.hubspot.com`, regional `app-*` HubSpot subdomains, active-without-verification, and active-without-transports.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/agent-gateway.test.ts`

Expected: FAIL because `packages/execution/src/agent-gateway.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure contract**

Create the exact exported types and helpers above. Host detection must parse URLs with `URL` and accept only exact `hubspot.com` or `*.hubspot.com`; string suffix checks such as `includes('hubspot.com')` are forbidden.

- [ ] **Step 4: Export the module from `packages/execution/src/index.ts`**

- [ ] **Step 5: Re-run focused test and typecheck**

Run:

```bash
npx vitest run tests/unit/agent-gateway.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/execution/src/agent-gateway.ts packages/execution/src/index.ts tests/unit/agent-gateway.test.ts
git commit -m "feat(gateway): define connection discovery contracts"
```

---

### Task 2: Extend connection persistence and repair canonical tenant scoping

**Files:**
- Create: `supabase/migrations/20261004_atlas_agent_gateway.sql`
- Modify: `supabase/functions/atlas-execution/work-policy.ts`
- Modify: `supabase/functions/atlas-execution/work-connections.ts`
- Modify: `tests/unit/atlas-execution-work-policy-edge.test.ts`
- Modify: `tests/unit/work-runtime-migration.test.ts`
- Test: `tests/unit/atlas-agent-gateway-migration.test.ts`

**Interfaces:**
- Consumes: Task 1 `ConnectionHealth`, `ConnectionTransport`, `connectionIsReady`.
- Produces additive columns on `execution_connection_refs`:
  - `display_label text`
  - `provider_account_ref text`
  - `provider_tenant_ref text`
  - `principal_label text`
  - `transport_capabilities jsonb not null default '[]'::jsonb`
  - `health_state text not null default 'unknown'`
  - `verified_at timestamptz`
  - `expires_at timestamptz`
  - `last_checked_at timestamptz`
  - `last_error_code text`
- Produces server context requirement `{ userId, orgId, tenantId, permissions }` for Work policy resolution.

- [ ] **Step 1: Write failing migration tests**

Assert the migration is additive, preserves `external_ref`, contains the exact health enum, does not add secret/token/cookie columns, and retains RLS/service-role boundary semantics.

- [ ] **Step 2: Write the failing tenant regression test**

In `atlas-execution-work-policy-edge.test.ts`, require `liveBrowserCapability()` to filter:

```ts
.eq('org_id', context.orgId)
.eq('tenant_id', context.tenantId)
```

for both `execution_connection_refs` and `execution_runtime_registrations`; explicitly assert the source no longer contains `.eq('tenant_id', context.orgId)`.

- [ ] **Step 3: Run migration/policy tests and verify RED**

Run:

```bash
npx vitest run tests/unit/atlas-agent-gateway-migration.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts tests/unit/work-runtime-migration.test.ts
```

Expected: FAIL on missing migration and tenant regression.

- [ ] **Step 4: Create the additive migration**

Use `add column if not exists`; add a check constraint for the exact health values; add a GIN or equivalent index only if required by existing query patterns, otherwise keep indexing to `(org_id, tenant_id, status, health_state, updated_at desc)`.

- [ ] **Step 5: Repair `work-policy.ts` canonical tenant context**

Change `ServerContext` to include `tenantId: string`. Use `context.tenantId` in both connection/runtime queries. Do not synthesize tenant identity from org ID.

- [ ] **Step 6: Extend `work-connections.ts` normalized summaries**

List/select and return only sanitized additive metadata. Preserve raw `external_ref` write semantics server-side but never return it from list/get summaries.

- [ ] **Step 7: Re-run focused tests**

Run:

```bash
npx vitest run tests/unit/atlas-agent-gateway-migration.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts tests/unit/work-runtime-migration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261004_atlas_agent_gateway.sql supabase/functions/atlas-execution/work-policy.ts supabase/functions/atlas-execution/work-connections.ts tests/unit/atlas-agent-gateway-migration.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts tests/unit/work-runtime-migration.test.ts
git commit -m "fix(gateway): enforce tenant-scoped connection readiness"
```

---

### Task 3: Add server Agent Gateway orchestration and adapter registry

**Files:**
- Create: `supabase/functions/atlas-execution/agent-gateway.ts`
- Test: `tests/unit/atlas-execution-agent-gateway.test.ts`

**Interfaces:**
- Consumes:
  - Task 1 domain types.
  - Task 2 normalized connection persistence.
- Produces:
  - `discoverAgentConnection(input: { target: unknown }): Promise<ConnectionDiscoveryResult>`
  - `verifyAgentConnection(deps, connectionId: string): Promise<NormalizedConnectionVerification>`
  - `testAgentConnection(deps, connectionId: string): Promise<NormalizedConnectionTest>`
  - `repairAgentConnection(deps, connectionId: string): Promise<NormalizedRepairResult>`
  - provider adapter registry keyed by normalized provider ID.

- [ ] **Step 1: Write failing orchestration tests**

Pin:
- HubSpot domain resolves to adapter-backed discovery.
- unknown provider returns `unsupported` without inventing API/MCP support.
- active but unknown-health connection is not ready.
- `verify` rejects connection outside current `{orgId, tenantId}`.
- `repair` can return `human_action_required` without marking the connection healthy.
- sanitized results never contain `token`, `cookie`, `password`, `authorization`, `ciphertext`, `iv`, or `refresh_token` keys.

- [ ] **Step 2: Run focused server test and verify RED**

Run: `npx vitest run tests/unit/atlas-execution-agent-gateway.test.ts`

Expected: FAIL because orchestration module does not exist.

- [ ] **Step 3: Implement provider adapter registry and generic orchestration**

Define a small internal `AgentGatewayProviderAdapter` interface matching the spec (`discover`, `begin`, `attest`, `test`, `repair`, optional `revoke`). Provider-specific code must live outside the registry file.

- [ ] **Step 4: Implement generic browser/session fallback semantics**

A `session` connection may advertise `browser` transport only when a healthy registered runtime can actually execute browser work for the same `{orgId, tenantId}`. It must not synthesize provider account identity from the session/profile reference.

- [ ] **Step 5: Re-run focused tests**

Run: `npx vitest run tests/unit/atlas-execution-agent-gateway.test.ts`

Expected: PASS for generic cases; HubSpot-specific adapter cases may remain skipped only until Task 4 is implemented, with explicit test names rather than broad suite skipping.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-execution/agent-gateway.ts tests/unit/atlas-execution-agent-gateway.test.ts
git commit -m "feat(gateway): add governed provider orchestration"
```

---

### Task 4: Bridge the existing HubSpot integration into Agent Gateway

**Files:**
- Create: `supabase/functions/atlas-execution/agent-gateway-hubspot.ts`
- Modify: `supabase/functions/atlas-execution/agent-gateway.ts`
- Modify: `tests/unit/atlas-execution-agent-gateway.test.ts`
- Reference only, do not duplicate: `supabase/functions/atlas-crm-hubspot/index.ts`
- Reference only, do not duplicate: `supabase/functions/_shared/hubspot-connection-store.ts`
- Reference only, do not duplicate: `supabase/functions/_shared/hubspot-connection-lifecycle.ts`
- Reference only, do not duplicate: `supabase/functions/_shared/hubspot-oauth.ts`
- Reference only, do not duplicate: `supabase/functions/atlas-hubspot-live-verify/index.ts`

**Interfaces:**
- Consumes existing HubSpot provider truth from `atlas_integration_connections`, `atlas_integration_health`, encrypted credential references and current OAuth lifecycle.
- Produces normalized HubSpot gateway discovery, begin/attest/test/repair results without token access in `execution_connection_refs`.

- [ ] **Step 1: Add failing HubSpot federation tests**

Tests must assert:
- connected HubSpot provider state yields `mechanism: 'oauth'` and `transportCapabilities: ['api']` without starting new OAuth;
- provider account ID/label and granted scopes are copied only as sanitized metadata;
- credential reference is represented only as an opaque provider-subsystem pointer and never returned client-side;
- provider state `expired` maps to `reauth_required`;
- provider health failure maps to `degraded`/`unavailable` and blocks readiness;
- provider account ID change maps to `account_changed` and blocks mutation;
- unconfigured HubSpot returns a guided setup action targeting the existing `/crm/integrations/hubspot` flow rather than creating a second OAuth implementation;
- existing OAuth implementation remains date-based `2026-03` and is not replaced with `/v1/*` endpoints.

- [ ] **Step 2: Run HubSpot gateway tests and verify RED**

Run: `npx vitest run tests/unit/atlas-execution-agent-gateway.test.ts -t HubSpot`

Expected: FAIL because the bridge adapter does not exist.

- [ ] **Step 3: Implement `agent-gateway-hubspot.ts` as a bridge**

Read provider state through the existing HubSpot connection store / server-side integration tables. Do not decrypt credentials inside Agent Gateway unless an existing HubSpot lifecycle/test helper already owns that operation; call/reuse existing provider lifecycle semantics instead.

- [ ] **Step 4: Register HubSpot adapter in the gateway registry**

Discovery should accept `hubspot.com` and `*.hubspot.com` targets. `begin` should either federate an existing connected provider state or return a safe setup/reauth action for the canonical CRM integration flow.

- [ ] **Step 5: Re-run HubSpot and existing CRM tests**

Run:

```bash
npx vitest run tests/unit/atlas-execution-agent-gateway.test.ts -t HubSpot
npx vitest run tests/unit/crm-routes.test.tsx
```

Expected: PASS with no CRM regression.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-execution/agent-gateway-hubspot.ts supabase/functions/atlas-execution/agent-gateway.ts tests/unit/atlas-execution-agent-gateway.test.ts
git commit -m "feat(gateway): federate verified HubSpot connections"
```

---

### Task 5: Expose governed Agent Gateway operations through `atlas-execution`

**Files:**
- Modify: `supabase/functions/atlas-execution/index.ts`
- Modify: `supabase/functions/atlas-execution/work-connections.ts`
- Modify: `tests/unit/atlas-execution-agent-gateway.test.ts`
- Modify: `tests/unit/atlas-execution-work-policy-edge.test.ts`

**Interfaces:**
- Consumes Task 3/4 orchestration functions.
- Produces exact operations:
  - `discover_work_connection`
  - `begin_work_connection`
  - `verify_work_connection`
  - `test_work_connection`
  - `repair_work_connection`
  - `get_work_connection`
  - existing `list_work_connections`, `register_work_connection_ref`, `revoke_work_connection_ref` remain compatible.

- [ ] **Step 1: Add failing dispatcher/permission tests**

Assert operations are in `SUPPORTED_OPERATIONS` and use the narrowest existing execution permissions:
- discover/list/get/test: `execution.read`
- begin/register/verify/repair: `execution.write`
- revoke: existing mutation permission plus current approval/policy behavior; do not create a bypass.

Also assert `containsSensitiveInputKey()` still rejects token/secret/password/cookie/authorization/recovery keys for all new operations.

- [ ] **Step 2: Run focused edge tests and verify RED**

Run:

```bash
npx vitest run tests/unit/atlas-execution-agent-gateway.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts
```

Expected: FAIL on missing operations.

- [ ] **Step 3: Wire operations into `atlas-execution/index.ts`**

Use canonical authenticated `RequestContext` including `tenantId`; never accept tenant identity from request payload.

- [ ] **Step 4: Record material connection actions in `execution_audit_events`**

For begin/verify/test/repair/revoke, record sanitized action/result state with a correlation identifier. Never write provider tokens, cookies, credential payloads or raw upstream error bodies.

- [ ] **Step 5: Persist normalized verification metadata**

After successful attestation/test, update the corresponding `execution_connection_refs` row with provider account/tenant refs, transports, health, `verified_at`, `last_checked_at`, expiry and safe error code. A failed test must update health/error state without falsely setting `verified_at` to a new successful timestamp.

- [ ] **Step 6: Re-run focused tests**

Run:

```bash
npx vitest run tests/unit/atlas-execution-agent-gateway.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts
npm run verify:edge
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/atlas-execution/index.ts supabase/functions/atlas-execution/work-connections.ts tests/unit/atlas-execution-agent-gateway.test.ts tests/unit/atlas-execution-work-policy-edge.test.ts
git commit -m "feat(gateway): expose verified connection operations"
```

---

### Task 6: Upgrade `/work/connections` into the Agent Gateway connection center

**Files:**
- Modify: `apps/web/src/work/api.ts`
- Modify: `apps/web/src/work/WorkConnectionsPage.tsx`
- Modify: `tests/integration/work-runtime-pages.test.tsx`
- Modify the existing Work stylesheet that currently owns `.work-*` classes only if layout/state styling requires it; do not create a second visual system.

**Interfaces:**
- Consumes Task 5 edge operations.
- Produces web functions:
  - `discoverWorkConnection(target: string)`
  - `beginWorkConnection(input)`
  - `getWorkConnection(connectionId: string)`
  - `verifyWorkConnection(connectionId: string)`
  - `testWorkConnection(connectionId: string)`
  - `repairWorkConnection(connectionId: string)`
  - extended `WorkConnectionSummary` with sanitized account/transport/health/verification metadata.

- [ ] **Step 1: Write failing UX tests**

Tests must assert:
- page has `Paste an app URL or choose a provider` input;
- HubSpot URL discovery renders `HubSpot` and recommended structured connection path;
- no card renders `Connected`, `Verified`, `Healthy` or `Ready` merely from lifecycle `active`;
- `healthy + verifiedAt + transport` renders ready/verified state;
- `reauth_required` shows `Reconnect`/repair action;
- `account_changed` renders blocked/error semantics;
- `human_action_required` is shown without pretending repair completed;
- browser fallback is labeled as fallback/transport and not identity proof;
- error state exposes safe codes only, not provider payloads/secrets;
- existing manual opaque-ref registration remains available only as an advanced/fallback path if needed for approved external session/vault subsystems.

- [ ] **Step 2: Run focused UI tests and verify RED**

Run: `npx vitest run tests/integration/work-runtime-pages.test.tsx`

Expected: FAIL because discovery/test/repair UI does not exist.

- [ ] **Step 3: Extend `apps/web/src/work/api.ts`**

Normalize all new gateway responses defensively. Unknown/invalid enum values must map to safe blocked/unknown states rather than optimistic defaults.

- [ ] **Step 4: Refactor `WorkConnectionsPage.tsx` into discovery-first flow**

Keep the component inside the existing Work shell and `WorkSubnav`. Required visible flow:

`Detect -> Recommended path -> Connect/Re-use -> Verify identity -> Test -> Ready`

Cards show provider, sanitized account/tenant label, mechanism, transports, lifecycle, health, verification time, safe capability list and evidence-backed actions.

- [ ] **Step 5: Re-run UI tests and typecheck**

Run:

```bash
npx vitest run tests/integration/work-runtime-pages.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/work/api.ts apps/web/src/work/WorkConnectionsPage.tsx tests/integration/work-runtime-pages.test.tsx
git commit -m "feat(gateway): add evidence-backed connection center"
```

---

### Task 7: Bind verified connection health into execution routing

**Files:**
- Modify: `supabase/functions/atlas-execution/work-policy.ts`
- Modify: `packages/execution/src/work-routing.ts` only if the existing route contract cannot express verified health without duplication.
- Modify: `tests/unit/atlas-execution-work-policy-edge.test.ts`
- Add or modify the most focused existing `work-routing` unit test file discovered during implementation.

**Interfaces:**
- Consumes Task 1 `connectionIsReady` and Task 2 metadata.
- Produces route selection that requires matching verified provider capability for native/browser execution.

- [ ] **Step 1: Write failing routing tests**

Assert:
- `active + healthy + verified API` can satisfy native route;
- `active + reauth_required` is blocked;
- `active + account_changed` is blocked;
- browser route requires both a verified browser-capable connection and healthy browser runtime in the same tenant/org;
- API capability must not be inferred from browser capability;
- provider/account mismatch blocks mutation even when a runtime is online.

- [ ] **Step 2: Run routing tests and verify RED**

Run the focused policy/routing tests discovered in the repository plus:

`npx vitest run tests/unit/atlas-execution-work-policy-edge.test.ts`

Expected: FAIL because current routing only checks connection presence/status and runtime availability.

- [ ] **Step 3: Replace presence-based browser authorization with readiness-based authorization**

Select `health_state`, `verified_at`, `transport_capabilities`, and provider/account metadata from `execution_connection_refs`; evaluate readiness using the shared contract. Preserve existing execution envelope and Approval Center logic.

- [ ] **Step 4: Re-run focused routing tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-execution/work-policy.ts packages/execution/src/work-routing.ts tests/unit/atlas-execution-work-policy-edge.test.ts tests/unit
git commit -m "security(gateway): require verified connection health for execution"
```

Only stage the actual focused routing test file(s), not the whole `tests/unit` directory, if unrelated changes are present.

---

### Task 8: Add production verification and full regression gates

**Files:**
- Modify: `data/ops/global-production-verification.json` only if an Agent Gateway-specific marker can be verified without authentication leakage.
- Modify: `tests/unit/work-production-verification.test.ts`
- Modify: `tests/integration/global-production-verification.test.ts`
- Modify: `.github/workflows/global-production-verify.yml` only if the existing canonical verifier does not already cover the required route/gate.

**Interfaces:**
- Consumes the completed Agent Gateway route and production build.
- Produces fail-closed P0 verification for the public app shell route and authenticated gateway readiness only through approved machine-safe probes.

- [ ] **Step 1: Write failing production contract tests**

Assert `/work/connections` remains in the P0 route matrix. If an authenticated machine-safe readiness probe is available, require a sanitized Agent Gateway marker/state; otherwise explicitly keep authenticated provider/account data out of public probes and verify only the route shell plus backend health through existing secure production mechanisms.

- [ ] **Step 2: Run production verification unit/integration tests and verify RED only for the new assertion**

Run:

```bash
npx vitest run tests/unit/work-production-verification.test.ts tests/integration/global-production-verification.test.ts
```

- [ ] **Step 3: Update canonical production verification minimally**

Do not weaken existing P0 checks, TLS/security-header gates, health checks or exact deployment SHA verification.

- [ ] **Step 4: Run full repository gates locally/in CI-equivalent mode**

Run:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run verify:edge
npm run verify:navigation
npm run build
npm run verify:all
```

Expected: all commands PASS. Do not claim completion from a partial suite.

- [ ] **Step 5: Commit**

```bash
git add data/ops/global-production-verification.json tests/unit/work-production-verification.test.ts tests/integration/global-production-verification.test.ts .github/workflows/global-production-verify.yml
git commit -m "test(gateway): enforce production readiness gates"
```

Stage only files actually changed.

---

### Task 9: PR, CI, merge, deploy and E2E verification

**Files:**
- No planned product-code changes; fixes discovered by review/CI must use new TDD cycles and separate commits.

**Interfaces:**
- Consumes all prior task commits.
- Produces a merged, deployed, independently verified production release or an explicit blocked state with evidence.

- [ ] **Step 1: Reconcile with latest `main` without discarding branch history**

Fetch and compare `main` to `feat/atlas-agent-gateway`. If `main` advanced, merge/rebase using the repository's accepted workflow and re-run focused/full gates after conflict resolution.

- [ ] **Step 2: Verify branch diff contains only intended Agent Gateway/spec/plan changes**

Use commit comparison; reject unrelated file changes.

- [ ] **Step 3: Open PR**

Title: `feat: add ATLAS Agent Gateway`

PR body must summarize architecture reuse, HubSpot federation, tenant fix, security boundaries, tests and production verification plan. Do not claim live HubSpot/TinyFish authorization unless verified in the target environment.

- [ ] **Step 4: Run/request review and inspect every required CI check**

Required evidence includes at minimum typecheck/tests/build plus repository security and production-readiness checks applicable to the branch. Any failing job is investigated from logs; no blind rerun before understanding the failure.

- [ ] **Step 5: Fix CI/review findings with TDD and re-run gates**

Each fix: failing test -> minimal change -> focused pass -> full relevant suite -> commit.

- [ ] **Step 6: Merge only when required checks are green and review blockers are resolved**

Use the repository's allowed merge method and protect against head-SHA drift.

- [ ] **Step 7: Verify canonical production deployment**

Confirm the deployed SHA corresponds to the merge result using existing deployment evidence. Do not infer deployment from PR merge alone.

- [ ] **Step 8: Run fail-closed production verification**

Run the repository canonical production verifier:

```bash
npm run verify:production:global
```

Also inspect the production GitHub Action associated with the merged SHA if deployment verification runs there.

Expected P0 outcomes:
- `https://www.atlasenterprisesuite.com/` returns healthy app shell under existing security-header/TLS gates;
- canonical health endpoint passes existing P0 contract;
- `/work/connections` route is available through the production shell;
- no public probe leaks provider account, token, cookie, vault or session material;
- if authenticated HubSpot connection test is available in the deployment environment, it must independently attest provider account + capability and record safe evidence before the connection is shown as ready.

- [ ] **Step 9: Perform end-to-end HubSpot proving-ground verification**

For an authorized HubSpot organization:
1. discover `app-na2.hubspot.com`;
2. reuse the existing canonical HubSpot OAuth integration when already connected, otherwise route to the existing user authorization flow;
3. return to `/work/connections`;
4. verify provider account/portal identity and scopes;
5. execute a harmless read test;
6. confirm health/verified timestamp/transports are evidence-backed;
7. confirm execution policy accepts only the verified capability route;
8. confirm revocation/reauth/account-change state blocks mutation.

If user interaction is required for HubSpot consent/MFA/passkey/CAPTCHA, stop only at that exact human gate and resume after it is completed; do not bypass it.

- [ ] **Step 10: Final evidence report**

Report exact PR number, merge SHA, CI results, deployed SHA, production verification results and any remaining provider/human gate. Only then mark the Agent Gateway release complete.
