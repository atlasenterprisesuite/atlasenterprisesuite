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
- Attempts exhausted become a persisted blocked/dead-letter result; the adapter
  never reports that as success or endlessly retries.
- Branch/SHA drift, staged changes, unrelated dirty paths, symlinks, hardlinks,
  protected paths, dependency/build directories and source conflicts fail closed.
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
  tests/unit/atlas-777-executor.test.ts \
  tests/unit/atlas-777-autonomous-executor.test.ts
```

The first local-cycle test creates a synthetic Git repository and launches three
independent Node processes: A changes a function from returning 0 to returning
42; B resumes state and runs a real assertion of that behavior; C confirms no
repeated work. Additional tests exercise missing approval, mutable plans,
missing evidence, concurrency/CAS, namespace isolation, expired interrupted
leases, exhausted retries, protected paths, symlinks, SHA drift and failing tests.
This proves a local functional loop with synthetic data, not an always-on service.

The existing `atlas-777-worker.yml` includes a PR-only Ubuntu proof job and
uploads test results under the PR SHA. Scheduled observation remains unchanged
and has no source-write authority. No new scheduler is created.

Local validation on the reconstructed worktree: 1,531 unit tests, 997 integration
tests, TypeScript and production build passed. Vite reported its existing large
bundle advisory. The worktree overlays #867's files onto local base
`6f7bc8bf7ccb4c50afb347281c934b4cf1925786`; those aggregate results are not
whole-PR exact-SHA certification. GitHub CI must verify the published commit.

### CI diagnosis on the initial published pilot

At `692a72830ddd0774dcff101c4bb5692312a32e32`, nine other PR workflows passed,
but the local proof and Council security workflows failed. The proof job checked
out a merge tree whose `npm test` script chained several runners, sending the
focused Vitest arguments to the wrong runner. It now checks out the exact PR
head, invokes the installed Vitest binary directly and requires its JSON
artifact. The same focused command passed all 32 tests locally.

Council job `133373595190` failed because the old PR head does not contain
`tests/node/atlas-ai-council-security-gates.test.mjs`; its continuity step was
therefore never reached. This is a blocking branch-reconciliation issue, not a
Cloudflare/network diagnosis. Current main `f632c3140e20e99b34808682f3109f24146078b4`
contains that suite and `tests/node/atlas-model-continuity.test.mjs`, but its
intelligence gateway, message store and background authorization implementation
also differ from this branch. Do not copy only tests, skip the gate or assert
whole-PR certification. Reconcile the reviewed main changes on the canonical
branch and rerun both security suites and all required CI on the resulting SHA.
This pilot does not change those unrelated runtime modules.

## Remaining delivery gates

1. Current PR exact-SHA CI, independent review and main reconciliation.
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
