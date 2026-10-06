# ATLAS Agent Gateway — Design Specification

Date: 2026-10-04
Status: Design approved; written-spec review pending
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-agent-gateway`
Owner: ATLAS Core / Work Soberano / Universal Execution Engine
Primary surface: `/work/connections`
Initial provider proving ground: HubSpot
External browser runtime reference: TinyFish Browser Context Profiles may be used as one runtime/provider substrate, never as ATLAS source of truth.

## 1. Purpose

ATLAS Agent Gateway turns the existing Work connection-reference surface into a governed universal application-connection layer for ATLAS agents.

The user should be able to provide a provider URL or choose a provider, let ATLAS discover the strongest available connection method, establish or reuse authorized access, verify the actual account/tenant and granted capabilities, and then make that connection available to the Universal Execution Engine without exposing secret material.

The target experience is materially stronger than a saved browser-profile setup. A saved session is only one possible substrate. ATLAS must know whether a connection is usable, for which tenant/account, for which operations, with which transport, under which policy, and with what evidence.

Canonical outcome:

`PROVIDER/URL -> DISCOVER -> SELECT STRONGEST AUTHORIZED ROUTE -> CONNECT -> ATTEST IDENTITY/TENANT -> RESOLVE CAPABILITIES -> POLICY/RBAC -> TEST -> RECORD EVIDENCE/AUDIT -> READY FOR EXECUTION`

A connection is not considered ready merely because an OAuth callback succeeded, a secret reference exists, or browser cookies were saved.

## 2. Existing ATLAS Foundation to Reuse

This design extends the existing ATLAS Work and Universal Execution foundations. It must not introduce a second workflow engine, approval system, audit system, tenant model, browser execution model, or secret store.

Reuse or extend:

- `execution_connection_refs` as the canonical connection registry;
- `/work/connections` as the canonical connection-management surface;
- `apps/web/src/work/api.ts` as the web client boundary;
- `supabase/functions/atlas-execution/work-connections.ts` as the server connection boundary;
- `supabase/functions/atlas-execution/index.ts` as the operation dispatcher;
- `packages/execution` policy/routing contracts;
- `execution_runtime_registrations` and `execution_runtime_jobs` for runtime execution;
- canonical organization/tenant/session resolution;
- Approval Center for sensitive mutations;
- `execution_audit_events` for material action history;
- `execution_evidence` when connection verification occurs inside a canonical workflow;
- existing production verification and fail-closed gates.

The current `/work/connections` implementation already stores opaque references and explicitly rejects direct secret handling. That security property is binding and must be preserved.

## 3. Repository Findings That Bind This Design

### 3.1 Existing connection model

`execution_connection_refs` currently stores:

- `org_id`;
- `tenant_id`;
- `provider`;
- `mechanism` (`oauth`, `session`, `vault`);
- opaque `external_ref`;
- lifecycle `status`;
- normalized `capabilities`;
- creator and timestamps.

This is the correct canonical base. The gateway extends it rather than replacing it.

### 3.2 Existing UI limitation

`WorkConnectionsPage.tsx` currently requires manual entry of provider, mechanism, opaque reference and capability names. It does not perform discovery, provider-specific setup, identity attestation, health checks, capability verification, or guided repair.

### 3.3 Multi-tenant bug discovered during design review

`supabase/functions/atlas-execution/work-policy.ts` currently filters both `execution_connection_refs.tenant_id` and `execution_runtime_registrations.tenant_id` using `context.orgId` inside `liveBrowserCapability()`.

That is inconsistent with the canonical data model, where `tenant_id` and `org_id` are distinct fields. The Agent Gateway implementation must correct this by carrying the canonical `tenantId` into the server context and filtering on `context.tenantId`.

This repair is P0 because incorrect tenant resolution can cause valid connections/runtimes to be denied and would undermine isolation guarantees if identifiers ever overlap unexpectedly.

## 4. Binding Architecture Decisions

1. `/work/connections` remains the canonical connection surface.
2. `/settings/integrations` may exist only as a navigation alias/redirect to the canonical Work surface; it must not persist parallel connection state.
3. `execution_connection_refs` remains the canonical connection registry.
4. Secret values remain outside execution tables. `external_ref` remains opaque.
5. Authentication mechanism and execution transport are separate concepts.
6. `mechanism` remains `oauth | session | vault` in v1.
7. Execution transports are normalized separately as `api | mcp | browser` capabilities.
8. ATLAS prefers structured native transports over browser automation when both can satisfy the requested action.
9. TinyFish, Playwright, local Chrome, or future browser providers are runtime substrates, not identity authorities and not canonical connection stores.
10. A connection may expose multiple transports simultaneously, for example OAuth-backed API plus authorized browser fallback.
11. Readiness requires provider/account attestation plus at least one verified capability route.
12. Browser session persistence never equals identity verification.
13. Completion/readiness claims must be evidence-backed.
14. Cross-tenant reads and writes fail closed.
15. Existing Approval Center, audit, execution and evidence systems remain authoritative.

## 5. Product Scope

### 5.1 In scope for v1

- provider URL/domain discovery;
- provider selection from known adapters;
- detection of supported connection methods;
- normalized route recommendation;
- guided connection setup;
- opaque connection registration;
- account/tenant identity attestation;
- capability discovery and normalization;
- connection test;
- health state;
- expiry/reauth state;
- permission/scope visibility;
- revoke;
- repair/reconnect entry point;
- audit trail;
- execution-router consumption;
- first provider adapter for HubSpot;
- browser-runtime adapter contract that can consume an authorized TinyFish profile reference without treating TinyFish as canonical state;
- multi-tenant policy fix in `work-policy.ts`.

### 5.2 Explicitly out of scope for v1

- building a general password manager;
- storing plaintext credentials;
- bypassing MFA, CAPTCHA, passkeys or provider consent;
- replacing HubSpot OAuth/service authorization with scraped cookies when a supported structured path exists;
- cloning all TinyFish browser infrastructure;
- creating a second ATLAS audit history;
- introducing provider spend without the existing budget/approval controls;
- claiming arbitrary providers are supported without an adapter or verified generic browser route.

## 6. Connection Discovery

The user may begin from:

- a provider URL, e.g. `https://app-na2.hubspot.com/...`;
- a domain, e.g. `app-na2.hubspot.com`;
- provider selection, e.g. `HubSpot`;
- an already-authorized external runtime/profile reference.

The discovery resolver normalizes:

```ts
interface ConnectionDiscoveryResult {
  provider: string;
  canonicalDomain: string | null;
  detectedTenantHint: string | null;
  supportedMechanisms: Array<'oauth' | 'session' | 'vault'>;
  supportedTransports: Array<'api' | 'mcp' | 'browser'>;
  recommendedPath: ConnectionPath;
  reasons: string[];
  requiresHumanSignIn: boolean;
  adapterAvailable: boolean;
}

type ConnectionPath =
  | 'native_api_oauth'
  | 'native_api_vault'
  | 'native_mcp_oauth'
  | 'authorized_browser_session'
  | 'unsupported';
```

Discovery is deterministic where an ATLAS adapter exists. Generic domain heuristics may suggest a browser path, but they must not claim API/MCP support without an adapter contract.

## 7. Route Selection Priority

The default connection/execution preference is:

`VERIFIED NATIVE API/MCP -> VERIFIED STRUCTURED PROVIDER AUTH -> VERIFIED AUTHORIZED BROWSER SESSION -> BLOCKED`

This refines the existing Work principle `AUTHORIZED API -> AUTHORIZED SESSION/BROWSER -> OTHER APPROVED RUNTIME`.

Selection considers:

- requested operation;
- adapter capability;
- granted scopes;
- account/tenant match;
- runtime availability;
- connection health;
- policy and RBAC;
- execution envelope;
- cost/budget;
- provider restrictions.

The same connection may route different operations differently. Example: HubSpot CRM reads may use API while a UI-only administrative action may use the browser fallback if explicitly authorized.

## 8. Identity and Tenant Attestation

A connection is not `ready` until ATLAS independently reads back non-secret identity information from the provider or authorized session.

Normalized attestation:

```ts
interface ConnectionAttestation {
  provider: string;
  connectionId: string;
  providerAccountRef: string | null;
  providerTenantRef: string | null;
  principalRef: string | null;
  principalLabel: string | null;
  grantedCapabilities: string[];
  transportCapabilities: Array<'api' | 'mcp' | 'browser'>;
  verifiedAt: string;
  expiresAt: string | null;
  evidenceDigest: string;
}
```

Rules:

- no access tokens, refresh tokens, cookies, passwords, recovery codes or private keys in attestation;
- provider IDs may be stored when they are ordinary non-secret account identifiers;
- email/user labels should be minimized/redacted according to existing ATLAS privacy conventions;
- `evidenceDigest` is derived from a sanitized verification result, not from secret material;
- a provider/account change during later health verification moves health to `account_changed` and blocks mutation until re-attested.

## 9. Lifecycle and Health States

Lifecycle (`status`) remains separate from live health.

Existing lifecycle:

- `active`;
- `revoked`;
- `expired`;
- `error`.

New normalized health state:

```ts
type ConnectionHealth =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'reauth_required'
  | 'insufficient_scope'
  | 'account_changed'
  | 'runtime_unavailable'
  | 'unavailable';
```

Only `status = active` plus an acceptable health state and matching verified capability can satisfy execution routing.

`active` must never be rendered as synonymous with `healthy` or `verified`.

## 10. Permission Model

Connection setup and use are separate permissions.

Proposed normalized permissions:

- `work.connections.read`;
- `work.connections.create`;
- `work.connections.verify`;
- `work.connections.repair`;
- `work.connections.revoke`;
- `work.connections.admin`.

Provider capabilities remain granular, e.g.:

- `hubspot.crm.contacts.read`;
- `hubspot.crm.contacts.write`;
- `hubspot.crm.companies.read`;
- `hubspot.settings.email.read`;
- `browser.navigate`;
- `browser.form.write`.

A visible control is never authorization. Immediately before a provider mutation ATLAS must still evaluate canonical execution permission, owner-module permission, autonomy, approval, budget, connection health, provider capability and execution envelope.

## 11. Secret and Session Boundary

Binding rules:

- OAuth tokens live only in the approved provider/vault subsystem.
- Service/API keys are represented by `mechanism = vault` plus an opaque `external_ref`.
- Browser cookies/storage live only in the approved browser-profile/runtime subsystem.
- TinyFish profile IDs may be stored as opaque external references if the profile was explicitly authorized.
- The UI may display a sanitized runtime/profile label, never cookies or credential values.
- Secret-looking fields remain rejected by the atlas-execution request boundary.
- Secrets are never copied into workflow context, audit strings, evidence payloads, logs or client-visible errors.

## 12. Persistence Changes

Extend `execution_connection_refs` through a forward migration. Do not replace the table.

Proposed additive fields:

```sql
alter table public.execution_connection_refs
  add column if not exists display_label text,
  add column if not exists provider_account_ref text,
  add column if not exists provider_tenant_ref text,
  add column if not exists principal_label text,
  add column if not exists transport_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists health_state text not null default 'unknown',
  add column if not exists verified_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_error_code text;
```

Check constraints must bound lifecycle/health enums and array/object shape where feasible.

Do not create a separate connection audit table. Material connection events are recorded through `execution_audit_events` with `module = 'work'` and connection correlation identifiers.

For standalone connection verification that is not part of an execution workflow, latest sanitized verification state lives on `execution_connection_refs`; the event history lives in `execution_audit_events`. If future requirements need immutable standalone evidence objects, that is a separate reviewed extension rather than a shadow audit implementation.

## 13. Server Operations

Extend `atlas-execution` with normalized operations:

- `discover_work_connection`;
- `begin_work_connection`;
- `register_work_connection_ref` (preserved, hardened);
- `verify_work_connection`;
- `test_work_connection`;
- `repair_work_connection`;
- `list_work_connections` (extended summary);
- `get_work_connection`;
- `revoke_work_connection_ref` (preserved, audited).

No operation accepts raw passwords, tokens, cookies, recovery codes or private keys.

`begin_work_connection` returns an approved provider-specific setup action/reference, not a secret.

`verify_work_connection` performs identity, tenant and capability attestation.

`test_work_connection` performs a safe, non-destructive provider read or equivalent probe.

`repair_work_connection` may refresh/reauthorize only through the approved provider/session substrate. It must return `human_action_required` when MFA, consent, CAPTCHA, passkey or equivalent user interaction is required.

## 14. Provider Adapter Contract

Provider-specific logic implements one normalized interface:

```ts
interface AgentGatewayProviderAdapter {
  id: string;
  domains: string[];
  discover(input: { url?: string; domain?: string }): Promise<ConnectionDiscoveryResult>;
  begin(input: BeginConnectionInput): Promise<BeginConnectionResult>;
  attest(input: ConnectionRefContext): Promise<ConnectionAttestation>;
  test(input: ConnectionRefContext): Promise<ConnectionTestResult>;
  repair(input: ConnectionRefContext): Promise<RepairResult>;
  revoke?(input: ConnectionRefContext): Promise<ProviderRevokeResult>;
}
```

Adapters must not receive broader organization data than required. They receive opaque credential/session references resolved server-side.

## 15. HubSpot Adapter — v1 Proving Ground

HubSpot is the first complete adapter because the originating use case is a TinyFish setup targeted at `app-na2.hubspot.com`.

The HubSpot adapter must:

1. detect `hubspot.com` / regional app subdomains;
2. prefer a structured HubSpot authorization/API path when the required capability is exposed;
3. accept an approved vault-backed service credential path when configured and policy permits;
4. allow an authorized browser-session fallback only for UI-only work;
5. attest the actual HubSpot account/portal/tenant identity through a read-back path;
6. normalize granted scopes/capabilities;
7. run a harmless read test before marking the connection healthy;
8. block mutation if the attested portal differs from the connection's expected portal;
9. preserve browser fallback as a separate transport capability, not as proof that API scopes exist.

The adapter must not infer successful HubSpot authorization solely from the existence of a browser profile.

## 16. TinyFish Runtime Adapter Boundary

TinyFish may be integrated as one implementation of an authorized cloud browser substrate.

ATLAS stores only an opaque TinyFish profile/session reference in `external_ref` when the user has explicitly authorized that profile for use.

ATLAS must independently track:

- ATLAS organization/tenant;
- expected provider/domain;
- ATLAS connection lifecycle;
- attested provider account/tenant;
- normalized capabilities;
- ATLAS health state;
- policy/RBAC;
- audit and verification results.

TinyFish remains responsible for its own remote browser/session state. ATLAS must not assume a TinyFish `signed_in_sites` claim proves current authentication, correct account, correct tenant, or sufficient provider permissions. Each execution requiring that connection must still pass health/capability checks.

## 17. Web UX

Enhance `/work/connections` from a manual reference form into the Agent Gateway connection center.

Primary sections:

### 17.1 Connect an App

Input:

`Paste an app URL or choose a provider`

Example:

`https://app-na2.hubspot.com/...`

Flow:

`Detect -> Recommended connection path -> Connect -> Verify identity -> Test -> Ready`

### 17.2 Connection Card

Each card shows only evidence-backed state:

- provider;
- sanitized account/tenant label;
- mechanism;
- available transports;
- lifecycle;
- health;
- verified capabilities;
- last verified/check timestamp;
- expiry when known;
- actions: `Test`, `Manage permissions`, `Repair`, `Revoke`.

### 17.3 State truthfulness

Never show `Connected`, `Verified`, `Healthy`, `Ready` or equivalent unless the corresponding backend state exists.

Use explicit intermediate states:

- `Authorization required`;
- `Authorization saved; verification pending`;
- `Verified; test pending`;
- `Healthy`;
- `Re-authentication required`;
- `Permission missing`;
- `Account changed`;
- `Runtime unavailable`.

### 17.4 Routes

Canonical routes:

- `/work/connections`;
- `/work/connections/new`;
- `/work/connections/:connectionId`.

Optional navigation alias:

- `/settings/integrations` -> redirect to `/work/connections`.

Do not duplicate state or implementation under Settings.

## 18. Execution Router Integration

Before a route is considered authorized, the router resolves:

1. canonical org and tenant;
2. active connection reference;
3. lifecycle = active;
4. acceptable health state;
5. provider account/tenant attestation matches expected context;
6. requested capability is granted;
7. required transport is available;
8. runtime is healthy when browser execution is required;
9. execution envelope allows domain/action;
10. RBAC/approval/budget gates pass.

Only then may the step execute.

The existing `liveBrowserCapability()` must be refactored to consume the normalized connection-health resolver rather than simply checking whether an active row exists.

## 19. Multi-Tenant Repair

Update the server context used by `work-policy.ts` from:

```ts
type ServerContext = {
  orgId: string;
  userId: string;
  permissions: string[];
};
```

to include canonical tenant identity:

```ts
type ServerContext = {
  orgId: string;
  tenantId: string;
  userId: string;
  permissions: string[];
};
```

All connection and runtime queries must use both:

```ts
.eq('org_id', context.orgId)
.eq('tenant_id', context.tenantId)
```

TDD must demonstrate that a connection/runtime in another tenant cannot satisfy route availability even when provider/domain/capabilities match.

## 20. Audit and Evidence

Material actions emit canonical audit events, including:

- discovery completed;
- connection authorization begun;
- opaque reference registered;
- identity attested;
- capability test passed/failed;
- health changed;
- repair requested/completed;
- reauth required;
- account/tenant changed;
- connection revoked.

Audit strings contain no secrets.

When connection setup/test is performed as part of a Work workflow, verified outcomes should additionally bind to canonical `execution_evidence` and the workflow's success criteria.

## 21. Failure and Repair Semantics

Repair is evidence-driven and idempotent where possible.

Examples:

- expired OAuth -> refresh/reauthorize via provider subsystem;
- stale browser session -> reopen approved profile/setup flow;
- missing scope -> return exact missing normalized capability and require new authorization;
- account changed -> block mutations until the user/provider flow re-attests the intended account;
- runtime offline -> keep connection registered but health reflects `runtime_unavailable` for browser-only capabilities;
- uncertain provider mutation -> read provider state before retrying.

ATLAS must never blindly repeat an external mutation after a timeout.

## 22. Observability

Connection operations must produce structured logs/metrics without secrets.

Minimum dimensions:

- provider;
- mechanism;
- transport;
- health transition;
- operation;
- result;
- duration bucket;
- org/tenant opaque identifiers or approved correlation IDs;
- runtime kind for browser operations.

Do not log `external_ref` when it could reveal provider-specific secret-bearing identifiers; use connection ID/correlation ID instead.

## 23. TDD Requirements

Implementation follows test-first development.

Required contract coverage:

1. migration extends `execution_connection_refs` without destructive replacement;
2. health/lifecycle state normalization;
3. domain/provider discovery;
4. route recommendation favors verified structured transports over browser;
5. HubSpot adapter discovery;
6. HubSpot identity/tenant attestation contract;
7. harmless HubSpot connection test contract;
8. `work-policy.ts` uses `tenantId`, not `orgId`, for tenant filters;
9. cross-tenant connection cannot satisfy routing;
10. cross-tenant runtime cannot satisfy routing;
11. secret-looking request fields remain rejected;
12. browser profile presence does not equal `healthy`;
13. `active` does not equal `verified`;
14. account-change state blocks mutation;
15. missing scope blocks the requested capability;
16. revoke is organization+tenant scoped and audited;
17. UI renders truthful intermediate states;
18. `/work/connections/new` and detail routes integrate with canonical Work navigation;
19. production verification includes the new connection routes;
20. no existing Work runtime/connection tests regress.

## 24. Production Verification

Deployment follows existing ATLAS production workflow and Fail Closed policy.

P0 verification after merge/deploy:

- `GET https://www.atlasenterprisesuite.com/` -> 200;
- canonical health endpoint -> 200/healthy;
- `/work` reachable through expected authenticated app shell behavior;
- `/work/connections` route loads without application error;
- `/work/connections/new` route loads without application error;
- production security headers remain valid;
- deployment exact-SHA verification passes;
- connection APIs fail closed when unauthenticated;
- tenant-isolation tests pass in CI;
- no secret material appears in build artifacts or client bundle.

Provider E2E readiness for HubSpot requires an actually authorized HubSpot connection. If production credentials/session are not available in CI, provider E2E remains an explicit environment-dependent gate and must not be falsely marked passed. The application/deployment gate and provider-authorization gate are reported separately.

## 25. Acceptance Criteria

The feature is complete only when all of the following are evidenced:

1. A user can paste a HubSpot URL and ATLAS detects HubSpot.
2. ATLAS recommends a structured authorization path before browser fallback when supported.
3. The UI never asks the user to paste raw secrets into Work connection state.
4. An approved opaque connection reference can be registered.
5. ATLAS can attest the actual provider account/tenant through a safe read path.
6. ATLAS records normalized capabilities and transports.
7. A harmless test must pass before the UI displays `Healthy`.
8. A saved browser profile by itself does not display `Healthy`.
9. Account mismatch results in `account_changed` and blocks mutation.
10. Missing provider scope results in `insufficient_scope` for affected actions.
11. Browser runtime loss is represented truthfully without deleting the connection.
12. Revocation is scoped to the active org+tenant.
13. The `work-policy.ts` tenant filter bug is fixed and covered by regression tests.
14. Existing Work execution, runtime, policy and production verification tests continue to pass.
15. CI passes on the feature head.
16. PR review gates pass.
17. Merge targets `main` without bypassing required checks.
18. Production deployment is verified by exact deployed SHA and P0 route/security checks.
19. HubSpot provider E2E is marked complete only with real authorization evidence.

## 26. Recommended Implementation Shape

Expected implementation areas after plan approval:

- `packages/execution/src/` — normalized connection health/route contracts;
- `supabase/migrations/` — additive Agent Gateway migration;
- `supabase/functions/atlas-execution/work-connections.ts` — discovery/verify/test/repair lifecycle;
- `supabase/functions/atlas-execution/work-policy.ts` — tenant fix and health-aware resolution;
- `supabase/functions/atlas-execution/index.ts` — operation dispatch;
- `supabase/functions/atlas-execution/providers/` — provider adapter registry and HubSpot adapter;
- `apps/web/src/work/api.ts` — richer normalized connection API;
- `apps/web/src/work/WorkConnectionsPage.tsx` — connection center;
- new connection setup/detail components under `apps/web/src/work/`;
- `apps/web/src/work/WorkRoutes.tsx` — setup/detail routes;
- tests under `tests/unit/` and `tests/integration/`;
- production verification route lists/contracts.

Exact file creation/modification will be finalized by the implementation plan after this written spec is approved.

## 27. Implementation Handoff Rule

This is an architectural change. Per the repository's Superpowers workflow, code implementation must not begin until:

1. this written spec is reviewed and approved;
2. the implementation plan is produced with the `writing-plans` workflow;
3. the plan is reviewed/approved for execution;
4. implementation proceeds test-first;
5. verification evidence is collected before any completion claim.

No approval from an earlier stage is interpreted as approval of an artifact that did not yet exist.
