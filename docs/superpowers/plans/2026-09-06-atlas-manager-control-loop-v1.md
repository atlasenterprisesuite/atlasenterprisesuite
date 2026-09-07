# ATLAS Manager Control Loop v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the first production-capable ATLAS Manager control loop for canonical GitHub state, Vercel provisioning/deployment, authenticated infrastructure status, and deployment evidence while keeping Cloudflare/Supabase truth states explicit.

**Architecture:** Reuse the approved `docs/architecture/ATLAS_MANAGER_SPEC.md`, the existing canonical `production-deploy.yml`, Supabase `atlas_runtime_verification_runs`, and Supabase Edge Functions. Public `/atlas/infra/status` is a no-cache proxy to an admin/JWT-gated control-plane endpoint; successful production deployment writes evidence back through short-lived GitHub OIDC rather than a persisted GitHub credential.

**Tech Stack:** TypeScript 5.7, Vite 6, Vitest 3, GitHub Actions, GitHub OIDC, Vercel CLI/REST API, Supabase Edge Functions/Postgres.

**Spec:** `docs/architecture/ATLAS_MANAGER_SPEC.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Production-stable branch: `main`.
- Do not expose or commit provider secrets.
- Code, CI, deployment, runtime, DNS/edge, and public verification remain separate truth states.
- Do not call a provider `live`, `connected`, `ready`, or `verified` without evidence.
- Continue independent work when a provider or authorization boundary is blocked.

---

### Task 1: Infrastructure status route and normalized truth

**Files:**
- Modify: `vercel.json`
- Create: `adapters/supabase/atlas-infra-status/index.ts`
- Test: `tests/integration/atlas-manager-infra-route.test.ts`
- Test: `tests/unit/atlas-infra-status-source.test.ts`

**Interfaces:**
- Consumes: authenticated ATLAS JWT, `atlas_release_registry`, `atlas_runtime_verification_runs`, provider environment variables.
- Produces: `GET /atlas/infra/status` proxy and normalized `production_readiness`, provider states, blockers, latest runtime verification, and latest infrastructure-deployment verification.

- [ ] **Step 1: Add failing route/status source tests**

Assert `/atlas/infra/status` rewrites to the Supabase status function, disables rewrite caching, uses `atlasenterprisesuite/atlasenterprisesuite`, queries `verification_type = infrastructure-deployment`, and preserves `/healthz`.

- [ ] **Step 2: Run the focused tests and confirm RED when the binding or source contract is absent**

Run: `npx vitest run tests/integration/atlas-manager-infra-route.test.ts tests/unit/atlas-infra-status-source.test.ts`

Expected before implementation: at least one assertion fails because the route/source contract is missing.

- [ ] **Step 3: Implement the minimum route and status aggregator**

Keep the Edge Function admin/JWT gated, no-store, and read-only. Query the latest general runtime verification independently from the latest `infrastructure-deployment` verification.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `npx vitest run tests/integration/atlas-manager-infra-route.test.ts tests/unit/atlas-infra-status-source.test.ts`

Expected: PASS.

- [ ] **Step 5: Deploy the Edge Function and verify provider state**

Deploy `adapters/supabase/atlas-infra-status/index.ts` as `atlas-infra-status` with JWT verification enabled. Verify the deployed function is ACTIVE and versioned.

### Task 2: OIDC deployment evidence ingress

**Files:**
- Create: `adapters/supabase/atlas-infra-evidence/index.ts`
- Test: `tests/unit/atlas-infra-evidence.test.ts`
- Modify: `.github/workflows/production-deploy.yml`

**Interfaces:**
- Consumes: GitHub Actions OIDC token with audience `atlas-infrastructure-evidence`; successful deployment metadata.
- Produces: one `atlas_runtime_verification_runs` row with `verification_type = infrastructure-deployment` and canonical commit traceability.

- [ ] **Step 1: Add failing security contract tests**

Assert the ingress accepts only `atlasenterprisesuite/atlasenterprisesuite`, `refs/heads/main`, and `.github/workflows/production-deploy.yml`; assert it does not read a `GITHUB_TOKEN`; assert it reuses `atlas_runtime_verification_runs`.

- [ ] **Step 2: Run the unit test and confirm RED before implementation**

Run: `npx vitest run tests/unit/atlas-infra-evidence.test.ts`

Expected before implementation: FAIL because the ingress source is absent.

- [ ] **Step 3: Implement OIDC verification and evidence persistence**

Verify GitHub JWKS signature, issuer, audience, expiry/not-before, repository, owner, ref, and workflow ref. Insert only non-secret deployment evidence and set both `started_at` and `completed_at` for a terminal `passed` row.

- [ ] **Step 4: Add production workflow OIDC registration**

Grant only `contents: read` and `id-token: write`. After route verification succeeds, request an OIDC token and POST commit/deployment/check metadata to `atlas-infra-evidence?api=record`.

- [ ] **Step 5: Run unit/integration tests and deploy the ingress**

Run: `npm run test:unit && npm run test:integration`.

Deploy `atlas-infra-evidence` with platform JWT verification disabled only because the function performs explicit GitHub OIDC authentication internally.

### Task 3: Vercel self-provisioning and production gates

**Files:**
- Modify: `.github/workflows/production-deploy.yml`
- Test: `tests/integration/atlas-manager-infra-route.test.ts`

**Interfaces:**
- Consumes: repository secret `VERCEL_TOKEN`, team slug `winderaranguren-gifs-projects`, project name `atlasenterprisesuite`.
- Produces: existing-or-created Vercel project, explicit production deployment URL, route/health/auth-boundary verification.

- [ ] **Step 1: Add failing workflow contract assertions**

Assert the workflow inspects the project, creates it through `POST https://api.vercel.com/v11/projects?slug=$VERCEL_SCOPE` if absent, and deploys with explicit `--project`.

- [ ] **Step 2: Confirm RED against the pre-self-provisioning workflow**

Run: `npx vitest run tests/integration/atlas-manager-infra-route.test.ts`.

Expected before implementation: FAIL on the provisioning assertions.

- [ ] **Step 3: Implement the smallest provisioning path**

If `vercel project inspect` succeeds, continue. Otherwise create a Vite project with the repository build/output contract, immediately re-inspect it, then deploy.

- [ ] **Step 4: Verify deployed boundaries**

Require success for `/`, `/finance/accounting/accounts-payable`, `/healthz`; require anonymous `/atlas/infra/status` to return `401` so the infrastructure endpoint remains private.

- [ ] **Step 5: Run the integration suite**

Run: `npm run test:integration`.

Expected: PASS before merge/deployment is attempted.

### Task 4: Canonical GitHub repair execution alignment

**Files:**
- Create: `.github/workflows/atlas-ai-repair-executor.yml`
- Create: `scripts/atlas-ai-repair-runner.mjs`
- Create: `tests/unit/atlas-ai-repair-runner.test.ts`
- Create: `adapters/supabase/atlas-repair-bridge/index.ts`

**Interfaces:**
- Consumes: queued `atlas_ai_repair_jobs`, GitHub OIDC audience `atlas-enterprise-suite-repair`, canonical repository checkout, existing test commands.
- Produces: bounded repair branch/PR or truthful blocked/failed result with evidence; never writes directly to `main`.

- [ ] **Step 1: Add failing repair-executor contract tests**

Assert the runner uses the canonical repository, refuses `.github/`, secret/env/credential paths, refuses deletion/binary patches, limits patch size, and allows only existing ATLAS validation commands.

- [ ] **Step 2: Run the focused repair test and confirm RED**

Run: `npx vitest run tests/unit/atlas-ai-repair-runner.test.ts`.

Expected before implementation: FAIL because the runner/workflow is absent.

- [ ] **Step 3: Add the canonical OIDC repair workflow**

The workflow must request `id-token: write`, check out `main`, claim one repair job, gather bounded repository context, request or accept a repair plan, apply it on a new `atlas/repair-*` branch, execute allowlisted validations, push the branch, and open a PR. It must not bypass branch review or production gates.

- [ ] **Step 4: Align the repair bridge with canonical governance**

Set repository to `atlasenterprisesuite/atlasenterprisesuite`, owner to `atlasenterprisesuite`, and workflow ref to `.github/workflows/atlas-ai-repair-executor.yml@refs/heads/main`. Keep OIDC verification and existing repair-job RPC/storage semantics.

- [ ] **Step 5: Verify source security and deploy bridge only after the canonical workflow exists**

Run: `npm run test:unit && npm run test:integration && npm run typecheck && npm run build`.

Deploy the updated bridge only when those checks pass or when the sole remaining failure is independently proven to be the external GitHub-hosted-runner entitlement blocker.

### Task 5: GitHub Actions pre-run blocker classification

**Files:**
- Modify: `docs/architecture/ATLAS_MANAGER_SPEC.md` only if a newer evidence classification is needed; do not change workflow code to mask the failure.
- Evidence source: GitHub workflow/job API and ATLAS Manager blocker output.

**Interfaces:**
- Consumes: workflow run/job metadata.
- Produces: blocker classification separate from application/test failure.

- [ ] **Step 1: Reproduce with one failed-job rerun**

Use the GitHub Actions rerun API on one failed job only.

Expected: if the platform/entitlement issue persists, the new job again ends with `steps: []`, `runner_id: 0`, and no runner name.

- [ ] **Step 2: Check GitHub public service status**

If Actions is operational publicly while this private repository consistently receives no runner, classify the problem as repository/account runner entitlement/billing/authorization rather than `test_failure`.

- [ ] **Step 3: Keep PR gated**

Do not merge solely on source inspection while the required consensus workflow cannot execute. Continue independent Supabase/architecture work and surface the exact human/provider dependency.

### Task 6: Final verification and promotion

**Files:**
- PR: `atlas/manager-infra-status-v1` → `main`

**Interfaces:**
- Consumes: green unit/integration/typecheck/build/consensus, Vercel authorization, deployed endpoint evidence.
- Produces: traceable canonical merge and production deployment evidence.

- [ ] **Step 1: Synchronize with latest `main` without force-push**

Confirm `behind_by = 0` and preserve newer parallel work.

- [ ] **Step 2: Run full verification**

Run: `npm run test:unit && npm run test:integration && npm run typecheck && npm run build`.

Expected: all exit 0.

- [ ] **Step 3: Require ATLAS 3-of-3 Consensus**

Product/UX, Architecture/Build, and Security/Reliability must all complete successfully with actual executed steps.

- [ ] **Step 4: Merge and let production workflow deploy**

Merge only after the verification gates are green. Production workflow must create/link the Vercel project if needed, deploy, verify routes, and register OIDC evidence.

- [ ] **Step 5: Verify production truth**

Verify production root, module routes, `/healthz`, authenticated `/atlas/infra/status`, deployment commit traceability, and the latest `infrastructure-deployment` evidence row before marking ATLAS Manager production-ready.
