# ATLAS Device OS — Internet & Device Connectivity 777

Date: 2026-11-13
Status: draft PR; read-only code integration; no production verification.

## Reused components

- Existing Device OS route and Local Control Plane (organization-scoped, authorized local-agent APIs).
- Existing Local Network Access allowlist. This change does not expand it or scan networks.
- Network Sentinel user-reported quality measurement; the new dashboard never fabricates a measurement.
- Work Computer Operations advanced network guidance and production-route diagnostics.

## Current integrated vertical slice

The Device OS page displays registered devices from the canonical Local Control API and safely projects:
1. Recent agent reporting and recorded mTLS binding, or an explicit stale/offline/unverified reason.
2. Separate **not-measured** states for general Internet, Wi-Fi, cellular and VPN.
3. A user-initiated GET of the current ATLAS origin with no credentials, redirects or persistence. Its result is intentionally labeled **ATLAS HTTP origin**, not Internet connectivity.
4. Windows user-provided JSON with strict allowed fields; triage warns on missing adapters, failed DNS and unreachable TCP 443, but never certifies VPN health. Reports older than 15 minutes (or future dated) are stale.
5. iPhone manual Wi-Fi, cellular, Hotspot and VPN inputs remain in React memory only, are resettable and provide context-specific troubleshooting without asserting device access.

An opt-in read-only Windows script at `scripts/network/atlas-windows-connectivity.ps1` can print a sanitized local JSON report; the browser validates a strict schema and displays it as user-provided evidence only. It never uploads reports, exposes IP/SSID/password/key data, or claims that an active WireGuard interface proves a VPN tunnel is working.

The page refreshes without retaining stale connected-looking values after an API permission or transport failure. No passwords, router administration, Wi-Fi enumeration, carrier subscriptions, WireGuard keys or raw IP telemetry are collected.

## Trust and ownership boundaries

- This browser feature cannot read iOS network interfaces or manage Personal Hotspot / cellular; Apple OS permissions remain authoritative.
- It cannot manage Windows adapters, services or WireGuard tunnels without a separately installed and enrolled local agent capability with signed native adapter.
- A local-agent heartbeat, healthy device or successful HTTP route probe does not imply Internet or VPN works.
- Device and agent inventory comes from the existing authenticated, organization-scoped API. The client additionally refuses to join agent/device records across organization IDs.
- No background auto-scans or unauthorized network probes, no automatic association with hotel/public Wi-Fi, no changes to host firewalls, VPN or DNS.
- Future mutating commands require capability declaration, organization RBAC/RLS, audit, fresh authorization, and ATLAS Approval Center on risky actions.

## TDD and acceptance matrix

- [x] Pure model, negative unit tests, read-only Windows diagnostics assessment and iPhone manual guidance authored.
- [x] Device OS page integration, sanitized Windows diagnostic script, and local JSON parser authored.
- [ ] Exact-current-head Vitest and TypeScript against complete repository dependencies (CI evidence required). Prior SHA 2167a541 showed 1 failed assertion for invalid-origin validation order; fixed in later commit, but do not inherit previous test results.
- [ ] Exact PR-head SHA check runs complete.
- [ ] Browser E2E on authenticated Device OS and iPhone VoiceOver/accessibility.
- [ ] Authorized enrolled Windows agent with independent verified connectivity telemetry.
- [ ] WireGuard adapter read-only telemetry with real consent and no private key capture.
- [ ] Separate authorization for merge / production deployment and exact-deployed-SHA verification.

P0: if any required authorization, cross-organization isolation, source provenance or evidence check fails, retain **NO-GO**. Do not label deployment completed from source code alone.
