# ATLAS FreeWave — Offline-first Pilot

Status: DESIGN ONLY. No deployed radio network, hardware coverage, or verified calling.
Tracking: #830

## Scope and existing boundaries
Reuse ATLAS Communication identities and accessibility patterns, Carrier control-plane policy and audit conventions. FreeWave peer IDs are **not** E.164 numbers; offline local sessions are **not** PSTN sessions. Do not change existing Carrier numbering truth gates or mark a provider active.

## Physical feasibility
A communication link always requires compatible powered transceivers and a usable propagation path. The first pilot uses two user-consenting devices over an OS-supported local Wi-Fi or Bluetooth transport; no tower or WAN required for short-range operation. iOS/browser restrictions must be assessed before choosing a transport. No claim of infinite range, infrastructure-free long-distance service, or borrowed third-party spectrum.

## Phase A: test-first contract
1. Discover nearby peers only with explicit opt-in and OS permissions; never enumerate third-party traffic.
2. Pair peers using mutual authentication and a human-verifiable pairing code; reject unknown peers.
3. Negotiate end-to-end encryption with ephemeral session keys, authenticated messages, replay protection and revocation; never log plaintext or keys.
4. Send offline messages; support voice only after the underlying local transport is demonstrated with two devices and acceptable latency.
5. Display LOCAL ONLY, DISCONNECTED, UNSUPPORTED and PERMISSION DENIED states accurately; provide captions and accessible controls.
6. Persist no cross-tenant private payloads to shared services; document data retention and device loss handling.

## Automated acceptance tests (must be implemented before release)
- Both peers opted in: authenticated offline message exchange with WAN disabled succeeds.
- One peer rejects consent: connection fails closed.
- Wrong pairing code, replayed frame, revoked key, malformed packet: rejected and audited without exposing secrets.
- Link lost or radio disabled: session stops and UI never claims delivery.
- No carrier authorization/allocation evidence: PSTN and E.164 actions remain blocked.
- Tenant isolation and accessibility checks pass.

## Release gates
Threat model, supported platform matrix, regulatory radio review, reproducible tests, CI checks, exact-SHA deployment proof and physical two-device E2E evidence. Do not merge/deploy until green; P0 fails closed. Hardware coverage, carrier allocation and live calling remain BLOCKED without evidence.

## Follow-on options
Local Wi-Fi Direct / peer-to-peer where supported; authorized community mesh relays; privately owned point-to-point backhaul. Each adds hardware, power, spectrum and/or site requirements. External PSTN access remains a separately authorized Carrier project.
