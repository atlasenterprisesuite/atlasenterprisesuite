# ATLAS Spider Intelligence 777 — isolated TDD gate

## Verified source inspection
- Branch baseline: b9f0aade69fa56e0963322a17099fcf96e5ebee2.
- Pure classifier: packages/spider-intelligence/src/classify.ts.
- Eleven negative/positive Vitest cases: tests/unit/spider-intelligence.test.ts.
- Vitest config: jsdom and tests/setup.ts; setup imports @testing-library/jest-dom/vitest.
- Test module imports only vitest and the pure classifier. No application network/DB imports were identified in this direct import graph.
- Root package.json has a postinstall hook scripts/install-render-local-ai.mjs; npm install or npm ci must not be performed without auditing that hook and all transitive installation scripts.
- Root verify:all runs audit, build, scripts, and broader tests. It is NOT an approved isolated test command.
- apps/web typecheck runs tsc --noEmit, but includes ../../packages and ../../data. Its complete transitive compiler/plugin and dependency safety has not been established.

## Safe test gate (NOT executed)
Use a disposable checkout at the exact commit with preexisting vetted dependencies, no network access, no production secrets, read-only mounts except ephemeral temp, and disabled lifecycle scripts. Inspect lockfile, tsconfig.base.json, Vitest plugins, setup, dependency integrity, and test side effects before running:
- npx --no-install vitest run tests/unit/spider-intelligence.test.ts
- npm --workspace apps/web run typecheck
Record stdout, stderr, exit codes, SHA and environment. Do not infer passing from presence of test source.

## Read-only integration design
1. Spider classifies a signal as observation only; no job dispatch.
2. A trusted backend persists a unique (tenantId,idempotencyKey) observation with atomic insert, tenant RLS and immutable audit receipt.
3. The #933 multipotency planner may consume a sanitized observation only after independent active membership, exact SHA, verified evidence, valid lease and audit receipt; it remains a pure planner.
4. The merged #927 executor accepts only its existing bounded verify/audit/test/diagnose task contract. Do not call it from Spider until a durable atomic state store, tenant authorization and explicit action approval are independently verified.
5. #917 atomic runtime and #931 repair verification are P0 dependencies. Never treat a classifier result or planned task as a completed repair.

## Unresolved
No executable test result or exact-SHA CI was established for this feature. The classifier's previouslyObservedKeys input is an advisory in-memory snapshot, not durable idempotency; concurrency remains unsafe without a transactional store. Keep P0 open. No merge/deploy/production writes.
