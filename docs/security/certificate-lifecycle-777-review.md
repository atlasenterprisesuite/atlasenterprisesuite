# ATLAS Certificate Lifecycle & Trust Management — 777 REVIEW

Status: APPROVED DESIGN; NOT PRODUCTION VERIFIED.

## Scope
Cloudflare, API gateway, Salesforce/MuleSoft if connected, payment, governmental connectors, workload mTLS and external TLS endpoints.

## P0 controls
- Inventory actual endpoints, certificate chains, key usages, SAN, issuer, expiration, owners and renewal methods without exporting private keys.
- For each integration distinguish inbound/outbound, client/server identity, public/private PKI and CA restrictions.
- Flag dual-use client/server certificates for replacement with separate purpose-scoped identities, based on applicable provider rules.
- Never disable certificate/hostname validation, weaken trust stores or silently fall back to insecure transport.
- Fail closed on expired, untrusted, mismatched or unauthorized identities.

## Rotation
- Monitor expiry, issuance, root/intermediate changes and revocation.
- Support automated issuance/renewal via approved CA/provider integrations, staging validation, overlapping certificates where supported, rollback, alerts and audit trail.
- Design for 47-day maximum public TLS certificate validity by March 2029, with provider-specific earlier milestones; validate authoritative schedule before coding fixed dates.
- Mozilla Root Set guidance applies to relevant public inbound trust stores, not a mandate to trust every root in every workload; private trust remains explicitly scoped.

## Implementation gates
1. READ ONLY audit and inventory of deployed cert metadata, not private keys.
2. Compatibility matrix and risk-ranked findings.
3. Typed schema and tests for certificate inventory, renewal scheduling, trust profiles, mTLS client/server roles.
4. Connector-specific integration tests and negative tests.
5. PR and CI review, approval for production rotations where required.
6. Exact-SHA deployment and authenticated TLS handshake verification.
7. Production VERIFIED only after evidence attached.

## Acceptance criteria
- All P0 findings remediated or blocked.
- Renewal rehearsed with simulated expiration and CA rotation.
- Audit logs redact secrets.
- Every connection reports last verified handshake and trust policy.
- No unverified Salesforce connection or operational compliance claim.


## Authenticated certificate telemetry integration (2026-10-09)
- `atlas-core` contains RLS-protected `atlas_certificate_targets` and immutable `atlas_certificate_observations`, with an approved public TLS target for `www.atlasenterprisesuite.com:443`.
- Reuse the **existing**, cryptographically authenticated `atlas-infra-evidence?api=record` endpoint; Supabase is at the 100 Edge Function limit. A separate receiver is NOT deployed or required.
- The preexisting Cloudflare deployment workflow is explicitly authorized by that live receiver's GitHub-OIDC claim allowlist. A scheduled/read-only certificate-monitor job executes there, without running a scheduled production deployment.
- A narrowly filtered database adapter maps only `github-actions-oidc` verification records with exact workflow, main branch, hostname, approved target and TLS proof into the certificate observations table.
- Signed observation persistence must be verified by a successful **main-branch** run before declaring monitoring LIVE. GitHub CI alone is insufficient.
- Public TLS verification never proves mutual TLS; mTLS requires dedicated client-identity handshake tests, currently NOT VERIFIED.
- Production UI state is under explicit `VERIFICATION_HOLD` until route E2E and exact-SHA evidence. Never mark all certificates verified by default.
- Never delete active Supabase services or silently bypass plan limits. See issue #734 for capacity context and reconciliation evidence.
