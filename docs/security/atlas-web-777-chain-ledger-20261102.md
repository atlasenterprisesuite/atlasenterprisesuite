# ATLAS WEB-777 — Cross-PR dependency and evidence ledger
Status: P0 NO-GO. Read-only cross-PR analysis. No merge, deploy or production mutation.
Baseline: cc64465b4c4c5fe9422945cbd59c415edcbd60bf (foundation negative preflight).

## Exact HEAD snapshots (2026-11-02)
| PR | HEAD | Evidence observed | P0 boundary |
| --- | --- | --- | --- |
| #974 Foundation | ce889fa69aea940e1c705e67906c66293baed551 | Isolated PostgreSQL 17 workflow failure; other checks in progress | Authentic Supabase Auth / foundation bootstrap absent |
| #968 Advisory | 609217b77823e3adbd50cd778e3d234bb5a730ca | Advisory 777 Revocation Evidence (isolated): success | Does not certify Foundation/other tenants |
| #970 Robotics | 8d8fbe37650b65b8d202f0ee68d532263c987018 | Robotics PostgreSQL 17 isolated revocation proof: success | Simulation and robotics-specific coverage only |
| #976 Sovereign Browser | 04f8e9a01f3a5213242a697b8118ec91564479c3 | Security baseline success, several checks in progress | Browser authorization/production unverified |
| #948 Secure Data Room | 8fce4d6bf979ab969787a65341744745f2094d44 | Secure Data Room PostgreSQL 777: success | Delivery-time revocation not globally certified |
| #977 Rulesets | 7350d417f4d2065bbc87801bac8e66ba2e001bd9 | Eight workflows success | NEG-RULESET-001 actual enforcement distinct from draft state unproven |

## Single dependency graph
1. Supabase Auth identity and authenticated request provenance -> active organization membership -> role/permission lookup.
2. Authentic PostgreSQL 17 foundation DDL, grants, RLS, trigger functions, audit identity -> negative isolation/revocation tests.
3. Shared authorization envelope -> Advisory transactional revocation / Robotics simulation / Browser operations / Data Room access.
4. Each module's own exact-SHA CI and negative tests -> required Ruleset enforcement evidence -> release-control approval.
5. Any P0 failure or unverified upstream contract blocks downstream certification. A passing isolated workflow does not transitively certify another PR.

## Reuse inventory (do not duplicate)
- tests/security/atlas-777-foundation-preflight.sql: read-only fail-closed dependency/RLS/ACL checks.
- .github/workflows/atlas-777-foundation-preflight-negative.yml: disposable PG17 negative harness; NO CI run verified on baseline commit.
- .github/workflows/atlas-777-isolated-postgres.yml: existing People foundation PG17 gate; currently fails at authentic dependency check.
- Existing #968 Advisory and #970 Robotics isolated PG17 revocation proofs: reuse patterns after source/fixture review, never assume interchangeability.
- #977 NEG-RULESET-001: preserve isolated enforcement experiment; never interpret draft PR state as ruleset proof.

## Static verification contract
- Every PR must be re-fetched immediately before action; compare HEAD to recorded SHA, fail closed on drift.
- Require exact-SHA workflow success for each required P0 job; pending, cancelled, absent and failed are NOT success.
- Verify `auth.uid()` provenance, membership active status, tenant separation and transactional revocation independently.
- Inspect function SECURITY DEFINER ownership, EXECUTE ACL, RLS and TRUNCATE grants; do not copy production ACL to disposable fixtures without review.
- Require negative proof for cross-tenant reads/writes, permission revocation, stale JWT and concurrency, where applicable.
- Require Ruleset actual merge-block evidence for failed/pending/missing required check, not only a green workflow.
- Preserve original migration SQL and run it only after authentic foundation bootstrap in disposable PostgreSQL 17.

## Evidence limits
This ledger is a dependency contract, not an executable merge, CI success, production deployment, or certified test suite. No new runners triggered. No original People/Advisory migrations executed. No secrets or user data read.
