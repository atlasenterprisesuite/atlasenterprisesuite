# ATLAS Wireless MVNO Core

Status: pre-launch, fail-closed.

## Purpose

ATLAS Wireless owns the customer-facing MVNO control plane while one primary wholesale carrier provides authorized network access. Specialized providers are allowed only where the primary carrier cannot supply a required capability.

## Current implementation boundary

ATLAS now contains four internal MVNO layers:

1. the authenticated web route at `/connect/wireless/mvno`;
2. an authenticated Supabase Edge Function gate, `atlas-wireless-mvno`, with `readiness`, `status`, `provision`, `activate`, `suspend`, `reconnect` and `revoke` operation names;
3. a server-only provider-neutral lifecycle/adapter contract under `supabase/functions/_shared/mvno.ts`;
4. explicit `wireless.mvno.*` authorization codes registered through migrations.

The server gate is intentionally non-operational for carrier mutations. It resolves organization scope, reads only server-side provider-configuration evidence, returns no provider secret values, and rejects lifecycle mutations with `provider_not_ready` until a real authorized provider adapter is implemented and verified.

ATLAS still does **not** claim an active carrier, MVNE, SM-DP+, SM-SR, IMSI/MSISDN inventory, production billing feed or live subscriber provisioning. Repository presence of an endpoint is not evidence that the external provider path is ready.

Those capabilities may only move from design contract to operational state after an authorized provider supplies documented interfaces, credentials, test inventory and acceptance evidence.

Production route reachability is not carrier readiness and MUST NOT promote provider or subscriber state.

## Owned-network transition

ATLAS Wireless is the canonical service provider. The long-term network model is no longer limited to a permanent wholesale MVNO dependency.

The owned-network foundation is defined in `docs/atlas-wireless/OWNED_NETWORK_FOUNDATION.md` and `supabase/functions/_shared/atlas-wireless-network.ts`.

ATLAS may operate in:

- `atlas-owned` mode where ATLAS controls the verified access/core network;
- `hybrid` mode during coverage build-out;
- `wholesale-fallback` mode where an external network supplies access.

An ATLAS-owned or hybrid mode must not be inferred from branding. It requires evidence for core, RAN, spectrum, backhaul and the remaining public-service gates before public activation.

## Subscriber lifecycle

`order -> pending_provider -> provisioning -> active | degraded | offline -> suspended -> revoked`

No mock, static fixture, browser state, configured secret or UI action may move a subscriber into `active`. Provider/network evidence must be authoritative.

Subscriber `active` and provider `ready` are separate facts. A subscriber may transition to `active` only when the server-side provider readiness state is `ready`.

The server contract enforces explicit lifecycle edges. `revoked` is terminal; only an idempotent `revoked -> revoked` result is accepted. Reconnect is modeled as a governed transition from `suspended` and cannot bypass provider-readiness checks when the result becomes `active`.

## Pilot acceptance gate

1. Carrier/MVNO accepts the internal pilot.
2. One test SIM/eSIM and MSISDN are issued.
3. Authorized provisioning credentials are delivered through the approved secret manager.
4. A technical onboarding contact is assigned.
5. Provision, activate, status/usage, suspend/reconnect and revoke interfaces are documented.
6. Voice, SMS/MMS, mobile data and hotspot are validated.
7. E911 responsibility and coordinated test procedure are documented.
8. End-to-end evidence is captured before any commercial activation.

## Provider adapter contract

The provider adapter contract is server-only under `supabase/functions/_shared/mvno.ts`. Browser code must not own carrier execution contracts or credentials.

Every carrier integration must implement the provider-neutral adapter and receive explicit organization, tenant, actor, provider-instance, correlation and idempotency context. Mutating operations must enforce the corresponding `wireless.mvno.*` permission server-side and must return provider evidence suitable for an audit trail.

`wireless.mvno.suspend` and `wireless.mvno.reconnect` are separate permissions so restoring service does not require broader activation/admin authority.

Credentials must never be committed to source control. Provider errors must fail closed and preserve the last verified state. eSIM activation material stays server/provider-side; browser surfaces receive only non-secret references.

The contract includes EID and IMEI handling, separates provider readiness from subscriber lifecycle state, and requires a provider readiness check before any subscriber may become `active`. Active mutation results are structurally constrained to carry `providerState: ready`, with a runtime assertion for untrusted provider payloads.

The current server function may detect that provider configuration exists, but configuration alone produces `configured_unverified`, never `ready`. A future adapter must perform a non-destructive provider verification before carrier mutations can be enabled.

## Server gate

The browser reads readiness from:

`GET /functions/v1/atlas-wireless-mvno?api=readiness`

Authenticated lifecycle operations are reserved at the same Edge Function:

- `GET ?api=status`
- `POST ?api=provision`
- `POST ?api=activate`
- `POST ?api=suspend`
- `POST ?api=reconnect`
- `POST ?api=revoke`

Until provider verification exists, each lifecycle operation remains fail-closed with HTTP 503 and a non-secret blocker code.

Repository merge and Cloudflare web deployment do not prove this Edge Function is live in Supabase. The function must be deployed separately with JWT verification enabled and its deployed version/readiness must be verified before the web surface can treat server readiness as available.

## Audit and isolation boundary

Any future live provider adapter or carrier mutation path must:

- resolve the authenticated actor and active organization server-side;
- carry explicit tenant scope into provider execution;
- scope every subscriber/provider lookup to the active organization and tenant;
- reject missing or mismatched organization/tenant context;
- enforce the specific `wireless.mvno.*` permission before provider access;
- retain correlation and idempotency identifiers;
- write append-only audit evidence for consequential lifecycle operations;
- never infer provider readiness from UI state, configured secrets or HTTP route reachability.

## Commercial separation

The pilot does not authorize public commercial service. Billing, telecom tax, E911, Home Hub, satellite/D2D, staging, carrier acceptance and exact provider-side end-to-end verification remain separate launch gates.
