# ATLAS CRM + HubSpot Integration Design

Date: 2026-09-14
Status: Approved design, pending implementation plan review
Owner: ATLAS CRM
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-crm-hubspot-integration`

## 1. Objective

Create ATLAS CRM as a first-class module inside the existing ATLAS Enterprise Suite and connect it to HubSpot through the existing ATLAS integration architecture rather than building a parallel application or a HubSpot-specific silo.

ATLAS remains responsible for identity, organization/tenant isolation, RBAC, orchestration, audit, approvals, UI, and cross-module coordination. HubSpot remains the source of truth for connected CRM records during the first production milestone.

The initial production milestone is intentionally read-only for HubSpot business data: ATLAS may connect or disconnect the HubSpot account and read supported CRM objects, but it must not create, edit, delete, merge, or otherwise mutate HubSpot contacts, companies, deals, tickets, activities, products, line items, pipelines, or configuration.

## 2. Current repository truth

The canonical repository already contains the foundations this feature must reuse:

- `apps/web` as the primary web application;
- `AtlasShell` for authenticated organization context and module navigation;
- `packages/core/src/scope.ts` for tenant + organization isolation;
- `packages/core/src/permissions.ts` for authorization;
- `packages/core/src/audit.ts` for normalized audit events;
- `packages/core/src/integrations.ts` for provider connection state and the rule that a connection may only report connected when authorization and provider verification both succeed;
- `packages/core/src/index.ts` for the current Google integration gateway types and OAuth helpers;
- `supabase/functions/atlas-google-connect` and `_shared/google-oauth.ts` for server-side OAuth initiation patterns;
- `supabase/migrations/20260906034500_google_workspace_integration.sql` for short-lived OAuth state persistence;
- existing Supabase RLS, identity membership, and organization permission patterns.

The repository does not currently contain a production ATLAS CRM module or a HubSpot provider adapter.

The implementation must preserve the existing Google Workspace integration and must not rewrite historical migrations.

## 3. External platform direction

ATLAS will use a HubSpot project-based public app with OAuth for multi-tenant installations.

For new token work, ATLAS will target HubSpot's date-based OAuth API family rather than the deprecated v1 token endpoints. The implementation baseline is the supported `2026-03` OAuth family unless a newer date-based version is explicitly verified during implementation and adopted consistently.

Relevant OAuth operations are:

- authorization through HubSpot's normal app install/authorization flow;
- authorization-code exchange through the supported date-based OAuth token endpoint;
- refresh-token exchange through the same supported token endpoint;
- token introspection through the supported date-based introspection endpoint;
- token revocation through the supported date-based revoke endpoint.

Client credentials, refresh tokens, access tokens, encryption keys, and app secrets are server-side only.

ATLAS will not use a HubSpot legacy private app as the default multi-tenant architecture. Service Keys may be supported later for explicitly single-account system-to-system deployments, but they are not the P0 path because ATLAS CRM is designed for multiple organizations and future webhook support.

## 4. P0 product scope

P0 provides a production-safe read-only CRM bridge with these capabilities:

- expose ATLAS CRM as a real module in the authenticated ATLAS shell;
- connect one HubSpot account to one ATLAS organization through OAuth;
- verify the connected HubSpot account before reporting `connected`;
- disconnect/revoke an existing HubSpot connection;
- read Contacts;
- read Companies;
- read Deals;
- read Tickets when the authorized account and scopes support them;
- read supported engagement/activity types needed for customer history, including tasks, calls, meetings, notes, and emails when the authorized account and scopes support them;
- read object associations;
- search/filter through provider-backed queries rather than fake local data;
- paginate using provider cursors;
- show truthful empty, loading, degraded, expired, revoked, and error states;
- preserve a minimal external-object linkage layer for downstream ATLAS references without copying entire HubSpot records into ATLAS by default;
- record auditable connection, verification, sync/read, disconnect, denial, and failure events.

## 5. Explicit P0 non-goals

P0 does not:

- create or edit HubSpot CRM records;
- delete or merge HubSpot records;
- alter HubSpot pipelines or properties;
- create custom HubSpot objects;
- copy the full HubSpot CRM database into Supabase;
- claim bidirectional synchronization;
- implement HubSpot webhooks;
- implement marketing automation;
- implement HubSpot CMS functionality;
- use HubSpot as the accounting source of truth;
- turn HubSpot Product or Line Item records into ATLAS ledger entries automatically;
- expose provider access/refresh tokens to the browser;
- display `Connected`, `Live`, `Online`, or equivalent unless a live server-side verification has succeeded.

## 6. Architectural model

```text
ATLAS Identity
    -> Organization / Tenant
    -> RBAC
    -> ATLAS CRM
    -> ATLAS Integration Gateway
    -> HubSpot Provider Adapter
    -> HubSpot APIs
    -> Normalized ATLAS CRM View Models
    -> Audit / Evidence
```

The HubSpot adapter is server-side. Browser code calls ATLAS backend boundaries only and never calls HubSpot with provider credentials directly.

ATLAS CRM consumes provider-neutral normalized models so that a future Salesforce, Dynamics, Zoho, or native ATLAS CRM provider does not require rewriting the UI.

## 7. Integration provider model

Extend the existing provider model instead of creating a second integration framework.

Canonical provider identifiers:

```ts
type IntegrationProvider = 'google' | 'hubspot';
```

Canonical connection states remain aligned with `packages/core/src/integrations.ts`:

```ts
type IntegrationConnectionState =
  | 'unconfigured'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'revoked'
  | 'error';
```

`connected` requires all of the following:

1. ATLAS session authenticated;
2. organization membership active;
3. caller authorized to manage the integration;
4. OAuth authorization completed;
5. token exchange succeeded;
6. token introspection succeeded;
7. provider account identity captured;
8. a live HubSpot API probe succeeded with the granted scopes.

If any required probe fails, the connection must not be represented as connected.

## 8. Permission model and compatibility reconciliation

The repository currently has two integration permission vocabularies: TypeScript exposes `integrations.read`, `integrations.write`, and `integrations.admin`, while the existing Supabase Google migration uses `integrations.manage`.

P0 must reconcile this without breaking Google.

Canonical new permission vocabulary:

- `integrations.read`
- `integrations.write`
- `integrations.admin`
- `crm.read`
- `crm.sync`
- `crm.admin`

Compatibility rule:

- `integrations.manage` remains accepted server-side as a deprecated compatibility alias for `integrations.admin` while Google is migrated;
- no new UI or provider code should introduce additional checks against `integrations.manage`;
- existing Google authorization must continue to function during the transition;
- role mappings should grant owner/admin the canonical permissions through the identity permission tables;
- CRM read access is separate from integration administration.

Connection/disconnection requires `integrations.admin` or the compatibility alias while it exists.

Reading CRM data requires `crm.read` or `crm.admin`.

Manual refresh/sync metadata actions require `crm.sync` or `crm.admin`.

## 9. Persistent data model

### 9.1 `atlas_integration_connections`

One row represents a provider connection for an ATLAS organization.

Fields:

- `id uuid primary key`
- `org_id uuid not null`
- `provider text not null`
- `state text not null`
- `provider_account_id text`
- `provider_account_label text`
- `granted_scopes text[] not null default '{}'`
- `credential_ref uuid`
- `last_verified_at timestamptz`
- `last_success_at timestamptz`
- `last_error_code text`
- `last_error_at timestamptz`
- `connected_by uuid`
- `connected_at timestamptz`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(org_id, provider)` for the first milestone;
- provider constrained to supported values;
- no access token, refresh token, client secret, or encryption key in this table.

### 9.2 `atlas_integration_credentials`

Dedicated server-only encrypted credential storage.

Fields:

- `id uuid primary key`
- `org_id uuid not null`
- `provider text not null`
- `ciphertext text not null`
- `iv text not null`
- `algorithm text not null default 'AES-GCM-256'`
- `key_version text not null`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Security rules:

- `anon` receives no privileges;
- `authenticated` receives no direct table privileges;
- browser clients cannot select, insert, update, or delete rows;
- only the approved server-side runtime/service role may access encrypted credentials;
- encryption/decryption key material is supplied through server-side ATLAS secrets, never stored in the table;
- disconnect/revoke removes or invalidates the provider credential material;
- logs must never include plaintext tokens.

### 9.3 `atlas_external_object_links`

Minimal linkage metadata used to relate ATLAS references to provider objects without persisting complete CRM records.

Fields:

- `id uuid primary key`
- `org_id uuid not null`
- `provider text not null`
- `provider_account_id text not null`
- `provider_object_type text not null`
- `provider_object_id text not null`
- `atlas_object_type text`
- `atlas_object_id uuid`
- `last_seen_at timestamptz not null`
- `source_updated_at timestamptz`
- `source_fingerprint text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique key:

`(org_id, provider, provider_account_id, provider_object_type, provider_object_id)`

This table stores linkage and reconciliation metadata only. It does not become a shadow CRM database.

### 9.4 `atlas_integration_sync_runs`

Audit-friendly operational records for explicit reads/refreshes.

Fields:

- `id uuid primary key`
- `org_id uuid not null`
- `provider text not null`
- `operation text not null`
- `object_type text`
- `status text not null`
- `cursor_in text`
- `cursor_out text`
- `records_observed integer not null default 0`
- `started_by uuid`
- `started_at timestamptz not null default now()`
- `completed_at timestamptz`
- `error_code text`
- `evidence_ref text`

No business PII is required in this table.

## 10. OAuth state reuse

Do not create a second OAuth state table.

Extend the existing `atlas_oauth_states.provider` constraint from Google-only to the provider registry used by ATLAS, including `hubspot`.

OAuth states remain:

- short-lived;
- one-time use;
- scoped to `org_id` and `user_id`;
- hashed/opaque at rest where applicable;
- invalid after consumption or expiration;
- protected against cross-organization replay.

HubSpot OAuth callback processing must verify the stored state before token exchange persistence is finalized.

## 11. Credential encryption contract

A server-only `IntegrationCredentialVault` abstraction owns credential encryption/decryption.

Equivalent interface:

```ts
interface IntegrationCredentialVault {
  seal(input: {
    organizationId: string;
    provider: IntegrationProvider;
    credential: ProviderCredentialPayload;
  }): Promise<SealedCredential>;

  open(input: {
    organizationId: string;
    provider: IntegrationProvider;
    credentialRef: string;
  }): Promise<ProviderCredentialPayload>;

  destroy(input: {
    organizationId: string;
    provider: IntegrationProvider;
    credentialRef: string;
  }): Promise<void>;
}
```

The implementation must use authenticated encryption. The browser never receives plaintext provider credentials.

## 12. HubSpot provider adapter contract

The adapter presents a provider-neutral read interface.

```ts
type CrmObjectType =
  | 'contact'
  | 'company'
  | 'deal'
  | 'ticket'
  | 'task'
  | 'call'
  | 'meeting'
  | 'note'
  | 'email';

interface CrmReadAdapter {
  readonly provider: 'hubspot';

  readiness(context: CrmProviderContext): Promise<CrmProviderReadiness>;
  getAccountIdentity(context: CrmProviderContext): Promise<CrmProviderAccount>;
  listObjects(
    context: CrmProviderContext,
    request: CrmListRequest
  ): Promise<CrmPage>;
  searchObjects(
    context: CrmProviderContext,
    request: CrmSearchRequest
  ): Promise<CrmPage>;
  getObject(
    context: CrmProviderContext,
    request: CrmGetRequest
  ): Promise<CrmRecord>;
  listAssociations(
    context: CrmProviderContext,
    request: CrmAssociationRequest
  ): Promise<CrmAssociationPage>;
}
```

No P0 adapter method exposes create/update/delete semantics.

## 13. Normalized CRM view model

HubSpot-specific property names stay inside the provider adapter and mapping layer.

ATLAS UI consumes normalized models:

### Contact

- provider reference
- display name
- first name
- last name
- primary email when scope permits
- primary phone when scope permits
- lifecycle/status fields when available
- associated companies
- associated deals
- last provider update timestamp

### Company

- provider reference
- name
- domain when available
- industry when available
- phone when available
- associated contacts
- associated deals
- last provider update timestamp

### Deal / Opportunity

- provider reference
- name
- amount/currency when available
- pipeline
- stage
- close date
- associated contact/company references
- last provider update timestamp

### Ticket / Service Case

- provider reference
- subject/title
- pipeline
- stage/status
- priority when available
- associated contact/company/deal references
- last provider update timestamp

### Activity

- provider reference
- activity type
- subject/title
- occurred/due timestamp
- owner reference when available
- association references
- safe preview/summary only when authorized by the granted provider scope

ATLAS must not infer fields that the provider did not return.

## 14. Provider object mapping

ATLAS terminology maps HubSpot objects as follows:

- HubSpot Contact -> ATLAS Contact
- HubSpot Company -> ATLAS Account
- HubSpot Deal -> ATLAS Opportunity
- HubSpot Ticket -> ATLAS Service Case
- HubSpot Task/Call/Meeting/Note/Email -> ATLAS Activity

Product and Line Item integrations are deferred to the future ATLAS Commerce Bridge. They must not be posted to ATLAS Accounting automatically.

## 15. API and backend boundaries

Create a server-side ATLAS CRM boundary rather than exposing provider URLs to the web app.

Primary Edge Function direction:

`supabase/functions/atlas-crm-hubspot`

Supported P0 operations:

- `oauth.prepare`
- `oauth.callback`
- `connection.status`
- `connection.disconnect`
- `crm.list`
- `crm.search`
- `crm.get`
- `crm.associations`
- `crm.refresh`

Each operation must:

1. validate method and CORS;
2. authenticate the ATLAS bearer session where applicable;
3. resolve active organization membership;
4. enforce organization scope;
5. enforce the exact ATLAS permission;
6. load the same organization's provider connection;
7. obtain provider credentials only through the server credential vault;
8. refresh provider tokens when needed;
9. call HubSpot server-side;
10. normalize the response;
11. emit audit/sync metadata;
12. return no provider credential material.

OAuth callback is the only browser-originated flow that may arrive without the normal ATLAS bearer header after HubSpot redirect. It must instead validate the previously persisted one-time state and bind the completed installation back to the originating ATLAS user and organization.

## 16. Frontend module and routes

Create:

`apps/web/src/modules/business/crm/`

Primary routes:

```text
/crm
/crm/contacts
/crm/contacts/:providerId
/crm/companies
/crm/companies/:providerId
/crm/deals
/crm/deals/:providerId
/crm/service
/crm/service/:providerId
/crm/activities
/crm/integrations
/crm/integrations/hubspot
```

The ATLAS shell receives a CRM navigation entry. CRM uses the existing authenticated organization context rather than introducing a separate login, tenant selector, or shell.

## 17. CRM UX behavior

### CRM home

Shows provider-neutral operational entry points and truthful connection state. No invented pipeline totals or sample revenue values in production mode.

### Lists

Contacts, Accounts, Opportunities, Service Cases, and Activities support:

- provider-backed search;
- provider-backed filters where supported;
- pagination;
- loading state;
- empty state;
- degraded/error state;
- row/detail navigation;
- provider source indicator;
- last-read/last-provider-update metadata where available.

### Details

Detail routes display normalized fields and associations. Unsupported or unauthorized properties are omitted rather than replaced with fake values.

### Integration settings

`/crm/integrations/hubspot` shows:

- unconfigured;
- authorizing;
- connected;
- degraded;
- expired;
- revoked;
- error.

Actions:

- Connect HubSpot;
- Retry verification;
- Refresh connection status;
- Disconnect HubSpot with confirmation.

The page may show provider account ID/label, granted scope summary, verification timestamp, and safe error code. It must never render token material.

## 18. Search and pagination behavior

Search is never implemented as client-side filtering over a tiny first page while pretending to search the full CRM.

ATLAS forwards supported search filters to the HubSpot adapter and normalizes the response.

Pagination uses provider cursor/continuation semantics. ATLAS may encode opaque cursors for its own API response, but it must preserve deterministic forward navigation and must not expose secrets in cursor data.

## 19. Rate limits and resilience

HubSpot throttling and transient failures are normalized into ATLAS-safe error classes.

The adapter must distinguish at least:

- unauthenticated/expired credential;
- forbidden/missing provider scope;
- not found;
- validation error;
- rate limited;
- upstream unavailable;
- malformed provider response;
- unknown upstream error.

`429` handling honors provider retry metadata when available. P0 does not implement uncontrolled background retry loops.

A token refresh failure transitions the connection to `expired` or `error` based on the provider response and prevents false connected state.

## 20. Audit model

Sensitive and administrative actions create ATLAS audit records with at least:

- organization scope;
- actor ID;
- action;
- resource;
- result (`success`, `denied`, `failed`);
- occurred timestamp;
- evidence reference when available.

Required audited events include:

- HubSpot connect initiated;
- OAuth callback accepted/rejected;
- provider verification success/failure;
- connection disconnected/revoked;
- CRM list/search/get request success/failure at operational granularity;
- permission denial;
- tenant/scope mismatch;
- token refresh failure;
- provider throttling when it affects an ATLAS operation.

Audit logs must not contain CRM record payloads or provider secrets by default.

## 21. Tenant isolation and RLS

Every persistent integration row is organization-scoped.

RLS and backend logic must ensure:

- Organization A cannot observe Organization B connection metadata;
- Organization A cannot use Organization B credential reference;
- external object links cannot cross organizations;
- sync-run history cannot cross organizations;
- OAuth state cannot be replayed across organizations;
- one HubSpot installation cannot silently replace another organization's connection.

Service-role access is limited to Edge Function/backend operations that have already authenticated and authorized the originating ATLAS context.

## 22. Sensitive-data policy

P0 minimizes duplicated CRM data.

ATLAS does not persist complete HubSpot contact/company/deal/ticket/activity payloads by default. The browser receives only the normalized response needed for the active UI operation.

If a later ATLAS feature requires local persistence of CRM business fields, that change requires a separate data-classification and retention review.

Highly sensitive provider properties are not requested unless a future feature has a documented need, explicit permission, and an approved storage/display policy.

## 23. Disconnect behavior

Disconnect is a real operation.

Expected sequence:

1. verify ATLAS session and integration-admin permission;
2. load the same organization's HubSpot connection;
3. attempt provider-side revocation using the supported OAuth revoke operation when a valid credential exists;
4. destroy ATLAS encrypted credential material regardless of whether the remote revoke call is already invalid/expired;
5. transition the local connection to `revoked`;
6. preserve non-secret audit evidence;
7. do not delete unrelated CRM/audit history automatically.

The UI requires explicit confirmation before disconnect.

## 24. Future phases

### Phase 1 after P0: governed write operations

Potential capabilities:

- create/update Contact;
- create/update Company;
- create/update Deal;
- create/update Ticket;
- create Activity;
- association management.

Each mutation must add explicit permissions, idempotency, validation, audit, and Approval Center integration where business risk warrants it.

### Phase 2: webhook/event synchronization

Use a project-based HubSpot app webhook capability for near-real-time changes. Webhook signature verification, replay protection, event deduplication, tenant routing, and dead-letter handling are mandatory.

### Phase 3: ATLAS-native CRM authority

Only after a separate architecture decision may ATLAS become the source of truth for native CRM records with bidirectional reconciliation to HubSpot and other providers.

## 25. Testing requirements

P0 requires automated coverage for:

- provider enum extension without Google regression;
- integration permission compatibility mapping;
- HubSpot OAuth state creation, expiry, one-time consumption, and cross-org rejection;
- credential vault encrypt/decrypt/destroy behavior without plaintext leakage;
- connection state transitions;
- connected-state truth rule;
- token refresh handling;
- provider scope denial;
- CRM record normalization;
- search translation;
- pagination/cursor handling;
- association normalization;
- tenant isolation;
- RLS contract;
- Edge Function auth and CORS;
- disconnect/revoke behavior;
- CRM routes;
- shell navigation;
- loading/empty/error/degraded states;
- accessibility basics for navigation, forms, status messaging, and dialogs;
- regression coverage for Google integration, Identity, shell, and existing modules.

Before completion, run from repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

No task may be declared production-ready from unit tests alone.

## 26. Production verification gates

A production-ready claim requires evidence that:

1. HubSpot app/client configuration exists in the authorized environment;
2. callback URI exactly matches the ATLAS production callback;
3. server encryption secret is configured;
4. Supabase migrations are applied;
5. Edge Function is deployed;
6. authenticated ATLAS organization can initiate OAuth;
7. HubSpot authorization completes;
8. token introspection identifies the expected HubSpot account;
9. live provider probe succeeds;
10. UI reports connected only after that probe;
11. Contacts/Companies/Deals read successfully for an authorized account;
12. unsupported objects/scopes degrade truthfully;
13. another organization cannot access the connection;
14. disconnect revokes/destroys credentials and changes UI state;
15. no access token, refresh token, app secret, encryption key, or CRM payload is exposed in browser logs or committed files;
16. affected production routes return no 404/500 errors.

## 27. Definition of done

The P0 milestone is done only when ATLAS contains a real authenticated CRM module backed by the HubSpot provider adapter, uses the canonical tenant/RBAC/audit architecture, has a verified OAuth connection, reads supported HubSpot CRM data without fake metrics, isolates organizations, protects provider credentials server-side, passes the repository validation commands, and has production evidence for the supported flow.

If HubSpot application credentials, Supabase production access, encryption secrets, or another external dependency is not available during implementation, the code must stop at that real dependency boundary and report exactly what remains. The UI must not simulate a live connection.
