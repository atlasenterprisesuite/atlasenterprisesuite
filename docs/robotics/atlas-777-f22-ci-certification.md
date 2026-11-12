# ATLAS 777 — F22 exact-SHA CI evidence (Robotics PR #970)

## Verified checkpoint

- Commit `8d8fbe37650b65b8d202f0ee68d532263c987018`: **8/8 GitHub Actions workflows completed successfully** (observed via commit-specific workflow query).
- Robotics isolated PostgreSQL 17 run `41446167745`, job `125279665231`: success.
- Within that job, `npm ci --ignore-scripts --no-audit --no-fund`, `Robotics F21 scoped identity negative tests (Vitest)`, and `PostgreSQL 17 transactional revocation negative tests` each completed successfully.
- Vitest log: **1 test file, 21 tests passed**. Includes F21 missing bearer token, scoped-client verification failure and missing membership denial.
- Original-SQL F19 concurrency logs: complete-first and revoke-first paths passed, with negative actor/org/tenant tests.
- PostgreSQL logs contain expected `permission denied` statements for ungranted functions. These are negative-test assertions, not production authorization success.
- Workflow logs warn about deprecated Node.js 20 action runtime for `actions/checkout@v4` and `actions/setup-node@v4`; assess separately before upgrading, without mixing security changes.

## P0 fail-closed boundaries

1. Vitest uses mocked Supabase clients; passing does not prove genuine JWT-to-database binding.
2. PostgreSQL proofs use disposable CI fixture/privileged setup and do not certify production RLS or actual role-permission revocation under non-bypass roles.
3. Effective `execution.read` registration and tenant-to-organization mapping in real atlas-core remain unverified.
4. Universal Execution remains simulation-only; no physical activation, production SQL, deploy or merge.
5. This evidence commit changes HEAD. **Revalidate all required checks on the new exact SHA**; success on `8d8fbe...` is not automatically transferable.

## Next reproducible gates

- Add an isolated integration fixture that matches actual atlas-core Auth and permission schema, with ordinary-role positive and negative RLS tests.
- Add concurrent effective-role revocation writer and reader on the same original SQL and prove deterministic ordering.
- Confirm server-only scoped client construction, token/session freshness and tenant mapping; reject service_role and JWT claim shortcuts.
- Preserve immutable CI run/job identifiers and exact SHA for every promotion decision.

Status: **P0 NO-GO**.
