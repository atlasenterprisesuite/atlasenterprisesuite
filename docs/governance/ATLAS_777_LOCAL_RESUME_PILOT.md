# ATLAS 777 — bounded local implementation and resumption

Status: local synthetic pilot; P0 NO-GO for autonomous production development.
Canonical work: issue #866 / existing Draft PR #867; master ledger #993.

## Reuse and scope

This adapter extends #867's existing `Job`, `enqueue`, `claim`, `finish` and
`AtomicJobStore` contracts. It does not create a second orchestration engine.
The merged #927 verification kernel and #827 persistent verification workflow
remain unchanged. #188 Night Operations and #917 SQL claim/completion remain
separate dependencies for authenticated remote operation, not duplicate targets.

The only new job action is `implement`, admitted by a trusted local adapter.
It replaces **one existing source file** with exact approved content on an
isolated `feat/`, `fix/` or `audit/` branch, then runs one digest-bound existing
Node test. It never generates a patch from an issue, prompt or external page.
No model credentials, provider spend, shell payload, Git commit/push, PR creation,
merge, deployment or production mutation is performed by this adapter.

## Execution contract

An operator prepares and reviews a local JSON plan:

```json
{
  "version": 1,
  "id": "unique-task-id",
  "sourceEventId": "authorized-source-reference",
  "organizationId": "local-organization-id",
  "repository": "atlasenterprisesuite/atlasenterprisesuite",
  "baseSha": "<actual 40-character commit SHA>",
  "branch": "feat/isolated-task-branch",
  "change": {
    "path": "packages/example/existing-file.mjs",
    "beforeSha256": "<actual SHA-256 of existing file bytes>",
    "content": "<reviewed replacement source>"
  },
  "test": {
    "path": "tests/example.test.mjs",
    "sha256": "<actual SHA-256 of reviewed acceptance test>"
  }
}
```

After review, provide the SHA-256 of `JSON.stringify(parsedPlan)` as an
independent invocation argument. The digest binds a plan to its approval; it is
**not a digital signature or proof of authenticated user identity**. Never
automatically take both plan and approval digest from an untrusted issue/chat.
The local OS account and the explicitly authorized launcher are the trust boundary.

```sh
node --experimental-strip-types \
  scripts/atlas-777-local-cycle.mjs \
  /absolute/isolated-worktree /absolute/private-state-directory \
  /absolute/reviewed-plan.json APPROVED_PLAN_SHA256
```

One invocation performs at most one job. A subsequent invocation uses the same
plan and state directory to continue. The first implements, the next tests,
and later invocations verify completion without repeating the patch/test.
The library permits a maximum of two jobs in a call. Use one fixed state
directory per isolated worktree/plan; it rejects a different plan digest.
The state directory must be outside the worktree on a private local POSIX
filesystem. Windows fails closed pending an ACL-backed adapter.
Source and acceptance files must belong to the invoking OS user and must not
allow group/world writes. Shared writable checkouts are rejected before claiming
or editing; the worker does not silently change their permissions.

## Persistence and failure behavior

- File adapter: private directory 0700, records 0600, atomic exclusive lock,
  compare-and-swap version, fsync and atomic rename; organization/repository/plan
  binding and immutable job identity.
- Completion and its evidence are written together. Completed checkpoints
  without matching evidence are rejected. Resume also checks source/test hashes.
  Receipts include local OS UID, worker ID, source reference and observation time;
  these are local audit metadata, not an authenticated remote identity.
- Unique lease owners and CAS prevent stale completion. An expired lease can
  be claimed for at most a second attempt. After a partial edit, the approved
  output hash is reconciled rather than blindly replaying the operation.
- Source temporaries are named from their persisted lease owner. Recovery only
  removes that expired lease's regular, singly linked, same-UID file containing
  complete approved bytes or an exact byte prefix, after winning a new claim.
  Active leases and unknown/conflicting temporaries are preserved. Legacy random
  temporary names cannot be attributed and require safe owner reconciliation.
- Attempts exhausted become a persisted blocked/dead-letter result; the adapter
  never reports that as success or endlessly retries.
- Branch/SHA drift, staged changes, unrelated dirty paths, symlinks, hardlinks,
  protected paths, dependency/build directories and source conflicts fail closed.
  Branch, SHA and worktree cleanliness are rechecked before and after actions;
  a test cannot change them and still produce a completed acceptance receipt.
- The plan is cloned before asynchronous I/O so approval cannot be changed by
  mutating its caller's object.
- The acceptance command is fixed to `node --test <reviewed-file>` with no shell,
  inherited credentials or NODE_OPTIONS. Its failure output is not echoed.
- A test is executable code: use a trusted reviewed test in an isolated sandbox.
  This launcher does **not** itself implement an OS network/filesystem sandbox.
- Unexpected termination while holding the short state-write lock leaves a
  fail-closed lock. It requires owner reconciliation; do not automatically delete
  a lock based solely on age. A crash outside that critical section is recovered
  through the existing expiring job lease.
- Local state ownership is not server RBAC/RLS, a signed native agent, a
  distributed queue, a cross-device bridge or authenticated chat ingestion.

`baseSha` identifies the original worktree commit, while the source receipt binds
the proposed changed bytes. The adapter leaves the worktree uncommitted. A local
acceptance result therefore does not certify a later commit's CI or production.
`productionVerified` is always false even when both local jobs complete.

## Repeatable acceptance

```sh
npm exec --no -- vitest run tests/unit/atlas-777-local-cycle.test.ts \
  tests/unit/atlas-777-atomic-store.test.ts \
  tests/unit/atlas-777-executor.test.ts
```

The process-resumption test creates a synthetic Git repository and launches three
independent Node processes: A changes a function from returning 0 to returning
42; B resumes state and runs a real assertion of that behavior; C confirms no
repeated work. Additional tests exercise missing approval, mutable plans,
missing evidence, concurrency/CAS, namespace isolation, expired interrupted
leases, exhausted retries, protected paths, symlinks, SHA drift and failing tests.
This proves a local functional loop with synthetic data, not an always-on service.

The three pilot suites contain 31 tests: 23 resumable-loop cases and eight
existing state/CAS cases. The existing `atlas-777-worker.yml` includes a PR-only
Ubuntu proof job, requires those three suites and all 31 passing results, and
uploads test results under the PR SHA. Scheduled observation remains unchanged
and has no source-write authority. No new scheduler is created.

### Review and branch reconciliation

The initial exact-head pilot passed 20 tests in Actions run `43890588697`,
but Council security failed because its old branch lacked the suites required
by current main. Main `d9dfae686d9f0a266be18064b4cf3d410bb09e89` is now reconciled
into the feature branch, preserving its reviewed security/runtime changes.
The pilot remains an 11-file delta relative to that main revision; no second
implementation of the intelligence gateway or security suites is introduced.

Independent review identified branch/SHA/dirt changes during acceptance, orphan
source temporaries preventing recovery, and exhausted claims whose terminal state
was not persisted by `claimPersisted`. Eight regression assertions failed before
their corresponding fixes, including the shared-write permission boundary.
Regression coverage also preserves unknown
temporaries and prevents cleanup under an active lease. The focused report must
show the identities of all three suites, all 31 passing tests and no failed or
pending tests. Local results are not a substitute for published exact-head CI;
current logs, artifacts and full validation results are linked from PR #867.

After reconciliation, local validation passed 2,629 Vitest tests in 542 suites,
24 Node Council/continuity tests and 13 local-core Node tests. TypeScript and
the production build passed. Vite's existing large-bundle advisory and React
`act(...)` test warnings remain advisory; neither is a production certificate.
Independent code review found no remaining critical or important pilot defects.

The unrestricted `npm test` attempt was blocked because a possible external
Supabase request and credential use had not been established as safe. Validation
instead ran Vitest in a fresh Linux network namespace with only loopback, no
external IPv4/IPv6 interfaces/routes and a minimal credential-free environment.
The namespace was checked through `/proc/self/net` before starting tests.
The 13 local-core cases ran separately after confirming their real HTTP call
uses a synthetic server bound to `127.0.0.1`; the other transports are stubs.
No external Supabase operation was authorized by this validation.

Where Linux user/network namespaces are supported, the application-suite command
is reproducible without granting external network access:

```sh
unshare --user --map-root-user --net --fork \
  env -i PATH="$PATH" LANG=C NPM_CONFIG_CACHE=/tmp/atlas-777-isolated-npm-cache \
  npm exec --no -- vitest run
env -i PATH="$PATH" LANG=C node --test tests/node/*.test.mjs
env -i PATH="$PATH" LANG=C node --test tools/local-agent/tests/*.test.mjs
```

Namespace setup failure is a blocked run, not permission to fall back to an
unrestricted external test. Node suites retain their reviewed fixture boundary.

### Credential boundaries and the GitGuardian reference

The public event page for [Inside the Vault, Outside the Vault](https://www.gitguardian.com/events/credential-layer-webinar-2026-11-17)
describes a GitGuardian/1Password webinar on November 17, 2026, about credentials
inside and outside vaults. This is public event metadata, not a transcript or
evidence that its live stream was accessed. It does not enable a new integration.

For this pilot, plans, issues, logs and test reports must contain no real
passwords, recovery codes, bearer tokens or provider keys. An approved source
replacement must be reviewed for that boundary before invoking the launcher.
The existing local-core vault (`tools/local-agent/lib/local-core-vault.mjs`)
provides a separate encrypted local data primitive; it is not an authorization
to import Google/Apple passwords or expose them to ChatGPT or this worker.
Personal passwords, service credentials and account-issued recovery codes require
separate records and capability grants. Jobs should carry opaque references and
non-secret search metadata, with least privilege and explicit revocation.

The existing GitHub security baseline checks repository/workflow policy. Its
presence alone does not certify credential-leak detection, rotation, GitGuardian
installation or complete vault protection. Those capabilities remain unverified
unless their own authorized execution and evidence prove them.

## Remaining delivery gates

1. Current PR exact-SHA CI and independent review of the final corrected tree.
2. Persistent execution host and explicit enrollment/authentication, scoped
   permission and revocation checks, durable lifecycle and lock reconciliation.
3. Governed code-generation/repair adapter through the existing intelligence
   gateway; exact approved capabilities and attempt/cost budgets. This pilot
   only applies prepared deterministic changes.
4. Authenticated task ingestion from accessible conversations with provenance,
   per-task acceptance criteria, deduplication and master checkpoint linkage.
5. Real scheduled handoff that launches the adapter with an independently
   approved plan and preserves state between runs. A prompt update alone does
   not satisfy that gate; ChatGPT's inherited environment is not verified here.
6. Required merge/release authorization and post-deployment verification.

Keep the existing hourly Master task. It may track this PR and its evidence, but
must not declare every chat autonomous or this pilot installed on the user's
Windows laptop. No access to personal credentials or production was used.
