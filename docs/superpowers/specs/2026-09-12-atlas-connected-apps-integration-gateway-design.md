# ATLAS Connected Apps + Integration Gateway — Design Specification

Date: 2026-09-12  
Status: Design approved in chat; written spec awaiting user review  
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

`ATLAS Manager -> Infrastructure -> Connections`

Route family:

- `/manager/infrastructure/connections`
- `/manager/infrastructure/connections/:providerKey`

## 5. Architectural decision

ATLAS will use a shared **Integration Gateway**.

General execution path:

`User/Module -> Session -> Tenant/Organization -> RBAC -> Integration Grant -> Connection State -> Provider Adapter -> Provider API -> Result -> Audit`

Interactive authorization path:

`Connected Apps -> Connect -> server-side authorization setup -> provider consent -> secure callback -> state/PKCE validation -> protected credential boundary -> provider verification -> connection update -> audit -> UI`

Infrastructure configuration path:

`ATLAS Manager -> privileged authorization -> server-side secret submission -> protected storage -> provider verification -> environment-scoped connection -> audit`

Consuming modules never receive raw provider credentials.

## 6. Connector classes

### 6.1 User OAuth connectors

Initial providers:

- Microsoft
- Google
- GitHub

Characteristics:

- user- or organization-linked authorization;
- provider-hosted consent;
- authorization code flow and PKCE when supported;
- explicit scopes;
- refresh/expiration lifecycle when applicable;
- reconnect and revoke operations;
- sanitized identity metadata only;
- capability use controlled through Integration Grants.

### 6.2 Infrastructure connectors

Initial providers:

- Cloudflare
- Supabase

Characteristics:

- organization-owned;
- environment-scoped: `development`, `staging`, or `production`;
- privileged management permission;
- no reveal-after-save behavior;
- real provider verification;
- rotation/replacement workflows;
- stronger audit policy;
- Approval Center integration for production changes when policy requires it.

## 7. Provider adapter contract

Every provider adapter must implement a common conceptual contract:

- `getProviderMetadata()`
- `listSupportedCapabilities()`
- `beginAuthorization()` when applicable
- `handleAuthorizationCallback()` when applicable
- `verifyConnection()`
- `refreshConnection()` when supported
- `revokeConnection()` when supported
- `executeCapability(request)`
- `sanitizeIdentityMetadata()`
- `mapProviderError(error)`

Provider-specific API behavior stays inside adapters. Tenant policy, RBAC, grants, approval checks, audit, and shared state semantics stay outside adapters.

## 8. Capability model

Modules and ATLAS Assistant request named capabilities, never tokens.

Examples:

- `microsoft.profile.read`
- `microsoft.mail.read`
- `microsoft.calendar.read`
- `microsoft.files.read`
- `google.gmail.read`
- `google.calendar.read`
- `google.drive.read`
- `github.repositories.read`
- `github.pull_requests.read`
- `cloudflare.dns.read`
- `cloudflare.workers.read`
- `supabase.project.read`

A capability executes only when all of these are true:

1. ATLAS session is valid;
2. tenant and organization are resolved;
3. actor has the required ATLAS permission;
4. connection belongs to the same tenant/organization;
5. an Integration Grant authorizes the actor, role, or module;
6. connection state permits execution;
7. provider scopes/credential permissions satisfy the capability;
8. any required Approval Center decision is satisfied.

## 9. Status model

### 9.1 Provider configuration state

A provider can be `not_configured` when ATLAS does not yet have the required OAuth application registration, callback configuration, infrastructure secret-storage facility, or authorized provider configuration needed to begin a real connection.

`not_configured` is a provider/configuration state, not evidence of a failed user connection.

### 9.2 Connection lifecycle states

Connections use:

- `not_connected`
- `authorizing`
- `connected_unverified`
- `verified`
- `degraded`
- `expired`
- `reconnect_required`
- `revoked`
- `error`

Definitions:

- `not_connected`: no usable authorization exists for that connection scope.
- `authorizing`: interactive authorization has started but has not produced a verified connection.
- `connected_unverified`: credential material exists, but ATLAS has not completed a successful authenticated provider verification.
- `verified`: ATLAS completed a real authenticated provider verification and recorded evidence/time of that check.
- `degraded`: a previously usable connection exists, but health, scopes, or operations are partially failing.
- `expired`: credential lifetime ended and automatic recovery is unavailable or pending.
- `reconnect_required`: ATLAS cannot restore use automatically and user/admin authorization is required.
- `revoked`: the provider or ATLAS explicitly revoked authorization.
- `error`: a non-transient failure prevents normal operation and does not fit another state.

The UI must never show `verified` solely because metadata or a credential reference exists.

## 10. Data model

The implementation should use Supabase migrations and preserve tenant/organization isolation. Exact SQL names may follow established repository conventions, but these logical boundaries are binding.

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
- `created_at`
- `updated_at`

### 10.2 `integration_connections`

Required logical fields:

- `id`
- `tenant_id`
- `organization_id`
- `user_id` nullable for organization-owned infrastructure connections
- `provider_id`
- `connector_class`
- `environment` nullable for normal user connections and required for environment-scoped infrastructure connections
- `status`
- `external_subject_id` when safe to retain
- `masked_identity`
- `granted_scopes`
- `credential_ref`
- `connected_at`
- `last_verified_at`
- `expires_at`
- `revoked_at`
- `last_error_code`
- `last_error_at`
- sanitized `metadata`
- `created_at`
- `updated_at`

### 10.3 Credential metadata boundary

ATLAS may persist only the minimum metadata needed to locate protected credentials, for example:

- `id`
- `connection_id`
- `credential_ref`
- `credential_type`
- `created_at`
- `rotated_at`

Raw secret material must be handled only by a server-side credential-vault abstraction. The implementation plan must bind that abstraction to an existing authorized protected secret store if one exists. If no suitable protected store exists, implementation must stop at the real configuration boundary rather than persist plaintext secrets insecurely.

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

Immutable metadata-only audit events contain:

- `id`
- `tenant_id`
- `organization_id`
- `actor_id`
- `provider_key`
- `connection_id`
- `action`
- `status_before`
- `status_after`
- `requested_scopes`
- `module`
- `environment`
- `approval_id`
- `correlation_id`
- `outcome`
- safe provider error code when useful
- `created_at`

Audit events must never contain raw provider credentials.

## 11. RBAC and tenancy

Minimum permissions:

- `integrations.view`
- `integrations.use`
- `integrations.manage`
- `infrastructure.integrations.manage`

Semantics:

- `integrations.view`: view provider catalog, sanitized identity, states, scopes, usage metadata, and allowed audit history.
- `integrations.use`: consume an authorized capability through the gateway when an Integration Grant also permits it.
- `integrations.manage`: connect, reconnect, update allowed settings, or revoke normal user/provider connections.
- `infrastructure.integrations.manage`: configure, rotate, replace, verify, or revoke privileged infrastructure connections.

No query or operation may expose a connection from another tenant or organization. Tenant mismatch must fail without revealing whether the foreign connection exists.

## 12. Connected Apps UI

Each provider card shows only truthful non-secret data:

- approved provider icon/logo;
- provider name;
- connector class/category;
- masked connected identity when applicable;
- current state;
- connected date when applicable;
- last verified timestamp when applicable;
- concise capability summary;
- primary action.

Provider detail:

**Overview** — owner, organization, environment, sanitized identity, state, connected time, verification time, expiration, health, management actions.

**Permissions** — provider scopes, mapped capabilities, missing capability requirements, and whether additional consent is required.

**Used By** — authorized modules, principals/roles where relevant, and active Integration Grants.

**Activity** — lifecycle audit events, verification results, reconnect/revoke events, and usage events when policy requires them.

**Security** — connector class, environment, rotation metadata for infrastructure, provider-side management link/action, and RBAC-gated revoke/reconnect controls.

Desktop, tablet, and mobile must preserve the same functions. Narrow layouts may change tab/navigation presentation but may not hide capabilities merely due to viewport size.

## 13. Microsoft — first complete adapter

Required lifecycle:

`Connect -> Microsoft consent -> callback -> state/PKCE validation -> protected credential persistence -> verify -> display -> execute authorized capability -> refresh -> reconnect -> revoke -> audit`

User-visible metadata may include:

- masked identity such as `w***u@hotmail.com`;
- connected date;
- last verification time;
- granted scopes;
- mapped capabilities;
- health state.

Full external account identifiers are shown only when ATLAS RBAC/privacy policy permits them.

Required actions:

- `Connect`
- `Verify now`
- `Manage`
- `Reconnect`
- `Manage at Microsoft`
- `Revoke from ATLAS`

`Manage at Microsoft` directs users to Microsoft's official management surface when provider-side consent or administration belongs there.

## 14. Google and GitHub

Google and GitHub use the same gateway, state model, schema, policy, grants, audit, and UI contracts. They must not create provider-specific architecture forks.

Google target capability families:

- Gmail
- Calendar
- Drive
- Workspace identity when authorized

GitHub target capability families:

- repositories
- pull requests
- issues
- repository metadata
- explicitly authorized write operations in later milestones

## 15. Cloudflare and Supabase infrastructure profiles

When used for ATLAS platform operations, Cloudflare and Supabase are Infrastructure Connections.

They require:

- organization ownership;
- explicit environment;
- `infrastructure.integrations.manage`;
- protected server-side secret handling;
- real provider verification;
- no reveal-after-save behavior;
- audit for create, verify, rotate, replace, revoke, and failed verification;
- Approval Center integration for sensitive production changes when policy requires it.

A configured infrastructure credential remains `connected_unverified` until ATLAS successfully verifies it.

## 16. ATLAS Assistant

ATLAS Assistant is a consumer of capabilities, never the owner of provider tokens.

Example execution:

`Assistant intent -> capability selection -> session -> tenant -> RBAC -> Integration Grant -> provider state -> scope validation -> adapter -> provider result -> sanitized assistant result -> audit as required`

If execution is unavailable, the Assistant returns a structured blocked reason such as:

- provider not configured;
- provider not connected;
- provider degraded;
- reconnect required;
- missing ATLAS permission;
- missing Integration Grant;
- missing provider scope;
- approval required.

The Assistant must never silently expand scopes, create infrastructure credentials, or bypass Approval Center.

## 17. Approval Center

Sensitive actions may require Approval Center according to organization policy.

Examples:

- expanding OAuth scopes;
- granting a privileged module a connection;
- connecting production infrastructure;
- rotating/replacing production Cloudflare or Supabase credentials;
- revoking an organization-shared connection;
- enabling a high-privilege capability.

Approval records identify:

- requester;
- provider;
- connection;
- tenant/organization;
- environment;
- requested scope/capability change;
- risk classification when available;
- resulting action.

Lifecycle:

`requested -> awaiting_approval -> approved/rejected -> executed -> verified`

A rejected approval must not partially mutate provider state.

## 18. Secret handling invariants

1. no provider secret in LocalStorage or SessionStorage;
2. no provider secret in URLs;
3. no provider secret in frontend logs, analytics, audit payloads, browser error payloads, or persisted client state;
4. no provider secret committed to Git;
5. provider secrets handled only by server-side code;
6. browser receives sanitized metadata and opaque identifiers only;
7. infrastructure secrets are never revealable after save;
8. rotation is auditable without exposing old/new secret values;
9. callback/provider errors are sanitized before reaching the browser.

## 19. Error behavior

- **Provider outage:** preserve the connection; record failure; use `degraded` only when evidence supports it.
- **Expired credential:** attempt server-side refresh when supported; successful refresh must be followed by verification before returning to `verified`; otherwise use `reconnect_required` when user action is necessary.
- **External revocation:** transition to `revoked`, block capability execution, and audit the event.
- **Missing scope:** preserve the connection, deny only the affected capability, and offer explicit reauthorization only to an authorized manager.
- **Tenant mismatch:** deny without leaking foreign connection existence.

## 20. Audit requirements

Audit at minimum:

- authorization started;
- connection established;
- verification succeeded/failed;
- refresh succeeded/failed;
- scopes changed;
- Integration Grant created/revoked;
- reconnect started/completed;
- revoke requested/completed;
- infrastructure credential created/rotated/replaced;
- privileged capability used when policy requires usage audit;
- provider-reported revocation;
- approval requested/approved/rejected/executed.

Correlation IDs must allow a UI action, gateway request, provider call, approval, and resulting state transition to be traced without storing secrets.

## 21. Implementation boundaries

Implementation must inspect and extend existing ATLAS architecture before creating new services or packages.

Likely responsibility boundaries:

### Web

- routes;
- Connected Apps UI;
- responsive states;
- explicit management actions;
- no raw credential handling.

### Shared core

- tenant/organization scope contracts;
- integration permission definitions;
- status/capability types;
- provider-independent policy helpers;
- audit metadata contracts.

### Integration Gateway

- provider registry;
- capability authorization;
- grant checks;
- state enforcement;
- provider dispatch;
- standardized result/error mapping;
- audit correlation.

### Supabase

- migrations for provider, connection, grants, and audit metadata;
- RLS or equivalent tenant/organization enforcement consistent with repository patterns;
- server-side functions for callbacks, verification, refresh, revoke, and infrastructure credential submission where appropriate.

### Credential vault abstraction

- opaque credential references;
- server-side retrieval;
- rotation metadata;
- no browser access.

Exact file paths are determined during implementation planning after repository inspection.

## 22. Reusable units

Expected UI units:

- `ConnectedAppsPage`
- `ProviderCard`
- `ConnectionStatus`
- `ConnectionDetail`
- `PermissionsPanel`
- `UsedByPanel`
- `IntegrationActivity`
- `ProviderSecurityPanel`

Expected non-UI units:

- `IntegrationGateway`
- `ProviderRegistry`
- `ProviderAdapter`
- `IntegrationPolicy`
- `IntegrationGrantRepository`
- `CredentialVaultAdapter`
- `IntegrationAudit`

Names may follow repository conventions, but responsibilities must remain isolated and testable.

## 23. Required UI states

Controls and pages implement real states for:

- idle;
- hover;
- active;
- selected;
- loading;
- disabled;
- empty;
- authorizing;
- connected/unverified;
- verified;
- degraded;
- reconnect required;
- revoked;
- error;
- success.

No functional control may exist solely to log to the console, use `href="#"`, or simulate a provider action.

## 24. Test strategy

New behavior uses TDD and appropriate unit, integration, and route-level coverage.

Required scenarios:

1. tenant A cannot view tenant B connection;
2. tenant A cannot execute tenant B capability;
3. actor without `integrations.view` cannot view connection metadata;
4. actor with view but without manage cannot connect, reconnect, or revoke;
5. invalid OAuth `state` is rejected;
6. invalid PKCE verifier is rejected when PKCE applies;
7. successful callback creates only sanitized connection metadata plus protected credential reference;
8. cancelled consent returns a safe cancelled/error state;
9. missing provider scope blocks only the affected capability;
10. expired credential triggers refresh when supported;
11. successful refresh re-verifies before `verified`;
12. failed refresh can transition to `reconnect_required`;
13. provider outage can produce `degraded` without deleting authorization;
14. external revocation produces `revoked`;
15. revoke from ATLAS disables capability execution;
16. raw secrets are absent from frontend responses;
17. raw secrets are absent from audit events;
18. material lifecycle operations emit audit events;
19. Approval Center is enforced when policy requires it;
20. rejected approval does not mutate provider authorization;
21. ATLAS Assistant is blocked without required permission, grant, scope, or healthy state;
22. ATLAS Assistant succeeds through the gateway when all checks pass;
23. Connected Apps renders a real empty state;
24. desktop route/layout works;
25. tablet route/layout works;
26. mobile route/layout works;
27. provider detail navigation remains usable on mobile;
28. `verified` is impossible without recorded successful verification evidence;
29. infrastructure connection cannot be managed with ordinary `integrations.manage` alone;
30. infrastructure connection cannot cross development/staging/production scope.

## 25. Validation

Before declaring the feature complete:

```bash
npm run typecheck
npm test
npm run build
```

Also verify:

- affected routes have no 404/500 failures;
- provider-management navigation reaches final actions;
- callback/revoke flows work;
- authentication and RBAC boundaries hold;
- no provider secret entered source control;
- empty/loading/degraded/reconnect/revoked/error/success states work;
- desktop/tablet/mobile behavior is checked;
- adjacent ATLAS modules are not regressed.

## 26. Milestones

### Milestone 1 — Shared foundation

- provider registry;
- status model;
- capability/permission contracts;
- Integration Gateway skeleton;
- tenant-aware connection/grant/audit persistence;
- Connected Apps shell;
- secure credential boundary abstraction.

### Milestone 2 — Microsoft end-to-end

- connect;
- callback;
- state/PKCE validation;
- protected credential persistence;
- verify;
- scope/capability display;
- one authorized capability execution;
- refresh;
- reconnect;
- revoke;
- audit;
- responsive UI.

### Milestone 3 — Google and GitHub

Reuse the same contracts without architecture forks.

### Milestone 4 — Infrastructure profiles

Deliver Cloudflare and Supabase with environment scoping, stronger permission requirements, protected secret submission, verification, rotation metadata, and policy-driven Approval Center integration.

## 27. Acceptance criteria

The first operational acceptance gate is satisfied only when an authorized user can complete this real workflow:

`ATLAS -> Settings -> Security -> Connected Apps -> Microsoft -> Connect -> Microsoft consent -> return to ATLAS -> authenticated provider verification -> inspect permissions -> execute one authorized Microsoft capability -> inspect audit trail -> revoke -> confirm further capability use is blocked`

The workflow must demonstrate:

- tenant/organization isolation;
- no browser secret exposure;
- no fake `verified` state;
- provider scopes mapped to ATLAS capabilities;
- RBAC for view/use/manage;
- Integration Grants for module/assistant consumption;
- audit events;
- safe provider error mapping;
- desktop/tablet/mobile usability;
- passing typecheck, tests, and build.

Google and GitHub are accepted only when they reuse the same gateway/policy model. Cloudflare and Supabase are accepted only when infrastructure credentials remain server-side, environment-scoped, RBAC-protected, and truthfully verified.

## 28. Security invariants

1. tenant boundaries are enforced server-side;
2. provider credentials never become client-readable application data;
3. ATLAS Assistant never receives raw provider credentials;
4. provider adapters cannot bypass gateway policy;
5. `verified` requires real provider verification evidence;
6. infrastructure connections require infrastructure-level permission;
7. approval-gated actions cannot execute before approval;
8. audit data never contains raw secrets;
9. missing capability fails closed;
10. provider outages do not weaken authorization checks.

## 29. Production dependency boundary

Production deployment is not part of design approval.

If a real OAuth app registration, callback configuration, provider credential, secret-storage facility, or production permission is missing, implementation must stop at that dependency boundary and show `not_configured` or the appropriate non-live state. ATLAS must not simulate a successful connection.

## 30. Definition of done

Connected Apps + Integration Gateway is done only when:

- the shared architecture is implemented without unnecessary duplication;
- Microsoft passes the end-to-end acceptance workflow;
- provider states are truthful;
- tenant/organization isolation is verified;
- permissions and Integration Grants are verified;
- secret-handling invariants are verified;
- audit and approval behavior are verified;
- desktop/tablet/mobile behavior is verified;
- `npm run typecheck`, `npm test`, and `npm run build` pass;
- no production credential is committed or exposed;
- implementation evidence supports every completion claim.
