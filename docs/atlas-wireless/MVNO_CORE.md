# ATLAS Wireless MVNO Core

Status: pre-launch, fail-closed.

## Purpose

ATLAS Wireless owns the customer-facing MVNO control plane while one primary wholesale carrier provides authorized network access. Specialized providers are allowed only where the primary carrier cannot supply a required capability.

## Current implementation boundary

ATLAS now contains three internal MVNO layers:

1. the authenticated web route at `/connect/wireless/mvno`;
2. a provider-neutral lifecycle type contract;
3. authenticated Wireless operations hosted inside the existing `atlas-platform-controls` Edge Function: `wireless-mvno-readiness`, `wireless-mvno-status`, `wireless-mvno-provision`, `wireless-mvno-activate`, `wireless-mvno-suspend`, `wireless-mvno-reconnect` and `wireless-mvno-revoke`.

The server gate is intentionally non-operational for carrier mutations. It resolves organization scope, reads only server-side provider-configuration evidence, returns no provider secret values, and rejects lifecycle mutations with `provider_not_ready` until a real authorized provider adapter is implemented and verified.

ATLAS still does **not** claim an active carrier, MVNE, SM-DP+, SM-SR, IMSI/MSISDN inventory, production billing feed or live subscriber provisioning. Repository presence of an endpoint is not evidence that the external provider path is ready.

Those capabilities may only move from design contract to operational state after an authorized provider supplies documented interfaces, credentials, test inventory and acceptance evidence.

## Subscriber lifecycle

`order -> pending_provider -> provisioning -> active | degraded | offline -> suspended -> revoked`

No mock, static fixture, browser state, configured secret or UI action may move a subscriber into `active`. Provider/network evidence must be authoritative.

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

Every carrier integration must implement a provider-neutral adapter. Credentials must never be committed to source control. Provider errors must fail closed and preserve the last verified state. eSIM activation material stays server/provider-side; browser surfaces receive only non-secret references.

The current server function may detect that provider configuration exists, but configuration alone produces `configured_unverified`, never `ready`. A future adapter must perform a non-destructive provider verification before carrier mutations can be enabled.

## Server gate

The browser reads readiness from:

`GET /functions/v1/atlas-platform-controls?api=wireless-mvno-readiness`

Authenticated lifecycle operations are reserved at the same Edge Function:

- `GET ?api=wireless-mvno-status`
- `POST ?api=wireless-mvno-provision`
- `POST ?api=wireless-mvno-activate`
- `POST ?api=wireless-mvno-suspend`
- `POST ?api=wireless-mvno-reconnect`
- `POST ?api=wireless-mvno-revoke`

Until provider verification exists, each lifecycle operation remains fail-closed with HTTP 503 and a non-secret blocker code.

The active Supabase project reached its Edge Function-count limit when ATLAS attempted to deploy a separate `atlas-wireless-mvno` function. ATLAS therefore reuses the already-deployed, JWT-protected `atlas-platform-controls` control plane instead of paying for or creating a parallel runtime. Repository merge and Cloudflare web deployment still do not prove the new Wireless operations are live: the updated `atlas-platform-controls` version must be deployed and verified independently before the web surface can treat server readiness as available.

## Commercial separation

The pilot does not authorize public commercial service. Billing, telecom tax, E911, Home Hub, satellite/D2D, staging, carrier acceptance and exact provider-side end-to-end verification remain separate launch gates.
