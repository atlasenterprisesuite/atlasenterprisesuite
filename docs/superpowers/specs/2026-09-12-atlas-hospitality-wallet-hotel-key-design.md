# ATLAS Hospitality Wallet Hotel Key Design

Date: 2026-09-12
Status: Approved design, pending implementation plan
Owner: ATLAS Hospitality
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/hospitality-wallet-hotel-key`

## 1. Objective

Extend ATLAS Hospitality from provider-aware room-access orchestration into a governed hotel digital-key platform that consumes an authorized hotel reservation/check-in source, validates room assignment and guest eligibility, issues a provider-backed mobile room credential, and delivers a supported Apple Wallet or Google Wallet provisioning flow without exposing lock secrets or bypassing vendor controls.

ATLAS is the orchestration, authorization, tenancy, audit, policy, readiness, and guest-delivery layer. The PMS remains the source of truth for reservation/check-in state. The access-control vendor remains the source of truth for physical lock capability and credential cryptography. Apple Wallet and Google Wallet remain the credential containers and provisioning ecosystems.

The system must never manufacture, clone, reverse engineer, or locally derive hotel lock credentials. It uses only official PMS APIs/webhooks and official access-provider or wallet integrations authorized for the property.

## 2. Product outcome

For an authorized hotel property, a guest who becomes eligible for digital access should be able to receive a room key with minimal staff intervention:

1. A reservation/check-in event enters ATLAS from an approved PMS connector.
2. ATLAS verifies organization, property, reservation, guest eligibility, room assignment, stay window, and provider readiness.
3. ATLAS resolves the property's configured access provider and wallet capabilities.
4. The access provider creates or authorizes the room credential through its official API/SDK/service.
5. ATLAS creates a short-lived wallet-provisioning session/reference.
6. The guest receives an `Add to Apple Wallet` or `Add to Google Wallet` action when supported.
7. The guest completes the wallet platform's required user-consent/device provisioning step.
8. ATLAS records the resulting credential reference and lifecycle state.
9. Room changes, checkout, cancellation, security revocation, or provider invalidation revoke or replace the credential through the official provider lifecycle.

ATLAS may automate eligibility, orchestration, creation, delivery, revocation, and audit. It must not claim that a credential has been silently installed into a user's wallet when the wallet platform requires explicit user action.

## 3. Scope

### 3.1 In scope

- normalized PMS connector model for Oracle OPERA Cloud/OHIP, Mews, Cloudbeds, Infor HMS, and future certified PMS providers;
- normalized stay/reservation/check-in/room-assignment event model;
- automatic digital-key eligibility evaluation;
- PMS property/room to ATLAS property/room mappings;
- access-provider selection per property;
- Apple Wallet and Google Wallet capability modeling;
- provider-backed wallet credential issuance where official vendor contracts support it;
- wallet provisioning-session generation and guest delivery;
- room-change replacement;
- checkout/cancellation/revocation;
- RBAC/permissions, audit, readiness, evidence, retries, idempotency, and fail-closed behavior;
- responsive admin and guest wallet-delivery UI;
- deterministic mocks/sandboxes plus vendor-authorized production verification.

### 3.2 Explicitly out of scope

- remote door unlock as an automatic guest workflow;
- raw NFC/RFID payload handling;
- credential cloning, replay, emulation, or master-key generation;
- reverse engineering Vingcard, dormakaba/Saflok, SALTO, Apple, Google, or PMS proprietary protocols;
- storing wallet private keys, vendor cryptographic seeds, encoder secrets, facility codes, master keys, or raw credential material in browser state or business tables;
- silently installing a credential into Apple Wallet or Google Wallet without required user interaction;
- marking a provider `ready` because configuration values merely exist;
- assuming every hotel uses the same PMS or lock vendor;
- payments, loyalty, housekeeping automation, or remote-unlock automation.

## 4. Supported hotel software strategy

ATLAS supports multiple PMS families rather than assuming a single U.S. hotel standard.

### 4.1 Oracle OPERA Cloud / OHIP

Use Oracle Hospitality Integration Platform (OHIP) and published Hospitality REST APIs. OPERA Cloud has documented external-room-key workflows and is the first implementation target.

Application registration, API subscriptions, property identifiers, event subscriptions, and room-key entitlements remain external prerequisites. No Oracle connector becomes production-ready without authorized access and a successful non-destructive property-level verification.

### 4.2 Mews

Use Mews Open API / Connector API and supported operational event mechanisms. Normalize Mews reservation/customer/space data into the same ATLAS stay and room-assignment model.

### 4.3 Cloudbeds

Use Cloudbeds PMS APIs and approved integration credentials for reservation, guest reference, room, and property state. Marketplace/partner approval requirements remain external prerequisites.

### 4.4 Infor HMS

Use supported Infor HMS integration interfaces/web services made available to the authorized hotel. ATLAS does not invent undocumented interfaces. If the property exposes only a certified bridge, the connector remains `configured_unverified` until that bridge is authorized and tested.

### 4.5 Generic certified PMS

Future PMS providers implement the same normalized connector contract. A generic connector cannot report `ready` without documented authentication, property mapping, event/polling behavior, and successful verification.

## 5. Access-control and wallet strategy

ATLAS uses a hybrid model: direct official integrations for major access-control families plus a certified-aggregator fallback where required.

### 5.1 Vingcard

Targets include Vostio, Visionline through an approved interface, VConnect/certified integration paths, and Apple Wallet/Google Wallet capability where the property's installed hardware, firmware, configuration, and entitlement support it.

Wallet support is verified per property; it is never inferred from the Vingcard brand alone.

### 5.2 dormakaba / Saflok

Targets include Ambiance Cloud, approved PMS/mobile-access integration, and Apple Wallet/Google Wallet hotel-key capability where installed locks/readers, firmware, Ambiance configuration, and entitlement support it.

### 5.3 SALTO

Primary guest-wallet target is SALTO Space Hospitality API with WalletHub for supported Apple Wallet guest room keys. SALTO KS remains a separate access-control integration and is not treated as equivalent to the Space Hospitality Wallet contract.

### 5.4 Certified aggregator fallback

A certified mobile-key aggregator may be represented through the generic provider adapter only when the property authorizes it, it officially supports the installed lock system, it exposes documented server-side integration, property/room scope can be verified, and wallet issuance/revocation is auditable.

## 6. Architectural principles

1. PMS, ATLAS, access provider, and wallet are separate trust domains.
2. PMS is authoritative for reservation/check-in/checkout/room assignment unless the property explicitly configures another approved source of truth.
3. The access provider is authoritative for lock compatibility and credential lifecycle.
4. Wallet state is authoritative for wallet provisioning completion where observable.
5. ATLAS never stores or exposes raw physical-key cryptographic material.
6. Every operation is organization- and property-scoped.
7. Room access is denied unless the exact room mapping is verified.
8. Automatic issuance requires explicit property-level opt-in and a versioned automation policy.
9. All automatic actions are idempotent and auditable.
10. Provider failures fail closed.
11. Wallet delivery is capability-driven, not inferred only from user-agent strings.
12. Readiness is capability-specific, not one global green state.
13. One property's credentials can never be reused for another property.
14. Browser clients receive only normalized references, statuses, and approved provisioning actions.
15. Unsupported hardware/platform combinations remain visibly unavailable.

## 7. High-level architecture

```text
PMS / Stay Source
 OPERA | Mews | Cloudbeds | Infor | Certified PMS
            |
            v
atlas-hospitality-pms-ingest
 provider auth/signature + replay protection + idempotency
            |
            v
ATLAS PMS Connector + Stay Projection
 reservation -> check-in -> room assignment -> eligibility
            |
            v
ATLAS Wallet Credential Orchestrator
 policy + permissions + mapping + readiness + audit
            |
       +----+----+
       |         |
       v         v
Access Provider   Wallet Delivery
Vingcard          Apple Wallet
Dormakaba         Google Wallet
SALTO             provider-approved handoff
Certified provider
       |
       v
Hotel locks/readers/elevators/approved amenities
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
- timestamps

Secrets stay in the approved server-side secret mechanism, never in this business table.

### 8.2 Stay projection

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

Guest PII is minimized. Credential logic should use opaque references rather than duplicate full guest profiles.

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

Extend `HospitalityCredentialReference` with:

- `stay_id`
- `room_assignment_id`
- `wallet_platform`: `apple_wallet | google_wallet | provider_app | none`
- `wallet_state`: `not_requested | eligible | provisioning_ready | provisioned | revoked | expired | failed | unknown`
- `credential_type`: `wallet_mobile_key | mobile_key | rfid_reference`
- existing provider/stay validity/status/audit fields

No raw wallet authorization blob, decrypted provision token, key bytes, or private cryptographic material is stored in the business record.

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
- timestamps

Sensitive transient provider values are encrypted server-side and short-lived, or generated just-in-time without durable persistence where the provider contract permits.

### 8.6 Integration event ledger

`HospitalityIntegrationEvent`

- `id`
- `org_id`
- `property_id`
- `pms_provider_instance_id`
- `source_event_id`
- `event_type`
- `idempotency_key`
- `received_at`
- `processed_at`
- `status`
- `attempt_count`
- `last_error_code`
- `correlation_id`

This table is required. It is the canonical idempotency/replay ledger for PMS ingestion. Raw vendor payloads are not stored unless a future retention design explicitly approves a minimized/encrypted evidence field.

### 8.7 Automation policy

`HospitalityAutomationPolicy`

- `id`
- `org_id`
- `property_id`
- `version`
- `auto_wallet_key_on_checkin`
- allowed platforms and access scopes
- activation/expiry rules
- replacement/retry/manual-review settings
- `enabled`
- `created_by`
- timestamps

This table is required because automatic issuance must be explicit, versioned, auditable, and property-scoped.

## 9. Normalized PMS connector contract

```ts
interface HospitalityPmsConnector {
  readonly providerType: HospitalityPmsProviderType;
  readonly capabilities: HospitalityPmsCapability[];

  readiness(context: PmsProviderContext): Promise<PmsReadiness>;
  syncReservations?(context: PmsProviderContext, cursor?: string): Promise<PmsSyncResult>;
  getReservation?(context: PmsProviderContext, reservationId: string): Promise<NormalizedStay>;
  verifyRoomAssignment?(context: PmsProviderContext, reservationId: string): Promise<NormalizedRoomAssignment>;
  normalizeWebhook?(context: PmsProviderContext, event: unknown): Promise<NormalizedPmsEvent[]>;
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

Vendor payloads are normalized at the connector boundary and do not leak into the rest of the domain.

## 10. Wallet and access capabilities

Extend Hospitality capabilities with:

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

Existing `credential.issue`, `credential.revoke`, `credential.status`, `room.mapping.verify`, and `mobile_key.issue` remain valid.

Capability reporting is per provider instance and property. Apple/Google readiness must be separately verified.

## 11. Permissions

Add:

- `hospitality.pms.read`
- `hospitality.pms.configure`
- `hospitality.pms.sync`
- `hospitality.wallet.read`
- `hospitality.wallet.issue`
- `hospitality.wallet.revoke`
- `hospitality.wallet.configure`
- `hospitality.wallet.audit`
- `hospitality.wallet.automation.manage`

Automatic issuance executes as a governed service action under the active property automation policy. Audit records identify policy version, source event, property, stay, decision, and provider outcome.

## 12. Automatic issuance policy

A property may enable `auto_wallet_key_on_checkin` only if all gates pass:

1. PMS instance is `ready` for check-in and room-assignment data.
2. Access provider is `ready` for the selected wallet capability.
3. Property mapping is verified.
4. Room mapping is verified.
5. Stay is eligible and inside the allowed time window.
6. Check-in is confirmed by the authoritative source.
7. Current room assignment exists.
8. Key validity is bounded by stay/policy limits.
9. No equivalent active credential exists unless replacement is required.
10. Automation policy is enabled and versioned.
11. A supported delivery path exists or state remains `provisioning_ready` without claiming delivery.

Any failed gate blocks issuance and records a normalized blocker.

## 13. Event model and idempotency

Normalized events:

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

Every inbound PMS event is written to `hospitality_integration_events` using a deterministic idempotency key built from organization, property, provider instance, and source event identity/version. Duplicate or replayed events cannot generate duplicate credentials.

## 14. PMS webhook ingress boundary

External PMS webhooks use a dedicated Supabase Edge Function: `atlas-hospitality-pms-ingest`.

It is separate from `atlas-hospitality-access` because provider webhooks are not browser-user JWT requests. The function validates the exact vendor's documented signature/token scheme before processing.

Requirements:

- provider-specific signature/token validation;
- replay protection using vendor event IDs/timestamps/nonces where available;
- server-side mapping from endpoint/provider configuration to organization/property;
- no trust in org/property identifiers supplied only by event body;
- required integration-event idempotency ledger;
- correlation IDs;
- bounded retry/dead-letter state;
- no shared universal webhook secret across properties;
- no user-session JWT as a substitute for vendor webhook authentication.

Where a PMS lacks suitable webhooks, a governed scheduled sync uses the same connector normalization and idempotency ledger.

## 15. Check-in flow

1. `atlas-hospitality-pms-ingest` validates and records the PMS event, or a governed sync retrieves it.
2. Connector normalizes the event.
3. ATLAS updates stay and room assignment.
4. Eligibility policy evaluates mapping, readiness, check-in, validity, and automation policy.
5. Ineligible states persist the blocker and stop.
6. Eligible state calls the access-provider adapter for the specific wallet/mobile-key capability.
7. Provider creates the credential/reference.
8. ATLAS stores normalized reference metadata only.
9. ATLAS creates a short-lived wallet provisioning session.
10. Guest delivery becomes available.
11. Audit records source event, policy decision, provider result, and provisioning state.

## 16. Apple Wallet flow

Apple Wallet support is provider-specific; ATLAS does not invent a generic hotel-room credential format.

For SALTO Space Hospitality, ATLAS follows the official Space/WalletHub provisioning contract: create the provider-backed room key, obtain the provider-supported provisioning token/reference server-side, create the Apple handoff exactly as required, and present the authorized add-to-wallet action. Vingcard and dormakaba use their own authorized Apple Wallet paths rather than reusing SALTO-specific semantics.

## 17. Google Wallet flow

Google Hotel Key is a restricted hotel-key program, not a generic Wallet pass. Production digitization remains disabled until required Google agreements/onboarding and access-provider prerequisites are complete.

ATLAS verifies property capability, requests the credential through the supported access-provider path, creates a short-lived provisioning session, presents the authorized Google Wallet action, and records safe normalized lifecycle state.

## 18. Room-change flow

1. PMS reports a verified room change.
2. ATLAS resolves active credential(s) for the old assignment.
3. New room mapping is verified.
4. ATLAS creates the replacement credential.
5. After the replacement reaches the provider-defined acceptable state, ATLAS revokes/invalidates the old room credential using provider-safe sequencing.
6. Failure leaves an explicit operational blocker; ATLAS never reports a partial replacement as complete.
7. Audit records old/new room assignments and credential references.

Provider atomic replacement APIs are preferred where available.

## 19. Checkout and cancellation

Verified checkout/cancellation triggers provider-backed revocation/invalidation of active guest room credentials and provisioning sessions. ATLAS moves local references to terminal state only with provider evidence or an explicitly reconciled terminal outcome. Failures remain visible for staff follow-up.

## 20. Readiness model

PMS/access instances use:

- `not_configured`
- `configured_unverified`
- `ready`
- `degraded`
- `offline`
- `disabled`

Capability readiness is separate. Example: room mapping may be `ready` while Google Wallet remains `configured_unverified`. The UI never collapses capability differences into one misleading `Connected` state.

## 21. API boundaries

`atlas-hospitality-access` remains the authenticated browser/admin/guest backend boundary with `verify_jwt=true`.

`atlas-hospitality-pms-ingest` is the dedicated vendor webhook ingress boundary. It uses vendor-specific server-side authentication and must not accept anonymous events without successful provider validation.

Internal modules should separate:

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
- `events/repository.ts`
- existing `providers/*`
- shared context/audit/errors

Browser API operations expose normalized statuses/actions only; secrets and raw provider responses are never returned.

## 22. Data persistence and RLS

Required persistence:

- existing `hospitality_provider_instances`
- existing `hospitality_room_mappings`
- existing `hospitality_credential_references`, extended for wallet/stay fields
- `hospitality_pms_provider_instances`
- `hospitality_stays`
- `hospitality_room_assignments`
- `hospitality_wallet_provisioning_sessions`
- `hospitality_automation_policies`
- `hospitality_integration_events`

All applicable rows carry `org_id` and `property_id`. RLS and backend checks enforce tenant/property isolation. Business tables contain no raw secrets or key material.

## 23. Guest delivery

Supported delivery surfaces can include an authenticated ATLAS guest web flow, the hotel's existing guest app through a provider-approved flow, a secure SMS/email link from the authorized communications stack, or front-desk QR/link handoff when the provider/wallet platform permits it.

Delivery links are short-lived, single-purpose, non-enumerable, credential-scoped, and revocable. They do not contain reusable lock secrets.

UI states distinguish: eligible, credential issued, provisioning ready, provisioned where observable, failed, expired, revoked.

## 24. Security and privacy boundaries

- PMS/access secrets stay server-side.
- Never log authorization headers, API keys, private certificates, raw provision tokens, authorization blobs, credential keys, or NFC data.
- Minimize guest PII and prefer opaque references.
- RLS plus backend organization/property checks are mandatory.
- Automatic issuance requires a versioned property policy.
- Provisioning sessions are short-lived and one-purpose.
- Every state-changing action is auditable.
- Cross-property issuance is denied even within one organization unless exact scope is authorized.
- Readiness probes are non-destructive.
- Wallet/vendor onboarding restrictions are hard gates, not obstacles to bypass.
- Remote unlock remains a separate future privileged design.

## 25. Error normalization

Add:

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

Safe provider codes may be attached as metadata; sensitive bodies/headers are redacted.

## 26. UI design

Extend existing Hospitality navigation:

- `Overview` — readiness and blockers;
- `PMS` — connectors, sync/webhook status;
- `Providers` — access providers and wallet capabilities;
- `Rooms` — PMS ↔ ATLAS ↔ access-provider mappings;
- `Stays` — normalized active stays and assignments;
- `Wallet Keys` — credential/provisioning lifecycle;
- `Automation` — property policy;
- `Audit` — source events, decisions, provider evidence.

Guest delivery is separate from admin configuration. Admin pages never display provider secrets or raw provisioning material.

## 27. Automation policy UI

Users with `hospitality.wallet.automation.manage` can configure:

- automatic issuance on/off;
- eligible stay statuses;
- activation lead time;
- expiry rules;
- allowed wallet platforms/access scopes;
- room-change replacement behavior;
- retry/manual-review settings;
- emergency kill switch.

Policy changes are versioned and audited. Disabling automation does not silently revoke existing credentials unless an explicit supported revocation action is selected.

## 28. Testing strategy

### Unit

- PMS normalization;
- event idempotency/replay;
- eligibility and validity rules;
- capability-based wallet selection;
- automation policy evaluation;
- room-change replacement state machine;
- checkout revocation logic;
- secret-redaction contracts.

### Integration

- OPERA/Mews/Cloudbeds/Infor connector contracts with documented mocks or sandboxes;
- valid/invalid webhook signatures;
- duplicate event handling;
- cross-org/property denial;
- wallet issuance blocked when provider not ready;
- provisioning expiry;
- Apple/Google capability divergence;
- room change and checkout lifecycle;
- persistence/audit failure behavior;
- CORS/JWT/browser boundaries.

### UI

- truthful PMS/provider/wallet readiness;
- automation disabled by default;
- permission-based issue/revoke/configure actions;
- add-to-wallet CTA only when provisioning is truly ready;
- mobile Safari and Android Chrome;
- no simulated production labels;
- human-readable labels instead of raw IDs where available.

### Production verification

A property/provider/platform combination is production-ready only after an authorized controlled test proves PMS event receipt, correct room assignment, correct mapping, official provider credential issuance, wallet provisioning action, device provisioning where permitted, supported physical access, checkout/revocation, complete audit evidence, and absence of secret leakage.

## 29. Rollout order

1. Extend domain capabilities/types for PMS, stays, wallet platforms, automation.
2. Add schema/RLS for PMS instances, stays, assignments, provisioning, policies, and integration-event ledger.
3. Implement `atlas-hospitality-pms-ingest` with vendor authentication, replay protection, and idempotency.
4. Implement PMS connector registry.
5. Implement OPERA Cloud/OHIP first.
6. Implement Mews and Cloudbeds.
7. Implement Infor HMS only against an authorized documented interface.
8. Extend access-provider adapters with property-specific wallet capabilities.
9. Implement SALTO Space Apple Wallet flow against official Hospitality API requirements.
10. Implement Vingcard Apple/Google wallet flows only with authorized credentials/docs.
11. Implement dormakaba Apple/Google wallet flows only with authorized credentials/docs.
12. Add generic certified provider fallback.
13. Implement Wallet Credential Orchestrator and automation policy engine.
14. Add admin and guest wallet-delivery UI.
15. Run TDD/unit/integration/typecheck/build/security/mobile verification.
16. Perform controlled production validation property by property.

## 30. External prerequisites and blockers

Architecture/schema/policies/UI/mocks can be implemented without live hotel credentials. Real issuance remains blocked per property until applicable PMS API access, property IDs/events, access-provider credentials, compatible locks/firmware, wallet/mobile-key entitlement, Apple/provider onboarding, Google Hotel Key agreements/API access, authorized test environment, and property authorization are available.

ATLAS surfaces the exact blocker instead of simulating readiness.

## 31. Migration from current ATLAS Hospitality

Preserve the existing multi-provider foundation:

- `atlas-hospitality-access`;
- provider registry;
- Vingcard/dormakaba/SALTO/generic provider types;
- readiness states;
- organization/property-scoped provider instances;
- room mappings;
- credential references;
- explicit Hospitality permissions;
- fail-closed behavior;
- existing `/hospitality/access/*` surfaces.

Extend, do not replace, domain capabilities, credential references, provider adapters, readiness, audit, and UI. PMS ingestion and wallet orchestration are new bounded subsystems behind the Hospitality architecture.

## 32. Definition of done

Complete only when:

- PMS connector abstraction represents OPERA/Mews/Cloudbeds/Infor;
- vendor ingress is authenticated and replay-safe;
- PMS events normalize into scoped stay/room assignment state;
- duplicate events cannot issue duplicate credentials;
- wallet capabilities are explicit and property-verified;
- Apple Wallet and Google Wallet are modeled separately;
- automatic issuance is disabled by default and controlled by versioned policy;
- issuance requires verified eligibility and room mapping;
- provisioning uses only official provider/platform contracts;
- guest consent/device provisioning requirements are truthful;
- room changes and checkout safely replace/revoke credentials;
- raw lock/wallet secrets never reach browser or business tables;
- RLS/backend checks enforce organization/property isolation;
- automated decisions/actions are auditable;
- unit/integration/UI/security/mobile tests pass;
- unsupported combinations fail closed;
- at least one authorized PMS + access provider + wallet combination is verified end-to-end on a controlled hotel property before ATLAS marks that combination production-ready.

## 33. Official integration references used for design

- Oracle Hospitality Integration Platform / OHIP and external room-key workflows.
- Mews Open API / Connector API.
- Cloudbeds PMS API developer platform.
- Infor HMS official product/integration documentation.
- Vingcard mobile wallet hotel-key solutions.
- dormakaba room key in Apple Wallet and Hotel Key in Google Wallet.
- SALTO Space Hospitality API and WalletHub provisioning flow.
- Google Wallet Hotel Key onboarding/API documentation.

Vendor documentation and commercial/API contracts remain authoritative. If an implementation detail conflicts with a current vendor contract, the provider contract wins and the ATLAS adapter must be revised through a reviewed change rather than bypassed.
