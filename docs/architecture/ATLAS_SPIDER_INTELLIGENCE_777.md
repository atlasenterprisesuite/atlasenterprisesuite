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

## 2026-10-27 isolated environment inspection
- Inspected exact baseline ff67dac7328d2fd455502f28b7579cbc96bcede2.
- package-lock.json v3 root hasInstallScript=true; dependency integrity entries exist but entire lockfile/transitive package scripts were not audited.
- scripts/install-render-local-ai.mjs exits unless RENDER=true; when enabled it performs curl downloads, tar extraction, chmod, and local filesystem writes. Never run install lifecycle hooks for this gate.
- vitest.config.ts imports vitest/config and configures jsdom plus tests/setup.ts; setup imports @testing-library/jest-dom/vitest.
- tsconfig.base.json uses strict, noEmit and bundler resolution; apps/web/tsconfig.json includes ../../packages and ../../data, so typecheck is not restricted to Spider.
- Local disposable runtime check: Node v22.16.0 and git available; no repository checkout or vetted local node_modules/vitest. No safe complete exact-SHA Vitest/typecheck execution environment was established.
- Gate decision: BLOCKED; do not install packages, run lifecycle scripts, or claim tests passed. For exact-SHA verification, require integrity-checked checkout and preapproved offline dependency cache with scripts disabled and no production credentials.
- Integration remains observation-only; #933 is pure planning, #927 needs atomic durable state, and no real executor callback is connected.

## 2026-10-27 verified source / offline execution follow-up
- Verified GitHub commit object exists for 0499f0c6cb003687d960323eed0f4691a549d89e via authorized GitHub connector. This is NOT an integrity-verified local Git checkout.
- Connector supports fetching individual files/blobs and commit metadata, but no demonstrated end-to-end export into this sandbox with verified tree reconstruction.
- Sandbox has Node v22.16.0 and Git v2.47.3. No Vitest executable, node_modules, or vetted offline dependency cache found in the inspected locations.
- Direct git ls-remote of repository failed because github.com DNS resolution is unavailable in the sandbox. No credentials were supplied or used.
- Consequently exact-SHA Vitest (11 tests) and full typecheck were NOT executed. Neither pass nor fail is established. No lifecycle scripts or npm install were run.
- Further static conclusion: a pure classifier cannot guarantee durable uniqueness or audit receipts. Do not wire it to #927 executor or claim transactional idempotency; a backend with atomic unique constraints and tenant RLS remains necessary.
- P0 remains open; this is a reproducible environment limitation, not an application test failure.
