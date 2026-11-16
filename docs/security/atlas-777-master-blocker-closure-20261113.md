# ATLAS 777 — Master blocker closure evidence matrix

Date: 2026-11-13. GitHub exact-SHA run inspection and prior authorized catalog-only atlas-core reads. No production DDL, merge, deploy, costs, or secrets.

| PR | Inspected HEAD | Exact-SHA workflow | Root cause | Action | P0 |
|---|---|---|---|---|---|
| #974 Foundation | `8a1493562f68187269291b309821f970e362b69a` | 7/8 success; isolated PostgreSQL 17 runtime failure | Intentional unconditional `Explicitly reject premature RPC certification` exits 1. Earlier negative prerequisite gates correctly reject absent authentic Auth/identity/audit schema. | Preserve fail-closed; do not replace real Auth with permissive stubs. Build only from verified recovered migrations and Supabase Auth parity, then run original RPC and A/B revocation tests. | NO-GO |
| #970 Robotics | `15dbd1de02330c1f3a4d78bc1a33c15f3875eb2e` (before remediation) | 8/9 success; AI Council Security Gates failure | Required `tests/node/atlas-model-continuity.test.mjs` missing in PR head, although file exists on canonical default branch. | Reused exact default-branch test (blob `ff77309ba656e8b2896ee156595d795ff2825be2`) in existing Robotics branch; commit `5070f7dc05ce1ee6d0311908d32ff23fc1edb911`. Recheck CI at new SHA. | NO-GO pending new CI and authentic auth proof |
| #978 ChatGPT MCP | `59893ff4c71b2a28017911bccd6b6826b524653c` | 7/7 success | Effective `TRUNCATE` granted directly to `anon` and `authenticated` on `public.identity_permissions` and `public.organization_modules`; RLS does not govern TRUNCATE. | Existing review-only targeted revoke plan `docs/audits/atlas-777-pr978-truncate-remediation-candidate.md`. Require disposable RED/GREEN and separately authorized production change. | NO-GO |

## Evidence provenance

- #974 failing run `41948387443`, job `126986154934`: dependency checks reject missing authentic foundation, then deliberate fail-closed exit 1.
- #970 failing run `43136001552`, job `130911378385`: `Could not find 'tests/node/atlas-model-continuity.test.mjs'`.
- #978 prior catalog-only checks established effective table TRUNCATE, schema USAGE, and direct ACL grants without PUBLIC grant; not proof of public API exploitability.

## Acceptance gates

1. All required workflows success at each **current** HEAD, not a historical SHA.
2. Foundation authentic PG17 bootstrap, original migrations, tenant isolation, revocation and negative SQL tests reproducible.
3. Robotics actual authenticated identity, tenant scope, concurrency revocation and CI tests reproducible.
4. MCP privilege fix proven in disposable environment and separately authorized in production, with post-change read-only verification.
5. Until all pass: P0 NO-GO. This ledger does not claim closure or a deployment.
