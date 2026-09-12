# ATLAS Connected Apps + Integration Gateway — Design Specification

Date: 2026-09-12  
Status: Approved design, implementation not started  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Target branch for eventual integration: `main`

## 1. Purpose

ATLAS Enterprise Suite needs one secure, tenant-aware system for connecting external accounts and infrastructure providers to ATLAS without duplicating OAuth, credential handling, verification, RBAC, auditing, or provider-specific logic in each module.

This specification defines **ATLAS Connected Apps + Integration Gateway** as the shared integration layer for user-authorized SaaS accounts and privileged infrastructure connections.

The first end-to-end production-grade adapter is Microsoft. The architecture is multiprovider from the start and must support Google, GitHub, Cloudflare, Supabase, and future providers through a common contract.

The design is based on the product reference showing Microsoft notifying the user that ChatGPT had been connected to the user's Microsoft account. ATLAS must reproduce the operational intent of that experience as real software: visible connection status, permissions, verification, management, revocation, and audit history. The screenshot is a visual and functional reference, not an asset to embed.

## 2. Design goals

The system must:

1. provide a single Connected Apps administration surface;
2. support both user OAuth connections and privileged infrastructure connections;
3. preserve tenant and organization isolation;
4. enforce RBAC before viewing, using, modifying, or revoking a connection;
5. keep provider credentials server-side and outside browser persistence;
6. make every status truthful and evidence-based;
7. expose provider capabilities through a shared Integration Gateway rather than direct token access;
8. allow ATLAS Assistant and modules to request capabilities without receiving provider credentials;
9. integrate sensitive changes with Approval Center when policy requires approval;
10. emit metadata-only audit events for all material connection changes and uses;
11. provide empty, degraded, expired, revoked, and error states instead of simulated success;
12. remain compatible with the repository's existing React application, Supabase direction, shared tenancy concepts, and ATLAS Manager architecture.

## 3. Non-goals

This project does not:

- create a parallel authentication system for ATLAS users;
- make Microsoft, Google, GitHub, Cloudflare, or Supabase the source of truth for ATLAS tenancy or RBAC;
- expose raw OAuth access tokens, refresh tokens, API keys, client secrets, private certificates, or recovery codes to the browser;
- store provider passwords;
- claim a provider is connected or healthy merely because environment variables or metadata exist;
- implement every possible API offered by every provider in the first milestone;
- bypass provider-hosted consent or administrative controls;
- replace official Microsoft, Google, GitHub, Cloudflare, or Supabase account-management pages where provider-side administration is required;
- allow ATLAS Assistant to silently expand OAuth scopes or create privileged infrastructure credentials.

## 4. Ownership and module classification

### 4.1 Primary product owner

**Settings / Security** owns the user-facing administration experience.

Primary route hierarchy:

`Settings -> Security -> Connected Apps`

### 4.2 Shared integration owner

**ATLAS Connect** owns the reusable provider catalog, Integration Gateway contracts, provider adapters, capability resolution, and provider-health semantics.

### 4.3 Secondary consumers

The shared system can be consumed by:

- ATLAS Assistant;
- ATLAS Drive;
- mail and calendar experiences;
- ATLAS Manager;
- Finance, Accounting, HR, CRM, Creator, Hospitality, and future modules;
- automation and workflow systems;
- Approval Center;
- Audit Trail.

### 4.4 Infrastructure administration

Privileged infrastructure providers appear through:

`ATLAS Manager -> Infrastructure -> Connections`

They reuse the same Integration Gateway but follow stricter infrastructure credential policy.

## 5. Architectural decision

ATLAS will use a shared **Integration Gateway** instead of embedding OAuth or credentials inside each consuming module.

High-level flow:

`User/Module -> Connected Apps or Capability Request -> Session -> Tenant/Organization -> RBAC -> Integration Grant -> Connection State -> Provider Adapter -> Provider API -> Result -> Audit`

For interactive user authorization:

`Connected Apps -> Connect -> server-side authorization setup -> provider consent -> secure callback -> state/PKCE validation -> credential persistence boundary -> provider verification -> connection state update -> audit -> UI`

For infrastructure configuration:

`ATLAS Manager -> privileged authorization -> server-side credential submission -> protected storage -> provider verification -> environment-scoped connection state -> audit`

No consuming module is allowed to read or manipulate raw provider secrets.

## 6. Connector classes

### 6.1 User OAuth connectors

Initial user-oriented connectors:

- Microsoft;
- Google;
- GitHub.

Characteristics:

- user or organization-linked authorization;
- provider-hosted consent;
- authorization code flow with PKCE when supported;
- explicit scopes;
- refresh/expiration lifecycle when applicable;
- reconnect and revoke operations;
- user-facing identity metadata may be stored only in sanitized form;
- capabilities are granted to ATLAS modules through Integration Grants.

### 6.2 Infrastructure connectors

Initial infrastructure connectors:

- Cloudflare;
- Supabase.

Characteristics:

- organization-owned rather than treated as a casual personal account;
- environment-scoped: `development`, `staging`, or `production`;
- privileged configuration permission;
- no secret reveal after initial save;
- stronger audit requirements;
- optional Approval Center requirement for production changes;
- provider health verification through a real API call;
- rotation and replacement workflows rather than generic personal-account reconnect semantics when appropriate.

## 7. Shared provider contract

Every provider adapter must implement a common contract conceptually equivalent to:

- `getProviderMetadata()`
- `listSupportedCapabilities()`
- `beginAuthorization()` when interactive authorization is supported
- `handleAuthorizationCallback()` when callback-based authorization is supported
- `verifyConnection()`
- `refreshConnection()` when refresh is supported
- `revokeConnection()` when revocation is supported
- `executeCapability(request)`
- `sanitizeIdentityMetadata()`
- `mapProviderError(error)`

Provider-specific logic must remain inside the adapter. Shared policy, tenancy, RBAC, audit, approval checks, and status semantics remain outside adapters.

## 8. Capability model

Modules and ATLAS Assistant request named capabilities, not tokens.

Illustrative capabilities:

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

A capability request is authorized only after all of the following are true:

1. ATLAS session is valid;
2. tenant and organization context are resolved;
3. actor has the required ATLAS permission;
4. connection belongs to the same tenant/organization scope;
5. an Integration Grant authorizes the consuming module or actor;
6. provider connection state allows execution;
7. provider scopes or credential permissions satisfy the requested capability;
8. Approval Center policy, when required, is satisfied.

## 9. Connection state machine

Connections use explicit, truthful states:

- `not_connected`
- `authorizing`
- `connected_unverified`
- `verified`
- `degraded`
- `expired`
- `reconnect_required`
- `revoked`
- `error`

### 9.1 State rules

`not_connected`  
No usable credential or authorization exists.

`authorizing`  
An interactive authorization flow has started but no verified connection exists yet.

`connected_unverified`  
Credential material has been received or configured but ATLAS has not yet completed a successful provider verification.

`verified`  
ATLAS has completed a real authenticated verification against the provider and the recorded scopes/capabilities are consistent with the connection.

`degraded`  
A previously usable connection exists but one or more health checks, scopes, or provider operations are failing.

`expired`  
Credential lifetime has ended and automatic refresh is unavailable or not yet attempted.

`reconnect_required`  
ATLAS cannot restore a usable connection automatically and needs user or administrator authorization.

`revoked`  
The provider or ATLAS has explicitly revoked the authorization.

`error`  
A non-transient integration failure prevents normal operation and does not fit another lifecycle state.

### 9.2 Truthfulness rule

The UI must never display `verified` solely because a row, environment variable, or credential reference exists. A successful authenticated verification is required.

## 10. Data model

The implementation should use Supabase migrations and preserve tenant/organization isolation. Exact SQL names may be adjusted during implementation to align with existing repository conventions, but the logical boundaries below are binding.

### 10.1 `integration_providers`

Stores provider definitions and non-secret metadata.

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

Stores the sanitized connection record.

Required logical fields:

- `id`
- `tenant_id`
- `organization_id`
- `user_id` nullable for organization-owned infrastructure connections
- `provider_id`
- `connector_class`
- `environment` nullable for normal user connections and required for environment-scoped infrastructure connections
- `status`
- `external_subject_id` or equivalent provider identity reference when safe to retain
- `masked_identity`
- `granted_scopes`
- `credential_ref`
- `connected_at`
- `last_verified_at`
- `expires_at`
- `revoked_at`
- `last_error_code`
- `last_error_at`
- `metadata` restricted to sanitized non-secret provider information
- `created_at`
- `updated_at`

### 10.3 `integration_credentials`

This is a logical security boundary, not permission to store plaintext secrets in a normal table.

It must contain only the minimum metadata necessary to locate protected credentials, for example:

- `id`
- `connection_id`
- `credential_ref`
- `credential_type`
- `created_at`
- `rotated_at`

Raw provider secret material must be handled only by a server-side credential vault abstraction. The implementation plan must bind that abstraction to an existing authorized secret-storage mechanism if the repository already has one. If no suitable protected secret store exists, implementation must stop at the configuration boundary rather than persist raw secrets insecurely.

### 10.4 `integration_grants`

Controls which actor, role, or module can consume a connection.

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

Immutable metadata-only audit trail for integration lifecycle and material usage events.

Required logical fields:

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
- `provider_error_code` when safe and useful
- `created_at`

Audit events must never contain raw credentials or provider secrets.

## 11. Tenancy and RBAC

The design extends the repository's shared tenancy concepts rather than creating module-specific tenant rules.

Minimum product permissions:

- `integrations.view`
- `integrations.use`
- `integrations.manage`
- `infrastructure.integrations.manage`

Semantics:

`integrations.view`  
View provider catalog, connection status, sanitized identity, scopes, usage metadata, and audit history allowed by policy.

`integrations.use`  
Consume an already-authorized capability through the Integration Gateway when an Integration Grant also permits the use.

`integrations.manage`  
Connect, reconnect, update allowed settings, or revoke normal user/provider connections.

`infrastructure.integrations.manage`  
Configure, rotate, replace, verify, or revoke privileged infrastructure connections.

No query or operation may return a connection from a different tenant or organization.

## 12. Routes and navigation

### 12.1 Connected Apps

Primary route family:

- `/settings/security/connected-apps`
- `/settings/security/connected-apps/:providerKey`

Provider detail contains:

- Overview
- Permissions
- Used By
- Activity
- Security

### 12.2 ATLAS Connect

Provider catalog route family:

- `/connect/providers`
- `/connect/providers/:providerKey`

This surface explains available providers and supported capabilities while delegating administrative state to the same underlying Integration Gateway.

### 12.3 ATLAS Manager infrastructure

Infrastructure route family:

- `/manager/infrastructure/connections`
- `/manager/infrastructure/connections/:providerKey`

Cloudflare and Supabase are managed here when used as privileged infrastructure providers.

## 13. Connected Apps UI

### 13.1 Provider cards

Each provider card shows only truthful, non-secret data:

- provider logo/icon from approved assets;
- provider name;
- connector class or category;
- masked connected identity when applicable;
- current status;
- connected date when applicable;
- last verified timestamp when applicable;
- concise capability summary;
- primary action.

### 13.2 Provider detail

Overview shows:

- connection owner;
- organization;
- environment when relevant;
- sanitized account identity;
- status;
- connected time;
- last verification;
- expiration when known;
- health summary;
- allowed management actions.

Permissions shows:

- provider scopes;
- mapped ATLAS capabilities;
- missing capability requirements;
- whether additional consent is needed.

Used By shows:

- authorized modules;
- approved principals or roles where relevant;
- active Integration Grants.

Activity shows:

- connection lifecycle audit events;
- verification results;
- reconnect and revoke events;
- capability-use events when audit policy requires them.

Security shows:

- connection class;
- environment;
- credential rotation metadata for infrastructure connections;
- provider-side management action when available;
- revoke or reconnect controls gated by RBAC.

### 13.3 Responsive behavior

Desktop, tablet, and mobile must preserve the same functions. Detail tabs may become horizontally scrollable or a compact navigation control on narrow screens, but capabilities may not disappear merely due to viewport size.

## 14. Microsoft adapter — first full milestone

Microsoft is the first provider required to complete the entire lifecycle.

Required flow:

`Connect -> provider consent -> callback -> state/PKCE validation -> protected credential persistence -> verify -> display -> execute authorized capability -> refresh -> reconnect -> revoke -> audit`

### 14.1 Microsoft user-visible data

ATLAS may display:

- masked account identity, for example `w***u@hotmail.com`;
- connected date;
- last verification time;
- granted scopes;
- mapped capabilities;
- health state.

Full account identifiers should be displayed only where ATLAS RBAC and privacy policy permit them.

### 14.2 Microsoft actions

Required actions:

- `Connect`
- `Verify now`
- `Manage`
- `Reconnect`
- `Manage at Microsoft`
- `Revoke from ATLAS`

`Manage at Microsoft` must direct users to the provider's official account/application management when a provider-side permission or consent operation cannot be performed safely inside ATLAS.

## 15. Google and GitHub adapters

Google and GitHub must use the same provider contract and security boundaries.

The initial implementation plan may stage their capabilities after the Microsoft end-to-end milestone, but the shared contracts, provider registry, status model, RBAC, database schema, Integration Grants, and UI must not be Microsoft-specific.

Google target capability families:

- Gmail;
- Calendar;
- Drive;
- Workspace identity where authorized.

GitHub target capability families:

- repositories;
- pull requests;
- issues;
- repository metadata;
- explicitly authorized write actions in later milestones.

## 16. Cloudflare and Supabase infrastructure profiles

Cloudflare and Supabase are represented as Infrastructure Connections when used for ATLAS platform operations.

Required characteristics:

- organization ownership;
- explicit environment;
- `infrastructure.integrations.manage` permission;
- protected secret storage;
- verification through a real provider operation;
- no reveal-after-save behavior;
- audit event for create, verify, rotate, replace, revoke, and failed verification;
- Approval Center integration for production changes when policy requires it.

A configured infrastructure connection remains `connected_unverified` until ATLAS successfully verifies the credential against the provider.

## 17. ATLAS Assistant integration

ATLAS Assistant is a consumer of Integration Gateway capabilities. It is not the owner of provider tokens.

Example intent:

`Find the Microsoft email I received about a newly connected application.`

Execution path:

`Assistant intent -> capability selection -> session -> tenant -> RBAC -> Integration Grant -> provider state -> scope validation -> provider adapter -> provider result -> sanitized assistant result -> audit as required`

If the requested capability is unavailable, the Assistant must return a structured blocked state such as:

- provider not connected;
- provider degraded;
- reconnect required;
- missing ATLAS permission;
- missing Integration Grant;
- missing provider scope;
- approval required.

The Assistant must never silently expand OAuth scopes, create infrastructure tokens, or bypass Approval Center.

## 18. Approval Center integration

Approval Center is required for sensitive operations when organizational policy says approval is necessary.

Potential approval-gated operations include:

- expanding OAuth scopes;
- granting a privileged module access to an existing connection;
- connecting production infrastructure;
- rotating or replacing production Cloudflare/Supabase credentials;
- revoking an organization-shared connection;
- enabling a high-privilege capability.

Approval records must make the requested action intelligible:

- requester;
- provider;
- connection;
- tenant/organization;
- environment;
- requested capability or scope change;
- risk classification when available;
- resulting action.

Approval lifecycle:

`requested -> awaiting_approval -> approved/rejected -> executed -> verified`

A rejected approval must not partially mutate provider state.

## 19. Credential and secret handling

Binding rules:

1. no provider secret is persisted in browser LocalStorage or SessionStorage;
2. no provider secret is embedded in URLs;
3. no provider secret is emitted to frontend logs, analytics, browser error payloads, audit events, or UI state that survives the request;
4. no provider secret is committed to Git;
5. provider secrets are handled only by server-side code;
6. UI receives only sanitized metadata and opaque connection identifiers;
7. infrastructure secrets are never revealable after save;
8. credential rotation creates an auditable lifecycle event without exposing the old or new secret;
9. callback errors must sanitize provider payloads before returning them to the browser.

## 20. Error handling

### 20.1 Provider outage

A provider outage does not automatically delete the connection. ATLAS records the failure and transitions to `degraded` when evidence supports that state.

### 20.2 Expired credential

If refresh is supported, ATLAS attempts server-side refresh. If refresh succeeds, the connection returns to `verified` after verification. If refresh fails in a way requiring user action, transition to `reconnect_required`.

### 20.3 External revocation

If the provider reports that authorization was revoked, transition to `revoked`, disable capability execution, and emit an audit event.

### 20.4 Missing scope

The connection remains intact, but the capability request is denied with a structured missing-scope result. ATLAS may offer an explicit reauthorization flow when the actor is permitted to manage the connection.

### 20.5 Tenant mismatch

Return an authorization failure without leaking whether the foreign connection exists.

## 21. Audit requirements

All material lifecycle changes must emit immutable metadata-only integration events.

Minimum audited actions:

- authorization started;
- connection established;
- verification succeeded;
- verification failed;
- refresh succeeded;
- refresh failed;
- scopes changed;
- Integration Grant created;
- Integration Grant revoked;
- reconnect started;
- reconnect completed;
- revoke requested;
- revoke completed;
- infrastructure credential created;
- infrastructure credential rotated;
- infrastructure credential replaced;
- privileged capability used when policy requires usage auditing;
- provider-reported revocation;
- approval requested, approved, rejected, or executed.

Audit payloads must include correlation identifiers that allow a UI action, gateway request, provider call, approval, and resulting state transition to be traced without storing provider secrets.

## 22. Implementation boundaries

The implementation must follow the repository's existing architecture before introducing new packages or services.

Likely responsibility boundaries:

### Web application

- Connected Apps routes;
- provider cards and detail UI;
- responsive states;
- explicit management actions;
- no raw credential handling.

### Shared core

- shared tenant/organization scope contracts;
- integration permission definitions;
- status and capability types;
- provider-independent policy helpers;
- audit metadata contracts.

### Integration Gateway

- provider registry;
- capability authorization;
- Integration Grant checks;
- connection-state enforcement;
- provider adapter dispatch;
- standardized error/result mapping;
- audit correlation.

### Supabase

- migrations for provider, connection, grants, and audit metadata;
- RLS or equivalent tenant/organization enforcement consistent with existing project patterns;
- server-side functions for authorization callbacks, verification, refresh, revoke, and infrastructure credential submission where appropriate.

### Credential vault abstraction

- opaque credential references;
- server-side retrieval;
- rotation metadata;
- no browser access.

The implementation plan must inspect the repository before selecting exact file paths and must prefer extending existing shared infrastructure over creating parallel systems.

## 23. Reusable UI components

Expected reusable units include:

- `ConnectedAppsPage`
- `ProviderCard`
- `ConnectionStatus`
- `ConnectionDetail`
- `PermissionsPanel`
- `UsedByPanel`
- `IntegrationActivity`
- `ProviderSecurityPanel`

Expected non-UI units include:

- `IntegrationGateway`
- `ProviderRegistry`
- `ProviderAdapter`
- `IntegrationPolicy`
- `IntegrationGrantRepository`
- `CredentialVaultAdapter`
- `IntegrationAudit`

Names may be adjusted to existing repository conventions, but responsibilities should remain isolated and testable.

## 24. Required UI states

All relevant controls must implement real states for:

- idle;
- hover;
- active;
- selected;
- loading;
- disabled;
- empty;
- authorizing;
- connected but unverified;
- verified;
- degraded;
- reconnect required;
- revoked;
- error;
- success.

No button may exist solely to log to the console, use `href="#"`, or simulate a completed provider action.

## 25. Test strategy

Implementation must use TDD for new behavior and include unit, integration, and route-level coverage as appropriate.

Required scenarios:

1. tenant A cannot view tenant B connection;
2. tenant A cannot execute tenant B capability;
3. actor without `integrations.view` cannot view connection metadata;
4. actor with view permission but without manage permission cannot connect, reconnect, or revoke;
5. invalid OAuth state is rejected;
6. invalid PKCE verifier is rejected when PKCE applies;
7. successful callback creates only a sanitized connection record plus protected credential reference;
8. cancelled provider consent returns a safe cancelled/error state;
9. missing provider scope blocks only the affected capability;
10. expired credential triggers refresh when supported;
11. successful refresh re-verifies the connection;
12. failed refresh can transition to `reconnect_required`;
13. provider outage produces `degraded` behavior without deleting authorization;
14. external provider revocation produces `revoked`;
15. revoke from ATLAS disables further capability execution;
16. raw secrets are absent from frontend responses;
17. raw secrets are absent from audit events;
18. audit event is created for material lifecycle operations;
19. Approval Center is enforced when policy requires it;
20. rejected approval does not mutate provider authorization;
21. ATLAS Assistant is blocked without required capability or grant;
22. ATLAS Assistant succeeds through the gateway when capability, scope, state, grant, and permissions are valid;
23. Connected Apps renders appropriate empty state;
24. desktop route works;
25. tablet layout works;
26. mobile layout works;
27. provider detail tabs/navigation remain usable on mobile;
28. `verified` is impossible without recorded successful verification evidence;
29. infrastructure connection cannot be managed with normal `integrations.manage` alone;
30. environment-scoped infrastructure connection cannot cross development/staging/production boundaries.

## 26. Validation requirements

Before the feature can be declared complete, run the repository's required validation commands:

```bash
npm run typecheck
npm test
npm run build
```

Also verify:

- affected routes do not return 404/500;
- provider management navigation reaches final actions;
- callback and revoke flows behave correctly;
- authentication and RBAC boundaries hold;
- no provider secret is introduced into source control;
- empty, loading, degraded, reconnect, revoked, error, and success states work;
- responsive behavior is checked for desktop, tablet, and mobile;
- no adjacent ATLAS module is regressed.

## 27. Milestone sequence

### Milestone 1 — Shared integration foundation

Deliver:

- shared provider registry;
- shared state model;
- shared capability and permission contracts;
- Integration Gateway skeleton;
- tenant-aware connection/grant/audit persistence;
- Connected Apps shell;
- secure credential boundary abstraction.

### Milestone 2 — Microsoft end-to-end

Deliver:

- connect;
- callback;
- state/PKCE validation where applicable;
- protected credential persistence;
- verify;
- permission/scopes display;
- capability execution;
- refresh;
- reconnect;
- revoke;
- audit;
- responsive UI.

### Milestone 3 — Google and GitHub

Reuse the same contracts for Google and GitHub without introducing provider-specific architecture forks.

### Milestone 4 — Infrastructure connections

Deliver Cloudflare and Supabase infrastructure profiles with environment scoping, stronger permission requirements, protected secret submission, verification, rotation metadata, and Approval Center integration as required.

## 28. Acceptance criteria

The first operational acceptance gate is satisfied only when an authorized ATLAS user can complete this real workflow:

`ATLAS -> Settings -> Security -> Connected Apps -> Microsoft -> Connect -> Microsoft consent -> return to ATLAS -> verified provider check -> inspect permissions -> execute one authorized Microsoft capability -> inspect audit trail -> revoke -> confirm further capability use is blocked`

The workflow must satisfy all of the following:

- correct tenant and organization isolation;
- no secret exposure to the browser;
- no fake `verified` state;
- provider scopes mapped to ATLAS capabilities;
- RBAC enforced for view/use/manage;
- Integration Grants enforced for module/assistant consumption;
- audit events recorded;
- provider errors mapped to safe ATLAS states;
- mobile, tablet, and desktop usability;
- required typecheck, tests, and build pass.

Google and GitHub are accepted only when they reuse the same gateway and policy model. Cloudflare and Supabase are accepted only when infrastructure credentials remain server-side, environment-scoped, RBAC-protected, and truthfully verified.

## 29. Security invariants

These invariants are non-negotiable:

1. tenant boundaries are enforced server-side;
2. provider credentials never become client-readable application data;
3. ATLAS Assistant never receives raw provider credentials;
4. provider adapters cannot bypass Integration Gateway policy;
5. `verified` requires actual provider verification evidence;
6. infrastructure connections require infrastructure-level permission;
7. approval-gated actions cannot execute before approval;
8. audit data never contains raw secrets;
9. missing provider capability fails closed;
10. a provider outage cannot silently downgrade authorization checks.

## 30. Production behavior

Production deployment is not part of the design-approval step. When implementation reaches deployment, it must use the existing ATLAS pipeline and existing authorized provider configuration.

If a real provider credential, OAuth app registration, callback configuration, secret-storage facility, or production permission is missing, implementation must stop at that real dependency boundary, mark the integration as `not_configured` or the appropriate non-live state, and state exactly what remains. It must not simulate a successful production connection.

## 31. Definition of done

The Connected Apps + Integration Gateway project is done only when:

- shared integration architecture is implemented without duplicating existing ATLAS infrastructure;
- Microsoft passes the end-to-end acceptance workflow;
- provider states are truthful;
- tenant and organization isolation are verified;
- permissions and Integration Grants are verified;
- secret handling invariants are verified;
- audit and approval behavior are verified;
- desktop/tablet/mobile behavior is verified;
- `npm run typecheck`, `npm test`, and `npm run build` pass;
- no production credential is committed or exposed;
- implementation evidence supports the claimed status.
