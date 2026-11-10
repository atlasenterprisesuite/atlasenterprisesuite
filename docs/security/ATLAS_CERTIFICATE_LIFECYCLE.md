# ATLAS Certificate Lifecycle & Trust Management

Status as of 2026-10-09: **implemented in part, NOT certified in production.**
This document describes enforceable provider boundaries, not simulated provider readiness.

## Trust architecture

| Trust surface | Existing evidence | Correct certificate owner | State |
| --- | --- | --- | --- |
| ATLAS HTTPS apex and www | Cloudflare public edge | Cloudflare Universal SSL / verified provider lifecycle | Public TLS live probe pending |
| ATLAS Local Agent WSS + mTLS | `worker/index.ts`, `atlas-local-control`, Cloudflare API | Cloudflare-managed CA; private key remains on each agent | issuance / revocation implemented; live rotations not certified |
| Agent certificate inventory | `atlas_local_agents` metadata + Cloudflare public cert metadata | Cloudflare authoritative for issued/revoked, ATLAS authoritative for bound agent | cross-provider reconciliation NOT implemented |
| Certificate renewal | Local CSR + `local-agent-mtls.yml` issue/revoke | Device owns its private key; Cloudflare issues public cert | automatic observation only; automatic reissue NOT implemented |
| GitHub workflow identity | OIDC JWT with pinned workflow scope | GitHub Actions OIDC | available for mTLS callback, NOT proof of agent-bound TLS |
| Other external provider certificates | Vendor APIs / managed certificates | External provider | not inventoried in this first slice |

## Automated daily audit — read-only

`.github/workflows/certificate-lifecycle-audit.yml` runs two independent jobs:

1. Query the exact Cloudflare zone via the existing **production** `CLOUDFLARE_API_TOKEN` (SSL and Certificates Read or Write). Require the Cloudflare-managed CA hostname association, complete pagination (up to 100 pages of 50 items), known statuses, distinct IDs/fingerprints, parseable validity and consistency of certificate PEM metadata. Do not print the API response, CSR, private keys, IDs or fingerprints.
2. Open TLS 1.2+ connections to the canonical public hostnames with normal certificate-chain and hostname verification enabled. Inspect certificate validity without disabling TLS verification.

This is an **observation** workflow: GET-only API calls, `contents: read`, no OIDC write permission, no certificate issuance, no DNS edits, no automatic provider revocation. The daily workflow is not evidence of a successful live check until a completed job proves it.

### Alert thresholds

- mTLS **P0**: expiry within seven days, already expired, invalid / duplicate fingerprint, malformed PEM, incomplete inventory or missing mTLS CA hostname association. Fail the job closed and require security action.
- mTLS **P1**: renewal due within thirty days, pending provider transition, missing PEM evidence or zero active certificates. Warn without pretending to have verified usable mTLS.
- Public TLS **P0**: untrusted chain, hostname mismatch, non-TLS-1.2+ protocol, invalid period, expired or within seven days of expiry.
- Public TLS **P1**: expiry within twenty-one days.

A provider status `revoked` is not proof an ATLAS agent binding was invalidated. Cloudflare revocation and application-side deny controls must both be verified.

## Renewal/rotation gates (not yet automated end-to-end)

1. Agent generates a **fresh private key and CSR locally**. The private key stays on that device with OS-restricted permissions; never upload it to GitHub, Supabase, Cloudflare, artifacts, logs or ATLAS telemetry.
2. Confirm the agent identity, organization, old Cloudflare certificate ID and explicit permission to rotate. Compare Cloudflare authoritative status with the current ATLAS binding.
3. Request a new client cert from Cloudflare using only that CSR; verify issuer, SAN / authentication purpose where applicable, fingerprints, serial, notBefore/notAfter and vendor status.
4. Stage the new cert on the agent **before cutover**. Validate a real mTLS handshake with the new key and trust boundary. Do not trust client-supplied `certVerified` headers on non-Cloudflare paths.
5. Commit the new binding atomically after authenticated challenge/proof and confirm the agent reconnects. Preserve continuity and audit.
6. Revoke the old provider certificate; verify provider revocation and active WAF / API Shield rules deny revoked certificates, then clear the obsolete binding.
7. Record source evidence, provider certificate state, device verification, changes, rollback result and expiration. Never show a green completion if any gate fails.

**Known gap:** the current GitHub `issue` flow synchronizes a new binding before the operator installs the new certificate. It is not a zero-downtime, automatic rotation protocol. Do not trigger unattended issuance or revoke the old certificate until staging/activation is implemented and tested. The user-facing `agents.mtls.bind` route accepts admin-entered metadata, not a provider-signed proof; do not treat this operation as certification.

## Required production certification evidence

- Run the read-only audit with the actual Cloudflare zone and confirm full pagination and CA hostname association.
- Verify public HTTPS chain, SAN, TLS protocol and expiration from a real runner.
- Verify a real agent certificate with a device-held private key; test successful WSS handshake and failure for expired, wrong-tenant, revoked, missing, mismatched-fingerprint or missing-session credentials.
- Complete a staged renewal with key rotation, audited new binding, agent reconnect, old certificate revocation and effective WAF rejection.
- Perform exact-SHA integration CI, review, deploy and end-to-end verification for any modified Worker / Supabase Edge Function.
- Prove each provider and agent binding; authorization to develop is not evidence of certificate issuance.

Reference standards: RFC 5280 certificate path validation, RFC 9525 TLS service identity, RFC 8555 ACME for compatible issuance workflows; Cloudflare Client Certificates API for Cloudflare-managed mTLS. Managed public certificates and mTLS client certificates are distinct lifecycle classes.
