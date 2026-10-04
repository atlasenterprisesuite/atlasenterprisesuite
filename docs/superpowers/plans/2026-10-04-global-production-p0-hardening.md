# Global Production P0 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining ATLAS production-verification gaps by enforcing a dedicated JSON health endpoint, HSTS/CSP assertions, and current GitHub Action runtimes in the adjacent deployment/readiness workflows.

**Architecture:** Keep `/health` as the Health OS UI route and add `/api/v1/health` as the machine health contract. Extend the shared production contract and portable verifier so fail-closed verification requires the health payload and security headers. Update only the two adjacent workflows still using Node-20-targeted action majors.

**Tech Stack:** TypeScript/Cloudflare Worker, Node.js verifier, Vitest, GitHub Actions.

**Spec:** ATLAS master deployment protocol in current project context: P0 public domain must be HTTPS/200 with HSTS+CSP; health endpoint must return HTTP 200 JSON with `status: "healthy"`; production verification defaults fail-closed.

## Global Constraints

- Production origin remains `https://www.atlasenterprisesuite.com`.
- Verification remains fail-closed by default.
- `/health` remains the Health OS UI route.
- Machine health uses `/api/v1/health`.
- No claim of completion without exact-SHA production evidence.
- Preserve current protected `/deployment.json` behavior.

## Review Focus

- Health endpoint accidentally serving the SPA instead of JSON.
- Health JSON returning 200 without `status: "healthy"`.
- Root route losing HSTS or CSP while still returning 200.
- Exact-SHA headers missing from health/root responses.
- Adjacent deploy/readiness workflows retaining Node-20-targeted `@v4` actions.

---

### Task 1: Add failing P0 contract tests

**Files:**
- Create: `tests/integration/global-production-p0-hardening.test.ts`

**Interfaces:**
- Consumes: worker, global production contract/verifier, adjacent workflows.
- Produces: regression assertions for health JSON, security headers, and modern action majors.

- [ ] Write tests requiring `/api/v1/health`, `status: 'healthy'`, HSTS/CSP verification, and `checkout@v7`/`setup-node@v7` in both adjacent workflows.
- [ ] Run the targeted test and confirm failure for the missing behavior.
- [ ] Commit the red test.

### Task 2: Implement machine health and strict verifier checks

**Files:**
- Modify: `worker/index.ts`
- Modify: `data/ops/global-production-verification.json`
- Modify: `scripts/verify-global-production.mjs`

**Interfaces:**
- Produces: GET `/api/v1/health` -> HTTP 200 JSON with `status: "healthy"`; verifier booleans `health_contract_verified` and `security_headers_verified`.

- [ ] Add `/api/v1/health` before SPA asset fallback and return security-wrapped JSON.
- [ ] Add health/security expectations to the shared production contract.
- [ ] Probe and validate JSON health payload plus HSTS/CSP in the portable verifier.
- [ ] Run targeted test and full repository verification.
- [ ] Commit green implementation.

### Task 3: Modernize adjacent GitHub Actions

**Files:**
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `.github/workflows/production-deploy.yml`

**Interfaces:**
- Produces: Node-24-compatible checkout/setup-node action majors while preserving npm caching semantics.

- [ ] Replace `actions/checkout@v4` with `actions/checkout@v7`.
- [ ] Replace `actions/setup-node@v4` with `actions/setup-node@v7`.
- [ ] Preserve `cache: npm` where it is already intentional.
- [ ] Run targeted and full verification.
- [ ] Commit.

### Task 4: PR, CI, merge, deploy, exact-SHA verification

- [ ] Open PR to `main`.
- [ ] Require all repository checks to pass.
- [ ] Merge through repository rules.
- [ ] Confirm Cloudflare deployment success on the merge SHA.
- [ ] Confirm global production verifier passes in fail-closed mode on that exact SHA, including health JSON and HSTS/CSP checks.
