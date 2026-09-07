# ATLAS Manager — Infrastructure Control Plane + Deployment Brain

Effective date: 2026-09-06
Status: Approved architecture directive
Owner: ATLAS Manager
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Purpose

ATLAS Manager is the central infrastructure control plane and deployment brain for ATLAS Enterprise Suite. It governs the path from source control to verified production and prevents provider-specific failures from becoming repeated manual diagnosis loops.

Primary control path:

`GitHub → Vercel → Cloudflare → Supabase → Production`

ATLAS Manager MUST distinguish code state, CI state, provider authorization, provider resource existence, deployment state, runtime health, DNS/edge state, and public production verification as separate facts.

## Operating principle

ATLAS Manager follows this rule:

1. Detect the current state from real provider evidence.
2. Classify the problem at the correct boundary.
3. Repair automatically when the authorized integration exposes the required action.
4. Re-run the smallest verification that proves or disproves the repair.
5. Continue through remaining independent work when one dependency is blocked.
6. Stop only the affected step when a human, legal, security, credential, billing, or unavailable-provider action is genuinely required.
7. Never claim `live`, `connected`, `ready`, `verified`, or `production` without corresponding evidence.

Repeated diagnosis without a new test, repair attempt, or evidence-producing action is not an acceptable terminal state.

## Scope

ATLAS Manager owns infrastructure orchestration across:

- GitHub repository authority, branches, pull requests, Actions, workflows, release gates, and deployment evidence.
- Vercel project discovery, project provisioning when authorized, repository linking, deployment configuration, deployment execution, logs, aliases, and production verification.
- Cloudflare DNS, SSL/TLS, Workers/Pages routing, Zero Trust controls, domain status, and public-edge verification.
- Supabase project connectivity, database readiness, migrations, Auth, Storage, RLS, backups, and production dependency health.
- Cross-provider deployment state, recovery policy, audit evidence, and production readiness.

ATLAS Manager does not invent or persist provider secrets in source control. Secret material remains in approved secret stores or provider-managed credentials.

## Target architecture

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
│   ├── vercel/
│   ├── cloudflare/
│   └── supabase/
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

Existing shared ATLAS components, auth, tenancy, RBAC, audit, navigation, and provider integrations MUST be reused when they are already stronger than this target layout. This document does not authorize parallel duplicate implementations.

## ATLAS GitHub Manager

Responsibilities:

- resolve the operational canonical repository;
- verify `main` and release branch state;
- inspect commits, pull requests, checks, Actions, and workflows;
- detect missing required secret names without exposing secret values;
- validate CI and release gates;
- open or update auditable infrastructure issues when failures persist;
- preserve the canonical-repository governance policy;
- prevent legacy repositories from becoming global blockers.

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

### GitHub-hosted runner pre-allocation failure

When a GitHub Actions job terminates with no executed steps, `runner_id = 0`, and no runner name/group, ATLAS Manager MUST NOT classify that result as `test_failure`, `build_failure`, or application-code failure because no repository command has executed.

The initial normalized classification is `authorization_missing` with provider-boundary detail `runner_entitlement_or_billing_control`, unless GitHub provider evidence identifies a more specific cause. ATLAS Manager must preserve the failed run/job identifiers, retry evidence, and the exact human/provider dependency. If a targeted rerun reproduces the same pre-allocation state while GitHub Actions is publicly operational, the affected release gate remains blocked and independent work continues.

## ATLAS Vercel Manager

Responsibilities:

- discover the target Vercel team/account;
- discover the production project;
- create/import/link the project when authorized actions exist;
- resolve and persist non-secret project identifiers such as `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` through approved configuration channels;
- verify framework, build command, output directory, and SPA routing;
- execute preview and production deployments;
- inspect build/runtime logs;
- verify aliases and custom domains;
- perform rollback or redeploy only when evidence supports that action.

A missing project is classified as `resource_missing`, not as an application-code failure.

A missing deployment credential is classified as `authorization_missing`, not as a Vite/React failure.

## ATLAS Cloudflare Manager

Responsibilities:

- resolve zone ownership and domain state;
- inspect and manage DNS when authorized;
- validate SSL/TLS state;
- validate Workers/Pages routing when used;
- validate Zero Trust controls relevant to ATLAS;
- verify apex and `www` routing;
- distinguish Cloudflare edge failures from origin failures;
- maintain public production verification evidence.

Initial production domains:

- `atlasenterprisesuite.com`
- `www.atlasenterprisesuite.com`

## ATLAS Supabase Manager

Responsibilities:

- discover and validate the expected Supabase project;
- verify database connectivity without leaking credentials;
- validate migration state;
- validate Auth readiness;
- validate Storage readiness;
- validate tenant isolation and RLS policies;
- validate backup/recovery readiness;
- classify database, auth, storage, and policy failures independently.

No database, Auth, Storage, RLS, or backup capability may be reported as production-ready without real provider evidence.

## ATLAS Deployment Brain

The Deployment Brain consumes normalized provider states and determines the next action.

```text
Detect
  ↓
Classify
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
- `dns_failure`
- `tls_failure`
- `runtime_failure`
- `database_failure`
- `auth_failure`
- `storage_failure`
- `policy_failure`
- `verification_failure`
- `human_approval_required`

Each failure MUST contain evidence, affected provider, affected resource, attempted actions, retry eligibility, and the next executable action.

## Recovery policy

For recoverable failures, ATLAS Manager MUST:

1. record the failure and evidence;
2. identify the smallest corrective action;
3. execute it when authorized;
4. verify the exact failing boundary again;
5. escalate only if the corrective action cannot be executed or verification still fails;
6. avoid unrelated refactors while repairing infrastructure.

For missing authorization or secrets, ATLAS Manager MUST identify the exact credential or approval required and MUST NOT fabricate, echo, log, or commit sensitive values.

## Production verification contract

A production deployment is not complete merely because a provider accepted a deployment request.

ATLAS Manager MUST verify, as applicable:

- deployment reaches provider-ready/success state;
- root route returns success;
- required module routes return success;
- `/healthz` returns a truthful healthy response;
- expected production commit/version is traceable;
- critical backend dependencies respond as expected;
- apex and `www` domains route to the intended production deployment;
- SSL/TLS is valid;
- no provider protection layer is unintentionally blocking public production;
- the public URL presents the expected current ATLAS build.

## Status endpoint

Target route:

`/atlas/infra/status`

The route MUST be backed by real state. It must never invent readiness percentages or provider connectivity.

Suggested response shape:

```json
{
  "status": "blocked",
  "productionReadiness": {
    "verifiedChecks": 7,
    "totalChecks": 10
  },
  "providers": {
    "github": { "status": "connected" },
    "vercel": { "status": "blocked", "reason": "resource_missing" },
    "cloudflare": { "status": "unknown", "reason": "not_verified" },
    "supabase": { "status": "unknown", "reason": "not_verified" }
  },
  "blocking": [
    {
      "provider": "vercel",
      "reason": "resource_missing",
      "nextAction": "create_or_link_project"
    }
  ]
}
```

If a readiness percentage is displayed in the UI, it MUST be computed from explicit verification gates rather than entered manually.

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
- secret changes;
- rollback or destructive provider operations.

ATLAS Manager MUST record an audit event containing actor/context, provider, action, resource, result, timestamp, and non-secret evidence reference.

## Current production P0

As of 2026-09-06, two separate provider boundaries block the canonical Vercel release path:

1. GitHub-hosted Actions is failing before runner allocation for the canonical repository, preventing required consensus and deployment jobs from executing. This is tracked by canonical issue #38 and is not evidence of a failing application test.
2. The connected Vercel team currently contains no ATLAS project. The production workflow therefore contains a bounded create-if-missing step, but that recovery cannot execute until GitHub allocates a runner and the repository's Vercel deployment credential is usable.

Cloudflare public edge remains separately reachable, while Cloudflare control-plane authorization is not yet verified. These are independent truth states and must not be collapsed into one generic deploy failure.

ATLAS Manager must treat these incidents as the first real integration test for the new architecture:

1. restore GitHub-hosted runner execution or obtain provider confirmation of the account/action required;
2. discover or provision the Vercel project;
3. bind the canonical GitHub repository;
4. resolve project/org identifiers;
5. establish authorized deployment credentials;
6. deploy;
7. verify `/`, Finance, Health, and `/healthz`;
8. verify `/atlas/infra/status` remains authentication-gated;
9. verify production domain routing;
10. register deployment evidence through GitHub OIDC;
11. close P0 only with evidence.

## Implementation sequence

1. Establish provider-neutral status and failure contracts.
2. Implement GitHub adapter around existing GitHub capabilities.
3. Implement Vercel adapter and provisioning/deployment boundary.
4. Implement Cloudflare adapter.
5. Implement Supabase adapter.
6. Implement Deployment Brain decision engine.
7. Implement audit and permission gates.
8. Implement `/atlas/infra/status` using real provider state.
9. Add provider contract tests and failure-classification tests.
10. Add end-to-end deployment verification gates.
11. Exercise the system against the current Vercel/GitHub P0.

## Acceptance criteria

ATLAS Manager is not considered production-ready until all of the following are verified:

- canonical repository is resolved correctly;
- provider adapters return normalized truthful states;
- missing resources are distinguished from missing credentials;
- recoverable failures trigger bounded automated recovery;
- non-recoverable authorization blocks identify the exact dependency;
- secrets never appear in committed files or logs;
- production deployment can be traced to a canonical commit;
- route and health checks validate the deployed artifact;
- domain verification confirms the public site reaches the intended deployment;
- Supabase security controls are verified when the application depends on them;
- all infrastructure mutations create audit evidence;
- ATLAS continues independent work when one provider is blocked.

## Governance rule

All future ATLAS modules MUST integrate with ATLAS Manager for infrastructure state, deployment verification, permissions, and audit where applicable. Modules must not create isolated provider-specific deployment mechanisms when a shared ATLAS Manager capability exists.

This specification is subordinate only to a newer explicitly approved ATLAS architecture directive committed to the canonical repository.