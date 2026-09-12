# ATLAS Connect — Social Accounts Center Design

Date: 2026-09-12
Status: Approved design specification
Owner module: ATLAS Connect
Secondary integrations: ATLAS Identity, ATLAS Studio / Creator, Security, Settings, Audit
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch for eventual integration: `main`

## 1. Purpose

Build a tenant-aware ATLAS Accounts Center for connecting, inspecting, governing, and using external social/business identities without conflating third-party accounts with ATLAS users.

The visual reference is a Meta/Facebook Accounts Center notification showing several Facebook, Instagram, and WhatsApp identities grouped under one account center. ATLAS must interpret that pattern as a product requirement: one ATLAS organization may govern multiple external identities and assets, and those connections must be reusable by authorized ATLAS modules.

The implementation must not reproduce the screenshot as a static interface. It must provide a functional ATLAS-native experience with real provider state, real authorization boundaries, and auditable actions.

## 2. Scope

This design includes:

- a new ATLAS Connect account-management surface;
- organization-scoped external account records;
- provider connection lifecycle and verified state;
- OAuth/provider authorization boundaries;
- permission and capability inspection;
- reconnection and disconnection workflows;
- audit history for sensitive connection events;
- reusable account selection for ATLAS Studio / Creator publishing;
- responsive desktop, tablet, and mobile UX;
- empty, loading, success, degraded, expired, revoked, and error states;
- initial provider architecture capable of supporting Meta assets without assuming every personal Meta account is API-manageable.

This design does not include:

- automatic posting without explicit permission and a supported provider capability;
- scraping credentials or sessions from consumer apps;
- storage of raw provider passwords;
- fabricated `connected`, `live`, or `online` states;
- silent tracking or identity correlation outside authorized organization context;
- direct support for unsupported personal Facebook, Instagram, or WhatsApp capabilities;
- automatic use of paid provider services without authorization.

## 3. Existing ATLAS Context

The canonical repository already has:

- `apps/web` as the primary application;
- ATLAS Identity backed by Supabase Auth and active-organization validation;
- protected ATLAS Studio routes;
- Creator Studio provider-readiness states that explicitly distinguish configured from unconfigured providers;
- Supabase as the primary backend platform direction;
- repository-wide tenancy, RBAC, auditability, and no-fake-state requirements.

ATLAS Identity currently treats `/finance`, `/health`, and `/studio` as valid post-auth destinations. The implementation of ATLAS Connect must extend that target policy to `/connect` without weakening redirect validation.

No equivalent social accounts center was found in the current default-branch code search. The implementation must still re-scan the target branch before introducing schema, services, or utilities, because adjacent work may land before implementation begins.

## 4. Architectural Decision

ATLAS Connect is the system owner for external account connections.

ATLAS Identity remains responsible for:

`ATLAS user -> authenticated session -> active organization -> permission`

ATLAS Connect is responsible for:

`organization -> provider authorization -> external account/asset -> granted capabilities -> health/state -> audit`

ATLAS Studio / Creator and future modules consume ATLAS Connect records through a stable account-selection interface. They must not own duplicate OAuth state, token storage, connection metadata, or provider health logic.

This separation prevents three failure modes:

1. treating third-party accounts as ATLAS users;
2. duplicating provider connections inside every module;
3. allowing publishing UIs to infer connection state from stale client-side data.

## 5. Routes and Navigation

Primary user-facing routes:

- `/connect/accounts` — account center list and health overview;
- `/connect/accounts/:accountId` — account detail;
- `/connect/accounts/:accountId/permissions` — granted capabilities and ATLAS access policy;
- `/connect/accounts/:accountId/activity` — connection/audit activity;
- `/connect/providers` — provider readiness and configuration boundary.

Creator integration:

- `/studio/publish` — destination selection and publishing workflow using eligible ATLAS Connect accounts.

Navigation depth:

`ATLAS -> Connect -> Accounts -> Account detail -> Permissions / Activity -> Action`

Every level must offer coherent return navigation through the existing ATLAS shell pattern, breadcrumbs, tabs, or equivalent navigation already used by the application.

The implementation must update ATLAS Identity target validation so authenticated redirects to `/connect...` remain internal and safe.

## 6. UX Design

### 6.1 Accounts Center

The account center should show one card/row per external account or provider asset returned from a verified connection.

Each item may display, when provider data actually supplies it:

- provider logo;
- display name;
- handle or provider identifier;
- account/asset type;
- owning ATLAS organization;
- verified connection state;
- last successful verification/sync time;
- capability summary;
- warning or action required state.

Supported actions, subject to RBAC and provider capability:

- Connect account;
- Reconnect;
- Refresh status;
- Manage permissions;
- Open activity;
- Disconnect.

No item may display `Connected` solely because a database row exists. Connected state requires a successful provider-side or server-verified credential/capability check that meets the provider adapter contract.

### 6.2 States

The shared connection state model is:

- `unconfigured` — provider integration is not configured for this environment;
- `authorization_required` — provider exists but no valid organization authorization is present;
- `connecting` — an authorization flow is in progress;
- `connected` — authorization is verified and required provider checks pass;
- `degraded` — authorization remains valid but one or more requested capabilities/assets are unhealthy or unavailable;
- `expired` — credentials/session require renewal;
- `revoked` — the provider or authorized user revoked access;
- `error` — a provider/server error prevents reliable determination or use.

UI language must distinguish provider state from ATLAS permission state. An account can be provider-connected while the current ATLAS user lacks permission to use it.

### 6.3 Empty and configuration states

If no accounts exist, show a real empty state with provider connection actions available only when configuration and RBAC permit them.

If provider configuration is missing, show `Configuration required` and the exact missing dependency category without exposing secrets.

## 7. Provider Adapter Boundary

Provider-specific behavior must live behind an adapter/service contract rather than inside React components.

The logical adapter responsibilities are:

- generate authorization URL / initiate authorization;
- validate callback state;
- exchange authorization code server-side;
- discover authorized accounts/assets;
- map provider capabilities to ATLAS capabilities;
- verify credential health;
- refresh/renew credentials when supported;
- revoke/disconnect when supported;
- normalize provider errors;
- expose provider identifiers needed for auditable downstream actions.

The first Meta adapter must not assume that consumer identities visible in Meta Accounts Center are all available through business APIs.

Examples of capability constraints that must be respected:

- Facebook publishing generally applies to provider-authorized Page/business assets rather than arbitrary personal profiles;
- Instagram publishing depends on provider-supported professional/business/creator account relationships and granted scopes;
- WhatsApp automation must be based on supported WhatsApp Business assets/APIs rather than a personal WhatsApp session unless an explicitly supported provider integration exists.

ATLAS stores and exposes only assets returned by the authorized provider flow.

## 8. Data Model

These are logical entities. Before creating schema, implementation must search for an equivalent existing ATLAS table/service and reuse it where possible.

### 8.1 Provider connection

Represents one organization-level authorization to a provider.

Required logical fields:

- `id`;
- `organization_id`;
- `provider`;
- `provider_connection_id` when available;
- `status`;
- `credential_reference` or equivalent server-side encrypted secret reference;
- `granted_scopes`;
- `expires_at` when applicable;
- `last_verified_at`;
- `last_error_code` / sanitized error metadata;
- `created_by`;
- `created_at`;
- `updated_at`;
- `revoked_at` when applicable.

### 8.2 External account / asset

Represents a provider-returned account, Page, professional profile, WhatsApp Business account, channel, or other authorized destination.

Required logical fields:

- `id`;
- `organization_id`;
- `provider_connection_id`;
- `provider`;
- `provider_account_id`;
- `account_type`;
- `display_name`;
- `handle` when available;
- `avatar_url` when provider-authorized and safe to store/use;
- `status`;
- normalized capabilities;
- `last_synced_at`;
- `created_at`;
- `updated_at`.

### 8.3 Audit event

Sensitive events must be emitted through the existing ATLAS audit mechanism if one exists. Do not create a parallel audit source of truth unless the repository truly lacks one.

Events should include, as applicable:

- authorization initiated;
- authorization completed;
- authorization failed;
- account discovered;
- permissions/scopes changed;
- reconnect completed/failed;
- status refreshed;
- disconnect requested;
- provider revocation completed/failed;
- publish destination selected;
- publish action attempted/result recorded by the publishing subsystem.

Audit records must contain actor, organization, target, action, result, timestamp, and sanitized evidence/provider identifiers where safe.

## 9. Token and Secret Handling

Provider access/refresh credentials must never be returned to the browser or stored in ordinary frontend state.

Requirements:

- OAuth code exchange occurs server-side;
- use PKCE when supported/appropriate;
- state/nonce must be cryptographically strong and bound to the initiating authenticated user, organization, provider, redirect target, and expiration;
- callback must reject missing, expired, replayed, mismatched, or cross-tenant state;
- tokens must be stored encrypted at rest or referenced through an approved secrets/credential service appropriate to the existing Supabase/ATLAS architecture;
- application logs and audit messages must never contain raw access tokens, refresh tokens, authorization codes, client secrets, passwords, or recovery codes;
- revocation/disconnect must invalidate local usability even when provider-side revocation cannot be confirmed;
- credential rotation/refresh must update state atomically where possible.

## 10. RBAC and Tenancy

Every read/write must be organization-scoped and subject to ATLAS authorization.

Logical permissions to map onto the existing ATLAS permission model:

- read connected accounts;
- manage provider authorization;
- inspect granted capabilities;
- reconnect or disconnect accounts;
- use an account as a publishing destination;
- view audit activity.

Implementation must reuse existing permission primitives if equivalent permission names/policies already exist.

RLS/server authorization must prevent:

- cross-organization account discovery;
- cross-organization token use;
- unauthorized connection management;
- using an account for publishing when the user lacks both account-use and publishing authority.

Frontend hiding is not an authorization boundary.

## 11. OAuth / Connection Flow

Happy path:

`User opens Connect -> selects provider -> ATLAS verifies session/org/RBAC -> server creates expiring authorization transaction -> provider consent -> callback validates state -> server exchanges code -> provider adapter discovers authorized assets -> ATLAS persists/updates connection + assets -> provider verification succeeds -> state becomes connected -> audit event -> user returns to account center`

Failure paths must cover:

- cancelled consent;
- invalid/replayed state;
- callback for wrong organization/user;
- missing provider configuration;
- code exchange failure;
- insufficient scopes;
- no supported assets returned;
- expired credentials;
- revoked credentials;
- provider outage/rate limit;
- partial asset failure.

No failure path should silently downgrade into `connected`.

## 12. Creator Studio Integration

Creator Studio must consume ATLAS Connect rather than creating its own provider-account store.

Publishing flow:

`Creator asset/content -> Publish -> eligible organization accounts -> destination capability check -> user selects destination -> permission verification -> provider publish action -> provider result/id -> ATLAS audit/result state`

Rules:

- only `connected` accounts with the required normalized capability are selectable;
- degraded/expired/revoked accounts are visible only when useful for diagnosis and must not be actionable as valid publish destinations;
- Creator must show a clear configuration/reconnect action when no eligible destinations exist;
- no publish success state may be shown until a provider response confirms an accepted/successful operation according to that provider contract;
- background completion, if required by a provider, must remain pending until verified.

## 13. API / Service Shape

Exact endpoints depend on existing repository/backend patterns, but the implementation should expose stable logical operations equivalent to:

- list organization accounts;
- get account detail;
- get account capabilities/permissions;
- initiate provider authorization;
- handle provider callback;
- refresh/verify provider connection;
- reconnect;
- disconnect/revoke;
- list provider readiness;
- resolve eligible publishing destinations.

Client code must not call provider OAuth/token endpoints directly when secrets or credential exchange are involved.

## 14. Error Handling and Observability

Provider errors must be normalized into user-safe status and operator-safe diagnostics.

User-facing errors should answer:

- what failed;
- whether the account is still usable;
- what action the user can take;
- whether ATLAS will retry automatically.

Operator diagnostics should preserve correlation IDs, provider request IDs when safe, adapter error class, organization ID, connection ID, and timestamp without secrets.

Health/status refresh must use bounded retry/backoff and respect provider rate limits.

## 15. Accessibility and Responsive Requirements

The Accounts Center must work on desktop, tablet, and mobile.

Requirements include:

- keyboard-accessible actions and tabs;
- visible focus states;
- semantic status text in addition to color;
- screen-reader labels for provider/account actions;
- responsive cards/tables without horizontal action loss;
- loading/error/success messages announced appropriately;
- confirmation flow for disconnect/revocation actions;
- no critical information encoded only in icons.

## 16. Testing Strategy

Implementation must use TDD and include focused tests before implementation changes.

### Unit tests

- connection state normalization;
- provider capability mapping;
- safe redirect target support for `/connect`;
- OAuth state validation;
- provider error normalization;
- publishing eligibility rules.

### Integration tests

- identity-gated `/connect` routes;
- organization isolation;
- account list/detail permission enforcement;
- connect callback success/failure;
- reconnect and disconnect behavior;
- provider configuration-required state;
- Creator destination resolution using ATLAS Connect;
- no `connected` state without verification.

### UI tests

- empty, loading, connected, degraded, expired, revoked, and error states;
- disabled actions when permission/capability is absent;
- mobile/tablet/desktop navigation depth;
- accessible names and keyboard flow.

### Full verification before completion

Run the repository-required checks, including:

- `npm run typecheck`;
- `npm test`;
- `npm run build`.

Also verify affected routes do not return 404/500, no secrets were introduced, tenancy cannot be bypassed, and adjacent ATLAS Studio/Identity behavior has not regressed.

Real provider end-to-end testing requires authorized provider configuration. If credentials or provider approval are unavailable, tests must stop at the real dependency boundary and report that limitation rather than fabricate a live integration.

## 17. Migration and Rollout

Implementation should be incremental:

1. shared domain/state model and permission contract;
2. protected `/connect` route shell and account center UI states;
3. server-side persistence/RLS using existing schema primitives where possible;
4. provider adapter contract and configuration readiness;
5. first authorized provider flow;
6. account discovery and health verification;
7. disconnect/reconnect/audit;
8. Creator destination integration;
9. responsive/accessibility hardening;
10. full regression verification.

No production deployment is part of this specification approval. Merge/deploy remain separate approval boundaries.

## 18. Acceptance Criteria

The feature is acceptable only when all applicable criteria below are verified:

1. ATLAS has a protected `/connect/accounts` experience within the existing application shell.
2. External accounts are organization-scoped and not modeled as ATLAS users.
3. Provider connection status is derived from verified server/provider state.
4. Missing provider configuration produces a truthful configuration state.
5. OAuth/provider credentials never reach client-visible state or repository secrets.
6. Callback state protects against replay, mismatch, open redirect, and cross-tenant use.
7. RBAC is enforced server-side for connection management and account use.
8. Account list/detail/permissions/activity navigation works end to end.
9. Disconnect/reconnect operations produce auditable results.
10. Creator Studio obtains publishing destinations from ATLAS Connect instead of a duplicate store.
11. Unsupported personal Meta account capabilities are not presented as available.
12. Empty/loading/error/degraded/expired/revoked/success states are real and test-covered.
13. Desktop, tablet, and mobile layouts remain usable.
14. Typecheck, tests, and production build pass before merge is proposed.
15. No merge, production deployment, or paid-provider action occurs without its required approval.

## 19. Non-Goals / Future Extensions

The architecture should permit later adapters for providers such as LinkedIn, X, YouTube, TikTok, Google Business Profile, Microsoft, or other authorized channels, but those integrations are outside this implementation unless separately specified and approved.

Future channel additions must reuse the same ATLAS Connect account model and capability contract rather than creating channel-specific account centers.
