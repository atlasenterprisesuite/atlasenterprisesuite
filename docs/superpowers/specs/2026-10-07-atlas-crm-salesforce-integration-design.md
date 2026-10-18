# ATLAS CRM + Salesforce Integration Design

Date: 2026-10-07
Status: Phase 0 implementation in progress
Owner: ATLAS CRM
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-crm-salesforce-integration`

## 1. Objective

Add Salesforce as a governed CRM provider inside the existing ATLAS Integration Gateway and CRM contracts without creating a Salesforce-specific silo.

ATLAS remains authoritative for tenant isolation, RBAC, orchestration, audit, evidence, UI, and cross-module coordination. Salesforce remains an external CRM provider. The UI must consume provider-neutral ATLAS CRM models so HubSpot, Salesforce, and future providers can coexist.

## 2. Evidence available

A Salesforce Environment Switcher screenshot supplied on 2026-10-07 shows two separate entries labeled as Production for the same user identity:

- `ATLAS ENTERPRISE SUITE`
- `Atlas Enterprise Suite`

The environment cards expose different Salesforce hostnames, which is sufficient to treat them as distinct candidate production organizations, but not sufficient to identify the canonical organization.

No deletion, consolidation, migration, or write operation is permitted until both orgs are inventoried by immutable Salesforce Organization ID.

## 3. Phase 0 repository changes

Phase 0 is intentionally non-destructive:

- register `salesforce` in the canonical ATLAS integration provider registry;
- generalize core CRM provider types from HubSpot-only to `hubspot | salesforce`;
- extend unit coverage so both CRM providers compile and preserve the provider-neutral contract;
- do not add credentials, secrets, OAuth values, or live Salesforce mutations.

## 4. Canonical org discovery gate

Before ATLAS may call a Salesforce connection `connected`, it must verify all of:

1. authenticated ATLAS user and active organization membership;
2. explicit ATLAS integration permission;
3. Salesforce OAuth authorization;
4. token exchange success;
5. live identity probe;
6. immutable Salesforce Organization ID captured;
7. instance URL captured;
8. org edition and My Domain captured when available;
9. API probe succeeds;
10. duplicate-org policy evaluated against any existing Salesforce connection for the ATLAS organization.

The two screenshot environments remain `unverified` until this gate succeeds.

## 5. Duplicate production organization policy

For each candidate Salesforce org, ATLAS must record:

- Salesforce Organization ID;
- org name;
- instance URL;
- My Domain;
- edition;
- user identity used for authorization;
- enabled API capabilities/scopes;
- Connected Apps relevant to ATLAS;
- custom objects;
- Apex classes/triggers;
- Flows;
- permission sets;
- integration users;
- record counts for Accounts, Contacts, Leads, Opportunities, Cases, and Activities;
- last modified metadata timestamps where available.

A canonical production org is selected only from evidence. The other org is classified as one of:

- `secondary-production`
- `legacy`
- `migration-source`
- `test-misclassified-as-production`
- `unknown`

No destructive action is taken automatically.

## 6. Salesforce object normalization

Initial read mapping:

- Salesforce Account -> ATLAS Account
- Salesforce Contact -> ATLAS Contact
- Salesforce Lead -> ATLAS Lead
- Salesforce Opportunity -> ATLAS Opportunity
- Salesforce Case -> ATLAS Service Case
- Salesforce Task/Event -> ATLAS Activity

Provider-specific Salesforce fields remain inside the adapter/mapping layer.

## 7. Backend boundary

Planned server boundary:

`supabase/functions/atlas-crm-salesforce`

P0 operations:

- `oauth.prepare`
- `oauth.callback`
- `connection.status`
- `connection.verify`
- `connection.disconnect`
- `crm.list`
- `crm.search`
- `crm.get`
- `crm.associations`
- `org.inventory`

The browser never receives Salesforce access or refresh tokens.

## 8. OAuth direction

Use Salesforce OAuth 2.0 through a Connected App or External Client App appropriate to the target Salesforce org and current Salesforce platform requirements.

Secrets remain server-side. OAuth state is organization- and user-bound, short-lived, single-use, and replay-resistant.

ATLAS must never infer that an Environment Switcher card is the correct production org simply from its display label.

## 9. Security and audit

All connection and CRM operations inherit the existing ATLAS controls:

- tenant/org scope;
- RBAC;
- encrypted credential vault;
- fail-closed connected-state truth;
- audit event emission;
- evidence references;
- no plaintext provider secrets in logs;
- no cross-org credential reuse.

Required audit events include authorization initiation, callback accept/reject, org identity verification, org inventory, read operations, permission denials, token failures, throttling, disconnect, and duplicate-org classification.

## 10. Delivery phases

Phase 0: provider registry + provider-neutral core contracts.

Phase 1: authenticated org inventory and canonical-org selection.

Phase 2: read-only Salesforce CRM adapter.

Phase 3: governed write operations with explicit permission, idempotency, validation, approvals, and audit.

Phase 4: CDC/Platform Events or webhook-style event ingestion only after replay protection, deduplication, tenant routing, and dead-letter handling are implemented.

## 11. Current blocker

The ChatGPT Salesforce connector is not available in the current session, and the available browser automation profile has no saved Salesforce login. Therefore live inspection of the two Salesforce production orgs cannot be truthfully completed yet.

The next external step is a one-time authenticated Salesforce browser/profile connection, after which ATLAS can inventory both orgs and select the canonical production organization using immutable IDs rather than labels.

## 12. Definition of done for Phase 0

Phase 0 is complete only when:

- `salesforce` is present in the canonical provider registry;
- CRM core types support both HubSpot and Salesforce;
- unit coverage exercises both provider IDs;
- existing HubSpot behavior remains compatible;
- CI passes on the implementation branch;
- no live-connection claim is made without provider verification.
