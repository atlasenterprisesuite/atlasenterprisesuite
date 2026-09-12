# ATLAS Hospitality Multi-Provider Room Access Design

Date: 2026-09-11
Status: Approved design, pending implementation plan
Owner: ATLAS Hospitality
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/hospitality-room-access`

## 1. Objective

Extend the existing ATLAS Hospitality room-access foundation into a governed multi-provider integration layer capable of supporting authorized hotel access-control systems from Vingcard, dormakaba/Saflok, SALTO, and future certified providers without exposing raw credential material, master keys, encoder secrets, or low-level device commands to browser clients.

ATLAS remains the orchestration, authorization, tenant-isolation, audit, and UX layer. Each physical access-control platform remains the source of truth for lock hardware, credential issuance semantics, and vendor-specific cryptographic operations.

## 2. Product scope

The first production scope is intentionally narrow:

- discover provider readiness for an authorized hotel property;
- map ATLAS property and room identifiers to provider-side entities;
- issue a guest or authorized-staff room credential through an official provider integration;
- revoke or cancel an issued credential through the same provider;
- read provider-side credential status when supported;
- preserve tenant, organization, user, role, property, room, assignment, validity, provider, and outcome metadata in ATLAS audit trails;
- expose truthful configuration states such as `not_configured`, `configured_unverified`, `ready`, `degraded`, and `offline`;
- keep unsupported capabilities disabled rather than simulating them.

Direct remote door opening is out of scope for this implementation milestone. If introduced later, it must be a separate privileged capability with explicit permission, step-up authentication, reason capture, audit, and property-level enablement.

## 3. Supported provider families

### 3.1 Vingcard

Primary integration direction:

- VConnect PMS Integration Platform;
- Vostio Access Management;
- Visionline where an approved VConnect/certified interface is available.

Public Vingcard material confirms that VConnect connects PMS platforms with access management, supports automated key creation/cancellation, and bridges cloud or on-premise PMS environments to Vostio and Visionline. ATLAS will not reverse engineer proprietary protocols or invent private endpoints. A provider instance becomes `ready` only after the property has supplied or obtained the official interface, credentials, identifiers, and required certification/partner access.

### 3.2 dormakaba / Saflok

Primary integration direction:

- Ambiance Cloud PMS Bridge;
- Ambiance SOAP API where contractually enabled;
- approved Ambiance/LGS REST integration where vendor documentation and credentials are supplied;
- FIAS/PMS bridge only when the hotel and vendor explicitly authorize that deployment model.

Public dormakaba material confirms Ambiance Cloud PMS Bridge support and documented PMS interfaces including FIAS and SOAP. ATLAS will not hard-code undocumented proprietary payloads, ports, or encoder commands into browser code or shared generic logic.

### 3.3 SALTO

Primary integration direction:

- SALTO KS Connect API for supported cloud-managed installations;
- SALTO Space Hospitality interfaces where the installed property system requires Space rather than KS.

SALTO publishes an OpenAPI-based Connect API supporting sites, locks, users, access groups, schedules, keys, and related access-control objects. ATLAS will authenticate server-side using the integration model authorized by SALTO and the property. Any digital-key material remains under SALTO's security model and is not copied into ATLAS browser state.

### 3.4 Generic certified provider

A generic adapter contract will support future vendors without adding vendor logic to the ATLAS UI or authorization layer. Generic adapters must implement the same normalized contract and may not report `ready` until an explicit readiness probe has verified the configured provider instance.

## 4. Architectural principles

1. One ATLAS domain model, multiple provider adapters.
2. No provider secret, token, certificate private key, master key, raw RFID/NFC payload, encoder secret, or low-level programming command is returned to the browser.
3. Provider integrations execute server-side through Supabase Edge Functions or another approved ATLAS backend boundary.
4. Every request is scoped to the authenticated ATLAS organization and mapped property.
5. Sensitive operations require explicit ATLAS authorization in addition to any provider-side authorization.
6. Provider readiness is evidence-based, never inferred from environment variables merely being present.
7. Vendor failures are normalized without losing useful provider status/error metadata needed for operations and audit.
8. No provider adapter may bypass the vendor's supported API, PMS bridge, certified interface, or approved SDK.
9. ATLAS stores references and audit metadata, not vendor cryptographic secrets.
10. Property configuration is isolated so one hotel's provider credentials or room mappings cannot affect another property or tenant.

## 5. Normalized domain model

### 5.1 Provider instance

`HospitalityProviderInstance`

- `id`
- `org_id`
- `property_id`
- `provider_type`
- `display_name`
- `state`
- `provider_property_id`
- `capabilities`
- `configuration_version`
- `last_verified_at`
- `last_error_code`
- `created_at`
- `updated_at`

No credential secret values are stored in this business table. Secret material stays in the approved secrets store/runtime environment.

### 5.2 Room mapping

`HospitalityRoomMapping`

- `id`
- `org_id`
- `property_id`
- `provider_instance_id`
- `atlas_room_id`
- `provider_room_id`
- `provider_lock_id` when required and safe to persist as an identifier
- `status`
- `last_verified_at`

### 5.3 Issued credential reference

`HospitalityCredentialReference`

- `id`
- `org_id`
- `property_id`
- `room_id`
- `provider_instance_id`
- `provider_credential_id`
- `assignment_reference`
- `credential_type`
- `starts_at`
- `expires_at`
- `status`
- `issued_by`
- `issued_at`
- `revoked_at`
- `provider_status_code` when appropriate

The record stores an external reference, not the raw key or credential payload.

## 6. Provider adapter contract

Each adapter implements a server-side interface equivalent to:

```ts
interface HospitalityAccessAdapter {
  readonly providerType: HospitalityProviderType;
  readonly capabilities: HospitalityProviderCapabilities;

  readiness(context: ProviderContext): Promise<ProviderReadiness>;
  listRooms?(context: ProviderContext): Promise<ProviderRoom[]>;
  issueCredential(context: ProviderContext, request: IssueCredentialRequest): Promise<IssueCredentialResult>;
  revokeCredential(context: ProviderContext, request: RevokeCredentialRequest): Promise<RevokeCredentialResult>;
  credentialStatus?(context: ProviderContext, providerCredentialId: string): Promise<CredentialStatusResult>;
}
```

The normalized result must include a provider reference, normalized state, timestamp, and safe provider metadata. It must never include raw key bytes, cryptographic seeds, master-key material, or encoder secrets.

## 7. Capability model

Provider capabilities are explicit rather than assumed:

- `credential.issue`
- `credential.revoke`
- `credential.status`
- `room.list`
- `room.mapping.verify`
- `mobile_key.issue`
- `rfid_reference.issue`
- `audit.read` when vendor-supported and contractually enabled

Future capabilities such as `door.remote_open` are not inherited automatically. They require a separate design and permission boundary.

## 8. Authorization model

Initial permission vocabulary:

- `hospitality.access.read`
- `hospitality.access.issue`
- `hospitality.access.revoke`
- `hospitality.access.configure`
- `hospitality.access.audit`
- `hospitality.access.admin`

Role-to-permission mapping should be resolved by the existing ATLAS authorization architecture rather than hard-coded indefinitely to `owner/admin`. The current role checks in the room-access foundation are an interim gate and should be replaced with explicit permission evaluation during implementation.

Credential issuance requires:

1. authenticated ATLAS user;
2. active organization membership;
3. property access within the same organization;
4. `hospitality.access.issue` or admin equivalent;
5. verified provider instance state `ready`;
6. verified room mapping;
7. non-empty assignment/reservation reference;
8. valid start/expiry window;
9. provider request accepted successfully.

Revocation requires equivalent scope checks plus `hospitality.access.revoke`.

## 9. Readiness state machine

Provider instance states:

- `not_configured`: required provider configuration is absent;
- `configured_unverified`: configuration exists but no successful provider probe has completed;
- `ready`: authentication, provider/property identity, and required capability probe succeeded;
- `degraded`: provider responds but one or more required capability checks fail;
- `offline`: provider cannot be reached or authentication is currently unusable;
- `disabled`: property administrator intentionally disabled the provider instance.

A provider may transition to `ready` only after a live server-side verification. UI labels such as Connected, Live, Online, or Ready must derive from this state.

## 10. Request flow

### 10.1 Issue credential

1. Browser submits room, property, assignment reference, credential type, validity, and reason to the ATLAS Hospitality Edge Function.
2. Edge Function authenticates the Supabase session.
3. ATLAS resolves organization membership and explicit permission.
4. ATLAS loads the provider instance for that same organization/property.
5. ATLAS verifies state `ready` and required capability.
6. ATLAS resolves and verifies the room mapping.
7. ATLAS calls the selected provider adapter.
8. Provider performs credential issuance using its official supported integration.
9. ATLAS persists only the normalized credential reference and safe status metadata.
10. ATLAS writes an audit event.
11. Browser receives normalized success/failure state and reference identifier.

### 10.2 Revoke credential

The same authorization and scope pipeline applies. The provider credential reference is resolved from ATLAS persistence, the adapter performs the supported cancellation/revocation operation, and ATLAS records the final normalized state and audit result.

## 11. Provider-specific configuration

### 11.1 Vingcard

Configuration metadata may include:

- provider mode: `vconnect`, `vostio`, or approved `visionline` integration;
- provider property/location identifier;
- certified integration identifier if applicable;
- server-side endpoint/configuration reference;
- secret reference names.

No Vingcard provider instance may be marked ready until a supported interface and successful authenticated property-level probe are available.

### 11.2 dormakaba / Saflok

Configuration metadata may include:

- provider mode: `ambiance_cloud`, `ambiance_soap`, `ambiance_rest`, or approved `pms_bridge`;
- property/system identifier;
- server-side endpoint reference;
- secret/certificate reference names;
- integration version.

ATLAS must treat installation-specific Ambiance/LGS interfaces as vendor-controlled contracts. Unsupported or undocumented command paths remain disabled.

### 11.3 SALTO

Configuration metadata may include:

- provider mode: `salto_ks` or approved `salto_space_hospitality`;
- site/property identifier;
- OpenID/OAuth client reference;
- API environment;
- secret reference names.

For KS, readiness should verify authentication and confirm the configured site exists and is accessible to the integration before the instance becomes ready.

## 12. Data persistence and RLS

Supabase tables introduced for this subsystem must include `org_id` and property scoping. RLS must enforce organization isolation and, where the existing model supports it, property-level access.

Required tables:

- `hospitality_provider_instances`
- `hospitality_room_mappings`
- `hospitality_credential_references`

Sensitive configuration values must not be stored in these tables. Use runtime secrets or an approved encrypted secret-management mechanism.

Audit events continue through the shared ATLAS `audit_logs` mechanism unless a newer canonical audit service supersedes it before implementation.

## 13. UI

Route ownership remains:

- `/hospitality`
- `/hospitality/access`
- `/hospitality/access/providers`
- `/hospitality/access/rooms`
- `/hospitality/access/credentials`
- `/hospitality/access/audit`

The existing Room Access page becomes the operational dashboard rather than a single-provider form.

Required UI states:

- provider cards with truthful readiness;
- property selector constrained to current organization;
- room mapping status;
- issue credential form;
- active/revoked/expired credential reference table;
- revoke action when permission allows;
- audit view when permission allows;
- loading, empty, disabled, error, success, degraded, and offline states;
- responsive desktop/tablet/mobile layouts.

The UI never accepts or displays raw provider secrets.

## 14. Error normalization

Normalized categories:

- `authentication_required`
- `authorization_denied`
- `organization_mismatch`
- `property_mismatch`
- `provider_not_configured`
- `provider_not_ready`
- `provider_authentication_failed`
- `provider_unreachable`
- `room_mapping_missing`
- `room_mapping_invalid`
- `credential_issue_rejected`
- `credential_revoke_rejected`
- `provider_response_invalid`
- `persistence_failed`
- `audit_failed`

Provider-specific error codes may be preserved as safe metadata but must not leak secrets, sensitive headers, or credential material.

## 15. Security boundaries

- All provider calls are server-side.
- Provider credentials are never committed to Git.
- Browser receives only normalized identifiers and statuses.
- Raw card sectors, NFC/RFID dumps, master keys, facility secrets, cryptographic seeds, encoder control commands, and vendor private keys are never exposed by ATLAS APIs.
- Provider-instance configuration and credential operations are tenant/property scoped.
- Issuance and revocation are auditable.
- Logs must redact authorization headers and secret values.
- Production must use HTTPS/TLS and vendor-supported authentication mechanisms.
- A compromised browser session must not be sufficient to retrieve vendor credentials.
- Provider readiness probes must avoid destructive actions.

## 16. Testing strategy

### Unit tests

- adapter registry selects the correct adapter;
- unsupported provider type fails closed;
- permission checks for read/issue/revoke/configure/audit;
- provider readiness state transitions;
- room mapping scope validation;
- validity-window validation;
- provider result normalization;
- audit payload excludes sensitive material.

### Integration tests

Use vendor sandbox/test environments or deterministic mock servers that reproduce documented API contracts without generating real physical credentials.

Test:

- authentication success/failure;
- property/site discovery where supported;
- issue normalized success;
- issue provider rejection;
- revoke normalized success;
- provider timeout/offline handling;
- cross-organization access denial;
- missing room mapping denial;
- persistence/audit behavior.

### UI tests

- protected routes;
- provider readiness cards;
- issue disabled unless provider is ready and permission exists;
- revoke visibility by permission/status;
- error/success states;
- responsive layouts.

### Production verification

A provider is considered production-ready only when an authorized property executes a controlled vendor-supported test against its actual configured integration and the resulting credential lifecycle is verified end-to-end without bypassing vendor controls.

## 17. Migration from current foundation

The existing `AuthorizedRoomAccessProvider` and single provider environment variables are replaced by a provider registry and per-property provider-instance configuration.

The existing `atlas-hospitality-access` Edge Function remains the public ATLAS backend boundary, but its internals are separated into:

- request authorization;
- provider-instance resolution;
- room mapping;
- adapter registry;
- provider adapters;
- persistence;
- audit;
- normalized API responses.

The current browser route and navigation are preserved and expanded rather than replaced.

## 18. Rollout order

1. Normalize provider contract and authorization permissions.
2. Add Supabase schema/RLS for providers, room mappings, and credential references.
3. Refactor Edge Function into provider registry + adapters.
4. Implement SALTO KS first because public API documentation is sufficiently explicit for development against an authorized test site.
5. Implement Vingcard VConnect adapter to the official interface supplied for the authorized property/integrator account.
6. Implement dormakaba Ambiance/Saflok adapter to the official interface supplied for the authorized property.
7. Add generic certified-provider adapter contract.
8. Expand Room Access UI into provider/room/credential/audit surfaces.
9. Run unit, integration, typecheck, build, security, and responsive verification.
10. Perform provider-specific controlled production validation only after credentials, authorization, and property mappings are verified.

## 19. External dependency boundaries

Implementation can proceed fully through provider abstraction, schema, permissions, UI, tests, and SALTO contract support using public documentation.

Real Vingcard and dormakaba issuance remains blocked until their authorized vendor-specific integration documentation/credentials are available for the target hotel property. ATLAS must expose this exact blocker rather than emulate a live integration.

## 20. Definition of done

This multi-provider milestone is complete only when:

- provider registry and normalized contract exist;
- Vingcard, dormakaba/Saflok, SALTO, and generic provider types are represented;
- all provider instances fail closed until verified;
- explicit Hospitality permissions replace broad role-only issuance checks;
- Supabase persistence and RLS enforce organization/property isolation;
- room mappings are verified before issuance;
- credential issue/revoke flows are auditable;
- no raw key material or provider secrets reach browser responses or logs;
- SALTO adapter passes contract tests against documented behavior;
- Vingcard and dormakaba adapters accurately expose `not_configured`/`configured_unverified` until official property integrations are available;
- typecheck, unit tests, integration tests, production build, route checks, and responsive verification pass;
- production status is not claimed until a real authorized provider/property validation succeeds.
