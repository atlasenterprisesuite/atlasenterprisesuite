# ATLAS Manager — Infrastructure Control Plane + Deployment Brain

Effective date: 2026-09-07
Status: Approved architecture directive — Supabase-first
Owner: ATLAS Manager
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Purpose

ATLAS Manager is the central infrastructure control plane and deployment brain for ATLAS Enterprise Suite. It governs the path from source control to verified production and prevents provider-specific failures from becoming repeated manual diagnosis loops.

Primary production path:

`GitHub → Supabase ATLAS Manager → Cloudflare → Production`

Vercel is no longer a required production stage. It is an optional deployment provider that may be used when intentionally configured and verified, but its absence MUST NOT block ATLAS production readiness.

ATLAS Manager MUST distinguish code state, CI state, provider authorization, provider resource existence, backend state, edge state, deployment state, runtime health, DNS/TLS state, and public production verification as separate facts.

## Operating principle

ATLAS Manager follows this rule:

1. Detect the current state from real provider evidence.
2. Classify the problem at the correct boundary.
3. Repair automatically when the authorized integration exposes the required action.
4. Re-run the smallest verification that proves or disproves the repair.
5. Continue through remaining independent work when one dependency is blocked.
6. Stop only the affected step when a human, legal, security, credential, billing, or unavailable-provider action is genuinely required.
7. Never claim `live`, `connected`, `ready`, `verified`, or `production` without corresponding evidence.
8. Optional providers MUST NOT reduce production readiness when the required production path is healthy.

Repeated diagnosis without a new test, repair attempt, or evidence-producing action is not an acceptable terminal state.

## Production authority

Current authoritative production components:

- Canonical source: `atlasenterprisesuite/atlasenterprisesuite`
- Primary backend/control-plane project: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
- Frontend/edge target: Cloudflare
- Public production domains:
  - `atlasenterprisesuite.com`
  - `www.atlasenterprisesuite.com`

Supabase project `atlas-core-v2` exists and is active, but it is not production authority until its schema, migrations, functions, policies, data, and integrations are reconciled against `atlas-core` and an audited cutover is explicitly approved.

The older inactive Supabase project `Atlas-core` is not production authority.

## Scope

ATLAS Manager owns infrastructure orchestration across:

- GitHub repository authority, branches, pull requests, Actions, workflows, release gates, and deployment evidence.
- Supabase database, Auth, Storage, Edge Functions, RLS, migrations, secrets boundary, verification evidence, runtime orchestration, and backend control-plane state.
- Cloudflare DNS, SSL/TLS, Workers/Pages routing, Zero Trust controls, domain state, frontend delivery, and public-edge verification.
- Optional providers such as Vercel when deliberately enabled.
- Cross-provider recovery policy, audit evidence, and production readiness.

ATLAS Manager does not invent or persist provider secrets in source control. Secret material remains in approved secret stores or provider-managed credentials.

## Existing Supabase control-plane assets

The current `atlas-core` project already contains ATLAS Manager building blocks and these MUST be reused instead of duplicated:

- `atlas-infra-status`
- `atlas-infra-evidence`
- `atlas-runtime-verifier`
- `atlas-sovereign-control-plane`
- `atlas-platform-controls`
- `atlas-repair-bridge`
- `atlas-enterprise-web`
- `atlas_release_registry`
- `atlas_runtime_verification_runs`
- `atlas_approvals`
- `atlas_integration_connections`
- ATLAS audit, identity, permissions, workflow, observability, and AI governance tables

These components form the initial runtime substrate for ATLAS Manager.

## Target architecture

```text
GitHub
  │
  ▼
ATLAS Manager
  │
  ├── Supabase Control Plane
  │   ├── PostgreSQL
  │   ├── Auth
  │   ├── Storage
  │   ├── Edge Functions
  │   ├── RLS / tenant isolation
  │   ├── Audit / approvals
  │   ├── Runtime verification
  │   └── Deployment Brain
  │
  └── Cloudflare Edge
      ├── Frontend delivery
      ├── DNS
      ├── SSL/TLS
      ├── Workers / Pages
      ├── Zero Trust
      └── CDN / public routing

              ▼
      atlasenterprisesuite.com
```

Repository layout target:

```text
apps/
└── atlas-manager/
    ├── api/
    ├── controllers/
    ├── workers/
    ├── health/
    └── runtime/

packages/
├── integrations/
│   ├── github/
│   ├── supabase/
│   ├── cloudflare/
│   └── vercel/        # optional provider adapter
│
├── infra-control/
│   ├── diagnostics/
│   ├── provisioning/
│   ├── deployment/
│   ├── verification/
│   └── recovery/
│
└── governance/
    ├── permissions/
    ├── secrets/
    └── audit/
```

Existing shared ATLAS components, auth, tenancy, RBAC, audit, navigation, verification, and provider integrations MUST be reused when they are already stronger than this target layout. This document does not authorize parallel duplicate implementations.

## ATLAS GitHub Manager

Responsibilities:

- resolve the operational canonical repository;
- verify `main` and release branch state;
- inspect commits, pull requests, checks, Actions, and workflows;
- detect missing required secret names without exposing secret values;
- validate CI and release gates;
- open or update auditable infrastructure issues when failures persist;
- preserve canonical-repository governance;
- prevent legacy repositories from becoming global blockers;
- trigger the Supabase/Cloudflare production path rather than assuming a Vercel deployment.

Required state model:

```text
repository
branch
commit_sha
ci_status
release_gate_status
required_secret_names
workflow_status
blocking_reason
last_verified_at
```

## ATLAS Supabase Manager

Supabase is the primary backend and control-plane runtime for ATLAS Manager.

Responsibilities:

- validate the authoritative `atlas-core` project;
- verify database connectivity and schema state without leaking credentials;
- validate migration state;
- operate ATLAS Manager Edge Functions;
- validate Auth readiness;
- validate Storage readiness;
- validate tenant isolation and RLS policies;
- maintain runtime verification evidence;
- maintain release registry evidence;
- maintain infrastructure audit evidence;
- coordinate approvals and privileged infrastructure actions;
- expose normalized provider state to ATLAS Manager;
- execute backend recovery actions when authorized;
- validate backup/recovery readiness.

No database, Auth, Storage, Edge Function, RLS, migration, or backup capability may be reported as production-ready without real provider evidence.

## ATLAS Cloudflare Manager

Cloudflare is the primary public frontend/edge layer.

Responsibilities:

- deliver the production frontend using the selected Cloudflare hosting mechanism;
- resolve zone ownership and domain state;
- inspect and manage DNS when authorized;
- validate SSL/TLS state;
- validate Workers/Pages routing when used;
- validate Zero Trust controls relevant to ATLAS;
- verify apex and `www` routing;
- distinguish Cloudflare edge failures from Supabase/backend failures;
- maintain public production verification evidence.

Initial production domains:

- `atlasenterprisesuite.com`
- `www.atlasenterprisesuite.com`

## ATLAS Vercel Manager — optional provider

Vercel is retained only as an optional adapter.

Responsibilities when enabled:

- discover the target Vercel team/account;
- discover or provision a project when authorized;
- configure build/deployment state;
- execute preview or production deployments if explicitly selected;
- inspect logs and aliases;
- return normalized provider state.

A missing Vercel project or token MUST be reported as `optional_provider_unconfigured` unless a release explicitly selected Vercel as its target. It MUST NOT block the default Supabase + Cloudflare production path.

## ATLAS Deployment Brain

The Deployment Brain consumes normalized provider states and determines the next action.

```text
Detect
  ↓
Classify
  ↓
Is provider required for this release?
  ├─ No  → Record optional state → Continue
  └─ Yes
       ↓
Can ATLAS repair with current authorization?
  ├─ Yes → Repair → Verify → Continue
  └─ No  → Mark affected step blocked → Continue independent work
  ↓
Production verification
  ↓
Audit result
```

### Failure classes

- `code_failure`
- `test_failure`
- `build_failure`
- `configuration_failure`
- `resource_missing`
- `authorization_missing`
- `provider_unavailable`
- `optional_provider_unconfigured`
- `dns_failure`
- `tls_failure`
- `runtime_failure`
- `database_failure`
- `auth_failure`
- `storage_failure`
- `policy_failure`
- `verification_failure`
- `human_approval_required`

Each failure MUST contain evidence, affected provider, affected resource, required/optional classification, attempted actions, retry eligibility, and the next executable action.

## Recovery policy

For recoverable failures, ATLAS Manager MUST:

1. record the failure and evidence;
2. identify the smallest corrective action;
3. execute it when authorized;
4. verify the exact failing boundary again;
5. escalate only if the corrective action cannot be executed or verification still fails;
6. avoid unrelated refactors while repairing infrastructure;
7. never let an unconfigured optional provider become a global production blocker.

For missing authorization or secrets, ATLAS Manager MUST identify the exact credential or approval required and MUST NOT fabricate, echo, log, or commit sensitive values.

## Production verification contract

A production deployment is not complete merely because a provider accepted a request.

ATLAS Manager MUST verify, as applicable:

- canonical commit/version is traceable;
- Supabase backend/control plane is healthy;
- required Edge Functions are deployed and reachable;
- required migrations are present;
- RLS/security gates are passing;
- frontend artifact reaches Cloudflare successfully;
- root route returns success;
- required module routes return success;
- `/healthz` returns a truthful healthy response;
- `/atlas/infra/status` returns truthful infrastructure state;
- apex and `www` domains route to the intended build;
- SSL/TLS is valid;
- no protection layer unintentionally blocks public production;
- public content matches the expected ATLAS release.

## Status endpoint

Target route:

`/atlas/infra/status`

The existing Supabase `atlas-infra-status` Edge Function is the backend authority for this route and MUST be evolved rather than replaced.

The route MUST be backed by real state. It must never invent readiness percentages or provider connectivity.

Required semantics:

```json
{
  "status": "partial",
  "requiredPath": ["github", "supabase", "cloudflare", "production"],
  "providers": {
    "github": { "status": "connected", "required": true },
    "supabase": { "status": "ready", "required": true },
    "cloudflare": { "status": "not_verified", "required": true },
    "vercel": { "status": "not_configured", "required": false }
  },
  "blocking": [
    {
      "provider": "cloudflare",
      "reason": "not_verified",
      "nextAction": "verify_or_configure_public_edge"
    }
  ]
}
```

If a readiness percentage is displayed in the UI, it MUST be computed only from required verification gates. Optional providers must be excluded from the denominator unless selected for the active release.

## Permissions and audit

Every provider action MUST pass through authorization checks appropriate to the operation.

Sensitive actions include, at minimum:

- repository mutation;
- workflow mutation;
- production deployment;
- DNS changes;
- TLS/security policy changes;
- database migrations;
- RLS changes;
- Auth configuration;
- Edge Function deployment;
- secret changes;
- rollback or destructive provider operations.

ATLAS Manager MUST record an audit event containing actor/context, provider, action, resource, result, timestamp, and non-secret evidence reference.

## Reclassification of the former Vercel P0

The previous failure caused by a missing Vercel project and missing `VERCEL_TOKEN` is no longer a production-blocking P0 under the default architecture.

It is reclassified as:

`optional_provider_unconfigured`

unless a future release explicitly chooses Vercel as a required deployment target.

The active production-critical path becomes:

1. verify canonical GitHub state;
2. verify `atlas-core` Supabase control plane;
3. adapt `atlas-infra-status` so Vercel is optional;
4. verify or configure Cloudflare frontend delivery;
5. bind/verify apex and `www` domains;
6. run public route and health verification;
7. record production evidence in Supabase.

## Implementation sequence

1. Update provider-neutral status contracts with `required` vs `optional` provider semantics.
2. Modify existing Supabase `atlas-infra-status` so Vercel no longer creates a blocker by default.
3. Reuse `atlas-infra-evidence`, `atlas-runtime-verifier`, `atlas-sovereign-control-plane`, `atlas-platform-controls`, and `atlas-repair-bridge` as the initial ATLAS Manager runtime.
4. Add/normalize Supabase self-checks for database, Auth, Storage, Edge Functions, migrations, RLS, and release evidence.
5. Implement/normalize Cloudflare adapter and public-edge verification.
6. Update GitHub production workflow so Vercel is not required by the default release path.
7. Establish Cloudflare frontend deployment for the current Vite application.
8. Wire `/atlas/infra/status` to the Supabase status authority.
9. Add provider contract tests and failure-classification tests.
10. Add end-to-end verification for GitHub → Supabase → Cloudflare → Production.
11. Reclassify or close the old Vercel blocker only after the new required path is verified.

## Acceptance criteria

ATLAS Manager is not considered production-ready until all of the following are verified:

- canonical repository is resolved correctly;
- `atlas-core` is explicitly recognized as the current authoritative Supabase project;
- provider adapters return normalized truthful states;
- providers are explicitly classified as required or optional for each release;
- missing Vercel configuration does not block the default production path;
- Supabase backend, control-plane, migrations, Edge Functions, and security controls are verified;
- Cloudflare frontend/edge state is verified;
- recoverable failures trigger bounded automated recovery;
- non-recoverable authorization blocks identify the exact dependency;
- secrets never appear in committed files or logs;
- production deployment can be traced to a canonical commit;
- route and health checks validate the deployed artifact;
- domain verification confirms the public site reaches the intended deployment;
- all infrastructure mutations create audit evidence;
- ATLAS continues independent work when one provider is blocked.

## Governance rule

All future ATLAS modules MUST integrate with ATLAS Manager for infrastructure state, deployment verification, permissions, and audit where applicable. Modules must not create isolated provider-specific deployment mechanisms when a shared ATLAS Manager capability exists.

The default production architecture is Supabase-first with Cloudflare at the public edge. Vercel remains optional unless a later explicitly approved release architecture makes it required.

This specification is subordinate only to a newer explicitly approved ATLAS architecture directive committed to the canonical repository.
