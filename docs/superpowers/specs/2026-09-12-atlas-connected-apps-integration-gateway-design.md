# ATLAS Connected Apps + Integration Gateway — Design Specification

Date: 2026-09-12  
Status: Approved by user; ready for implementation planning/execution  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Target branch for eventual integration: `main`

## 1. Purpose

ATLAS Enterprise Suite needs one secure, tenant-aware system for connecting external accounts and infrastructure providers without duplicating OAuth, credential handling, verification, RBAC, audit, or provider-specific logic in every module.

This specification defines **ATLAS Connected Apps + Integration Gateway** as the shared integration layer for user-authorized SaaS accounts and privileged infrastructure connections.

The first end-to-end adapter is Microsoft. The architecture is multiprovider from the start and must support Google, GitHub, Cloudflare, Supabase, and future providers through a common contract.

The Microsoft account screenshot supplied during design is a visual and functional reference for connection-management intent. It is not an asset to embed and is not, by itself, evidence that ATLAS has a usable provider connection.

## 2. Goals

The system must:

1. provide one Connected Apps administration surface;
2. support both user OAuth connectors and privileged infrastructure connectors;
3. preserve tenant and organization isolation;
4. enforce RBAC before viewing, using, modifying, or revoking a connection;
5. keep provider credentials server-side and outside browser persistence;
6. make every status truthful and evidence-based;
7. expose provider capabilities through a shared Integration Gateway rather than direct token access;
8. allow ATLAS Assistant and modules to request capabilities without receiving credentials;
9. integrate sensitive changes with Approval Center when policy requires approval;
10. emit metadata-only audit events for material connection changes and privileged uses;
11. render empty, degraded, expired, revoked, reconnect, and error states instead of simulated success;
12. remain compatible with the repository's existing React app, Supabase direction, shared tenancy concepts, and ATLAS Manager architecture.

## 3. Non-goals

This project does not:

- replace ATLAS authentication, tenancy, or RBAC;
- make an external provider the source of truth for ATLAS authorization;
- expose access tokens, refresh tokens, API keys, client secrets, private certificates, recovery codes, or provider passwords to the browser;
- claim a provider is healthy because a row, environment variable, or credential reference exists;
- implement every provider API in the first milestone;
- bypass provider-hosted consent or provider-side administrative controls;
- allow ATLAS Assistant to silently expand scopes or create privileged credentials;
- create a second parallel integration backend when an existing ATLAS service can be extended safely.

## 4. Product ownership and routes

### 4.1 Settings / Security

Primary user-facing administration owner:

`Settings -> Security -> Connected Apps`

Route family:

- `/settings/security/connected-apps`
- `/settings/security/connected-apps/:providerKey`

Provider detail tabs:

- Overview
- Permissions
- Used By
- Activity
- Security

### 4.2 ATLAS Connect

ATLAS Connect owns the shared provider catalog, Integration Gateway contracts, adapters, capability resolution, and provider-health semantics.

Route family:

- `/connect/providers`
- `/connect/providers/:providerKey`

### 4.3 ATLAS Manager

Privileged infrastructure connections are administered through:

- `/manager/infrastructure/connections`
- `/manager/infrastructure/connections/:providerKey`

Cloudflare and Supabase are not represented as casual personal OAuth accounts when they are used for ATLAS production infrastructure.

## 5. Architectural decision

ATLAS uses one shared **Integration Gateway** rather than embedding OAuth and credentials inside every consuming module.

Capability execution path:

`User/Module -> Session -> Tenant/Organization -> RBAC -> Integration Grant -> Connection State -> Provider Scope -> Provider Adapter -> Provider API -> Sanitized Result -> Audit`

Interactive authorization path:

`Connected Apps -> Connect -> server authorization setup -> provider consent -> secure callback -> state/PKCE validation -> protected credential boundary -> provider verification -> status update -> audit -> UI`

Infrastructure configuration path:

`ATLAS Manager -> privileged permission -> credential submission -> protected server storage -> provider verification -> environment-scoped status -> audit`

A consuming module receives a result for an authorized capability. It never receives raw provider credentials.

## 6. Connector classes

### 6.1 User OAuth connectors

Initial connectors:

- Microsoft;
- Google;
- GitHub.

Properties:

- provider-hosted authorization;
- explicit scopes;
- authorization-code flow with PKCE when supported;
- refresh and expiration lifecycle when supported;
- reconnect and revoke operations;
- sanitized identity metadata only;
- module/assistant use through Integration Grants.

### 6.2 Infrastructure connectors

Initial providers:

- Cloudflare;
- Supabase.

Properties:

- organization-owned;
- explicit `development`, `staging`, or `production` environment;
- `infrastructure.integrations.manage` permission;
- no reveal-after-save secrets;
- real provider verification;
- stronger audit requirements;
- approval enforcement for sensitive production changes when policy requires it.

## 7. Shared provider contract

Every provider adapter implements the equivalent responsibilities:

```text
getProviderMetadata()
listSupportedCapabilities()
beginAuthorization()                 # where applicable
handleAuthorizationCallback()        # where applicable
verifyConnection()
refreshConnection()                  # where applicable
revokeConnection()                   # where applicable
executeCapability(request)
sanitizeIdentityMetadata()
mapProviderError(error)
```

Provider-specific API logic remains in adapters. Tenant/RBAC policy, grants, status semantics, approval, and audit remain outside adapters.

## 8. Capability model

Modules request capabilities, not tokens.

Initial capability vocabulary:

```text
microsoft.profile.read
microsoft.mail.read
microsoft.calendar.read
microsoft.files.read
google.gmail.read
google.calendar.read
google.drive.read
github.repositories.read
github.pull_requests.read
cloudflare.dns.read
cloudflare.workers.read
supabase.project.read
```

A capability executes only when all conditions pass:

1. valid ATLAS session;
2. tenant and organization resolved;
3. actor has required ATLAS permission;
4. connection is in the same tenant/organization scope;
5. an active Integration Grant authorizes the principal/module/capability;
6. connection lifecycle state permits use;
7. provider scopes/credential permissions cover the capability;
8. required approval has been satisfied.

## 9. Configuration state versus connection state

Provider configuration and a user's connection lifecycle are separate concepts.

### 9.1 Provider configuration state

```text
not_configured
configured
```

`not_configured` means ATLAS lacks required provider application/infrastructure configuration, such as an OAuth client registration, callback configuration, protected secret-storage dependency, or provider-specific platform credential.

It is not a user connection state.

### 9.2 Connection lifecycle state

```text
not_connected
authorizing
connected_unverified
verified
degraded
expired
reconnect_required
revoked
error
```

Rules:

- `not_connected`: no usable authorization exists for this connection owner.
- `authorizing`: an authorization flow has started but has not produced a usable connection.
- `connected_unverified`: credential material/reference exists but no successful provider verification is recorded.
- `verified`: a real authenticated provider check succeeded and scope/capability metadata is consistent.
- `degraded`: a previously usable connection is partially failing.
- `expired`: credential lifetime ended and has not been restored.
- `reconnect_required`: automatic restoration failed and explicit user/admin authorization is required.
- `revoked`: ATLAS or the provider revoked authorization.
- `error`: a non-transient failure prevents normal operation and no more specific lifecycle state applies.

**Truthfulness invariant:** `verified` cannot be inferred from a database row, environment variable, credential reference, or callback success alone.

## 10. Data model

Use Supabase migrations and preserve tenant/organization isolation. Exact physical naming may follow existing repository conventions, but these logical records are required.

### 10.1 `integration_providers`

Required logical fields:

- `id`
- `provider_key`
- `display_name`
- `connector_class`
- `authorization_type`
- `enabled`
- `supported_capabilities`
- `supported_scopes_metadata`
- timestamps

No provider secret is stored here.

### 10.2 `integration_connections`

Required logical fields:

- `id`
- `tenant_id`
- `organization_id`
- `user_id` nullable for organization-owned infrastructure connections
- `provider_id`
- `connector_class`
- `environment` nullable for normal user connections
- lifecycle `status`
- safe provider subject reference when retention is allowed
- `masked_identity`
- `granted_scopes`
- `credential_ref`
- `connected_at`
- `last_verified_at`
- `expires_at`
- `revoked_at`
- safe last-error code/time
- sanitized metadata
- timestamps

### 10.3 `integration_credentials`

This is a credential-reference metadata boundary, not a plaintext-secret table.

Required logical fields:

- `id`
- `connection_id`
- `credential_ref`
- `credential_type`
- `created_at`
- `rotated_at`

Raw provider credential material may exist only behind the server-side credential-vault abstraction. If the canonical environment has no suitable protected secret store, ATLAS must stop at `not_configured`/configuration boundary rather than persist plaintext provider secrets.

### 10.4 `integration_grants`

Required logical fields:

- `id`
- `tenant_id`
- `organization_id`
- `connection_id`
- `principal_type`
- `principal_id`
- `module`
- `capability`
- `granted_by`
- `granted_at`
- `revoked_at`

### 10.5 `integration_events`

Immutable metadata-only audit events.

Required logical fields:

- `id`
- tenant/organization
- actor
- provider
- connection
- action
- status before/after
- requested scopes
- module
- environment
- approval reference
- correlation identifier
- outcome
- safe provider error code
- timestamp

Never store raw provider credentials in audit data.

## 11. Permissions

Minimum permissions:

```text
integrations.view
integrations.use
integrations.manage
infrastructure.integrations.manage
```

`integrations.view`: view allowed catalog, sanitized status/identity/scopes/grants/activity.

`integrations.use`: consume an already-authorized capability through the gateway when an Integration Grant also allows it.

`integrations.manage`: connect, reconnect, change permitted settings, and revoke user/provider connections.

`infrastructure.integrations.manage`: configure, rotate, replace, verify, or revoke privileged infrastructure connections.

A user with ordinary `integrations.manage` cannot manage production Cloudflare/Supabase infrastructure credentials.

## 12. Connected Apps UI

### 12.1 Provider list

Each provider card exposes only safe information:

- approved provider icon/logo;
- name and category;
- masked identity when connected;
- connection lifecycle state;
- connected time;
- last verified time;
- concise capability summary;
- allowed primary action.

### 12.2 Provider detail

Tabs:

**Overview**
- owner;
- organization;
- environment where applicable;
- sanitized identity;
- status;
- connected/verified/expiration information;
- health summary.

**Permissions**
- granted provider scopes;
- mapped ATLAS capabilities;
- missing scope/capability requirements;
- explicit reauthorization requirement.

**Used By**
- active Integration Grants;
- modules/principals authorized to consume the connection.

**Activity**
- metadata-only lifecycle and policy events.

**Security**
- connector class;
- environment;
- rotation metadata for infrastructure connections;
- provider-side management action where appropriate;
- RBAC-gated reconnect/revoke actions.

### 12.3 Responsive behavior

Desktop, tablet, and mobile expose equivalent functionality. Tabs may scroll horizontally or use a compact control on narrow viewports, but actions cannot disappear because of viewport size.

## 13. Microsoft — first end-to-end adapter

Required lifecycle:

`Connect -> Microsoft consent -> callback -> state/PKCE validation -> protected credential persistence -> connected_unverified -> authenticated verification -> verified -> display -> execute authorized capability -> refresh when required -> reconnect -> revoke -> audit`

Required user-visible actions:

- Connect
- Verify now
- Manage
- Reconnect
- Manage at Microsoft
- Revoke from ATLAS

Allowed safe metadata includes masked identity, connected date, last verification, scopes, mapped capabilities, and health state.

`Manage at Microsoft` links to official provider-side administration when a consent/permission action belongs to Microsoft.

## 14. Google and GitHub

Google and GitHub reuse the exact provider/gateway/security contracts. They must not introduce provider-specific authorization architecture forks.

Google target families:

- Gmail;
- Calendar;
- Drive;
- authorized Workspace identity.

GitHub target families:

- repositories;
- pull requests;
- issues;
- repository metadata;
- later explicitly approved write actions.

## 15. Cloudflare and Supabase infrastructure profiles

When used as ATLAS infrastructure, Cloudflare and Supabase connections require:

- organization ownership;
- explicit environment;
- infrastructure management permission;
- server-only protected credentials;
- no secret reveal after save;
- provider verification;
- lifecycle audit;
- Approval Center enforcement for sensitive production operations when policy requires it.

A saved credential reference remains `connected_unverified` until a real provider check succeeds.

## 16. ATLAS Assistant

ATLAS Assistant is a gateway consumer, not a credential owner.

Example:

`Find the Microsoft email I received about a newly connected application.`

Execution:

`intent -> capability -> session -> tenant/org -> RBAC -> grant -> connection state -> scope -> provider adapter -> sanitized result`

Structured blocked reasons include:

- provider not configured;
- provider not connected;
- degraded/reconnect required;
- missing ATLAS permission;
- missing Integration Grant;
- missing provider scope;
- approval required.

The Assistant cannot silently expand scopes or create infrastructure credentials.

## 17. Approval Center

Sensitive operations are approval-gated when organization policy requires it. Examples:

- expanding scopes;
- granting a privileged module access;
- configuring production infrastructure;
- rotating/replacing production credentials;
- revoking an organization-shared connection;
- enabling a high-privilege capability.

Approval information must identify requester, provider, connection, organization/tenant, environment, requested capability/scope change, risk classification where available, and resulting action.

Lifecycle:

`requested -> awaiting_approval -> approved/rejected -> executed -> verified`

Rejected approval cannot partially mutate provider authorization.

## 18. Secret handling invariants

1. No provider secret in browser LocalStorage or SessionStorage.
2. No provider secret in URLs.
3. No provider secret in frontend logs, analytics, persistent UI state, browser error payloads, or audit events.
4. No provider secret committed to Git.
5. Provider credentials are processed only server-side.
6. UI receives sanitized metadata and opaque connection identifiers.
7. Infrastructure secrets are not revealable after save.
8. Rotation is audited without exposing either old or new secret.
9. Callback/provider errors are sanitized before reaching the browser.

ATLAS's own session implementation may retain its existing session-storage behavior; this specification does not authorize external-provider credentials to use that path.

## 19. Error behavior

**Provider outage:** retain authorization; transition to degraded when evidence supports it.

**Expired credential:** attempt server-side refresh where supported; successful refresh must be followed by verification before restoring `verified`; unrecoverable refresh becomes `reconnect_required`.

**External revocation:** set `revoked`, disable execution, audit.

**Missing scope:** deny only the affected capability; offer explicit reauthorization only to an authorized manager.

**Tenant mismatch:** deny without revealing whether the foreign connection exists.

**Credential-store unavailable:** do not persist plaintext; expose provider/configuration as not usable.

## 20. Audit requirements

Audit material lifecycle actions including:

- authorization started;
- connection established;
- verification success/failure;
- refresh success/failure;
- scope change;
- grant create/revoke;
- reconnect start/complete;
- revoke request/complete;
- infrastructure credential create/rotate/replace;
- privileged capability use when policy requires;
- provider-reported revocation;
- approval requested/approved/rejected/executed.

Correlation identifiers must allow a UI action, gateway request, provider call, approval, and state transition to be traced without storing provider secrets.

## 21. Implementation boundaries

Prefer focused files and existing repository patterns.

**Web**
- Connected Apps routes;
- cards/detail UI;
- responsive states;
- explicit actions;
- sanitized API client.

**Shared contracts**
- scope/permission/status/capability types;
- provider-independent policy helpers;
- audit metadata contracts.

**Integration Gateway**
- provider registry;
- capability authorization;
- grant checks;
- lifecycle-state enforcement;
- provider dispatch;
- standardized safe errors/results;
- audit correlation.

**Supabase**
- migrations;
- tenant/org RLS;
- server functions for callback, verification, refresh, revoke, and infrastructure credential submission.

**Credential Vault Adapter**
- opaque references;
- server retrieval;
- rotation metadata;
- no browser access.

Do not force a large unrelated refactor of `App.tsx` or existing modules. Split only what this feature must touch.

## 22. Required UI states

Implement real states as applicable:

```text
idle
hover
active
selected
loading
disabled
empty
authorizing
connected_unverified
verified
degraded
reconnect_required
revoked
error
success
```

No `href="#"`, console-only buttons, fake connected states, or screenshot-as-interface substitutions.

## 23. Test strategy

New behavior uses TDD. Required scenarios include:

1. organization/tenant isolation on view and execution;
2. actor without view permission;
3. actor with view but without manage permission;
4. invalid OAuth state;
5. invalid PKCE verifier when applicable;
6. successful callback stores sanitized connection metadata plus protected credential reference only;
7. canceled consent;
8. missing scope;
9. expired credential and refresh path;
10. failed refresh -> reconnect required;
11. provider outage -> degraded without deleting authorization;
12. provider revocation -> revoked;
13. ATLAS revoke blocks subsequent use;
14. no raw secret in frontend responses;
15. no raw secret in audit;
16. audit lifecycle events;
17. approval enforcement when configured;
18. rejected approval causes no provider mutation;
19. Assistant blocked without grant/capability;
20. Assistant succeeds only through gateway when policy passes;
21. empty state;
22. desktop/tablet/mobile route usability;
23. verified impossible without verification evidence;
24. infrastructure operations require infrastructure permission;
25. environment separation for infrastructure connections.

## 24. Validation

Before any completion claim:

```bash
npm run typecheck
npm test
npm run build
```

Also verify:

- affected routes have no 404/500;
- navigation reaches final actions;
- callbacks/revoke behave as specified;
- auth/RBAC boundaries hold;
- source control contains no provider secret;
- empty/loading/degraded/reconnect/revoked/error/success states work;
- desktop/tablet/mobile behavior works;
- adjacent ATLAS modules remain intact.

## 25. Milestones

### Milestone 1 — Shared foundation

- provider registry;
- state/capability/permission contracts;
- Integration Gateway skeleton;
- tenant-aware connection/grant/audit persistence;
- Connected Apps shell;
- credential-vault abstraction.

### Milestone 2 — Microsoft end-to-end

- connect;
- callback;
- state/PKCE validation;
- protected credential handling;
- verify;
- scopes/capabilities display;
- one real authorized capability execution;
- refresh;
- reconnect;
- revoke;
- audit;
- responsive UI.

### Milestone 3 — Google + GitHub

Reuse the same contracts. No architecture fork.

### Milestone 4 — Infrastructure profiles

Cloudflare + Supabase with environment scoping, stronger permissions, protected secret submission, verification, rotation metadata, and approval enforcement.

## 26. Acceptance criteria

The first operational acceptance gate is:

`ATLAS -> Settings -> Security -> Connected Apps -> Microsoft -> Connect -> Microsoft consent -> ATLAS callback -> real verification -> inspect permissions -> execute one authorized Microsoft capability -> inspect audit -> revoke -> verify further execution is blocked`

This workflow passes only with:

- correct organization/tenant isolation;
- no client secret exposure;
- no fake verified state;
- provider scope → ATLAS capability mapping;
- RBAC for view/use/manage;
- Integration Grant enforcement;
- audit events;
- safe error mapping;
- desktop/tablet/mobile usability;
- passing typecheck/tests/build.

Google/GitHub are accepted only when they reuse this gateway. Cloudflare/Supabase are accepted only when infrastructure credentials are server-only, environment-scoped, RBAC-protected, and truthfully verified.

## 27. Security invariants

Non-negotiable:

1. organization/tenant boundary enforced server-side;
2. provider credential never becomes client-readable data;
3. Assistant never receives provider credentials;
4. adapter cannot bypass gateway policy;
5. `verified` requires provider evidence;
6. infrastructure connection requires infrastructure permission;
7. approval-gated action cannot execute first;
8. audit never stores raw secret;
9. missing capability fails closed;
10. provider outage cannot bypass authorization checks.

## 28. Production boundary

Deployment is not part of design approval.

If implementation lacks a real OAuth app registration, callback setup, protected credential store, provider credential, Approval Center dependency, or production permission, stop at that exact boundary and use a truthful configuration/non-live state. Do not simulate a production connection.

## 29. Definition of done

The project is complete only when:

- shared architecture is implemented without duplicating existing ATLAS infrastructure;
- Microsoft passes the real end-to-end acceptance workflow;
- states are truthful;
- tenant/org isolation is verified;
- permissions/grants are verified;
- secret invariants are verified;
- audit/approval behavior is verified;
- desktop/tablet/mobile are verified;
- `npm run typecheck`, `npm test`, and `npm run build` pass;
- no production credential is committed or exposed;
- implementation evidence supports the claimed status.
