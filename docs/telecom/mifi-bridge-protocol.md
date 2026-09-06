# ATLAS MiFi Bridge Protocol v1

The bridge is a trusted local/embedded service. Browser clients never receive raw modem credentials or direct modem access.

## Authentication
Every request carries an ATLAS-issued bearer credential over HTTPS or a mutually authenticated local transport. The bridge validates tenant, organization, actor, device permission, expiry, and request idempotency before writes.

## GET /v1/devices/:deviceId
Returns the normalized `MifiDevice` schema defined in `packages/telecom/src/types.ts`. An unavailable bridge returns `connectionState: "unavailable"` and false capabilities; it does not fabricate a connected device.

## GET /v1/devices/:deviceId/call-forwarding
Returns an array of network-read `CallForwardingRule` values. Empty is valid only when the bridge successfully queried the network and no rule exists. Adapter failure returns a non-2xx response instead of an invented empty success.

## PUT /v1/devices/:deviceId/call-forwarding
Request body is `CallForwardingRequest.rule`; headers include `Idempotency-Key`.

A 2xx response means the modem/network accepted the command, not that forwarding is verified. The response sets `verified: false` until a separate read-back matches the requested rule.

## POST /v1/devices/:deviceId/call-forwarding/verify
Reads the active network rule and returns it. ATLAS marks a rule verified only when the returned reason, destination, enabled state, and no-answer delay match the request.

## Adapter selection
After hardware identification, choose the first authenticated mechanism that capability probing confirms: manufacturer API, QMI/MBIM/AT, then USSD/MMI. No transport is assumed from carrier name alone.

## Audit
Every write records request id, idempotency key, actor id, tenant id, organization id, device id, requested rule, transport selected, normalized modem/network response, error code, and timestamp.
