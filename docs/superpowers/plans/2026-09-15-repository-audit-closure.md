# ATLAS Repository Audit Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the actionable P0/P1 repository audit findings while preserving ATLAS production truth, tenant isolation, Cloudflare Access, Supabase governance, and one canonical architecture.

**Architecture:** Harden the repository in layers: trusted CI boundaries, shared verification, edge/browser hardening, a typed module registry, repository governance/hygiene, and a convergence register. Administrative controls that cannot be mutated by the connected GitHub capability remain explicit external gates rather than simulated success.

**Tech Stack:** GitHub Actions, npm workspaces, React 18, TypeScript 5, Vite 6, Vitest 3, Cloudflare Workers, Supabase Edge Functions/Deno, Python unittest/pytest-compatible tests.

**Spec:** `docs/superpowers/specs/2026-09-15-repository-audit-closure-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Canonical branch: `main`.
- No secrets or credentials in source.
- Preserve Cloudflare Access fail-closed behavior.
- Preserve Supabase tenant/RLS/RBAC and audit boundaries.
- Demo data must remain explicitly labeled.
- Do not bulk-merge historical A-Z work.
- Do not claim repository-admin/provider-side controls are enabled unless verified.

---

### Task 1: Trusted CI runner boundary

**Files:**
- Modify: `.github/workflows/accounts-payable-ci.yml`
- Modify: `.github/workflows/ride-profile-photo-ci.yml`
- Modify: `.github/workflows/hospitality-self-hosted-ci.yml`
- Modify: `.github/workflows/atlas-director-self-hosted-ci.yml`
- Create: `tests/unit/ci-runner-boundary.test.ts`

**Interfaces:**
- Consumes: GitHub event name/ref.
- Produces: PR jobs that run only on `ubuntu-latest`; self-hosted jobs remain manual/trusted-branch only.

- [ ] Write a source-contract test that loads the four workflows and fails if any `pull_request` workflow job uses unconditional `runs-on: self-hosted`.
- [ ] Run the focused test and confirm RED against current workflows.
- [ ] Move PR-capable jobs to `ubuntu-latest`; preserve self-hosted workflows only where their triggers are explicit trusted branches/manual dispatch.
- [ ] Re-run the focused test and full unit suite.
- [ ] Commit as `ci: isolate pull requests from self-hosted runners`.

### Task 2: Repository-wide verification contract

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/production-deploy.yml`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Create: `scripts/verify-edge-source.mjs`
- Create: `scripts/verify-python.mjs`
- Create: `tests/unit/repository-verification-contract.test.ts`

**Interfaces:**
- Produces: `npm run verify:all`.

- [ ] Add a failing contract test asserting root scripts `verify:edge`, `verify:python`, and `verify:all` exist and production workflows invoke the shared verification contract or the exact same expanded gates.
- [ ] Implement `verify:edge` as deterministic source checks for Supabase Function entrypoints/migrations and `verify:python` using Python's unittest discovery for `services/creator-native`.
- [ ] Add `verify:all = npm audit --audit-level=high && npm run typecheck && npm run test:unit && npm run test:integration && npm run verify:edge && npm run verify:python && npm run build`.
- [ ] Update production-readiness and Cloudflare workflows to call `npm run verify:all` after `npm ci`.
- [ ] Run focused tests and CI on the branch.
- [ ] Commit as `ci: unify repository verification contract`.

### Task 3: Cloudflare response security headers

**Files:**
- Modify: `worker/index.ts`
- Create: `tests/unit/cloudflare-worker-security-headers.test.ts`

**Interfaces:**
- Consumes: authenticated asset response from `env.ASSETS.fetch`.
- Produces: same status/body plus hardened response headers.

- [ ] Write a failing source/behavior contract requiring CSP, HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy.
- [ ] Implement a response-cloning helper that adds headers only after successful Access assertion verification.
- [ ] Preserve 401/403 fail-closed Access behavior unchanged.
- [ ] Run focused test, unit/integration suites and build.
- [ ] Commit as `security: harden Cloudflare asset responses`.

### Task 4: Session storage boundary

**Files:**
- Create: `apps/web/src/lib/atlasSessionStorage.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Create: `tests/unit/atlas-session-storage.test.ts`
- Create: `docs/security/ATLAS_BROWSER_SESSION_MODEL.md`

**Interfaces:**
- Produces: `readAccessToken`, `readRefreshToken`, `writeSession`, `clearSessionStorage`.

- [ ] Write failing unit tests for centralized storage behavior and explicit clearing.
- [ ] Move direct `localStorage` reads/writes from `atlasSession.ts` into the adapter without changing external auth behavior.
- [ ] Document residual XSS risk and the required future HttpOnly/BFF migration contract; do not fake that migration.
- [ ] Run focused tests, typecheck and integration tests.
- [ ] Commit as `security: centralize browser session persistence`.

### Task 5: Canonical module registry

**Files:**
- Create: `apps/web/src/modules/registry.ts`
- Modify: `apps/web/src/App.tsx`
- Create: `tests/unit/module-registry.test.ts`
- Create: `tests/integration/module-registry-navigation.test.tsx`

**Interfaces:**
- Produces: `ATLAS_MODULES` typed registry with `id`, `title`, `area`, `route`, `readiness`, `requiresAuth`, `description`.

- [ ] Write failing tests for unique IDs/routes and expected implemented top-level modules.
- [ ] Implement registry for currently surfaced Business, Finance, Payroll, Learning, Health, Studio/Creator, Hospitality, Ride and Voice capabilities without marking unimplemented modules active.
- [ ] Generate Enterprise Home module cards from registry entries that are approved for home display.
- [ ] Preserve existing routers and route URLs.
- [ ] Run focused tests, full tests and build.
- [ ] Commit as `refactor: add canonical ATLAS module registry`.

### Task 6: Demo truth regression contract

**Files:**
- Create: `tests/unit/demo-production-boundary.test.ts`
- Modify only if needed: `apps/web/src/modules/finance/accounting/PayablesPage.tsx`

**Interfaces:**
- Guarantees: demo AP data always carries explicit demo language; authenticated Supabase data carries live RLS language.

- [ ] Add a regression test checking demo notice, no fake connected wording and session-gated live ledger behavior.
- [ ] If the test exposes ambiguous UI copy, make the smallest wording/state correction.
- [ ] Run focused and integration tests.
- [ ] Commit as `test: enforce demo and production data boundary`.

### Task 7: Repository governance and hygiene

**Files:**
- Create: `.gitignore`
- Create: `.github/CODEOWNERS`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `docs/governance/MAIN_BRANCH_REQUIRED_POLICY.md`
- Create: `tests/unit/repository-governance-files.test.ts`

**Interfaces:**
- Produces: machine-readable/documented desired-state controls for repository administration.

- [ ] Write failing tests requiring the governance files and required-policy keywords/check names.
- [ ] Add secure defaults for generated files, `.env*` except examples, Python/Node caches, coverage/build outputs and local credentials.
- [ ] Add CODEOWNERS for workflows, worker, Supabase, security/governance and core application surfaces.
- [ ] Document required `main` rules: PR-only, no force/deletion, required checks, resolved conversations and release evidence.
- [ ] Run focused tests.
- [ ] Commit as `chore: codify repository governance controls`.

### Task 8: Historical convergence register and stale audit refresh

**Files:**
- Create: `docs/audit/2026-09-15-repository-hardening-closure.md`
- Create: `docs/governance/HISTORICAL_CONVERGENCE_REGISTER.md`
- Modify: `docs/audit/2026-09-13-atlas-module-readiness-matrix.md`

**Interfaces:**
- Produces: current truth on exact-SHA deploy, remaining external gates, and no-bulk-merge policy.

- [ ] Record the exact audit baseline and closure branch scope.
- [ ] Mark prior Cloudflare credential blocker as historical/resolved where current exact-SHA workflow evidence proves success.
- [ ] Classify A-Z and oversized historical work as salvage-only, never bulk merge.
- [ ] Keep privileged MFA/Supabase provider settings as `REVERIFY` unless fresh provider evidence exists.
- [ ] Commit as `docs: refresh repository hardening truth`.

### Task 9: Final verification and merge gate

**Files:**
- No product file changes unless verification reveals a defect.

**Interfaces:**
- Consumes: branch head.
- Produces: a reviewable PR whose checks prove the closure.

- [ ] Run/observe `npm ci` + `npm run verify:all` on GitHub Actions.
- [ ] Confirm ATLAS Consensus 3-of-3 passes.
- [ ] Confirm CodeQL passes.
- [ ] Inspect Copilot review findings and resolve material issues.
- [ ] Merge only when checks are green and the PR is mergeable.
- [ ] Verify `main` production-readiness and Cloudflare deployment on the exact merged SHA.
- [ ] Record any remaining admin/provider external gates without claiming them complete.
