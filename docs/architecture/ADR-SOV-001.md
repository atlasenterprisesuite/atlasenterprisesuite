# ADR-SOV-001 — Sovereign release evidence (proposal)

**Status:** implementation candidate; no production cutover.
**Owner:** ATLAS Manager / 777 REVIEW.
**Source:** User-approved requirement that GitHub, Cloudflare and managed providers remain replaceable; existing canonical repository remains authoritative until an audited change.

## Decision
Extend the existing ATLAS Evidence Engine with an offline integrity gate for signed P0 release claims. Reuse ATLAS Manager, `atlas-sovereign-control-plane`, `atlas_master_evidence_registry`, the existing production verifiers, RBAC/RLS and deployment governance. This PR does **not** introduce a parallel orchestrator or change provider authority in production.

Release checks remain separate: source, CI, signed artifact evidence, provider runtime, public DNS/TLS, authorization and post-deployment SHA. A forged or merely self-reported signed status is **not** production proof.

## Threats and boundaries
- Untrusted signing keys: pin Ed25519 public-key fingerprint independently; keep private key out of repository, runner logs and chat.
- Source/artifact substitutions: require exact 40-character commit SHA and SHA-256 per local evidence file.
- Missing/stale claims: fail closed; no inferred pass from warnings or absent evidence.
- Cross-tenant reads: require separate adversarial RLS/RBAC tests; not covered here.
- Hostile runners and provider outages: isolate CI and use tested backups; not covered by this PR.
- Production/rollback: no merge, deployment, DNS cutover, data migration or claims of live readiness.

## Follow-up acceptance
1. Reconcile with the existing ATLAS Evidence Engine manifest schema without duplicating record types.
2. Produce independent trusted attestations from real isolated runners.
3. Test PostgreSQL restore and tenant isolation against an approved sanitized dataset.
4. Prove a second source/runner and optional origin can build and serve the same exact SHA.
5. Run authenticated external provider and public production checks before any release approval.

P0 remains blocking; P1 cost/performance/footprint recommendations are advisory. A provider-name keyword inventory is not a measured dependency index.
