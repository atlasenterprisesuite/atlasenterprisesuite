# ATLAS Local Device Bridge — Local Network Access design

Date: 2026-09-18

## Decision

ATLAS Device OS owns browser Local Network Access (LNA). The feature is a governed transport boundary, not a provider certification layer. Granting LNA never upgrades Onity, POS, printer, medical, vehicle, or other hardware capabilities to ready.

## Browser contract

ATLAS production remains HTTPS. A local probe is initiated only for an explicit organization allowlist entry. Direct probes use Fetch with CORS, omit browser credentials, reject redirects, use no-store caching, and annotate local destinations with `targetAddressSpace: "local"`. Loopback is not mislabeled as local.

Chrome's LNA prompt remains authoritative. ATLAS does not attempt to bypass, pre-grant, suppress, or infer browser permission.

## Security invariants

- No LAN scanning or automatic device enumeration.
- No wildcard subnet allowlists in P0.
- No ATLAS bearer token, cookie, password, or provider secret is sent to the local endpoint.
- Endpoint policy is scoped by `org_id` and RLS.
- Read/use/admin are separate permissions.
- Audit is append-only for authenticated clients.
- Audit stores endpoint identity, event outcome and safe status metadata only.
- A missing pre-execution audit write fails closed before the local request.
- Direct browser control requires CORS from the local service.
- Provider-specific actions remain governed by their existing adapters and readiness state.

## Current supported destinations

P0 accepts explicit localhost/loopback, RFC1918 IPv4, carrier-grade NAT, IPv4 link-local, IPv6 unique-local/link-local, and `.local` origins. Public split-DNS hostnames are intentionally excluded from the P0 allowlist.

## Future extension

A signed ATLAS Local Agent may later provide a mutually authenticated bridge for devices that cannot expose browser-safe CORS. That agent must have its own device identity, rotation, tenant binding and capability-specific authorization; it must not reuse the browser probe as a generic network proxy.
