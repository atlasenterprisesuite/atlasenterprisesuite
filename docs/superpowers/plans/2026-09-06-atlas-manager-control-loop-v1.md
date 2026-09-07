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

## Current execution state — 2026-09-06

- `atlas-infra-status` is deployed in Supabase with platform JWT verification enabled. Supabase deployment metadata reports ACTIVE version 7; source contract version is 4.
- `atlas-infra-evidence` is deployed and accepts only the canonical production workflow through GitHub OIDC.
- Vercel team `winderaranguren-gifs-projects` is reachable but currently contains zero projects. Self-provisioning is staged in the canonical production workflow.
- GitHub-hosted Actions is the current P0 release gate: jobs terminate before runner allocation (`steps: []`, `runner_id: 0`) and a targeted rerun reproduced the condition. Canonical issue #38 records the blocker.
- The canonical repair executor and source-controlled repair bridge are staged on `atlas/manager-infra-status-v1`; they never write directly to `main`.
- The active repair queue has no `pending`, `claimed`, or `planning` jobs.
- The currently deployed repair bridge is reachable but retains a historical validation-command contract. Do not promote the staged repair executor until required repo verification can actually run.

---

### Task 1: Infrastructure status route and normalized truth

**Files:**
- Modify: `vercel.json`
- Create: `adapters/supabase/atlas-infra-status/index.ts`
- Test: `tests/integration/atlas-manager-infra-route.test.ts`
- Test: `tests/unit/atlas-infra-status.test.ts`

**Interfaces:**
- Consumes: authenticated ATLAS JWT, `atlas_release_registry`, `atlas_runtime_verification_runs`, provider environment variables.
- Produces: `GET /atlas/infra/status` proxy and normalized `production_readiness`, provider states, blockers, latest runtime verification, latest infrastructure-deployment verification, and repair-planner readiness.

- [x] **Step 1: Add route/status source tests**

Assert `/atlas/infra/status` rewrites to the Supabase status function, disables rewrite caching, uses `atlasenterprisesuite/atlasenterprisesuite`, queries `verification_type = infrastructure-deployment`, preserves `/healthz`, and does not treat repair-bridge reachability as planner readiness.

- [x] **Step 2: Confirm RED for the planner-readiness delta**

The prior v3 source only probed repair-bridge reachability; `repair_planner_not_configured` and `openaiConfigured` planner truth were absent.

- [x] **Step 3: Implement the minimum route and status aggregator**

The Edge Function remains admin/JWT gated, no-store, and read-only. It queries the latest general runtime verification independently from the latest `infrastructure-deployment` verification and parses repair-bridge readiness.

- [ ] **Step 4: Run the focused Vitest suite and confirm GREEN**

Run: `npx vitest run tests/integration/atlas-manager-infra-route.test.ts tests/unit/atlas-infra-status.test.ts`

Blocked by GitHub-hosted runner allocation. Full Vitest remains required before merge.

- [x] **Step 5: Deploy the Edge Function and verify provider metadata**

Supabase reports `atlas-infra-status` ACTIVE, platform JWT verification enabled, deployment version 7.

### Task 2: OIDC deployment evidence ingress

**Files:**
- Create: `adapters/supabase/atlas-infra-evidence/index.ts`
- Test: `tests/unit/atlas-infra-evidence.test.ts`
- Modify: `.github/workflows/production-deploy.yml`

**Interfaces:**
- Consumes: GitHub Actions OIDC token with audience `atlas-infrastructure-evidence`; successful deployment metadata.
- Produces: one `atlas_runtime_verification_runs` row with `verification_type = infrastructure-deployment` and canonical commit traceability.

- [x] **Step 1: Add security contract tests**
- [x] **Step 2: Implement OIDC verification and evidence persistence**
- [x] **Step 3: Add production workflow OIDC registration**
- [x] **Step 4: Deploy the ingress**
- [ ] **Step 5: Run full unit/integration verification**

Run: `npm run test:unit && npm run test:integration`.

Blocked by GitHub-hosted runner allocation; must be green before merge.

### Task 3: Vercel self-provisioning and production gates

**Files:**
- Modify: `.github/workflows/production-deploy.yml`
- Test: `tests/integration/atlas-manager-infra-route.test.ts`

**Interfaces:**
- Consumes: repository secret `VERCEL_TOKEN`, team slug `winderaranguren-gifs-projects`, project name `atlasenterprisesuite`.
- Produces: existing-or-created Vercel project, explicit production deployment URL, route/health/auth-boundary verification.

- [x] **Step 1: Add workflow contract assertions**
- [x] **Step 2: Implement the smallest provisioning path**
- [x] **Step 3: Define deployed-boundary verification**
- [ ] **Step 4: Exercise self-provisioning against Vercel**

Current provider evidence: team exists, project count = 0. Execution is blocked because the GitHub-hosted deploy runner cannot currently allocate.

- [ ] **Step 5: Confirm production deployment and evidence**

Requires a successful GitHub-hosted production workflow and Vercel deployment.

### Task 4: Canonical GitHub repair execution alignment

**Files:**
- Create: `.github/workflows/atlas-ai-repair-executor.yml`
- Create: `scripts/atlas-ai-repair-runner.mjs`
- Create: `tests/unit/atlas-ai-repair-runner.test.ts`
- Create: `tests/unit/atlas-repair-bridge-source.test.ts`
- Create: `adapters/supabase/atlas-repair-bridge/index.ts`

**Interfaces:**
- Consumes: queued `atlas_ai_repair_jobs`, GitHub OIDC audience `atlas-enterprise-suite-repair`, canonical repository checkout, existing test commands.
- Produces: bounded repair branch/PR or truthful blocked/failed result with evidence; never writes directly to `main`.

- [x] **Step 1: Add repair-executor contract tests before implementation**
- [x] **Step 2: Confirm RED before runner/workflow implementation**
- [x] **Step 3: Add the canonical OIDC repair workflow and bounded runner**
- [x] **Step 4: Correct runner execution bug found during independent verification**
- [x] **Step 5: Source-control an updated canonical repair bridge**
- [ ] **Step 6: Run full repo tests and deploy the updated repair bridge**

Do not replace the active bridge until the canonical workflow exists on `main` and required verification can actually execute. Current repair queue has no pending/claimed/planning jobs.

### Task 5: GitHub Actions pre-run blocker classification

**Evidence:** GitHub issue #38 and workflow/job API.

- [x] **Step 1: Reproduce with one failed-job rerun**
- [x] **Step 2: Separate provider/account gate from test failure**
- [x] **Step 3: Record auditable blocker in issue #38**
- [x] **Step 4: Keep PR gated**

PR #27 remains draft. No merge is authorized by source inspection alone.

### Task 6: Final verification and promotion

**Files:**
- PR: `atlas/manager-infra-status-v1` → `main`

- [x] **Step 1: Synchronize with latest observed `main` without force-push**

Latest verified compare showed the branch ahead and `behind_by = 0`, preserving parallel work.

- [ ] **Step 2: Run full verification**

Run: `npm run test:unit && npm run test:integration && npm run typecheck && npm run build`.

Expected: all exit 0.

- [ ] **Step 3: Require ATLAS 3-of-3 Consensus**

Product/UX, Architecture/Build, and Security/Reliability must all complete successfully with actual executed steps and a non-zero allocated runner.

- [ ] **Step 4: Merge and let production workflow deploy**

Merge only after the verification gates are green. Production workflow must create/link the Vercel project if needed, deploy, verify routes, and register OIDC evidence.

- [ ] **Step 5: Verify production truth**

Verify production root, module routes, `/healthz`, authenticated `/atlas/infra/status`, deployment commit traceability, Cloudflare routing/control state, and the latest `infrastructure-deployment` evidence row before marking ATLAS Manager production-ready.
