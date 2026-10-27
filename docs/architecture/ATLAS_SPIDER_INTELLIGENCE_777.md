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

## 2026-10-27 static security TDD hardening
- Hardened classifier to reject malformed event, tenant and kind IDs; require strict UTC ISO timestamps and calendar validity; require explicit revoked=false; reject malformed idempotency history entries.
- Added six Vitest cases (17 total defined), covering impossible/ambiguous timestamps, malformed identities, unspecified revocation, malformed idempotency history, invalid severity and valid UTC milliseconds.
- Static-only change: no Vitest/typecheck run; no verified transactional persistence, authenticated membership lookup, immutable evidence receipt, or concurrency protection. Input context is untrusted unless a trusted backend validates it.
- Fail-closed here means classification-only; it does not imply authorization to execute jobs or repairs.

## 2026-10-27 atomic observation contract (isolated draft)
- Inspected #917 atomic runtime claim/completion SQL and external-effect ledger, plus #931 rollback-only repair fixture.
- Added tests/fixtures/spider-observation-atomic-isolated.sql: disposable schema, UNIQUE(tenant_id,idempotency_key), unique tenant-scoped receipt, SHA check, RLS enabled and public grants revoked, explicit ROLLBACK. No executable RPC or production migration.
- Added tests/unit/spider-observation-sql-contract.test.ts with seven static assertions. These do not execute PostgreSQL, do not establish transactional rollback, and do not test real concurrent workers.
- P0 prerequisites: verify authoritative membership source and revocation semantics; implement trusted transaction that locks/validates membership and inserts observation + audit receipt atomically; negative PostgreSQL tests for simultaneous inserts, cross-tenant, revoked actor, rollback on audit failure, false-success result, and replay; demonstrate RLS/grants in disposable DB.
- Never infer persisted or verified status from the pure classifier; do not wire #927 execution. No deploy, merge, or production changes.

## 2026-10-27 PostgreSQL negative TDD follow-up
- Added tests/fixtures/spider-observation-negative-isolated.sql with temporary tables and rollback-only negative assertions for duplicate idempotency key, audit rollback, revoked membership and cross-tenant membership.
- Read existing #917 runtime SQL and #931 isolated repair fixture as references. The #917 atomic migration is not present on this branch's base; do not treat it as merged or installed.
- Inspected runtime code; it uses org_id and tenant_id scopes but this is not sufficient evidence for the authoritative organization_members schema, revocation policy, or actual audit table. Integration with those sources remains blocked pending exact schema inspection.
- The new fixture is a single-session test and DOES NOT verify two-worker concurrency, RLS as a non-owner, or live authorization. No PostgreSQL instance was used. The fixture has not been executed.
- Next gate: dedicated disposable PostgreSQL with two separate connections and barrier synchronization, independent RLS roles, authoritative membership schema and a single transaction that inserts observation plus audit receipt; assert zero persisted rows on failure and no success response without committed receipt.

## 2026-10-27 membership and concurrency gate
- Found existing membership lookups in supabase/functions/atlas-creator/_shared/context.ts and supabase/migrations/20260925093000_atlas_chat_postgrest_runtime.sql: public.organization_members filtered by org_id, user_id and status='active'. This verifies a membership usage pattern, not the full CREATE TABLE definition, status transition guarantees, or RLS grants.
- Found existing shared public.audit_logs writes in atlas chat runtime; audit table schema/constraints still require exact-source inspection before implementing an atomic receipt.
- Spider currently scopes observations by tenant_id only; actual organization_members is scoped by org_id. A trusted mapping org_id+tenant_id and authenticated actor is required before integrating; never equate these identifiers.
- Added tests/fixtures/spider-observation-concurrency-isolated.sh as an explicit local-only fail-closed entrypoint. It refuses remote DB URLs and exits blocked: no misleading concurrent-test success. It is NOT a two-connection test harness and must not be reported as one.
- No verified ephemeral PostgreSQL available in this execution; no SQL tests run. Next stage needs exact audit schema, trusted org/tenant mapping, two-connection barrier, and rollback/receipt tests before any RPC or migration.

## 2026-10-27 auth schema and audit contract investigation
- Searched the accessible repository index for CREATE TABLE/ALTER TABLE/RLS of public.organization_members and public.audit_logs. Search yielded references to these existing shared tables, but NOT their authoritative original DDL or exhaustive later modifications. Therefore PK/FK, RLS, indexes, triggers, privileges and audit atomicity remain UNVERIFIED; do not invent them.
- Verified usage patterns: atlas-creator/_shared/context.ts authenticates the bearer via sb.auth.getUser(token), then queries organization_members by user_id and status='active', optionally selecting requested org_id. atlas_chat_postgrest_runtime.sql reads auth.uid() inside the DB and checks organization_members(org_id,user_id,status='active'), and writes audit_logs(org_id,user_id,action,table_name,record_id,new_data).
- auth.uid() is the authenticated DB request identity in that RPC, NOT a trusted caller-supplied UUID; any Spider implementation must preserve the DB authentication boundary and independently bind tenant_id to org_id.
- Proposed transactional contract (NOT implemented): validate DB auth identity and fresh active membership in the same transaction; check trusted org/tenant binding; insert immutable observation with UNIQUE(org_id,tenant_id,idempotency_key); insert shared audit_logs receipt; only return observed=true if both writes commit. On any missing membership, tenant mismatch, conflict, audit failure, or revoked membership, fail closed without success. Concurrency and revocation races require row locking/transaction isolation tests.
- No privileged RPC, migration, or database changes were introduced. Block implementation until authoritative DDL and RLS/grants are inspected in an isolated clone. The current SQL fixtures remain nonproduction drafts.

## 2026-10-27 authoritative DDL recovery attempt
- Searched repository code index for exact CREATE TABLE, ALTER TABLE, primary-key and policy patterns for public.organization_members and public.audit_logs. Results contain widespread references and calls but no authoritative creation statements. Cannot establish original DDL, later exhaustive changes, PK/FK, unique constraints, triggers, indexes, RLS policies or grants from these matches.
- Verified the existing shared audit insertion contract from atlas_chat_postgrest_runtime.sql: audit_logs(org_id,user_id,action,table_name,record_id,new_data). This is a column-usage observation, NOT a full schema guarantee.
- Authorization pattern remains auth.uid() plus organization_members(org_id,user_id,status='active'); no proof of concurrent revocation fencing or tenant binding. Do not substitute tenant_id for org_id.
- Required isolated catalog recovery (read-only, never production): pg_catalog.pg_class/pg_attribute/pg_constraint/pg_index/pg_trigger/pg_policy/pg_roles/pg_class.relrowsecurity and information_schema.role_table_grants for both tables; capture exact DDL, owner and migration history. This requires an explicitly verified disposable clone.
- Negative test specifications before an RPC: unauthenticated auth.uid() null, spoofed actor UUID, inactive/revoked membership, cross-org and cross-tenant, revoked membership during concurrent insert, duplicate idempotency key from two sessions, audit insertion error rolls back observation, receipt mismatch, zero-row success response, and client direct write denied by RLS/grants.
- No database catalog was queried; tests were not run. P0 remains open pending verifiable schema and disposable Postgres.

## Offline catalog inspection follow-up
Added tests/fixtures/spider-auth-catalog-readonly.sql and tests/unit/spider-auth-catalog-contract.test.ts. These are source-only, unexecuted checks for membership and audit metadata in a disposable clone. No clone was available; P0 remains open. Effective inherited privileges and function permissions require further review.

## Catalog privilege completeness follow-up
The read-only catalog inspector now includes relacl, schema ACL, effective table and schema privileges for anon/authenticated/service_role, pg_auth_members, role inheritance and bypass-RLS flags, default ACL, and related public function execute grants/security-definer flags. Six additional static Vitest checks were defined, not executed. This is metadata inspection design, not proof of authorization. No database connection or migration occurred. P0 remains open.

## Static contract validation follow-up
Fixed two classifier regressions: dotted signal kinds such as ci.failure were rejected by safeId; the timestamp regex contained double-escaped digit and decimal patterns. Added one regression test. The catalog function filter now reads pg_proc.prosrc instead of decompiling every routine; this reduces exposure to pg_get_functiondef failures for nonstandard functions. Static review only; Vitest, typecheck, PostgreSQL and CI have not passed or run in an isolated environment. P0 open.
