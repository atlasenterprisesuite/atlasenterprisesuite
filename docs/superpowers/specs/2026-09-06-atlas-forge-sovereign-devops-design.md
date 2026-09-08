# ATLAS Forge / Sovereign DevOps Design

Date: 2026-09-06
Status: Approved design, pending implementation-plan review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Release branch: `release/atlas-a-z`

## 1. Objective

Create a first-party ATLAS development and release platform that lets ATLAS continue building, testing, reviewing, packaging, and releasing software even when GitHub or another third-party platform is unavailable, rate-limited, misconfigured, or operationally blocked.

The goal is not to clone proprietary GitHub implementation details. ATLAS Forge will reproduce the capabilities ATLAS actually needs using Git-compatible protocols, ATLAS-owned orchestration, compatible open standards, and replaceable infrastructure adapters.

GitHub remains supported as an external mirror and collaboration provider, but it must not remain a single point of failure for ATLAS development.

## 2. Success Criteria

ATLAS Forge is successful when all of the following are true:

1. ATLAS has at least one first-party authoritative Git-compatible repository service under ATLAS control.
2. ATLAS can execute CI jobs on runners it controls without requiring GitHub-hosted Actions runners.
3. Every build can be tied to a source SHA, actor, timestamp, test result, artifact digest, and release state.
4. ATLAS can continue work during a GitHub outage and reconcile changes back to GitHub later without rewriting history unnecessarily.
5. GitHub is treated as an adapter/mirror, not as the only place where branches, reviews, artifacts, or release evidence exist.
6. CI jobs run in isolated, disposable execution environments with no implicit production credentials.
7. Secrets are stored outside the Git repository and are injected only into explicitly authorized jobs.
8. Release gates cannot be bypassed by UI state alone; policy is enforced by backend logic.
9. Build artifacts are content-addressed or checksum-verified and stored independently of the source host.
10. ATLAS can prove whether a release passed typecheck, unit, integration, E2E, security, build, and health verification gates.
11. A provider outage surfaces as `degraded` or `unavailable` instead of stopping the entire development system.
12. At least two independent repository copies/backups exist so ATLAS Forge itself does not become a new single point of failure.

## 3. Scope Boundary

This implementation cycle covers the sovereign development path needed to keep ATLAS moving:

- source repository service
- source mirrors
- branch/ref management
- commit/diff metadata
- CI pipeline definitions
- self-hosted runner orchestration
- job logs and evidence
- build artifacts
- release gates
- release candidates
- deployment handoff contracts
- rollback metadata
- GitHub synchronization adapter
- audit and RBAC contracts
- health and readiness states

The first cycle does not need to reproduce every GitHub product feature. Social feeds, stars, public marketplace behavior, generalized issue hosting, discussions, package ecosystems, and unrelated developer-network features are out of scope unless later required by ATLAS.

## 4. Architectural Principle

ATLAS Forge follows a provider-independent core with replaceable adapters.

The domain model belongs to ATLAS. GitHub, a local Git server, an object store, a VPS runner, Vercel, Cloudflare, or any future provider plugs into ATLAS through explicit interfaces.

The core must never import provider-specific SDK details into business logic.

Conceptually:

```text
Developer / ATLAS Agent
        |
        v
ATLAS Forge API
        |
        +--> Source Control Core
        +--> Pipeline Orchestrator
        +--> Review + Gate Engine
        +--> Artifact Vault
        +--> Release Engine
        +--> Audit / RBAC / Observability
        |
        +--> Git Service Adapter
        +--> Runner Adapter
        +--> Artifact Store Adapter
        +--> GitHub Mirror Adapter
        +--> Deployment Adapter(s)
```

## 5. Proposed Repository Structure

The first-party implementation should extend the current monorepo without creating duplicate architecture trees.

```text
apps/
  web/
    src/
      modules/
        forge/
          ForgeHome.tsx
          RepositoriesPage.tsx
          PipelinesPage.tsx
          RunsPage.tsx
          ArtifactsPage.tsx
          ReleasesPage.tsx
          MirrorsPage.tsx
          ForgeSettingsPage.tsx

  forge-api/
    src/
      api/
      auth/
      repositories/
      pipelines/
      runners/
      reviews/
      artifacts/
      releases/
      mirrors/
      audit/
      health/

packages/
  forge-core/
    source/
    pipeline/
    runner/
    review/
    artifact/
    release/
    mirror/
    policy/
    events/
    types/

  forge-git/
    bare-repositories/
    refs/
    packfiles/
    hooks/
    integrity/

  forge-runner/
    protocol/
    execution/
    sandbox/
    logs/
    heartbeats/

  forge-github-adapter/
    sync/
    pull-requests/
    statuses/
    webhooks/

  forge-artifacts/
    manifests/
    checksums/
    storage/

  forge-deploy/
    contracts/
    targets/
    verification/
```

If later implementation shows that `apps/forge-api` should be folded into an existing ATLAS backend service, that is acceptable as long as the domain boundaries above remain intact and no parallel backend architecture is created.

## 6. Source Control Core

### 6.1 Git Compatibility

ATLAS Forge must use standard Git semantics and preserve compatibility with normal Git clients.

Required capabilities:

- repositories
- branches and refs
- commits
- tags
- merge-base calculation
- diffs
- fetch/push
- immutable commit object verification
- protected branch policy
- mirror configuration

ATLAS should not invent a proprietary source format.

### 6.2 Authoritative Repository

The first-party repository service becomes an ATLAS-controlled source of truth for development continuity.

During migration, GitHub may remain primary for some workflows, but every authoritative branch used for ATLAS release work must have a verified ATLAS-controlled mirror.

The migration completes only after ATLAS can create a commit, run its gates, and produce a release candidate without contacting GitHub.

### 6.3 Repository Integrity

The system records:

- repository ID
- canonical name
- commit SHA
- parent SHAs
- tree SHA
- author/committer metadata
- creation time
- signature state when available
- mirror state
- last verified backup

Repository mutations must emit audit events.

## 7. Pipeline Orchestrator

ATLAS Forge pipelines replace GitHub Actions as the mandatory execution path over time.

### 7.1 Pipeline Definition

Pipelines should be declarative and versioned with source code.

Initial pipeline primitives:

- checkout
- dependency install
- environment preparation
- typecheck
- unit test
- integration test
- E2E test
- dependency/security scan
- source safety scan
- build
- artifact publish
- release-gate evaluation
- deployment handoff
- post-deploy verification

The first implementation should support the existing ATLAS commands rather than inventing a second test language.

Example logical sequence:

```text
checkout
-> npm ci
-> npm run typecheck
-> npm run test:unit
-> npm run test:integration
-> npm run test:e2e
-> npm audit --audit-level=high
-> npm run build
-> artifact digest
-> consensus gate
-> release candidate
```

### 7.2 Pipeline Run Model

Each run records:

- run ID
- repository ID
- source SHA
- pipeline version
- trigger
- requested actor
- assigned runner
- start/end time
- status
- job results
- log references
- artifact references
- gate result
- correlation ID

Statuses:

`queued | assigned | running | passed | failed | cancelled | timed_out | infrastructure_error`

An infrastructure failure must be distinguishable from a failing test.

## 8. Runner Architecture

### 8.1 Self-Hosted Runners

The first operational milestone is an ATLAS-controlled runner capable of executing the current monorepo CI commands.

A runner must:

- authenticate to Forge with a short-lived credential
- poll or receive signed work assignments
- execute one isolated job at a time
- stream logs
- publish exit status and evidence
- upload artifacts
- heartbeat while active
- self-report capacity and health

### 8.2 Isolation

Jobs must execute in disposable workspaces. Preferred progression:

1. isolated local process only for earliest bootstrap tests
2. containerized disposable job environment
3. stronger sandbox/VM boundary for high-risk or untrusted workloads

Production secrets must never exist in the default CI runner environment.

### 8.3 Runner Pools

Forge should model runner pools so ATLAS can later use:

- VPS runners
- local workstation runners
- dedicated build servers
- cloud workers
- temporary burst runners

The pipeline depends on capability labels, not on one hosting vendor.

## 9. Review and Gate Engine

ATLAS needs review semantics but does not need to recreate GitHub Pull Requests internally in the first milestone.

The first-party review object should model:

- source branch
- target branch
- source SHA
- target SHA
- changed files
- review state
- required gates
- approvals
- comments/notes
- merge eligibility
- merge result

Initial states:

`draft | review_required | changes_requested | approved | blocked | mergeable | merged | closed`

The review engine may synchronize to GitHub PRs when GitHub is available, but its core state must remain meaningful without GitHub.

## 10. Consensus and Policy Gates

Existing ATLAS consensus rules remain authoritative.

The Forge gate engine will evaluate at minimum:

- Product/UX result
- Architecture/Build result
- Security/Reliability result
- required CI jobs
- unresolved blocker count
- secret scan
- dependency audit
- protected-branch policy
- release authorization

A release candidate is created only when all configured mandatory gates pass.

No UI toggle can directly mark a failed gate as passed.

Any override, if later supported, must require an explicit high-privilege permission, mandatory reason, audit event, expiry, and visible exception state.

## 11. Artifact Vault

ATLAS Forge must store build outputs and evidence independently from GitHub.

Each artifact record includes:

- artifact ID
- source SHA
- pipeline run ID
- artifact type
- file name
- size
- SHA-256 or stronger digest
- storage adapter
- creation time
- retention policy
- release association
- verification state

Artifacts must be immutable once attached to an approved release candidate.

The storage implementation may initially use an existing object store or filesystem adapter, but the domain contract must permit migration without changing release logic.

## 12. Release Engine

The release state machine is:

```text
draft
-> validating
-> candidate
-> approved
-> deploying
-> verifying
-> released

          -> blocked
          -> failed
          -> rolled_back
```

A release record includes:

- release ID
- source SHA
- artifact digests
- pipeline run IDs
- approval actor
- approval timestamp
- deployment target
- deployment result
- health verification result
- rollback source
- audit correlation ID

The deployment adapter may target existing providers during migration. Forge sovereignty does not require replacing every hosting provider immediately; it requires that ATLAS development and release logic not disappear when one provider is inaccessible.

## 13. GitHub Mirror Adapter

GitHub remains a supported external adapter.

Capabilities:

- push ATLAS refs to GitHub
- fetch GitHub refs
- detect divergence
- synchronize approved branches
- mirror tags
- synchronize review/status metadata where appropriate
- ingest webhook events
- surface provider health

Mirror states:

`healthy | syncing | behind | diverged | authentication_required | rate_limited | unavailable`

Forge must never silently force-push over diverged history.

Divergence requires a reconciliation decision with audit evidence.

## 14. Provider Independence

Forge contracts must not depend on the availability of:

- GitHub
- GitHub Actions
- Vercel
- Cloudflare
- Supabase
- any single VPS provider

These may remain active adapters.

The long-term rule is:

> ATLAS owns the workflow, state, evidence, and policy. Providers supply replaceable capabilities.

## 15. RBAC

Initial Forge permissions:

- `forge.read`
- `forge.repository.read`
- `forge.repository.write`
- `forge.pipeline.read`
- `forge.pipeline.execute`
- `forge.runner.read`
- `forge.runner.manage`
- `forge.review.read`
- `forge.review.approve`
- `forge.artifact.read`
- `forge.release.read`
- `forge.release.approve`
- `forge.release.deploy`
- `forge.mirror.manage`
- `forge.admin`

Repository write permission does not imply release approval.

Release deployment must remain separately gated.

## 16. Audit Contract

Every sensitive Forge action emits a shared ATLAS audit event containing:

- event ID
- tenant ID
- organization ID
- actor ID
- action
- resource type
- resource ID
- before state
- after state
- timestamp
- correlation ID
- source IP/session metadata when available
- provider adapter involved, if any

High-value audit actions include:

- repository creation/deletion
- protected branch change
- mirror change
- runner registration/removal
- secret access grant
- gate override
- review approval
- artifact promotion
- release approval
- deployment
- rollback

## 17. Secret Management

Secrets must not be committed to Git.

Forge stores only secret references in pipeline definitions.

Required properties:

- encrypted at rest
- scoped to tenant/organization/project/environment
- explicit job access policy
- no plaintext display after creation
- rotation metadata
- audit trail
- environment separation

The first implementation may use an external secret backend if necessary, but Forge owns the access contract so the backend can be replaced later.

## 18. Observability and Health

Forge exposes health independently for each subsystem:

- source service
- database/metadata service
- runner scheduler
- runner pool
- artifact store
- mirror adapter
- release engine

Readiness states reuse ATLAS conventions:

`ready | degraded | not_configured | unavailable`

Example:

- GitHub unavailable + local Git healthy + runner healthy = Forge remains operational with GitHub mirror `degraded`.
- Runner unavailable = source operations remain available, pipelines become `degraded`.
- Artifact store unavailable = builds may run but cannot become release candidates.

## 19. Failure Handling

### GitHub outage

Continue commits, internal reviews, pipelines, artifacts, and release-candidate preparation locally. Queue mirror synchronization for recovery.

### Runner failure

Mark job `infrastructure_error`, preserve logs, and retry on another healthy runner when policy permits.

### Pipeline test failure

Mark job `failed`; do not classify as infrastructure error and do not retry indefinitely.

### Artifact upload failure

Do not mark the release candidate valid. Preserve the successful build evidence but require artifact publication to complete.

### Mirror divergence

Stop automatic synchronization. Show both SHAs and require an explicit reconciliation path.

### Forge primary repository failure

Fail over to a verified replica/backup according to recovery policy; do not promote an unverified copy silently.

## 20. Backup and Disaster Recovery

At least two independent source copies are required.

Initial strategy:

- primary ATLAS Git service
- independent Git mirror/backup location
- GitHub mirror while available
- scheduled integrity verification

Backup verification must test restoration, not only file existence.

Recovery objectives will be defined in implementation planning, but the architecture must support periodic repository and metadata snapshots plus artifact manifest backups.

## 21. Web UI

ATLAS Forge appears under the ATLAS application shell, not as a separate product tree.

Initial routes:

- `/forge`
- `/forge/repositories`
- `/forge/pipelines`
- `/forge/runs`
- `/forge/artifacts`
- `/forge/releases`
- `/forge/mirrors`
- `/forge/settings`

UI rules:

- no fake successful runs
- no fake connected providers
- no decorative deployment metrics presented as operational
- every button maps to a real permission-gated action
- provider failures expose degraded states
- source SHA is visible for build/release evidence

## 22. Testing Strategy

### Unit

- pipeline state machine
- release state machine
- gate policy
- mirror divergence detection
- artifact digest verification
- RBAC predicates
- runner assignment rules
- retry classification

### Integration

- repository push updates Forge metadata
- pipeline binds to exact commit SHA
- runner receives authorized job only
- logs attach to correct run
- artifact publication validates digest
- failed gate blocks release candidate
- GitHub outage does not block local source + CI path
- mirror recovery synchronizes non-divergent refs

### E2E

Minimum sovereign-development scenario:

1. Create or register an ATLAS repository.
2. Push a branch/commit.
3. Open an internal review.
4. Trigger pipeline.
5. Assign job to ATLAS-controlled runner.
6. Run typecheck/tests/build.
7. Upload build artifact and checksum.
8. Evaluate mandatory gates.
9. Create release candidate.
10. Simulate GitHub unavailable and verify the workflow still completes through release-candidate state.
11. Restore GitHub adapter and synchronize refs.
12. Verify complete audit chain by source SHA and correlation ID.

## 23. Migration Plan

Migration is incremental so ATLAS does not stop while sovereignty is being built.

### Phase 1 — Continuity Bootstrap

- define Forge core contracts
- register one ATLAS-controlled runner
- execute existing ATLAS CI commands outside GitHub-hosted runners
- collect logs and result evidence
- retain GitHub repository as current collaboration host

Success: a GitHub Actions runner outage no longer prevents ATLAS from running its validation suite.

### Phase 2 — Artifact and Gate Independence

- first-party run records
- artifact vault
- consensus gate engine
- release-candidate records

Success: build and release evidence exists independently from GitHub checks.

### Phase 3 — Source Independence

- ATLAS-controlled Git service
- branch/ref management
- protected branch policy
- verified repository backups
- GitHub mirror adapter

Success: ATLAS can commit and continue development with GitHub offline.

### Phase 4 — Review and Release Independence

- internal review objects
- approvals
- merge eligibility
- release engine
- deployment adapters
- rollback records

Success: GitHub PR and Actions are optional integrations.

### Phase 5 — Resilience Hardening

- multiple runners
- multiple repository copies
- recovery drills
- secret rotation
- observability
- provider failure tests

Success: ATLAS Forge has no known single third-party operational dependency for normal software-development continuity.

## 24. Integration With Current A-Z Closure

ATLAS Forge is a Platform Services capability and belongs conceptually in Wave 4, but the Continuity Bootstrap is allowed to begin earlier because it directly removes a blocker to completing every other wave.

This exception does not authorize a separate product release or partial production deployment.

The current `release/atlas-a-z` remains the integration branch. `main` remains protected from the incomplete A-Z release until the existing final release gate is satisfied.

Forge must reuse ATLAS Core tenancy, RBAC, audit, result/error, readiness, and correlation contracts instead of recreating them.

## 25. Non-Goals and Legal Boundary

ATLAS Forge will not:

- copy proprietary GitHub server source code
- scrape or reproduce confidential implementation details
- depend on undocumented private GitHub interfaces
- claim compatibility that has not been verified
- expose third-party trademarks as ATLAS-owned features

ATLAS may lawfully implement comparable developer-platform capabilities through independent implementation, standard Git protocols, public APIs, compatible open-source components, and ATLAS-owned code.

## 26. Initial Implementation Slice

The first implementation slice is intentionally narrow:

```text
Forge Core contracts
-> runner registration
-> one self-hosted runner
-> pipeline execution for existing ATLAS commands
-> logs + exit status
-> source SHA binding
-> artifact manifest
-> GitHub status reported as optional mirror state
```

No internal PR UI, generalized repository hosting, or deployment replacement is required in this first slice.

The purpose is immediate development continuity.

## 27. Definition of Done for the First Slice

The first slice is complete only when:

1. A runner under ATLAS control is registered and healthy.
2. A pipeline run is created for a specific `release/atlas-a-z` SHA.
3. The runner checks out that exact SHA.
4. Typecheck, unit, integration, security scan, and production build commands execute.
5. Logs are captured and associated with the run.
6. Exit status is classified correctly as pass/fail/infrastructure error.
7. Build artifact manifest contains a cryptographic digest.
8. The run can complete without GitHub Actions assigning a hosted runner.
9. GitHub unavailability is represented as mirror degradation, not global Forge failure.
10. Audit evidence identifies actor, SHA, runner, pipeline, result, and correlation ID.

## 28. Final Architectural Rule

ATLAS Forge exists to guarantee continuity, not to create another lock-in.

ATLAS must always be able to export its Git repositories using standard Git, export pipeline/release evidence in documented formats, move artifact storage, replace runner infrastructure, and replace provider adapters without rewriting ATLAS business modules.
