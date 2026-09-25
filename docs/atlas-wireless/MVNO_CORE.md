# ATLAS Wireless MVNO Core

Status: pre-launch, fail-closed.

## Purpose

ATLAS Wireless owns the customer-facing MVNO control plane while one primary wholesale carrier provides authorized network access. Specialized providers are allowed only where the primary carrier cannot supply a required capability.

## Subscriber lifecycle

`order -> pending_provider -> provisioning -> active | degraded | offline -> suspended -> revoked`

No mock, static fixture, or UI action may move a subscriber into `active`.

## Pilot acceptance gate

1. Carrier/MVNO accepts the internal pilot.
2. One test SIM/eSIM and MSISDN are issued.
3. Authorized provisioning credentials are delivered through the approved secret manager.
4. A technical onboarding contact is assigned.
5. Provision, activate, status/usage, suspend/reconnect and revoke interfaces are documented.
6. Voice, SMS/MMS, mobile data and hotspot are validated.
7. E911 responsibility and coordinated validation procedure are documented.
8. End-to-end evidence is captured before any commercial activation.

## Provider adapter contract

Every carrier integration must implement a provider-neutral adapter. Credentials must never be committed to source control. Provider errors must fail closed and preserve the last verified state.

## Commercial separation

The pilot does not authorize public commercial service. Billing, telecom tax, E911, Home Hub, satellite/D2D, staging and exact-SHA production verification remain separate launch gates.
