# ATLAS Connected Apps Control Plane — Design Specification

Date: 2026-10-05
Status: Design approved; implementation not started
Repository: `atlasenterprisesuite/atlasenterprisesuite`

## 1. Purpose

ATLAS Connected Apps provides one governed control plane for external applications and providers used by ATLAS users, modules, workflows, and AI agents. It consolidates authorization, scopes, readiness, lifecycle, audit, retention, and execution policy without replacing provider-specific adapters or duplicating module sources of truth.

The design takes the useful account-linking concepts exposed by major platforms and strengthens them for enterprise use with ATLAS Identity, organization scope, RBAC/ABAC, fail-closed provider readiness, explicit approval policy, evidence, audit, and data-retention controls.

The target outcome is a user-visible and machine-enforceable path:

`User/Agent -> Identity -> Organization -> Connected App -> Scope Check -> RBAC/ABAC -> Risk Policy -> Approval when required -> Provider Adapter -> Action -> Evidence -> Audit`

A connection is never sufficient authorization by itself.

## 2. Design principles

1. **One control plane, many adapters.** OAuth and provider details remain adapter-specific; policy, lifecycle, audit, organization scope, and user experience are shared.
2. **Reuse before create.** Reuse existing ATLAS identity permissions, OAuth state handling, `atlas_integration_connections`, credential sealing, Work approvals, audit boundaries, and provider readiness semantics.
3. **Fail closed.** Provider-backed capability remains unavailable until required organization authorization, scopes, credentials, connection health, and policy conditions are verified.
4. **No browser secrets.** Access tokens, refresh tokens, client secrets, signing keys, and credential envelopes remain server-side only.
5. **Least privilege.** Permissions are granular by app, provider capability, read/write action, organization, and where needed resource class.
6. **Explicit consequential action policy.** Read-only operations may be allowed by policy. Send, write, delete, publish, pay, transfer, invite, change-access, and other consequential actions require the configured approval boundary.
7. **Truthful state.** UI labels such as Connected, Authorized, Verified, Expired, Revoked, or Error must be derived from persisted and/or live evidence, not optimistic browser state.
8. **Audit by default.** Connection lifecycle, scope changes, agent use, approvals, executions, failures, and disconnections emit auditable events.
9. **Retention transparency.** ATLAS records what categories of external data were accessed or persisted, for what purpose, applicable retention policy, and deletion-request state.
10. **Compatibility over migration shock.** Existing provider-specific integrations remain operational while they are progressively adopted by the shared control plane.

## 3. Scope

### 3.1 In scope

- `Settings -> Connected Apps` user surface.
- `Security -> External Access` governance surface.
- `ATLAS AI -> Apps` connection-aware agent/tool surface.
- Reuse of Connected Apps inside Work and module workflows.
- Organization-scoped app connections.
- OAuth/OIDC and API-key/service-account style providers where already supported by ATLAS.
- Provider capability manifests.
- Granular scopes and permission metadata.
- Connection lifecycle and health/readiness state.
- Reconnect and disconnect flows.
- Risk classification and approval policy.
- Evidence and immutable-style audit events.
- Data provenance and retention ledger.
- Compatibility aliases for existing provider-specific settings pages during migration.

### 3.2 Initial provider families

The architecture must support at least these families without hard-coding product logic into the control plane:

- Google: Gmail, Calendar, Drive, Contacts.
- Microsoft: Outlook, Calendar, SharePoint/OneDrive where configured.
- CRM: HubSpot and future CRM adapters.
- Developer/operations: GitHub, GitLab, Vercel, Cloudflare where applicable.
- Collaboration: Slack and future workspace providers.
- Storage/content: Dropbox and other file providers.
- Communications and vertical providers already represented in ATLAS.

A provider is not considered implemented merely because it appears in the catalog. Catalog visibility, authorization support, verified runtime connectivity, and permitted actions are separate states.

### 3.3 Out of scope for the first implementation slice

- Building replacements for third-party providers.
- A generic secrets manager UI exposing secret values.
- Arbitrary user-authored OAuth clients.
- Automatic migration of every historical integration in one release.
- Cross-organization credential sharing.
- Provider actions that bypass canonical ATLAS domain logic.

## 4. Existing architecture to reuse

ATLAS already contains important foundations and they remain authoritative:

- identity memberships and permission tables;
- `has_identity_permission` and organization-scoped authorization patterns;
- OAuth state storage and callback conventions;
- `atlas_integration_connections` and provider metadata;
- server-only credential storage/sealing patterns;
- provider authorization/readiness separation;
- Work OS and Guided Execution approval boundaries;
- audit and evidence conventions;
- fail-closed production verification.

Connected Apps is a convergence layer over these primitives, not a parallel integration subsystem.

## 5. Canonical terminology

### Connected App
A user-visible application/provider entry such as Google Workspace, GitHub, HubSpot, Slack, or Dropbox.

### Provider Adapter
Server-side implementation that understands provider authentication, token refresh, capability discovery, API calls, rate limits, and provider-specific errors.

### Connection
An organization-scoped authorization/configuration binding between ATLAS and a provider account/tenant/workspace.

### Capability
A normalized action family exposed by an adapter, such as `mail.read`, `mail.send`, `calendar.read`, `calendar.write`, `files.read`, `files.write`, `crm.contacts.read`, or `repo.pr.write`.

### Scope
Provider-native authorization permission required to exercise a capability.

### Authorization
Evidence that the organization/user granted ATLAS permission.

### Provider Verification
Evidence that the server can currently use the connection and required scopes/capabilities are available.

### Approval Policy
ATLAS rule deciding whether an operation is allowed directly, requires explicit approval, or is denied.

## 6. Canonical connection state machine

The shared lifecycle is:

`DISCONNECTED -> AUTHORIZING -> CONNECTED -> DEGRADED -> EXPIRED`

Additional transitions:

- `CONNECTED -> REVOKED`
- `AUTHORIZING -> ERROR`
- `CONNECTED -> ERROR`
- `DEGRADED -> CONNECTED` after successful re-verification
- `EXPIRED -> AUTHORIZING` on reconnect
- `REVOKED -> AUTHORIZING` on explicit reauthorization
- any terminal disconnect operation -> `DISCONNECTED`

The persisted state must not hide the distinction between:

- user/organization authorization;
- credential presence;
- provider verification;
- capability/scopes satisfaction;
- runtime health.

The UI may show a concise status while retaining the underlying evidence fields.

## 7. Data model

The implementation should extend existing tables instead of replacing them unless migration evidence demonstrates replacement is safer.

### 7.1 `atlas_integration_connections`

Remain the canonical organization-scoped connection record. Required concepts include:

- `id`
- `org_id`
- `provider`
- `connection_name`
- `auth_kind`
- `endpoint_origin` when applicable
- `authorized`
- `provider_verified`
- normalized `state`
- provider account/workspace identity metadata safe for browser display
- `authorized_by`
- `authorized_at`
- `verified_at`
- `expires_at` when known
- `revoked_at` when known
- `last_error_code` and safe error summary
- timestamps

No access token or secret value may be included in a browser-readable row.

### 7.2 Credentials

Existing server-only credential storage remains the source of secret material. The Connected Apps surface may receive only credential presence/readiness metadata, never raw values.

### 7.3 New: `atlas_connected_app_capabilities`

Stores normalized capabilities available to a connection/provider combination.

Suggested fields:

- `id`
- `org_id`
- `connection_id`
- `capability_code`
- `provider_scopes text[]`
- `access_level` (`read`, `write`, `admin`, `consequential`)
- `authorized boolean`
- `verified boolean`
- `verification_source`
- `verified_at`
- metadata

### 7.4 New: `atlas_connected_app_policies`

Organization policy controlling Connected Apps execution.

Suggested fields:

- `id`
- `org_id`
- optional `connection_id`
- `capability_pattern`
- `effect` (`allow`, `approval_required`, `deny`)
- `actor_kind` (`user`, `agent`, `workflow`, `any`)
- optional role/permission constraints
- optional data classification constraint
- enabled flag
- created/updated metadata

Deny wins over approval-required; approval-required wins over direct allow.

### 7.5 New: `atlas_connected_app_access_events`

Append-only or immutable-style evidence for significant external access.

Minimum fields:

- `id`
- `org_id`
- `connection_id`
- actor identity/type
- source module/workflow/agent
- capability code
- provider operation class
- target resource class and opaque/provider-safe identifier when allowed
- decision (`allowed`, `approval_required`, `denied`, `executed`, `failed`)
- approval/evidence reference
- timestamp
- safe metadata

Sensitive provider payloads are not copied into audit by default.

### 7.6 New: `atlas_connected_app_data_ledger`

Data provenance and retention ledger.

Fields should record:

- organization and connection;
- data category (mail metadata, calendar events, files, contacts, CRM objects, etc.);
- purpose;
- storage mode (`transient`, `cached`, `persisted`);
- first/last accessed timestamps;
- retention policy code;
- scheduled deletion date when applicable;
- deletion request state;
- deletion/evidence reference.

The ledger describes ATLAS handling. It must not falsely claim that a third-party provider deleted data unless the provider returned evidence of that action.

## 8. Permission model

Connected Apps introduces namespaced permissions while preserving existing Identity authority.

Initial permission families:

- `connected_apps.read`
- `connected_apps.connect`
- `connected_apps.manage`
- `connected_apps.disconnect`
- `connected_apps.policy.read`
- `connected_apps.policy.manage`
- `connected_apps.audit.read`
- `connected_apps.retention.manage`
- `connected_apps.agent.use`

Provider/module permissions remain additional requirements where applicable. Example: `connected_apps.agent.use` does not grant permission to send mail if the actor lacks the relevant mail/action permission.

Backend checks are authoritative. UI hiding/disabling is only a convenience.

## 9. Provider manifest contract

Each provider adapter exposes a server-owned manifest containing safe metadata:

- provider ID;
- display name;
- icon identifier or safe asset reference;
- supported auth kinds;
- supported capabilities;
- capability -> provider scopes mapping;
- whether each capability is read/write/consequential;
- readiness probe support;
- token refresh support;
- disconnect/revoke support;
- deletion-request support, if any;
- provider documentation/help references;
- adapter version.

The browser cannot declare a capability available by modifying local state.

## 10. Server API / control-plane operations

A single Connected Apps server boundary should normalize operations. Names may adapt to existing Edge Function conventions, but the semantic contract is:

- `catalog.list`
- `connection.list`
- `connection.get`
- `connection.prepare_auth`
- `connection.complete_auth`
- `connection.verify`
- `connection.reconnect`
- `connection.disconnect`
- `capability.list`
- `policy.list`
- `policy.upsert`
- `access.evaluate`
- `access.execute`
- `audit.list`
- `retention.list`
- `retention.request_delete`

Provider-specific callbacks may remain separate endpoints when required, but they converge into the same connection state and audit model.

## 11. Access decision engine

Before any provider action, ATLAS evaluates:

1. authenticated actor;
2. active organization membership;
3. ATLAS permission;
4. connection organization match;
5. connection state;
6. provider authorization;
7. provider verification/readiness;
8. capability support;
9. required provider scopes;
10. Connected Apps policy;
11. module-specific permission/policy;
12. approval evidence if required;
13. provider adapter call.

Failure at any gate prevents execution and emits safe audit evidence.

Consequential capabilities default to `approval_required` unless a stricter policy denies them. Direct allow for a consequential capability must be explicit, organization-scoped, auditable, and limited to capability classes approved by ATLAS policy.

## 12. User experience

### 12.1 `Settings -> Connected Apps`

Primary catalog and lifecycle surface.

Each app card shows:

- application/provider name;
- status;
- connected account/workspace identity where safe;
- capabilities summary;
- last verification;
- scope warning when insufficient;
- Connect / Reconnect / Manage / Disconnect action according to state.

No card displays raw credentials.

### 12.2 Connection detail

Sections:

- Overview
- Permissions & Scopes
- Capabilities
- Agent & Workflow Access
- Activity
- Data & Retention
- Disconnect

Disconnect requires explicit confirmation and clearly distinguishes:

- stopping future ATLAS access;
- provider token revocation when supported;
- ATLAS-retained data deletion request;
- data that may remain at the external provider.

### 12.3 `Security -> External Access`

Security/governance view across all connections:

- connection inventory;
- high-risk scopes;
- consequential capabilities;
- agents/workflows with access;
- recent policy denials and approvals;
- expired/degraded connections;
- retention/deletion exceptions.

### 12.4 `ATLAS AI -> Apps`

Agents see only apps and capabilities allowed by organization policy and current actor permissions. The AI layer receives normalized tool descriptions and safe connection identifiers, not credentials.

Agent execution must flow through the same `access.evaluate` / execution boundary as UI and Work.

## 13. Work OS and approvals integration

Connected Apps must reuse Work OS rather than invent a second approval engine.

When `access.evaluate` returns `approval_required`:

1. create or reuse a governed Work approval object;
2. preserve organization, actor, provider, capability, and intended action summary;
3. do not include secrets or unnecessary provider payloads;
4. after approval, execute only the originally approved operation or a cryptographically/semantically equivalent bounded request;
5. expiry or material input changes invalidate approval;
6. emit final execution evidence.

## 14. AI agent model

Agents may discover Connected Apps through a filtered capability catalog.

The following are prohibited:

- directly reading credential tables;
- receiving raw OAuth refresh/access tokens;
- inferring scopes from UI labels;
- executing through a provider SDK outside the control plane when the action is governed by Connected Apps;
- treating prior user approval as permanent authorization for unrelated consequential actions.

Agent context should include:

- provider/app display name;
- connection health;
- allowed capability codes;
- whether approval is required;
- safe account/workspace label;
- freshness of provider verification.

## 15. Data retention and deletion

ATLAS adds a stronger layer than ordinary account linking by making data lifecycle visible.

Rules:

- default to transient processing unless persistence is required by a canonical ATLAS module;
- persisted external data must have an owner module and retention policy;
- connection disconnect stops future use immediately;
- disconnect does not automatically assert historical persisted data was deleted;
- deletion requests are independently tracked to completion/failure;
- provider-side deletion/revocation is reported only when verified;
- audit evidence required by security/accounting/compliance policy may be retained under its separate lawful/contractual retention policy, but should avoid raw provider content.

## 16. Error model

Normalize provider failures into safe categories:

- `connection_not_authorized`
- `connection_not_verified`
- `connection_expired`
- `scope_missing`
- `capability_not_supported`
- `permission_denied`
- `approval_required`
- `approval_invalid`
- `provider_rate_limited`
- `provider_unavailable`
- `provider_request_failed`
- `credential_unavailable`
- `organization_mismatch`

Provider error bodies must be sanitized before browser or audit exposure.

## 17. Security requirements

- Organization/tenant scope on every connection operation.
- RLS for browser-readable metadata.
- Service-only access for credentials.
- OAuth state must be single-use, bounded to actor/org/provider, and expire.
- PKCE when supported/appropriate.
- State/callback anti-CSRF protection.
- Redirect URI allowlist.
- Scope allowlist per adapter.
- No dynamic arbitrary OAuth scope strings accepted from browser clients.
- Token refresh server-side only.
- Token/secret masking in logs and errors.
- Provider webhooks require signature verification before state mutation.
- Disconnect/revoke operations are audited.
- High-risk policy changes require elevated permission and may require approval.

## 18. Migration strategy

Adopt providers incrementally.

### Phase 1 — Shared control plane foundation

- permissions;
- normalized connection states;
- provider manifest contract;
- Connected Apps UI;
- access decision engine;
- audit/data ledger;
- Work approval integration;
- compatibility support for existing provider pages.

### Phase 2 — Existing providers

Migrate existing ATLAS adapters such as HubSpot and existing Google/provider authorization flows to register manifests and route governed actions through the shared decision engine without removing working endpoints prematurely.

### Phase 3 — Agent integration

Expose filtered Connected Apps capability discovery to ATLAS Assistant/Agents/Work.

### Phase 4 — Retention automation and broader provider catalog

Add deletion workflows, policy reporting, and additional provider adapters after the foundation is production-verified.

## 19. Routing and navigation

Canonical routes:

- `/settings/connected-apps`
- `/settings/connected-apps/:connectionId`
- `/security/external-access`
- `/assistant/apps` or the existing canonical ATLAS AI Apps surface when route reconciliation identifies it

Existing provider-specific routes may remain as aliases/deep links, but their connection state must come from the same control plane.

No new top-level module is required. Connected Apps is a platform capability exposed through Settings, Security, AI, and Work.

## 20. Accessibility and responsive behavior

- Keyboard-operable catalog, menus, confirmations, and scope disclosures.
- Visible focus states.
- Status not communicated by color alone.
- Proper labels for provider status and risk.
- Mobile/tablet responsive connection cards and detail panels.
- Reduced-motion compliance.
- Confirmation dialogs expose exact consequences in accessible text.

## 21. Testing strategy

TDD is required for implementation.

### Unit tests

- state transition validation;
- capability/scope mapping;
- policy precedence;
- consequential-action defaults;
- safe error normalization;
- retention-state logic;
- provider manifest validation.

### Integration tests

- organization isolation;
- permission enforcement;
- OAuth state lifecycle;
- credential non-disclosure;
- connection verify/reconnect/disconnect;
- access evaluate -> Work approval -> execute flow;
- audit event creation;
- retention/deletion request recording;
- provider adapter contract tests using deterministic fakes where live calls are inappropriate.

### UI tests

- catalog rendering;
- status transitions;
- disabled/gated actions;
- scope disclosure;
- reconnect/disconnect confirmations;
- Security External Access filtering;
- AI Apps only exposing authorized capabilities.

### Production verification

Fail-closed production verification must include the public/authenticated shell route contract appropriate to these new surfaces. A successful web render does not prove provider readiness. Provider-specific live readiness remains separately evidenced.

## 22. Observability

Metrics should include:

- connections by state/provider;
- verification success/failure;
- scope deficiencies;
- provider latency and rate-limit events;
- access decisions by allow/approval/deny;
- approval completion/failure;
- agent/provider action counts;
- disconnect/revoke outcomes;
- retention/deletion backlog.

Metrics must not contain secrets or raw external content.

## 23. Definition of done

The first Connected Apps release is complete only when:

1. one shared organization-scoped connection catalog exists;
2. existing connection primitives are reused rather than duplicated;
3. permissions and RLS are enforced server-side;
4. credentials remain server-only;
5. at least one existing provider adapter is reconciled through the common control plane without regression;
6. read and consequential actions follow the access decision engine;
7. approval-required operations reuse Work OS;
8. agent access is capability-filtered and credential-free;
9. lifecycle, scope, activity, and retention state are visible in the UI;
10. disconnect and deletion-request semantics are truthful;
11. tests, typecheck, build, security checks, and accessibility checks pass;
12. PR is merged only after required CI is green;
13. deployment succeeds;
14. global fail-closed production verification succeeds;
15. provider readiness is not claimed without provider-specific evidence.

## 24. Non-negotiable invariants

- A Connected status never means every provider capability is authorized.
- OAuth consent never overrides ATLAS RBAC/ABAC.
- Agent access never exceeds the initiating actor/organization policy boundary.
- Browser code never receives credential secrets.
- A disconnected app cannot be used for new actions.
- A missing scope cannot be bypassed by UI state.
- Consequential actions cannot silently fall back to direct provider calls.
- ATLAS does not claim third-party data deletion without evidence.
- Existing canonical module sources of truth remain authoritative.
- Production completion requires fail-closed verification evidence.
