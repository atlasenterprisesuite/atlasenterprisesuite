# ATLAS Forge — Design Specification

Date: 2026-09-09
Status: Approved architecture, pending implementation plan
Branch target: `feat/atlas-forge`
Owner: ATLAS Manager

## Purpose

ATLAS Forge is ATLAS Enterprise Suite's provider-neutral source-control, collaboration, CI, and release workspace. Its purpose is to remove GitHub-hosted runner cost and entitlement as a production blocker while preserving Git compatibility, code history, review workflows, auditability, and production verification.

The governing rule is:

> ATLAS owns the development control plane. External source-control providers are adapters, not single points of failure.

ATLAS Forge does not reimplement the Git protocol. It uses Forgejo as the self-hosted Git collaboration engine and Forgejo Runner for workflow execution, then presents a governed ATLAS experience through ATLAS Identity and ATLAS Manager.

## Current Context

The canonical ATLAS repository is currently `atlasenterprisesuite/atlasenterprisesuite`. GitHub-hosted Actions are presently blocked before runner step allocation, so GitHub remains useful as a source mirror and historical collaboration provider but must no longer be the only CI execution authority.

ATLAS Manager already defines a Supabase-first production control plane with Cloudflare as the public edge. ATLAS Forge extends that architecture rather than replacing it.

Current required production architecture after this change:

`Source Control Provider → Build Runner → Supabase ATLAS Manager → Cloudflare → Production`

The active source-control provider may be ATLAS Forge, GitHub, or another future adapter. A provider is required only when selected for the active release.

## Technology Choice

### Selected: Forgejo + Forgejo Runner

Forgejo is selected as the Git collaboration engine because it provides Git repositories, branches, pull requests, issues, repository permissions, APIs, packages, and Actions-compatible workflows without requiring ATLAS to build a Git server from first principles.

Forgejo Actions workflows live under `.forgejo/workflows`, and jobs are dispatched to registered runners by labels. This allows ATLAS to run CI on a machine it controls rather than purchasing GitHub-hosted runner capacity.

ATLAS will pin an explicit supported Forgejo release and runner version during implementation. Version changes require compatibility verification before upgrade.

### Rejected: Build a Git hosting engine from scratch

Rejected because Git transport, packfiles, refs, credential handling, object storage, merge semantics, repository corruption recovery, and protocol compatibility create a large security and reliability surface that does not differentiate ATLAS.

### Rejected: Keep GitHub as mandatory CI authority

Rejected because the current runner-allocation blocker proves that provider entitlement or billing can halt delivery even when ATLAS source code is healthy.

## Architecture

```text
                    ┌────────────────────────────┐
                    │       ATLAS Forge UI       │
                    │  /developer/forge          │
                    └─────────────┬──────────────┘
                                  │
                           ATLAS Identity
                                  │
                    ┌─────────────▼──────────────┐
                    │       ATLAS Manager        │
                    │ provider-neutral SCM/CI    │
                    │ release + evidence brain   │
                    └───────┬───────────┬────────┘
                            │           │
                  ┌─────────▼───┐   ┌───▼────────────┐
                  │ ATLAS Forge │   │ GitHub Adapter │
                  │   Adapter   │   │ mirror/fallback│
                  └──────┬──────┘   └────────────────┘
                         │
                   ┌─────▼─────┐
                   │  Forgejo  │
                   │ Git + PRs │
                   │ Issues/API│
                   └─────┬─────┘
                         │
                  `.forgejo/workflows`
                         │
                 ┌───────▼────────┐
                 │ Forgejo Runner │
                 │ user-owned host│
                 └───────┬────────┘
                         │
        npm ci → audit → typecheck → unit → integration → build
                         │
                  verification evidence
                         │
                    ┌────▼─────┐
                    │ Supabase │
                    │ ATLAS    │
                    │ Manager  │
                    └────┬─────┘
                         │
                    Cloudflare
                         │
                    Production
```

## Hosting and Cost Boundary

ATLAS Forge software licensing target is $0.

The Forgejo server and Forgejo Runner require compute and persistent storage. The first implementation must support deployment to an existing authorized machine, VPS, or computer controlled by the user. ATLAS must not claim 24/7 availability until an always-on host is actually configured and verified.

No implementation step may require a paid GitHub Actions plan. If an optional provider later requires payment, ATLAS Manager must classify it as an optional-provider cost rather than a global blocker unless that provider was explicitly selected for the release.

## Components

### 1. ATLAS Forge UI

Primary route:

`/developer/forge`

Protected by the existing ATLAS Identity boundary.

Initial navigation:

- Overview
- Repositories
- Code
- Branches
- Pull Requests
- Issues
- Actions
- Releases
- Runners
- Settings

The first milestone should not clone all Forgejo UI. ATLAS Forge UI is a control and observability layer over Forgejo APIs. Deep repository operations may link to the Forgejo native interface until ATLAS-native screens are implemented.

### 2. Source Control Provider Contract

ATLAS Manager must stop treating `github` as a hard-coded source-control authority.

Introduce a provider-neutral contract conceptually shaped as:

```ts
type SourceControlProvider = {
  id: 'atlas-forge' | 'github' | string;
  required: boolean;
  repository: RepositoryState;
  branches(): Promise<BranchState[]>;
  pullRequests(): Promise<PullRequestState[]>;
  issues(): Promise<IssueState[]>;
  workflows(): Promise<WorkflowState[]>;
  runners(): Promise<RunnerState[]>;
  releases(): Promise<ReleaseState[]>;
};
```

The contract exposes normalized states to ATLAS Manager. Provider-specific payloads remain behind adapters.

### 3. Forgejo Adapter

Proposed package:

`packages/integrations/forgejo`

Responsibilities:

- authenticate to the configured Forgejo instance without exposing secrets to the browser;
- list repositories, branches, commits, pull requests, issues, actions, runners, and releases;
- create provider operations only through ATLAS Manager authorization;
- normalize Forgejo states into the ATLAS source-control contract;
- create non-secret audit evidence for mutations;
- expose connectivity and health state.

### 4. Forgejo Server

The Forgejo instance is the Git repository collaboration engine.

Initial responsibilities:

- host the canonical ATLAS repository mirror or primary repository;
- retain full Git history;
- host pull requests and issues for ATLAS Forge-managed work;
- host `.forgejo/workflows`;
- provide API access to ATLAS Manager;
- maintain repository access control;
- support backup and export.

Secrets, database credentials, and runner registration tokens must not be committed to source control.

### 5. Forgejo Runner

The runner executes CI on user-controlled compute.

Required initial label:

`atlas-linux`

Required verification workflow:

```text
checkout
  ↓
npm ci
  ↓
npm audit --audit-level=high
  ↓
npm run typecheck
  ↓
npm run test:unit
  ↓
npm run test:integration
  ↓
npm run build
  ↓
record evidence
```

The runner must execute jobs in an isolated environment. Docker-backed execution is preferred when the host supports it. Host-shell execution must not be the default for untrusted pull requests.

### 6. Supabase ATLAS Manager Evidence

Supabase remains the authoritative control plane for ATLAS release evidence rather than Forgejo becoming a second infrastructure source of truth.

Normalized records should include:

- provider
- repository
- branch
- commit SHA
- workflow/run ID
- runner ID/label
- status
- started/completed timestamps
- test/build outcome
- artifact digest when available
- release gate state
- evidence timestamp

ATLAS must distinguish provider-reported success from independently verified production health.

### 7. Cloudflare Production Delivery

Cloudflare remains the public edge for ATLAS. ATLAS Forge does not directly mark production as verified.

After a successful build, ATLAS Manager must continue the existing release process and verify:

- intended commit is traceable;
- deployment operation succeeds;
- root route responds;
- required module route responds;
- `/healthz` is truthful and healthy;
- apex and `www` reach the intended artifact;
- SSL/TLS is valid;
- production evidence is stored.

## Canonical Repository Transition

ATLAS must avoid a destructive one-step migration.

### Phase A — Mirror

GitHub remains the current source authority while ATLAS Forge receives a full mirror. CI moves first because GitHub-hosted runners are the active blocker.

### Phase B — Dual verification

ATLAS Manager compares repository identity, default branch, head SHA, and release evidence between GitHub and ATLAS Forge.

### Phase C — Forge primary

ATLAS Forge becomes the primary source-control provider only after:

- full Git history is verified;
- pushes and pulls work;
- pull-request workflow works;
- runner CI is green;
- backups are tested;
- ATLAS Manager provider normalization is verified;
- rollback to GitHub mirror is documented.

### Phase D — GitHub optional mirror

GitHub is retained as an optional mirror/backup while useful. GitHub Actions are not required for ATLAS production readiness.

## Decision Compass Recovery

PR #58 is the first concrete workload for ATLAS Forge CI.

Once ATLAS Forge Runner is operational, ATLAS will create an equivalent branch/review context in Forgejo and execute the required fresh verification sequence against the exact Decision Compass head SHA.

A passing Forgejo workflow may satisfy ATLAS's CI gate only if:

- repository SHA matches the intended source;
- all required steps executed;
- logs and result are retained;
- no required test/audit step was removed;
- ATLAS Manager records the evidence;
- downstream Supabase, Cloudflare, and production gates still pass.

The GitHub PR remains historical evidence but GitHub-hosted Actions are no longer required once ATLAS Forge is the approved CI authority for that release.

## Security Model

### Identity

ATLAS Forge UI uses ATLAS Identity. Forgejo native accounts may exist internally, but user-facing permissions must map to ATLAS organization membership and approved roles.

### Secrets

Secrets must live in approved server/provider secret stores. The browser must never receive Forgejo admin tokens, runner registration tokens, database passwords, deploy keys, or Cloudflare/Supabase privileged credentials.

### Runner isolation

- Prefer disposable containers for jobs.
- Separate trusted main/release workflows from untrusted pull-request workflows.
- Do not expose production secrets to untrusted PR jobs.
- Do not run arbitrary fork code with privileged host access.
- Pin or govern reusable actions where feasible.

### Audit

Every privileged operation must record:

- actor/context
- provider
- repository/resource
- action
- result
- timestamp
- non-secret evidence reference

## Backup and Recovery

ATLAS Forge is not production-ready until backup and restore are proven.

Minimum backup scope:

- Git repositories
- Forgejo database
- configuration excluding separately stored secrets
- issues/pull-request metadata
- release metadata
- package metadata if later enabled

Backups must be restorable to a clean Forgejo instance. A backup that has never been restore-tested is not considered verified.

## Failure Classification

ATLAS Manager must use provider-neutral failure classes:

- `source_control_unavailable`
- `repository_sync_failure`
- `runner_offline`
- `runner_label_mismatch`
- `ci_failure`
- `build_failure`
- `security_gate_failure`
- `artifact_failure`
- `authorization_missing`
- `host_unavailable`
- `storage_failure`
- `backup_failure`
- `provider_optional_unavailable`

A GitHub billing or runner-entitlement failure becomes a GitHub provider failure, not an ATLAS-wide failure, when ATLAS Forge is available.

## First Milestone

The first implementation milestone contains only the capabilities needed to remove the current blocker:

1. provider-neutral source-control/CI contract in ATLAS Manager;
2. Forgejo adapter;
3. ATLAS Forge route and operational status UI;
4. documented Docker-based Forgejo + runner deployment bundle;
5. one registered `atlas-linux` runner;
6. repository mirror procedure;
7. `.forgejo/workflows/atlas-ci.yml` with the full ATLAS gate;
8. normalized CI evidence in ATLAS Manager/Supabase;
9. Decision Compass verification on Forgejo Runner;
10. backup/export procedure and restore test contract.

Out of scope for milestone 1:

- rebuilding Git internals;
- replacing the entire Forgejo native UI;
- public multi-tenant SaaS hosting for third parties;
- billing/subscriptions;
- marketplace;
- fully custom package registry UI;
- mobile Git client;
- removing GitHub before mirror/rollback verification.

## Testing Strategy

### Unit

- provider normalization;
- required vs optional provider classification;
- runner state mapping;
- release gate evaluation;
- failure classification;
- no provider-specific hard-coded GitHub gate.

### Integration

- authenticated ATLAS Forge route;
- Forgejo API adapter against mocked responses;
- branch/PR/issue/workflow normalization;
- offline runner renders blocked state rather than fabricated readiness;
- GitHub failure does not block a release when ATLAS Forge is selected and verified;
- CI evidence requires exact commit SHA.

### Runtime

- Forgejo health endpoint reachable;
- repository clone/push/pull succeeds;
- runner registers and receives `atlas-linux` job;
- full ATLAS CI workflow executes;
- workflow logs are retained;
- runner secrets are not exposed to untrusted jobs;
- mirror sync succeeds.

### Production

- ATLAS Manager records the selected source-control provider;
- release can trace source commit to build evidence;
- Supabase control plane remains healthy;
- Cloudflare delivery succeeds;
- `/healthz` verifies the deployed release;
- public domain resolves to the intended build.

## Acceptance Criteria

ATLAS Forge milestone 1 is successful only when:

- no paid GitHub Actions capacity is required to run the full ATLAS CI gate;
- the exact canonical repository can be cloned from ATLAS Forge;
- a registered user-controlled runner executes the complete CI sequence;
- ATLAS Manager treats source control and CI as provider-neutral;
- GitHub can be unavailable or Actions-blocked without stopping ATLAS Forge CI;
- CI evidence is tied to an exact commit SHA;
- Decision Compass receives fresh CI evidence from ATLAS Forge;
- production remains gated by Supabase + Cloudflare + `/healthz` verification;
- secrets remain outside source control;
- backup and restore expectations are defined and testable;
- no component is described as live or verified without provider/runtime evidence.

## Governance Rule

ATLAS Forge becomes ATLAS's preferred self-controlled development provider after the migration gates pass. GitHub remains an adapter and optional mirror. Future source-control providers must implement the same ATLAS Manager contract rather than introducing new hard-coded provider dependencies.
