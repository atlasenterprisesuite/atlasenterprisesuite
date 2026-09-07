# ATLAS Manager — Infrastructure Control Plane + Deployment Brain

Effective date: 2026-09-07
Status: Approved architecture directive
Owner: ATLAS Manager
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Purpose

ATLAS Manager is the central infrastructure control plane and deployment brain for ATLAS Enterprise Suite. It governs source, verification, backend state, edge delivery, deployment and public production evidence without allowing a single provider to become the source of truth for the whole platform.

Primary control path:

`GitHub → ATLAS Forge/CI → Supabase + Cloudflare → Production`

Provider roles are explicit:

- GitHub is the canonical source/review/release authority.
- ATLAS Forge is the provider-neutral execution and evidence layer for install, typecheck, tests, audit and build.
- Supabase is the primary backend platform for database, Auth, Storage, Edge Functions and governed data services.
- Cloudflare is the primary web/edge/DNS/TLS delivery layer.
- Vercel is legacy compatibility only. It is not a required production dependency and a missing Vercel project or token must not block the approved Supabase + Cloudflare path.

ATLAS Manager MUST distinguish code state, CI state, runner state, provider authorization, provider resource existence, data-layer verification, deployment state, runtime health, DNS/edge state and public production verification as separate facts.

## Operating principle

1. Detect current state from real provider evidence.
2. Classify the failure at the correct boundary.
3. Repair automatically when the authorized integration exposes the required action.
4. Re-run the smallest verification that proves or disproves the repair.
5. Continue independent work when one dependency is blocked.
6. Stop only the affected step when a human, legal, security, credential, billing or unavailable-provider action is genuinely required.
7. Never claim `live`, `connected`, `ready`, `verified` or `production` without corresponding evidence.
8. Never mutate a production database from an incomplete migration mirror.

Repeated diagnosis without a new test, repair attempt or evidence-producing action is not an acceptable terminal state.

## Scope

ATLAS Manager owns orchestration across:

- GitHub repository authority, branches, pull requests, Actions, workflows, release gates and deployment evidence.
- ATLAS Forge local/self-hosted execution, exact-SHA verification, artifact evidence and provider-independent CI.
- Supabase project connectivity, database readiness, migrations, Auth, Storage, Edge Functions, RLS, backups and backend verification.
- Cloudflare DNS, SSL/TLS, Pages/Workers delivery, Zero Trust controls, domain status and public-edge verification.
- Cross-provider deployment state, recovery policy, audit evidence and production readiness.

ATLAS Manager never stores provider secrets in source control. Secret material remains in approved secret stores or provider-managed credentials.

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
│   ├── forge/
│   ├── supabase/
│   └── cloudflare/
├── infra-control/
│   ├── diagnostics/
│   ├── provisioning/
│   ├── deployment/
│   ├── verification/
│   └── recovery/
└── governance/
    ├── permissions/
    ├── secrets/
    └── audit/
```

Existing shared ATLAS components, auth, tenancy, RBAC, audit, navigation and provider integrations MUST be reused when they are already stronger than this target layout. This directive does not authorize duplicate parallel implementations.

## ATLAS GitHub Manager

Responsibilities:

- resolve `atlasenterprisesuite/atlasenterprisesuite` as the operational canonical repository;
- verify `main` and `release/atlas-a-z` state;
- inspect commits, pull requests, checks, Actions and workflows;
- distinguish workflow creation from runner allocation and executable step results;
- detect missing required secret names without exposing values;
- validate release gates and preserve auditable infrastructure issues;
- prevent legacy repositories from becoming global blockers.

A job with `runner_id = 0` and no executable steps is classified as `runner_allocation_failure`, not `code_failure` or `test_failure`.

## ATLAS Forge Manager

Responsibilities:

- execute the canonical provider-neutral pipeline when an authorized host is available;
- use exact commit SHAs and a clean working tree;
- run `npm ci → typecheck → unit → integration → dependency audit → build`;
- record immutable run evidence and artifacts;
- remain usable even when GitHub-hosted runner allocation is unavailable;
- never claim a local/self-hosted run occurred until host execution evidence exists.

GitHub-hosted Actions may invoke Forge, but that wrapper does not make Forge dependent on GitHub-hosted runners.

## ATLAS Supabase Manager

Canonical backend target:

- project: `atlas-core-v2`
- project ref: `qawxltbplsxcjvwxdkes`
- region: `us-east-1`

Responsibilities:

- verify the canonical project before any backend action;
- validate database, Auth, Storage, Edge Functions and RLS independently;
- execute the service-role-only `atlas_backend_gate()` as a data-layer release gate when authorized;
- validate tenant isolation and governed write paths;
- verify migration reproducibility before automated migration deployment;
- preserve backups/recovery and audit requirements.

The Backend Gate is data-layer evidence only. It does not substitute for TypeScript tests, dependency audit, frontend build, authenticated full-application E2E or public production verification.

Until the complete v2 migration history is mirrored in the canonical repository, the production deployment workflow MUST NOT perform an automatic `supabase db push`. Database changes remain separately governed and must be applied only through an auditable, complete migration source.

## ATLAS Cloudflare Manager

Responsibilities:

- resolve zone and Pages/Workers ownership;
- deploy the verified web artifact to the configured Cloudflare production target;
- validate DNS and SSL/TLS;
- verify apex and `www` routing;
- distinguish edge failures from application/backend failures;
- maintain public production verification evidence.

Initial production domains:

- `atlasenterprisesuite.com`
- `www.atlasenterprisesuite.com`

## Vercel legacy compatibility

`vercel.json` and any existing Vercel deployment may remain temporarily for rollback/history while the Cloudflare cutover is not yet fully verified. They are not authoritative infrastructure for new ATLAS development.

Do not delete legacy Vercel configuration solely to make architecture look clean. Remove it only after Cloudflare production delivery, domain routing and rollback requirements are independently verified.

Missing `VERCEL_TOKEN`, Vercel team/project state or Vercel billing is therefore non-blocking for the approved production architecture.

## ATLAS Deployment Brain

```text
Detect
  ↓
Classify
  ↓
Can ATLAS repair with current authorization?
  ├─ Yes → Repair → Verify → Continue
  └─ No  → Mark only affected step blocked → Continue independent work
  ↓
Backend gate + build evidence + edge deploy
  ↓
Production verification
  ↓
Audit result
```

Failure classes include:

- `runner_allocation_failure`
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

Every failure MUST contain evidence, affected provider/resource, attempted actions, retry eligibility and the next executable action.

## Production deployment contract

The production workflow is allowed to continue only when all of the following can execute truthfully:

1. exact canonical commit is checked out;
2. required non-secret configuration and secret presence checks pass without echoing values;
3. locked dependencies install;
4. dependency security gate passes;
5. TypeScript typecheck passes;
6. unit tests pass;
7. integration tests pass;
8. production build passes;
9. Supabase URL resolves to canonical project ref `qawxltbplsxcjvwxdkes`;
10. `atlas_backend_gate()` returns no failed checks;
11. Cloudflare accepts the built `apps/web/dist` artifact;
12. apex and `www` public routes respond successfully;
13. required ATLAS module routes respond successfully;
14. `/healthz` truthfully reports healthy state;
15. deployment evidence is traceable to the commit.

A provider accepting an upload is not sufficient evidence of production completion.

## Required production secret names

The workflow may require these repository/environment secrets; values MUST NOT be logged or committed:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`

`VERCEL_TOKEN` is not part of the approved required production contract.

## Status endpoint

Target route: `/atlas/infra/status`

The route MUST use real normalized evidence. It must never invent provider connectivity or readiness percentages.

Representative truth state while the current blockers remain:

```json
{
  "status": "blocked",
  "providers": {
    "github": { "status": "blocked", "reason": "runner_allocation_failure" },
    "forge": { "status": "versioned", "reason": "host_execution_not_verified" },
    "supabase": { "status": "verified_data_layer", "projectRef": "qawxltbplsxcjvwxdkes" },
    "cloudflare": { "status": "unknown", "reason": "production_delivery_not_verified" },
    "vercel": { "status": "legacy_non_blocking" }
  }
}
```

If a readiness percentage is displayed, it MUST be computed from explicit gates rather than manually entered.

## Permissions and audit

Sensitive actions include repository/workflow mutation, production deployment, DNS/TLS/security changes, database migrations, RLS/Auth changes, secret changes, rollback and destructive provider operations. Each action requires appropriate authorization and an audit event containing actor/context, provider, action, resource, result, timestamp and non-secret evidence.

## Current production P0s

As of 2026-09-07:

1. GitHub-hosted Actions is failing before runner assignment on the A-Z release. Issue #22 is authoritative evidence; jobs show `runner_id: 0` and no executable steps. This blocks hosted-CI evidence but is not an ATLAS code/test failure.
2. ATLAS Forge is versioned but a real self-hosted/Linux execution environment is not yet verified in this control path.
3. Supabase `atlas-core-v2` is the canonical backend and its Backend Gate currently provides verified data-layer evidence; this does not by itself prove full app production readiness.
4. The complete Supabase v2 migration history still needs a canonical repository mirror before automatic migration replay can be considered disaster-recovery-safe.
5. Cloudflare Pages/Workers production project, deployment credentials and current domain routing must be verified before the Cloudflare deployment path can be called live.

The absence of a Vercel project/token is no longer a production P0 under this approved directive.

## Implementation sequence

1. Keep GitHub canonical state and runner-allocation diagnostics truthful.
2. Maintain/activate ATLAS Forge as provider-neutral CI evidence.
3. Use Supabase v2 as the primary backend target and expand its governed E2E coverage.
4. Mirror the complete v2 migration history before automating migration replay.
5. Implement/verify Cloudflare deployment and domain delivery.
6. Implement Deployment Brain normalized state/recovery decisions.
7. Implement audit and permission gates for provider mutations.
8. Implement `/atlas/infra/status` from real evidence.
9. Execute full A-Z CI/consensus gates.
10. Merge/deploy to `main` only after the release gate is actually green and production verification succeeds.

## Acceptance criteria

ATLAS Manager is not production-ready until canonical source is resolved, executable CI/build evidence exists, Supabase backend security and tenant isolation are verified, Cloudflare deployment/domain/TLS are verified, secrets remain protected, production routes and `/healthz` pass, the deployed artifact is traceable to a canonical commit, and all infrastructure mutations create audit evidence.

## Governance rule

All future ATLAS modules MUST integrate with ATLAS Manager for infrastructure state, deployment verification, permissions and audit where applicable. Modules must not create isolated provider-specific deployment mechanisms when a shared ATLAS Manager capability exists.

This specification supersedes the 2026-09-06 Vercel-first control path and is subordinate only to a newer explicitly approved ATLAS architecture directive committed to the canonical repository.
