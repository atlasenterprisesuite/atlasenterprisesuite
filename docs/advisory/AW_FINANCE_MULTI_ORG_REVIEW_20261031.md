# Advisory Office isolated review — 2026-10-31

Status: NO-GO; P0 remains open. No merge, deploy, production SQL or provider credentials used.

Base: PR #946, `5c626e15eced83846ef26227f628982277884694`.
Local branch: `fix/advisory-multiempresa-777-20261031`.

## Changes and executed evidence

- Added behavioral bootstrap tests with mocked session and HTTP responses, synthetic data only.
- RED: 5 failed / 2 passed before the implementation change.
- Bootstrap now requires exactly one active firm with a nonempty ID and matching selected organization; rechecks organization after the response before allowing dependent calls.
- This client check is defense in depth, not server authorization or a transactional tenant binding; organization changes after the check remain a server-side responsibility.
- Repaired pre-existing literal newline escapes and overescaped regex in the privileged ACL test, which previously failed to parse.
- Focused Vitest run: 8 files, 38 tests passed. Includes bootstrap behavior, actor-org, RPC membership, ACL, search path, scope and persistence contracts. SQL text assertions do not prove database enforcement.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0; large bundle warning remains. Build was performed with uncommitted changes; generated manifest identifies the base commit and is not deployment evidence for the changed source.
- `git diff --check`: exit 0.
- Dependencies installed with `npm ci --ignore-scripts --no-audit --no-fund`; repository postinstall not executed.

## Unresolved blocking evidence

- No local PostgreSQL, psql, Docker or Podman executable was available. Authenticated database fixtures, migration application, SQLSTATEs, rollback and concurrent revocation remain unexecuted.
- The full `npm test` run was started but automatic approval review rejected further execution/polling because tests could contact an external Supabase endpoint of unknown ownership/environment. No complete-suite pass is claimed and external database effects were not established. Do not rerun without first isolating networking and verifying fixtures.
- Legacy SQL resolver still denies ambiguous multi-organization membership. Trusted explicit tenant binding and deterministic concurrent revocation proof remain P0.
- No remote branch publication, new PR, CI certification, merge or deployment performed.

## Follow-up: disconnected execution boundary

- Re-inspected local commit `75b749400f808c82803c241633da5d132fbaf346`; previous passing results were not rerun or upgraded to database evidence.
- Added `scripts/test-advisory-isolated.sh`: requires a fresh user/network namespace, verifies absence of external interfaces, clears inherited provider environment, invokes Vitest directly, and has no network-enabled fallback.
- Local namespace probe failed: `unshare: write failed /proc/self/uid_map: Operation not permitted`. Tests must not start under this condition. This is an environment boundary, not a failing application test.
- PostgreSQL concurrency proof remains unexecuted. The three write RPCs check membership before writing; that alone does not establish serialization with concurrent revocation.
- Required database cases: valid selected tenant with multiple memberships; forged or inactive selected tenant; cross-firm access; organization/firm membership revocation committed before authorization; two-session revocation/write interleavings with explicit barriers and final persisted-row assertions; rollback and denied-write SQLSTATE assertions.
- Backend tenant-binding and transactional locking changes remain pending. No unvalidated SQL change is claimed. Preserve the existing fail-closed resolver until a tested replacement exists.

### Executor verification follow-up

- Added `scripts/advisory-db-preflight.mjs`, a read-only prerequisite check with structured blocked status, source SHA and dirty state. No database or application test suite is started by this check.
- Five executor/preflight control tests passed locally. Updated the existing CI definition to include both control-test files; remote CI remains unexecuted.
- Actual preflight reported missing `postgres`, `initdb`, `pg_ctl`, `psql`, unavailable network namespace and root execution (PostgreSQL requires a non-root user). Database proof remains `not_executed`; source changes remain uncommitted.

- Replaced nested shell quoting with a literal heredoc and cleared inherited environment before starting the inner shell.
- Added a namespace capability probe: denial returns exit 78 before tests start; no fallback is attempted.
- `node --test tests/executor/advisory-isolated-runner.test.mjs`: 3/3 passed. Command doubles verify namespace denial, interface-check failure, environment removal and propagation of suite exit status. These are control-flow tests, not proof of real network isolation or database enforcement.
- Actual runner execution: exit 78, namespace denied by host; Vitest did not start.
- Backend SQL unchanged; P0 remains open; no merge or deploy.
