# ATLAS Sovereign CI

Status: implementation contract  
Owner: ATLAS Manager  
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Purpose

ATLAS Sovereign CI is the read-only, on-demand repository verification capability inside ATLAS Manager. It converts an explicit repository ref into evidence-backed execution state without creating a parallel CI database or deploying application code.

## Flow

```text
ATLAS Manager UI
  -> atlas-execution / start_manager_sovereign_ci
  -> manager.sovereign_ci workflow + task + ordered steps
  -> GitHub Actions workflow_dispatch / atlas-sovereign-ci.yml
  -> explicit ref checkout
  -> immutable git SHA
  -> npm ci
  -> npm run typecheck
  -> npm test
  -> npm run build
  -> GitHub OIDC report token
  -> atlas-sovereign-ci-report
  -> execution_evidence + execution_audit_events
  -> completed or blocked
```

## Trust boundaries

The browser never receives GitHub control credentials. `atlas-execution` authenticates the ATLAS user and organization and dispatches only the allowlisted canonical workflow through the server-side `ATLAS_GITHUB_TOKEN`.

Every start creates a random one-time dispatch binding. ATLAS stores only its SHA-256 hash in workflow context and sends the raw nonce to the selected GitHub run. The OIDC reporter hashes the presented nonce, compares it against the stored binding, and consumes the binding after the first accepted report. A replay is rejected.

The workflow separates privileges by job:

- `verify`: `contents: read` only; it executes the requested source and has no OIDC permission.
- `report`: `id-token: write`, `contents: none`; it never checks out or executes the requested source.

Checkout uses `persist-credentials: false`. The workflow contains no source-control write, merge, deployment, DNS, secret mutation, or provider deployment command.

The result path is intentionally separate from the ordinary user-JWT `atlas-execution` gateway. GitHub Actions mints an OIDC token with audience `atlas-sovereign-ci`; the dedicated `atlas-sovereign-ci-report` adapter verifies GitHub signature, repository, owner, workflow identity, main workflow ref, event type, expiry, and audience before writing through the service boundary.

## Target rules

v1 accepts only:

`atlasenterprisesuite/atlasenterprisesuite`

The requested branch, tag, or SHA is mandatory. ATLAS does not silently substitute `main`.

A successful checkout is resolved once with `git rev-parse HEAD`. That 40-character SHA becomes immutable evidence for the run.

If checkout/ref resolution fails, the workflow still reports a bounded failure to ATLAS. The task becomes `blocked` with `target_resolution_failure`; no SHA is fabricated.

## Evidence

Evidence is stored in the existing `execution_evidence` table. The optional JSON metadata boundary is additive and must remain non-secret.

Kinds:

- `manager.ci.target`
- `manager.ci.source`
- `manager.ci.install`
- `manager.ci.typecheck`
- `manager.ci.test`
- `manager.ci.build`
- `manager.ci.gate`

Stored command evidence contains bounded metadata such as command identifier, exit code, SHA-256 output digest, timestamps, resolved SHA, runner kind, and GitHub run ID. Raw command logs and credentials are not persisted into ATLAS execution evidence.

## Green gate

Green requires exactly one result for every fixed command and exit code 0 for all four:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

Missing, duplicate, or malformed command evidence fails closed.

A Sovereign CI green gate is build/test evidence. It is not production deployment evidence and cannot produce a production-verified badge by itself.

## Runtime blockers

ATLAS must report `blocked`, never green, if any of these are unavailable:

- authenticated ATLAS organization or `execution.write`;
- server-side GitHub Actions dispatch authorization;
- canonical workflow on the default branch;
- requested Git ref;
- GitHub-hosted runner;
- GitHub OIDC verification;
- Supabase report adapter or evidence persistence.

## Deployment

Sovereign CI itself does not deploy. Production deployment and exact-SHA runtime verification remain separate Release Control / ATLAS Manager gates.
