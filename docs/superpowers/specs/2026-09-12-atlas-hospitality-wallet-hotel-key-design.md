# ATLAS Hospitality Wallet Hotel Key Design

Date: 2026-09-12
Status: Approved design, pending implementation plan
Owner: ATLAS Hospitality
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/hospitality-wallet-hotel-key`

## 1. Objective

Extend ATLAS Hospitality from provider-aware room-access orchestration into a governed hotel digital-key platform that can consume an authorized hotel reservation/check-in source, validate room assignment and guest eligibility, issue a provider-backed mobile room credential, and deliver a supported Apple Wallet or Google Wallet provisioning flow without exposing lock secrets or bypassing vendor controls.

ATLAS is the orchestration, authorization, tenancy, audit, policy, readiness, and guest-delivery layer. The PMS remains the source of truth for reservation/check-in state. The access-control vendor remains the source of truth for physical lock capability and credential cryptography. Apple Wallet and Google Wallet remain the credential containers and provisioning ecosystems.

The system must never manufacture, clone, reverse engineer, or locally derive hotel lock credentials. It must use only official PMS APIs/webhooks and official access-provider or wallet integrations authorized for the property.

## 2. Product outcome

For an authorized hotel property, a guest who becomes eligible for digital access should be able to receive a room key with minimal staff intervention:

1. A reservation/check-in event enters ATLAS from an approved PMS connector.
2. ATLAS verifies organization, property, reservation, guest eligibility, room assignment, stay window, and provider readiness.
3. ATLAS resolves the property's configured access provider and wallet capabilities.
4. The access provider creates or authorizes the room credential using its official API/SDK/service.
5. ATLAS creates a time-limited wallet-provisioning session/reference.
6. The guest receives an `Add to Apple Wallet` or `Add to Google Wallet` action when supported.
7. The guest completes the wallet platform's required user-consent/provisioning step.
8. ATLAS records the resulting credential reference and lifecycle state.
9. Room changes, checkout, cancellation, security revocation, or provider invalidation revoke or replace the credential through the official provider lifecycle.

ATLAS may automate eligibility, orchestration, creation, delivery, revocation, and audit. It must not claim that a credential has been silently installed into a user's wallet when the wallet platform requires explicit user action or device-side provisioning.

## 3. Scope

### 3.1 In scope

- normalized PMS connector model for Oracle OPERA Cloud/OHIP, Mews, Cloudbeds, Infor HMS, and future certified PMS providers;
- normalized stay/reservation/check-in/room-assignment event model;
- automatic digital-key eligibility evaluation;
- property-level mapping between PMS property/room identifiers and ATLAS property/room identifiers;
- access-provider selection per property;
- Apple Wallet and Google Wallet capability modeling;
- provider-backed wallet credential issuance where official vendor contracts support it;
- wallet provisioning-session generation and delivery;
- guest-facing `Add to Wallet` actions;
- room-change replacement flow;
- checkout/cancellation/revocation flow;
- organization/property/room/reservation scope enforcement;
- RBAC/permissions, audit, readiness, evidence, retries, idempotency, and fail-closed behavior;
- responsive ATLAS Hospitality UI for configuration, readiness, reservations, keys, wallet delivery, and audit;
- deterministic sandbox/mock testing plus vendor-authorized production verification.

### 3.2 Explicitly out of scope

- remote door unlock as an automatic guest workflow;
- raw NFC/RFID payload handling;
- credential cloning, replay, emulation, or master-key generation;
- reverse engineering Vingcard, dormakaba/Saflok, SALTO, Apple, Google, or PMS proprietary protocols;
- storing wallet private keys, vendor cryptographic seeds, encoder secrets, facility codes, master keys, or raw credential material in browser state or business tables;
- silently installing a credential into Apple Wallet or Google Wallet without the wallet platform's required user interaction;
- marking a provider `ready` because configuration values merely exist;
- assuming every hotel uses the same PMS or lock vendor;
- broadening this milestone into payments, loyalty, housekeeping, or remote-unlock automation.

## 4. Supported hotel software strategy

ATLAS must support multiple PMS families rather than assume a single U.S. hotel standard. Initial first-class connector targets are:

### 4.1 Oracle OPERA Cloud / OHIP

Use Oracle Hospitality Integration Platform (OHIP) and its published Hospitality REST APIs. OPERA Cloud has documented external-room-key workflows and is a priority connector for enterprise and branded hotel environments.

ATLAS must treat OHIP application registration, API subscriptions, property identifiers, event subscriptions, and any room-key-specific entitlement as external prerequisites. No Oracle connector becomes production-ready without authorized customer/partner access and a successful non-destructive verification against the intended property.

### 4.2 Mews

Use Mews Open API / Connector API and supported webhooks/events for reservation and operational changes. Partner/certification requirements remain provider-controlled.

ATLAS should normalize Mews reservation/customer/space information into the same internal stay and room-assignment model used by other PMS connectors.

### 4.3 Cloudbeds

Use Cloudbeds PMS APIs and approved integration credentials to read reservation, guest, room, and property state. Cloudbeds credential/Marketplace approval requirements remain external prerequisites.

### 4.4 Infor HMS

Use supported Infor HMS integration interfaces/web services made available to the authorized hotel. ATLAS must not invent undocumented interfaces. If the hotel's Infor deployment exposes only a certified bridge rather than a direct API contract, the connector remains `configured_unverified` until that bridge is authorized and tested.

### 4.5 Generic certified PMS

Future PMS providers implement the normalized PMS connector contract. A generic connector may not report `ready` without an explicit provider identity, property mapping, documented authentication method, event/polling contract, and successful verification.

## 5. Access-control and wallet strategy

ATLAS uses a hybrid model: direct official integrations for major access-control families plus a certified-aggregator fallback where a property uses another supported vendor.

### 5.1 Vingcard

Primary targets:

- Vostio;
- Visionline when supported through an approved interface;
- VConnect or another certified integration path authorized for the property;
- Apple Wallet and Google Wallet room-key capability when the installed Vingcard system, lock firmware, property configuration, and commercial entitlement support it.

ATLAS does not assume wallet support merely because the property uses Vingcard. Wallet capability is a verified property/provider capability.

### 5.2 dormakaba / Saflok

Primary targets:

- Ambiance Cloud;
- approved Ambiance PMS/mobile-access integration;
- Apple Wallet and Google Wallet room-key support when the installed locks/readers, firmware, Ambiance configuration, and property entitlement support it.

### 5.3 SALTO

Primary target for guest wallet keys:

- SALTO Space Hospitality API for supported Apple Wallet guest room keys;
- SALTO WalletHub provisioning flow as defined by SALTO;
- SALTO KS remains a separate access-control integration and must not be treated as equivalent to the Space Hospitality Wallet contract.

SALTO Space wallet support remains limited by the exact official vendor API contract and installed-property prerequisites. ATLAS must preserve those boundaries rather than generalize unsupported behavior.

### 5.4 Certified aggregator fallback

A provider such as an approved hospitality mobile-key aggregator may be represented through the generic certified adapter only when:

- the property authorizes it;
- the aggregator officially supports the installed lock system;
- the integration exposes documented server-side APIs or SDKs;
- ATLAS can verify property and room scope;
- wallet issuance/revocation is auditable;
- no raw credential material is exposed to ATLAS browser clients.

## 6. Architectural principles

1. PMS, ATLAS, access provider, and wallet are separate trust domains.
2. PMS is authoritative for reservation/check-in/checkout/room assignment unless the hotel explicitly configures another source of truth.
3. The access provider is authoritative for lock compatibility and credential lifecycle.
4. Wallet platform state is authoritative for wallet provisioning completion where observable.
5. ATLAS never stores or exposes raw physical-key cryptographic material.
6. Every operation is organization- and property-scoped.
7. Room access is denied unless a verified mapping exists.
8. Automatic issuance requires explicit property-level opt-in and an enabled automation policy.
9. All automatic actions are idempotent and auditable.
10. Provider failures fail closed.
11. Wallet delivery is capability-driven, never inferred only from device user-agent strings.
12. A provider can be `ready` for room mapping but not `ready` for wallet issuance; capability readiness is granular.
13. One property's PMS/access credentials can never be reused for another property.
14. Browser clients receive normalized references, statuses, and provisioning actions only.
15. Unsupported hardware or wallet combinations remain visibly unavailable rather than simulated.

## 7. High-level architecture

```text
PMS / Stay Source
  OPERA | Mews | Cloudbeds | Infor | Certified PMS
             |
             v
ATLAS PMS Connector Layer
  auth + webhook/polling + normalization + idempotency
             |
             v
ATLAS Stay / Assignment Model
  reservation -> eligibility -> room assignment -> validity window
             |
             v
ATLAS Wallet Credential Orchestrator
  policy + permissions + property mapping + readiness + audit
             |
        +----+----+
        |         |
        v         v
Access Provider   Wallet Delivery
Vingcard          Apple Wallet
Dormakaba         Google Wallet
SALTO             provider-specific provisioning handoff
Certified provider
        |
        v
Hotel locks / readers / elevators / approved amenities
```

## 8. Normalized domain model

### 8.1 PMS provider instance

`HospitalityPmsProviderInstance`

- `id`
- `org_id`
- `property_id`
- `provider_type`
- `display_name`
- `state`
- `external_property_id`
- `capabilities`
- `configuration_version`
- `last_verified_at`
- `last_sync_at`
- `last_error_code`
- `created_at`
- `updated_at`

Secrets remain outside the business table in the approved server-side secret mechanism.

### 8.2 Stay / reservation projection

`HospitalityStay`

- `id`
- `org_id`
- `property_id`
- `pms_provider_instance_id`
- `external_reservation_id`
- `external_guest_reference`
- `status`
- `arrival_at`
- `departure_at`
- `checked_in_at`
- `checked_out_at`
- `room_assignment_id`
- `source_version`
- `last_synced_at`

PII stored by ATLAS should be minimized. The credential subsystem should rely on references wherever possible rather than duplicate full guest profiles.

### 8.3 Room assignment

`HospitalityRoomAssignment`

- `id`
- `org_id`
- `property_id`
- `stay_id`
- `atlas_room_id`
- `external_pms_room_id`
- `provider_room_mapping_id`
- `starts_at`
- `expires_at`
- `status`
- `assigned_at`
- `superseded_at`

### 8.4 Wallet credential reference

Extend or supersede the existing `HospitalityCredentialReference` with wallet-aware metadata:

- `id`
- `org_id`
- `property_id`
- `stay_id`
- `room_assignment_id`
- `provider_instance_id`
- `provider_credential_id`
- `wallet_platform`: `apple_wallet | google_wallet | provider_app | none`
- `wallet_state`: `not_requested | eligible | provisioning_ready | provisioned | revoked | expired | failed | unknown`
- `credential_type`: `wallet_mobile_key | mobile_key | rfid_reference`
- `starts_at`
- `expires_at`
- `status`
- `issued_by`
- `issued_at`
- `revoked_at`
- `provider_status_code`

No raw wallet authorization blob, decrypted provision token, key bytes, or private cryptographic material is stored in this business record.

### 8.5 Provisioning session

`HospitalityWalletProvisioningSession`

- `id`
- `org_id`
- `property_id`
- `stay_id`
- `credential_reference_id`
- `wallet_platform`
- `provider_type`
- `state`
- `expires_at`
- `consumed_at`
- `created_at`

The session contains only references and opaque provider-safe material needed to complete the supported wallet handoff. Sensitive transient values must be encrypted/server-side and short-lived, or generated just-in-time without durable persistence when the provider contract permits.

## 9. Normalized PMS connector contract

```ts
interface HospitalityPmsConnector {
  readonly providerType: HospitalityPmsProviderType;
  readonly capabilities: HospitalityPmsCapability[];

  readiness(context: PmsProviderContext): Promise<PmsReadiness>;
  syncReservations?(context: PmsProviderContext, cursor?: string): Promise<PmsSyncResult>;
  getReservation?(context: PmsProviderContext, reservationId: string): Promise<NormalizedStay>;
  verifyRoomAssignment?(context: PmsProviderContext, reservationId: string): Promise<NormalizedRoomAssignment>;
  handleWebhook?(context: PmsProviderContext, event: unknown): Promise<NormalizedPmsEvent[]>;
}
```

Initial PMS capabilities:

- `reservation.read`
- `reservation.events`
- `guest.reference.read`
- `checkin.read`
- `checkout.read`
- `room.assignment.read`
- `room.change.events`
- `property.read`

Connectors must normalize vendor events into ATLAS events rather than leaking vendor-specific payloads across the rest of the domain.

## 10. Wallet and access capabilities

Extend the Hospitality capability vocabulary with:

- `wallet.apple.issue`
- `wallet.apple.provision`
- `wallet.google.issue`
- `wallet.google.provision`
- `wallet.revoke`
- `wallet.status`
- `reservation.checkin.consume`
- `reservation.checkout.consume`
- `room.assignment.sync`
- `room.assignment.change.consume`
- `credential.replace`

Existing capabilities such as `credential.issue`, `credential.revoke`, `credential.status`, `room.mapping.verify`, and `mobile_key.issue` remain valid.

Capability reporting is per provider instance and property. A provider must not advertise Apple/Google wallet capability unless the exact property configuration has been verified.

## 11. Permissions

Extend ATLAS Hospitality permissions with:

- `hospitality.pms.read`
- `hospitality.pms.configure`
- `hospitality.pms.sync`
- `hospitality.wallet.read`
- `hospitality.wallet.issue`
- `hospitality.wallet.revoke`
- `hospitality.wallet.configure`
- `hospitality.wallet.audit`
- `hospitality.wallet.automation.manage`

Automatic issuance executes as a governed service action under an explicit property automation policy, not as an anonymous system bypass. The audit record must identify the automation policy, source event, property, stay, and resulting provider operation.

## 12. Automatic issuance policy

A property may enable `auto_wallet_key_on_checkin` only if all gates pass:

1. PMS provider instance is `ready` for check-in and room-assignment data.
2. Access provider instance is `ready` for the chosen wallet capability.
3. ATLAS property mapping is verified.
4. ATLAS room mapping is verified.
5. Stay is active and eligible.
6. Check-in is confirmed by the authoritative source.
7. A current room assignment exists.
8. Credential validity is bounded by the stay window and property policy.
9. No active credential already exists for the same stay/assignment/platform unless replacement is required.
10. Property automation policy is enabled and versioned.
11. Required guest delivery/contact channel is available or the credential remains `provisioning_ready` without pretending delivery occurred.

If any gate fails, ATLAS records the blocker and does not issue.

## 13. Event model and lifecycle

Normalized event types:

- `reservation.created`
- `reservation.updated`
- `reservation.cancelled`
- `stay.checkin_confirmed`
- `stay.checkout_confirmed`
- `room.assigned`
- `room.changed`
- `room.unassigned`
- `wallet.credential.requested`
- `wallet.credential.issued`
- `wallet.provisioning.ready`
- `wallet.provisioning.completed`
- `wallet.credential.revoked`
- `wallet.credential.expired`
- `wallet.credential.failed`

Every event requires an idempotency key composed from provider/source event identity plus organization/property scope. Duplicate PMS webhooks must not generate duplicate room credentials.

## 14. Check-in flow

1. PMS connector receives or retrieves a check-in event.
2. Connector authenticates and resolves the configured property.
3. Event is normalized and deduplicated.
4. ATLAS updates the stay projection.
5. ATLAS resolves current room assignment.
6. Eligibility policy evaluates check-in, stay window, mapping, provider readiness, permissions, and property policy.
7. If not eligible, ATLAS persists the blocker and stops.
8. If eligible, ATLAS calls the access-provider adapter for the wallet/mobile-key capability.
9. Provider creates the credential/reference.
10. ATLAS stores only normalized credential metadata.
11. ATLAS generates a short-lived wallet provisioning session or provider-supported handoff.
12. Guest delivery surface becomes available.
13. Audit records source event, policy decision, provider request outcome, and provisioning state.

## 15. Apple Wallet flow

Apple Wallet support is provider-specific. ATLAS must not implement a generic home-grown Apple room-key credential format.

For a provider such as SALTO Space Hospitality:

1. ATLAS requests the provider-backed room key through the official Hospitality API.
2. ATLAS obtains the provider-supported provisioning token/reference server-side.
3. ATLAS constructs or requests the Apple provisioning handoff exactly as the vendor/Apple contract requires.
4. Browser/app presents the authorized `Add to Apple Wallet` action.
5. Device-side Apple Wallet provisioning completes under Apple's rules.
6. ATLAS records observable completion/status when supported.

For Vingcard or dormakaba, ATLAS uses their authorized Apple Wallet integration path rather than trying to reuse the SALTO-specific flow.

## 16. Google Wallet flow

Google Hotel Key is a restricted-access wallet program. Production digitization must remain disabled until the required Google agreements/onboarding and access-provider integration prerequisites are complete.

Flow:

1. ATLAS verifies provider/property Google Wallet capability.
2. Access provider creates/authorizes the hotel-key credential through its supported Google Wallet integration.
3. ATLAS creates a short-lived provisioning/delivery session.
4. Guest is presented the authorized Google Wallet add/provision action.
5. Device-side provisioning completes according to Google's hotel-key APIs and provider contract.
6. ATLAS records safe normalized lifecycle state.

ATLAS must not treat ordinary Google Wallet generic passes as equivalent to NFC Hotel Key credentials.

## 17. Room-change flow

A room change is a security-sensitive replacement operation:

1. PMS emits or ATLAS detects a verified room-assignment change.
2. ATLAS resolves the old active credential(s).
3. New room mapping must be verified before replacement.
4. ATLAS requests the new provider credential.
5. Only after the replacement reaches an acceptable provider state does ATLAS revoke/invalidate the old room credential according to provider-safe sequencing.
6. If replacement fails, ATLAS records an operational blocker and does not falsely report success.
7. Audit records both old and new room assignments and credential references.

Provider-specific atomic replacement APIs should be preferred when available.

## 18. Checkout and cancellation

On verified checkout or reservation cancellation:

- active guest room credentials are revoked or invalidated through the official provider lifecycle;
- provisioning sessions are invalidated;
- local ATLAS references move to the normalized revoked/expired state only after evidence from the provider or an explicit reconciled terminal state;
- failures remain visible for staff follow-up;
- no credential secret is logged.

## 19. Readiness model

PMS and access providers use the existing states:

- `not_configured`
- `configured_unverified`
- `ready`
- `degraded`
- `offline`
- `disabled`

Readiness becomes capability-specific. Example:

- Vingcard property: room mapping `ready`, mobile key `ready`, Apple Wallet `ready`, Google Wallet `configured_unverified`;
- SALTO Space property: Apple Wallet `ready`, Google Wallet `not_supported`;
- Infor HMS connector: reservation sync `ready`, webhooks `configured_unverified`.

The UI must never collapse these differences into one misleading green `Connected` state.

## 20. API boundary

The existing `atlas-hospitality-access` Edge Function remains the primary authenticated Hospitality backend boundary unless implementation review proves that a dedicated PMS ingestion webhook function is required.

Likely internal separation:

- `pms/registry.ts`
- `pms/opera.ts`
- `pms/mews.ts`
- `pms/cloudbeds.ts`
- `pms/infor.ts`
- `wallet/orchestrator.ts`
- `wallet/apple.ts`
- `wallet/google.ts`
- `automation/policies.ts`
- `stays/repository.ts`
- `provisioning/repository.ts`
- existing `providers/*`
- shared auth/context/audit/error normalization

Public browser operations should expose normalized APIs such as:

- `GET readiness`
- `GET pms-providers`
- `GET stays`
- `GET wallet-credentials`
- `POST wallet-provisioning-session`
- `POST wallet-revoke`
- `POST wallet-retry`
- `GET audit`

Provider secrets and raw vendor responses are never returned.

## 21. Webhook boundary

PMS webhooks, where available, require a separate unauthenticated-by-user but strongly authenticated provider ingress boundary. That boundary must validate the vendor's documented signature/authentication method before accepting any event.

Requirements:

- provider-specific signature/token validation;
- replay protection when the vendor exposes timestamps/nonces/event IDs;
- organization/property resolution from server-side configuration, never from trusted client input alone;
- idempotency;
- safe raw-event retention policy, preferably minimized/redacted;
- dead-letter/retry behavior;
- audit correlation ID;
- no shared universal webhook secret across properties.

If a PMS lacks suitable webhooks, use governed polling with cursors and rate-limit awareness.

## 22. Data persistence and RLS

Existing Hospitality tables remain authoritative for provider instances, room mappings, and credential references. Add or extend tables only where the data has a distinct lifecycle:

- `hospitality_pms_provider_instances`
- `hospitality_stays`
- `hospitality_room_assignments`
- `hospitality_wallet_provisioning_sessions`
- extensions to `hospitality_credential_references`
- `hospitality_automation_policies`
- `hospitality_integration_events` if the shared ATLAS event/audit system is insufficient for idempotency/evidence

All tables require `org_id`, property scoping where applicable, RLS, timestamps, and non-secret business data only.

## 23. Guest delivery

Supported delivery surfaces may include:

- authenticated ATLAS guest web flow;
- hotel's existing guest app through a provider-supported deep link/SDK flow;
- secure SMS/email link generated by the hotel's authorized communications stack;
- front-desk QR or link handoff when approved by the vendor/wallet platform.

A delivery link must be short-lived, single-purpose, non-enumerable, scoped to one credential/provisioning session, and revocable. The link must not itself contain reusable lock secrets.

The UI must distinguish:

- eligible;
- credential issued;
- wallet provisioning ready;
- wallet added/provisioned when observable;
- failed;
- expired/revoked.

## 24. Security and privacy boundaries

- Never expose PMS client secrets or access-provider secrets to browser code.
- Never log authorization headers, API keys, private certificates, raw provision tokens, authorization blobs, credential keys, or NFC data.
- Minimize guest PII in Hospitality credential tables.
- Use opaque reservation/guest references where possible.
- Enforce RLS and backend organization/property checks.
- Automatic issuance requires an enabled, versioned property policy.
- Delivery sessions expire quickly and are one-purpose.
- All state-changing operations are auditable.
- Cross-property credential issuance is denied even inside the same organization unless the exact mapped property is authorized.
- Provider readiness probes must be non-destructive.
- Wallet/API onboarding restrictions are treated as security/contract gates, not development inconveniences to bypass.
- Remote unlock remains a separate privileged future capability.

## 25. Error normalization

Add normalized categories:

- `pms_not_configured`
- `pms_not_ready`
- `pms_authentication_failed`
- `pms_event_invalid`
- `pms_event_replayed`
- `stay_not_found`
- `stay_not_checked_in`
- `stay_not_eligible`
- `room_assignment_missing`
- `room_assignment_changed`
- `wallet_platform_not_supported`
- `wallet_provider_not_ready`
- `wallet_program_onboarding_required`
- `wallet_credential_issue_rejected`
- `wallet_provisioning_unavailable`
- `wallet_provisioning_expired`
- `wallet_revoke_rejected`
- `automatic_issue_blocked`
- `idempotency_conflict`

Provider-specific safe codes may be attached as metadata without leaking sensitive response bodies.

## 26. UI design

Extend the existing Hospitality navigation without creating a parallel shell.

Recommended surfaces:

- `Overview` — readiness and blockers;
- `PMS` — configured PMS connectors, sync/webhook status;
- `Providers` — Vingcard/dormakaba/SALTO/certified access providers;
- `Rooms` — PMS room ↔ ATLAS room ↔ access-provider room mappings;
- `Stays` — normalized active stays/check-in/room assignment state;
- `Wallet Keys` — credential lifecycle and guest provisioning status;
- `Automation` — property policy for automatic wallet-key issuance/revocation;
- `Audit` — event/decision/provider evidence.

Guest delivery should be separate from administrator configuration. An admin screen must never expose provider secrets or raw provisioning material.

## 27. Automation policy UI

Property administrators with `hospitality.wallet.automation.manage` can configure:

- automatic issuance enabled/disabled;
- eligible stay statuses;
- key activation lead time;
- maximum expiry after scheduled checkout;
- allowed wallet platforms;
- allowed access zones/amenities as supported by provider;
- replacement behavior on room change;
- retry policy;
- manual-review mode;
- emergency kill switch.

Policy changes are versioned and audited. Disabling automation does not silently revoke already-issued credentials unless the administrator explicitly selects a supported revocation action.

## 28. Testing strategy

### Unit

- PMS normalization;
- event idempotency;
- eligibility rules;
- validity windows;
- capability-based wallet selection;
- policy evaluation;
- room-change replacement state machine;
- checkout/cancellation revocation logic;
- secret-redaction contracts.

### Integration

- OPERA/Mews/Cloudbeds/Infor connector contracts through deterministic documented mocks or vendor sandboxes;
- valid/invalid webhook signatures;
- duplicate event handling;
- cross-org/property denial;
- wallet issuance blocked when provider is not ready;
- provisioning session expiry;
- Apple/Google capability divergence;
- room-change replacement;
- checkout revocation;
- persistence/audit failure handling;
- CORS/JWT/browser boundaries for guest/admin flows.

### UI

- PMS/provider/wallet readiness states;
- automation disabled by default;
- issue action hidden/disabled without permission;
- add-to-wallet CTA shown only when a provisioning session is truly ready;
- mobile Safari and Android Chrome responsive behavior;
- no demo or simulated production labels;
- no raw IDs where a safe human-readable label exists.

### Production verification

A property/provider/platform combination is `production_ready` only after an authorized controlled test proves:

1. PMS check-in or approved stay event received;
2. correct room assignment normalized;
3. correct provider/property/room mapping resolved;
4. credential issued through official provider path;
5. wallet provisioning action generated;
6. credential successfully added/provisioned on a supported test device where allowed;
7. door/approved access point works under the vendor-supported test procedure;
8. checkout/revocation invalidates the credential;
9. audit evidence is complete;
10. no secret/credential material appears in browser logs, server logs, database business tables, or Git.

## 29. Rollout order

1. Extend domain types/capabilities for PMS, stays, wallet platforms, and automation.
2. Add schema/RLS for PMS instances, stays, room assignments, provisioning sessions, and automation policies.
3. Implement normalized PMS connector registry and event/idempotency layer.
4. Implement OPERA Cloud/OHIP connector first because Oracle publishes mature hospitality integration APIs and external room-key workflows.
5. Implement Mews and Cloudbeds connectors.
6. Implement Infor HMS connector only against an authorized documented interface for the target property.
7. Extend access-provider adapters with property-specific wallet capabilities.
8. Implement SALTO Space Apple Wallet flow against official Hospitality API requirements.
9. Implement Vingcard Apple/Google wallet flows only with authorized integration credentials/docs for the target property.
10. Implement dormakaba Apple/Google wallet flows only with authorized integration credentials/docs for the target property.
11. Implement generic certified provider fallback.
12. Add Wallet Credential Orchestrator and automatic issuance policy engine.
13. Add Hospitality admin UI and guest wallet-delivery flow.
14. Run full TDD/unit/integration/typecheck/build/security/mobile verification.
15. Perform controlled provider-specific production validation property by property.

## 30. External prerequisites and blockers

Implementation can build the normalized architecture, schema, policies, event model, UI, mocks, and fail-closed adapters without live hotel credentials.

Real production issuance remains blocked per property until the relevant external requirements are satisfied, including as applicable:

- PMS customer/partner API access;
- PMS property IDs and authorized event subscriptions;
- access-provider credentials and property/system identifiers;
- compatible lock hardware/firmware;
- mobile-key/wallet licensing or commercial entitlement;
- Apple Wallet provider-specific onboarding/authorization;
- Google Hotel Key NDA/API terms/access when required;
- vendor sandbox or controlled production test capability;
- property authorization to issue guest digital credentials.

ATLAS must surface the exact blocker instead of simulating readiness.

## 31. Migration from current ATLAS Hospitality

The existing multi-provider room-access subsystem remains the foundation.

Preserve:

- `atlas-hospitality-access` authenticated backend boundary;
- provider registry;
- Vingcard, dormakaba, SALTO, and generic provider types;
- provider readiness states;
- organization/property scoped provider instances;
- room mappings;
- credential references;
- explicit Hospitality permissions;
- fail-closed provider behavior;
- existing `/hospitality/access/*` surfaces.

Extend rather than replace:

- `HospitalityCapability`;
- `HospitalityCredentialReference`;
- provider adapters;
- readiness response;
- audit events;
- UI navigation and operational dashboard.

Add PMS ingestion and wallet orchestration as new bounded subsystems behind the existing Hospitality boundary.

## 32. Definition of done

This milestone is complete only when:

- PMS connector abstraction exists and OPERA/Mews/Cloudbeds/Infor provider types are represented;
- PMS events normalize into organization/property-scoped stay and room-assignment state;
- duplicate events cannot issue duplicate credentials;
- access-provider wallet capabilities are explicit and property-verified;
- Apple Wallet and Google Wallet are modeled separately;
- automatic issuance is disabled by default and controlled by versioned property policy;
- credential issuance requires verified check-in/stay eligibility and verified room mapping;
- wallet provisioning uses only official provider/platform contracts;
- guest consent/device provisioning requirements are truthfully represented;
- room changes replace/revoke credentials safely;
- checkout/cancellation revokes credentials through the provider lifecycle;
- no raw lock/wallet secret material is exposed to the browser or persisted in business tables;
- RLS and backend checks enforce organization/property isolation;
- all automated decisions and provider actions are auditable;
- unit/integration/UI/security/mobile tests pass;
- unsupported vendor/platform combinations fail closed;
- at least one authorized provider/PMS/wallet combination is verified end-to-end on a controlled hotel property before ATLAS marks that combination production-ready.

## 33. Official integration references used for design

- Oracle Hospitality Integration Platform / OHIP and external room-key workflows.
- Mews Open API / Connector API.
- Cloudbeds PMS API developer platform.
- Infor HMS official product and integration documentation.
- Vingcard mobile wallet hotel-key solutions.
- dormakaba room key in Apple Wallet and Hotel Key in Google Wallet.
- SALTO Space Hospitality API and WalletHub provisioning flow.
- Google Wallet Hotel Key onboarding/API documentation.

Vendor documentation and commercial/API contracts remain authoritative. If an implementation detail in this design conflicts with a current vendor contract, the provider contract wins and the ATLAS adapter must be updated through a reviewed change rather than bypassed.
