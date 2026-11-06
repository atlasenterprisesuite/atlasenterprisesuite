# ATLAS Academy F2 — exact-SHA evidence ledger
Date: 2026-11-04 (America/New_York). Scope: issue #990, draft PR #992.
Status: P0 NO-GO. No deployment, credential issuance, database mutation or payments.

## Source inspection
- Main latest returned by repository commit search: `e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12` (search snapshot; do not treat as release HEAD without separate branch check).
- F2 correction commit: `ee45d0456e17c62c12404372815f39756763a56e`, confirmed via commit fetch.
- Read `packages/learning/academyAssessment.ts` and `packages/learning/academyAssessment.test.ts` on the Academy branch.
- Read `docs/academy/academy-credentials-f1-contract-777.md` and sampled `InteractiveLearningLabs.tsx` and `neuroplasticityRepository.ts`. Reuse requires server authorization audit.
- PR #992 remains labeled DRAFT in search result; PR body still describes original F1-only snapshot and must not be treated as current test evidence.

## GitHub Actions results returned for exact F2 correction SHA
Seven PR-triggered workflow runs returned by commit-filtered lookup; all status `completed`, conclusion `success`:
- CodeQL Advanced: run 41943508364
- ATLAS Sentinel Shield (advisory): run 41943508369
- ATLAS GitHub Security Baseline: run 41943508370
- ATLAS Ride Profile Photo CI: run 41943508339
- ATLAS Hospitality OS TDD: run 41943508434
- ATLAS Build + Production Readiness Gate: run 41943508357
- ATLAS Consensus CI: run 41943508344

GitHub combined commit status returned an empty `statuses` array. This does not negate the successful workflow-run results; it also does not prove that Academy's isolated Vitest suite ran. Job logs/steps and required-check policy have not been inspected, and no standalone local test execution was performed in this run.

## P0 missing evidence
1. Confirm Academy Vitest test file actually executed, plus TypeScript check on the exact SHA; inspect job steps/logs.
2. Test authenticated enrollment and trusted server-side rubric loading.
3. RLS/RBAC negative tests for two organizations, cross-tenant reads/writes and revocation during concurrent sessions.
4. Durable transactional idempotency of attempts and credential issuance under concurrent workers.
5. Private-by-default public verification, irreversible audited revocation and anti-enumeration.
6. Keyboard/mobile accessibility and real E2E tests; deployed exact-SHA release verification.
7. Recheck current PR HEAD before claiming exact-SHA readiness after any new commit.

## Next safe action
Audit actual workflow jobs to determine whether the Academy tests ran; add a dedicated Academy test command/check only after inspecting existing CI conventions. Do not issue credentials or enable production paths.


## F2.8 — Canonical unit CI coverage alignment (2026-11-05, America/New_York)

- Pre-change Academy assessment test SHA: `f3c960f60ddb1a25f68fb4722ff81c28783fb532`; seven PR-triggered workflows returned `completed/success` for that exact SHA (runs 41982378166, 41982378150, 41982378111, 41982378152, 41982377965, 41982377960, 41982377976).
- Inspected job `127095208860` (Hospitality Core focused TDD): Typecheck, Unit suite, Integration suite and Production build steps all `success`; inspected job `127095209125` (Build + Production Readiness Gate): Verify complete repository `success`. **Step summaries alone do not identify which Academy test file was executed.**
- Discovered existing `tests/unit/academy-assessment-security.test.ts` (canonical unit-suite smoke test) and `packages/learning/academyAssessment.test.ts` (domain-specific tests). Rather than creating another runner or workflow, added seven fail-closed assertions to the existing canonical unit smoke test covering non-finite/coercible thresholds, null/empty question arrays and malformed question IDs/answer keys.
- Test change commit: `ef3518807cc7bf3c59dd300221465e500384745e`. This is a **test-only** commit, no issuer, DB, auth or production changes. CI and direct test execution for this SHA must be independently verified. No claim of red/green TDD execution.
- Gate: obtain exact-SHA CI for test commit and ledger commit; inspect job logs for explicit test filename or reporter output. Then address server-side authenticated enrollment and tenant-isolated credential issuance with negative tests; P0 NO-GO remains.


## F2.9 — RED TOCTOU regression and bounded source fix (2026-11-05 ET)

- Inspected draft PR #992 at head `72067191e0eddcc73c24c86359d9229c43b758e6` before edit; scoped to issue #990 and existing Academy branch. Exact-SHA CI: six workflows SUCCESS, `ATLAS Hospitality OS TDD` run 42139445737 FAILURE. Job 127635786213 steps: Hospitality core contracts SUCCESS, Academy domain assessment FAILURE, subsequent typecheck/unit/integration/build SKIPPED.
- Read full job log: Vitest 20 tests total, **19 passed / 1 failed**. Failing regression `packages/learning/academyAssessmentBoundary.test.ts:94` expects rejection when enrollment is revoked during rubric loading, but grade resolved with `passed: true`. This is genuine reproducible RED evidence for a non-persistent TOCTOU gap.
- Bounded source correction commit `8184558ddf22e38abb0f81e7b7917339c4040af5`: after rubric lookup, re-read enrollment through trusted server dependency and require exact user/org/enrollment/course and active status before returning grade. No browser-supplied identity, no credential issuance or DB mutation. **This second read narrows the observed race but is not atomic**: later revocation remains possible; durable issuance requires locked transactional reauthorization and idempotency.
- GREEN verification for correction commit and this ledger commit **not yet observed**; no local test execution. Do not mark CI green before exact-SHA job/log inspection. P0 NO-GO: no real DB RLS/RBAC isolation, revocation-under-lock, concurrent issuance, durable idempotency, accessibility E2E or deployment verification.


## F2.10 — reconcile TOCTOU fix with scoped dependency call-count (2026-11-06 UTC)

- Verified PR #992 was Draft/open at HEAD `5b39d4174475c2d401c2443d3ac8b59b4947cb6c`. Exact-SHA CI: six workflows SUCCESS, Hospitality TDD run `42145736089` FAILURE. Job `127656680711` log: Hospitality 20/20 passed; Academy 19/20 passed. Failure is **test expectation drift**, not observed bypass: `academyAssessmentBoundary.test.ts:61` expected one scoped enrollment lookup but received two, as required by the F2.9 revocation recheck. TOCTOU regression itself passed.
- Bounded test-only fix `442c8cc0aef0d2557ba1aea5624b760cd5529841`: expect exactly two identical user/org/enrollment-scoped lookups; preserve strict argument equality and all revocation assertions. No production implementation, credential issuance, database, secrets or workflow change.
- **Pending**: verify exact-SHA Hospitality job GREEN on test commit and on this ledger commit; inspect logs for 20/20 Academy, Typecheck, unit/integration/build. Until verified, P0 NO-GO. Remaining critical gaps: real transactional issuance, RLS/RBAC tenant negatives, concurrent idempotency/revocation, accessibility E2E. No merge/deploy.
