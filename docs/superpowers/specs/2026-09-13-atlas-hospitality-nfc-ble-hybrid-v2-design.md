# ATLAS Hospitality — NFC + BLE Hybrid Access V2.1 Design

## Status

Approved architectural extension to the ATLAS Hospitality Wallet Hotel Key design. This document governs hybrid NFC/BLE guest-access behavior and adds Onity DirectKey as a first-class access-provider integration target while preserving fail-closed operation.

## Goal

Provide one ATLAS Hospitality access architecture that can orchestrate authorized hotel guest credentials over:

- NFC, through officially supported Apple Wallet or Google Wallet hotel-key flows; and
- BLE, through an officially supported provider mobile-key flow such as Onity DirectKey.

ATLAS never clones or emulates a physical card by reproducing raw credential material. ATLAS stores normalized references, readiness state, policy decisions, lifecycle state, and audit evidence only.

## Existing foundation

The implementation extends the existing Hospitality access subsystem rather than creating a second credential system. The canonical credential record remains `hospitality_credential_references`, and the canonical access-provider registry remains `hospitality_provider_instances`.

Existing provider readiness states remain unchanged:

- `not_configured`
- `configured_unverified`
- `ready`
- `degraded`
- `offline`
- `disabled`

Existing Wallet/PMS permissions and eligibility gates remain authoritative.

## Non-goals

The following are explicitly out of scope:

- cloning, copying, replaying, emulating, or deriving hotel card credentials;
- storing NFC/RFID dumps, UID values intended for credential reproduction, facility codes, master keys, encoder secrets, private keys, seeds, decrypted provisioning tokens, provider bearer tokens, or equivalent raw access material;
- reverse engineering proprietary lock protocols;
- bypassing hotel PMS, provider, identity, property, room, or guest authorization;
- direct remote door unlock;
- treating visual identification of a lock manufacturer as proof that a property has BLE, DirectKey, Wallet, or any other digital-key capability enabled.

## Architectural model

The canonical flow is:

```text
PMS / Reservation Source
        ↓
Stay + Check-in + Room Assignment
        ↓
ATLAS Eligibility + Automation Policy + RBAC
        ↓
ATLAS Access Transport Router
        ↓
┌──────────────────────────────┬──────────────────────────────┐
│ NFC                          │ BLE                          │
│ Apple/Google Wallet          │ Provider mobile-key app      │
│ official provider pathway    │ Onity DirectKey or approved  │
└──────────────────────────────┴──────────────────────────────┘
        ↓
Provider Credential Reference
        ↓
Provisioning / Activation / Replacement / Revocation
        ↓
Audit + Evidence + Expiration
```

ATLAS is the orchestration and governance layer. Cryptographic hotel-key material remains inside the authorized access-provider / wallet trust domain.

## Provider model

### Onity DirectKey

Add `onity_directkey` to the normalized `HospitalityProviderType` vocabulary and provider registry.

The Onity adapter is a dedicated adapter, not an alias for `generic_certified`.

Until an authorized official Onity/DirectKey runtime configuration and property mapping are available, readiness must remain:

```text
state = configured_unverified
blocker = onity_directkey_official_configuration_required
```

The adapter must fail closed for issuance, replacement, status, and revocation if the provider contract/configuration required for that operation is not verified.

No undocumented endpoint, payload, BLE frame, NFC credential, cryptographic field, device identifier, or provider secret may be invented.

### Other providers

SALTO, Vingcard, dormakaba, and generic certified providers retain their current contracts. Hybrid transport metadata is normalized across all provider references, but provider-specific capability claims remain independently verified.

## Transport model

Introduce:

```ts
export type HospitalityAccessTransport = 'nfc' | 'ble';
```

Transport describes the guest-device-to-lock interaction and is not equivalent to provider type.

Examples:

- Onity DirectKey: `transport = 'ble'`, `walletPlatform = 'provider_app'`.
- An officially supported Apple Wallet hotel key: `transport = 'nfc'`, `walletPlatform = 'apple_wallet'`.
- An officially supported Google Wallet hotel key: `transport = 'nfc'`, `walletPlatform = 'google_wallet'`.

A provider/property may support more than one transport, but ATLAS only advertises a route after readiness is verified for that exact property/provider/platform combination.

## Credential persistence

Do not create `hospitality_device_credentials` as a parallel source of truth.

Extend `hospitality_credential_references` with normalized lifecycle metadata. The migration must add fields equivalent to:

```text
stay_id
transport
wallet_platform
issuance_actor
provisioning_state
```

The existing `provider_credential_id` remains an opaque external reference only.

### Required semantics

`transport`:

- `nfc`
- `ble`

`wallet_platform`:

- `apple_wallet`
- `google_wallet`
- `provider_app`
- `none`

`issuance_actor`:

- `user`
- `service`

`provisioning_state`:

- `eligible`
- `provisioning_ready`
- `issued`
- `active`
- `revocation_pending`
- `revoked`
- `expired`
- `failed`
- `unknown`

The schema must not add a generic `payload_data` field or any column intended to persist reusable access material.

Service-generated actions use `issued_by = NULL` where the existing schema permits it, paired with `issuance_actor = 'service'`; service workflows must never invent a user identity.

## Eligibility and routing

The existing Wallet eligibility engine remains authoritative for Wallet routes. Hybrid routing adds transport/provider-specific gates after common eligibility passes.

A route may execute only when all applicable gates are true:

1. organization/tenant context is valid;
2. actor/service has the required Hospitality permission;
3. stay is active and `checked_in`;
4. room assignment exists;
5. room mapping is verified;
6. provider instance is `ready`;
7. property/provider supports the requested transport;
8. requested Wallet/provider-app platform is supported;
9. validity window is valid;
10. policy is enabled and emergency kill switch is off;
11. no equivalent active credential exists unless this is an explicit replacement flow.

The router returns a normalized decision; it never silently falls back from an unsupported Wallet route to a different credential route without an explicit policy decision.

## Lifecycle

### Initial issuance

```text
eligible
  → provisioning_ready
  → issued
  → active
```

`provisioning_ready` means provider-side issuance may have completed but guest delivery/activation is not yet confirmed. It must not be reported as `active`.

### Room change

Use a provider-safe replacement sequence:

1. validate new assignment and room mapping;
2. request replacement/new credential through the official provider adapter;
3. confirm acceptable provider state for the replacement;
4. revoke or supersede the old provider credential;
5. record both lifecycle transitions and audit evidence.

If the provider exposes a documented atomic room-change operation, prefer that operation.

If the replacement cannot be confirmed, do not revoke the old credential solely because ATLAS created a new local record.

### Checkout/cancellation

ATLAS requests provider-backed revocation and records the result.

If the provider revocation request is not confirmed, use `revocation_pending` or `failed`; do not report `revoked` optimistically.

### Expiration

Credential expiry is explicit and bounded by the stay/policy/provider validity window. ATLAS may reconcile an externally expired credential to `expired` without storing credential material.

## Access-provider adapter contract

`HospitalityAccessAdapter` remains the common boundary. Onity support extends the provider vocabulary and supplies a dedicated adapter implementation.

The adapter must expose only normalized operations already used by ATLAS:

- readiness;
- issue credential/reference;
- revoke credential/reference;
- credential status when supported.

A transport-aware capability set may include provider-specific normalized capabilities, but raw provider secret material never crosses the adapter boundary into browser state or business tables.

## Security boundaries

### ATLAS may store

- organization/property identifiers;
- room/stay/assignment references;
- provider instance identifiers;
- opaque provider credential references;
- transport and wallet/provider-app metadata;
- timestamps;
- readiness/status codes safe for audit;
- policy version and decision evidence;
- actor type and authorized user ID when applicable.

### ATLAS must not store

- raw NFC or RFID card contents;
- credential-emulation payloads;
- BLE unlock payloads or protocol frames;
- master/facility keys;
- vendor signing/private keys in business tables;
- provider bearer tokens in browser-visible state;
- decrypted provisioning tokens;
- reusable guest unlock secrets.

Provider secrets, if required for an authorized integration, stay in the approved server-side secret store/runtime configuration and are never returned to browser clients.

## API behavior

Authenticated administrative/read APIs may expose normalized readiness and credential-reference state only.

Guest delivery endpoints may expose only the official provider/Wallet handoff artifact required for the active, authorized stay. Any short-lived guest-delivery token must remain non-enumerable, revocable, credential-scoped, property-scoped, and stored only as a one-way hash where persistence is needed.

No endpoint may accept arbitrary lock identifiers plus arbitrary credential payloads from a browser client.

## UI behavior

ATLAS Hospitality should show transport and delivery path truthfully:

- NFC / Apple Wallet;
- NFC / Google Wallet;
- BLE / Provider App (for example Onity DirectKey);
- unavailable / configuration required.

For Onity, visual detection of an Onity lock may be recorded as discovery evidence, but the UI must keep the provider `configured_unverified` until the property integration is actually verified.

The UI must distinguish:

- provider detected;
- provider configured;
- provider verified/ready;
- guest credential eligible;
- provisioning ready;
- active;
- revocation pending;
- revoked/expired/failed.

## Audit model

Every issuance, replacement, revocation, failure, and administrative configuration decision records safe audit evidence with:

- organization;
- property;
- stay/assignment reference;
- provider instance;
- transport;
- wallet/provider-app platform;
- credential reference ID;
- action;
- result/state;
- policy version;
- actor type;
- user ID only when a real authenticated user performed the action;
- timestamps and sanitized provider status/error code.

No raw provider response body is persisted unless explicitly sanitized to the normalized safe schema.

## Error handling

The system fails closed.

Representative normalized blockers/errors include:

- `provider_not_ready`
- `onity_directkey_official_configuration_required`
- `transport_not_supported`
- `wallet_platform_not_supported`
- `room_mapping_missing`
- `stay_not_checked_in`
- `active_credential_exists`
- `replacement_not_confirmed`
- `revocation_pending`
- `provider_status_unavailable`

Errors shown to a guest do not expose provider internals, room-security details, tokens, headers, stack traces, or cryptographic metadata.

## Testing requirements

### Unit

- provider vocabulary includes `onity_directkey`;
- transport vocabulary accepts only `nfc|ble`;
- route selection is deterministic and fail-closed;
- Onity without official runtime configuration returns `configured_unverified`;
- Wallet/BLE route mismatch is rejected;
- no active-equivalent duplicate issuance unless replacement flow is explicit;
- admin permission still satisfies new access operations.

### Integration

- migration extends the existing credential table rather than creating `hospitality_device_credentials`;
- migration contains no raw credential/payload columns;
- RLS/tenant constraints remain intact;
- provider registry resolves Onity only to the dedicated fail-closed adapter;
- browser-facing APIs expose normalized references only;
- checkout and room-change lifecycle produce the required states;
- audit records never contain forbidden secret-field names/material.

### End-to-end / contract

Mock/sandbox tests may establish `implementation_verified` but never `production_ready`.

Production readiness requires a controlled, authorized hotel-property validation using the provider's official configuration and a legitimate guest/staff test flow. Required evidence must cover:

1. provider readiness;
2. verified property/room mapping;
3. legitimate checked-in stay;
4. authorized issuance;
5. device activation/provisioning;
6. physical access success through the official mechanism;
7. room-change/replacement behavior;
8. checkout/revocation behavior;
9. audit evidence;
10. absence of raw credential material in ATLAS storage/logs.

## Rollout sequence

1. Normalize transport and Onity provider types.
2. Extend credential-reference persistence safely.
3. Add dedicated Onity fail-closed adapter and provider registry path.
4. Add hybrid transport routing and lifecycle helpers.
5. Extend authenticated API/repository reads and safe write orchestration.
6. Add admin/readiness UI states for NFC/BLE/Onity.
7. Add unit, integration, schema, security, and route tests.
8. Run full repository gate on the exact feature SHA.
9. Keep production actions blocked until explicit approval and authorized official provider/property configuration exist.
10. Only after controlled property validation may the system be classified `production_ready` for that exact provider/property/transport combination.

## Production readiness classification

ATLAS reports the following independently:

- `implementation_verified`: code and automated tests pass;
- `external_gates_pending`: official provider/property/wallet onboarding or credentials remain unresolved;
- `production_ready`: only true after the controlled end-to-end property validation succeeds.

No configuration presence, lock photograph, mock response, sandbox result, or successful build may by itself set `production_ready = true`.
