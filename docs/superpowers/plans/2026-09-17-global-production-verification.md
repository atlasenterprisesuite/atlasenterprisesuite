# ATLAS Global Production Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-neutral fail-closed post-deployment verification plane for the ATLAS production domain and critical ATLAS Network routes.

**Architecture:** A shared JSON production contract drives a portable Node verifier. A reusable GitHub workflow executes the verifier after any supported deployment path and falls back to the existing authorized Supabase runtime only when Cloudflare classifies the public probe as an edge challenge. The authorized runtime remains narrowly scoped through GitHub OIDC allow-listing.

**Tech Stack:** Node.js 22, Vitest, GitHub Actions, Supabase Edge Functions/Deno, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-09-17-global-production-verification-design.md`

## Global Constraints

- Canonical production origin is `https://www.atlasenterprisesuite.com`.
- Default verification mode is `fail-closed`.
- Critical ATLAS Network routes are `/business/network`, `/business/network/pricing`, `/business/network/commissions`, `/business/network/payouts`, and `/business/network/compliance`.
- `/deployment.json` must remain protected with unauthenticated status `302`, `401`, or `403`.
- Cross-origin redirects are blocking.
- A Cloudflare challenge is never a pass by itself.
- Existing ATLAS Identity, RBAC, RLS, Cloudflare edge policy, and deployment evidence must not be weakened.
- Do not claim unprovisioned cloud regions as deployed.

---

### Task 1: Shared production contract and failing repository test

**Files:**
- Create: `tests/integration/global-production-verification.test.ts`
- Create: `data/ops/global-production-verification.json`

**Interfaces:**
- Produces: canonical JSON contract consumed by the portable verifier and alignment tests.

- [ ] **Step 1: Write the failing test**

Add a Vitest contract test that expects the JSON contract, portable verifier, reusable workflow, package script, exact critical routes, `fail-closed` default, and the two-workflow OIDC allow-list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- tests/integration/global-production-verification.test.ts`

Expected: FAIL because the shared contract, portable verifier, reusable workflow, package command, and extended OIDC allow-list do not exist yet.

- [ ] **Step 3: Add only the shared JSON contract**

The JSON must define:

```json
{
  "version": 1,
  "production_origin": "https://www.atlasenterprisesuite.com",
  "default_mode": "fail-closed",
  "public_routes": ["/", "/identity?app=%2Ffinance", "/finance"],
  "critical_network_routes": [
    "/business/network",
    "/business/network/pricing",
    "/business/network/commissions",
    "/business/network/payouts",
    "/business/network/compliance"
  ],
  "protected_routes": [
    { "path": "/deployment.json", "allowed_statuses": [302, 401, 403] }
  ]
}
```

- [ ] **Step 4: Keep the test RED**

Re-run the focused test. It must still fail on the not-yet-created verifier/workflow/package/OIDC requirements.

- [ ] **Step 5: Commit**

Commit the contract and failing test together.

---

### Task 2: Portable provider-neutral verifier

**Files:**
- Create: `scripts/verify-global-production.mjs`
- Modify: `package.json`
- Test: `tests/integration/global-production-verification.test.ts`

**Interfaces:**
- Consumes: `data/ops/global-production-verification.json`.
- Produces: CLI command `npm run verify:production:global` and JSON-capable verification results.

- [ ] **Step 1: Extend the failing test**

Assert that the verifier reads the shared contract, defaults to `fail-closed`, enforces HTTPS/same-origin redirects, checks protected routes, recognizes `warning-only`, and exposes explicit classified-challenge deferral only when requested.

- [ ] **Step 2: Run focused test and confirm RED**

Expected: FAIL because the verifier and package script are absent.

- [ ] **Step 3: Implement minimal verifier**

Use Node 22 built-in `fetch`, `AbortSignal.timeout`, manual redirect handling, bounded retries, and deterministic output. A required failure exits non-zero in `fail-closed`. `warning-only` records failures but exits zero. Classified Cloudflare challenge deferral must require an explicit CLI flag and must remain a non-passing result for the caller to resolve.

- [ ] **Step 4: Add package command**

Add:

```json
"verify:production:global": "node scripts/verify-global-production.mjs"
```

- [ ] **Step 5: Run focused integration test**

Expected: remaining failures should now be limited to the reusable workflow and OIDC allow-list work.

- [ ] **Step 6: Commit**

Commit the portable verifier and package command.

---

### Task 3: Reusable global production workflow and authorized fallback

**Files:**
- Create: `.github/workflows/global-production-verify.yml`
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `tests/integration/cloudflare-authorized-production-verifier.test.ts`
- Test: `tests/integration/global-production-verification.test.ts`

**Interfaces:**
- Consumes: `npm run verify:production:global`.
- Produces: reusable workflow callable from future deployment adapters and manual/production-deployment event verification.

- [ ] **Step 1: Keep tests RED for workflow/OIDC requirements**

The tests must require `workflow_call`, `workflow_dispatch`, production `deployment_status`, fail-closed default, direct global verifier execution, and OIDC fallback only after a classified challenge.

- [ ] **Step 2: Run focused tests and confirm RED**

Run both global verification and Cloudflare authorized-verifier integration tests.

- [ ] **Step 3: Implement reusable workflow**

The job must:

1. ignore non-success/non-production `deployment_status` events;
2. checkout source and set up Node 22;
3. execute the portable verifier in `fail-closed` by default;
4. permit classified-challenge deferral only inside this workflow;
5. obtain a GitHub OIDC token with audience `atlas-production-http-verifier` when challenge fallback is required;
6. call `atlas-cloudflare-production-http-verify?api=verify`;
7. require the authorized runtime to report `ok=true`, the current target SHA, public shell success, critical Network success, and protected deployment path success;
8. fail otherwise.

- [ ] **Step 4: Extend OIDC allow-list**

Replace the single allowed workflow constant with an exact set containing the Cloudflare deployment workflow and the new global verification workflow, both restricted to `refs/heads/main`.

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

Commit the workflow and OIDC extension.

---

### Task 4: Full verification, PR, deploy evidence, and public validation

**Files:**
- No new production files unless verification reveals a defect.

**Interfaces:**
- Produces: reviewed branch, CI evidence, and verified public production state before merge/deploy claims.

- [ ] **Step 1: Run repository verification**

Run: `npm run verify:all`

Expected: PASS.

- [ ] **Step 2: Review branch diff**

Confirm no secrets, no duplicated provider credentials, no weakened auth, no fake region claims, and no `warning-only` production default.

- [ ] **Step 3: Open pull request**

Target `main` from `feat/global-deployment-verification` with a summary of the provider-neutral gate and fail-closed behavior.

- [ ] **Step 4: Inspect GitHub checks**

All required checks must pass. Any failure blocks merge.

- [ ] **Step 5: Merge only after checks pass**

Use the repository's supported merge method and exact head SHA protection.

- [ ] **Step 6: Verify production after deployment**

Verify `https://www.atlasenterprisesuite.com` plus every critical ATLAS Network route. Do not call the deployment verified if any required route fails.

- [ ] **Step 7: Record the exact production outcome**

Report the merged SHA, provider deployment evidence, global verification result, and any external provider boundary still pending.
