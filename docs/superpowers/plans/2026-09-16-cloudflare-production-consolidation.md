# Cloudflare Production Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce ATLAS Cloudflare production automation to one reusable secret credential, one canonical Worker configuration, one early authorization preflight, and one provider-backed deployment/evidence path.

**Architecture:** Keep `.github/workflows/cloudflare-deploy.yml` as the only production Worker deployment workflow and `wrangler.jsonc` as the Worker source of truth. Store the fixed non-secret Cloudflare account ID once in `wrangler.jsonc`, leaving `CLOUDFLARE_API_TOKEN` as the only GitHub production secret used by direct Wrangler CI. Add an early, non-mutating Cloudflare API preflight that classifies configuration/authentication/authorization/provider failures before expensive repository verification, then retain `verify:all`, Wrangler deploy, HTTP probes, and ATLAS Manager evidence in that order.

**Tech Stack:** GitHub Actions, Node.js 22, Bash/curl, Wrangler 4, Cloudflare Workers API, Vitest 3.2.6, JSONC Wrangler config.

**Spec:** `docs/superpowers/specs/2026-09-16-cloudflare-production-consolidation-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/cloudflare-production-consolidation`.
- Production GitHub Environment remains `production`.
- The only Cloudflare credential consumed by the production deployment workflow is `secrets.CLOUDFLARE_API_TOKEN`.
- `CLOUDFLARE_API_TOKEN` must never be read from `vars`, committed, printed, written to an artifact, or surfaced in ATLAS Manager evidence.
- The Cloudflare account ID is non-secret configuration. For this implementation it is stored once as `account_id` in `wrangler.jsonc`; Cloudflare documents `account_id` as a supported Wrangler configuration field and recommends Wrangler config as the Worker source of truth.
- Canonical account ID: `1dd6dea2bb98459c66f610464354d686`.
- Canonical Worker name: `atlas-enterprise-suite-web`.
- Do not add `CLOUDFLARE_ZONE_ID`, DNS permissions, custom-domain mutation, or Workers Routes mutation in this plan.
- Do not introduce `CF_API_TOKEN`, `CF_ACCOUNT_ID`, module-specific Cloudflare tokens, per-Worker tokens, or alternate CI credential namespaces.
- Preserve Cloudflare Access, ATLAS Identity, Supabase RLS/RBAC, and existing production probe behavior.
- Do not weaken `npm run verify:all`; it must still pass before `wrangler deploy`.
- Do not claim production success unless Wrangler deploy, post-deploy probes, and provider-backed evidence all pass.

---

## File Structure

- `wrangler.jsonc` — canonical Worker definition plus the fixed non-secret `account_id`.
- `.github/workflows/cloudflare-deploy.yml` — token-only direct deployment selection, early provider preflight, full verification, deploy, probes, evidence.
- `tests/integration/cloudflare-static-assets-contract.test.ts` — static contract tests for one-secret configuration, ordering, no alternate token names, probes and evidence.
- `docs/runbooks/atlas-blocker-recovery-runbook.md` — replace stale two-secret recovery instructions with the consolidated one-secret operating model and provider failure classification.

---

### Task 1: Lock the one-secret Cloudflare contract in tests

**Files:**
- Modify: `tests/integration/cloudflare-static-assets-contract.test.ts`

**Interfaces:**
- Consumes: raw text from `wrangler.jsonc`, `.github/workflows/cloudflare-deploy.yml`, and `package.json`.
- Produces: regression assertions that later tasks must satisfy.

- [ ] **Step 1: Replace the stale credential assertions with failing one-secret assertions**

Add/replace tests so the contract includes these exact requirements:

```ts
it('pins the non-secret Cloudflare account once in canonical Wrangler config', () => {
  expect(wrangler).toContain('"account_id": "1dd6dea2bb98459c66f610464354d686"');
  expect(workflow).not.toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
  expect(workflow).not.toContain('vars.CLOUDFLARE_ACCOUNT_ID');
});

it('uses exactly one Cloudflare credential source in production CI', () => {
  expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
  expect(workflow).not.toContain('vars.CLOUDFLARE_API_TOKEN');
  expect(workflow).not.toContain('CF_API_TOKEN');
  expect(workflow).not.toContain('CF_ACCOUNT_ID');
});

it('fails Cloudflare authorization before expensive repository verification', () => {
  const preflight = workflow.indexOf('Cloudflare authorization preflight');
  const verify = workflow.indexOf('npm run verify:all');
  const deploy = workflow.indexOf('wrangler@4 deploy');
  expect(preflight).toBeGreaterThan(-1);
  expect(verify).toBeGreaterThan(preflight);
  expect(deploy).toBeGreaterThan(verify);
});

it('classifies provider failures without logging the token', () => {
  expect(workflow).toContain('cloudflare_failure_category=configuration');
  expect(workflow).toContain('cloudflare_failure_category=authentication');
  expect(workflow).toContain('cloudflare_failure_category=authorization');
  expect(workflow).toContain('cloudflare_failure_category=provider');
  expect(workflow).not.toContain('echo "$CLOUDFLARE_API_TOKEN"');
  expect(workflow).not.toContain('printf \'%s\' "$CLOUDFLARE_API_TOKEN"');
});
```

Retain the existing assertions that `verify:all` includes audit/typecheck/unit/integration/build, deployment uses Wrangler 4, production probes remain, custom-domain routing is not embedded in `wrangler.jsonc`, and ATLAS Manager evidence remains provider-backed.

- [ ] **Step 2: Run the focused integration test and confirm RED**

Run:

```bash
npx vitest run tests/integration/cloudflare-static-assets-contract.test.ts
```

Expected: FAIL because the current workflow still references `CLOUDFLARE_ACCOUNT_ID` and the Wrangler config does not yet contain `account_id` or the new preflight label/classification markers.

- [ ] **Step 3: Commit the RED test contract**

```bash
git add tests/integration/cloudflare-static-assets-contract.test.ts
git commit -m "test: lock single-secret Cloudflare deployment contract"
```

---

### Task 2: Make Wrangler the single source of account configuration

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `.github/workflows/cloudflare-deploy.yml`

**Interfaces:**
- Consumes: `secrets.CLOUDFLARE_API_TOKEN` from GitHub Environment `production`.
- Produces: Wrangler config with `account_id`; direct deployment mode requiring only the token secret.

- [ ] **Step 1: Add the account ID to `wrangler.jsonc`**

The top of the config must become:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "atlas-enterprise-suite-web",
  "account_id": "1dd6dea2bb98459c66f610464354d686",
  "compatibility_date": "2026-09-07",
```

Do not add a zone ID, route, custom domain, token, API key, or email.

- [ ] **Step 2: Simplify deployment-mode selection to token-only direct auth**

In `.github/workflows/cloudflare-deploy.yml`, remove `ACCOUNT_SECRET_PRESENT`, `ACCOUNT_VARIABLE_PRESENT`, `GITHUB_EVENT_NAME`, and all `CLOUDFLARE_ACCOUNT_ID` secret/variable fallback logic.

The selection step should follow this shape:

```yaml
      - name: Select Cloudflare deployment verification mode
        id: deployment_mode
        env:
          TOKEN_SECRET_PRESENT: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}
          TOKEN_VARIABLE_PRESENT: ${{ vars.CLOUDFLARE_API_TOKEN != '' }}
        run: |
          set -euo pipefail
          echo "Cloudflare API token secret configured: $TOKEN_SECRET_PRESENT"
          echo "Cloudflare API token variable configured: $TOKEN_VARIABLE_PRESENT"

          if [ "$TOKEN_VARIABLE_PRESENT" = "true" ]; then
            echo "::error::CLOUDFLARE_API_TOKEN must never be stored as an Actions Variable; use the production Environment Secret."
            exit 1
          fi

          if [ "$TOKEN_SECRET_PRESENT" = "true" ]; then
            MODE="direct-wrangler"
          else
            MODE="cloudflare-native-github-app"
          fi

          echo "mode=$MODE" >> "$GITHUB_OUTPUT"
          echo "Cloudflare deployment verification mode: $MODE" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 3: Remove account-ID plumbing from deploy**

Delete the current `Use configured Cloudflare account ID` step and remove `CLOUDFLARE_ACCOUNT_ID` from the deploy step environment. The deploy step must rely on Wrangler's `account_id` and only inject the token:

```yaml
      - name: Deploy Workers Static Assets
        if: steps.deployment_mode.outputs.mode == 'direct-wrangler'
        id: deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          set -euo pipefail
          npx --yes wrangler@4 deploy --config wrangler.jsonc 2>&1 | tee /tmp/wrangler-deploy.log
```

Preserve the existing deployment URL extraction and post-deploy summary lines after the command.

- [ ] **Step 4: Run the focused contract test**

Run:

```bash
npx vitest run tests/integration/cloudflare-static-assets-contract.test.ts
```

Expected: still FAIL only on preflight/classification assertions from Task 1; the one-secret/account assertions should now pass.

- [ ] **Step 5: Commit the account/source-of-truth change**

```bash
git add wrangler.jsonc .github/workflows/cloudflare-deploy.yml
git commit -m "ci: consolidate Cloudflare account configuration"
```

---

### Task 3: Add an early non-mutating Cloudflare authorization preflight

**Files:**
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `tests/integration/cloudflare-static-assets-contract.test.ts` only if an exact assertion must be aligned to the implemented non-sensitive marker text; do not weaken the requirements.

**Interfaces:**
- Consumes: `CLOUDFLARE_API_TOKEN`, `wrangler.jsonc` `account_id`, and `wrangler.jsonc` Worker `name`.
- Produces: early PASS or a classified failure summary with no secret disclosure.

- [ ] **Step 1: Place the preflight before native media installation and `npm ci`**

Immediately after `actions/setup-node`, add a direct-Wrangler-only step named exactly `Cloudflare authorization preflight`.

Use Node only to read non-secret config fields and curl for provider checks:

```yaml
      - name: Cloudflare authorization preflight
        if: steps.deployment_mode.outputs.mode == 'direct-wrangler'
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          set -euo pipefail
          test -n "$CLOUDFLARE_API_TOKEN" || {
            echo "cloudflare_failure_category=authentication" >> "$GITHUB_STEP_SUMMARY"
            echo "::error::Cloudflare authentication secret is empty."
            exit 1
          }

          ACCOUNT_ID="$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));process.stdout.write(String(c.account_id||''))")"
          WORKER_NAME="$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));process.stdout.write(String(c.name||''))")"
          test -n "$ACCOUNT_ID" && test -n "$WORKER_NAME" || {
            echo "cloudflare_failure_category=configuration" >> "$GITHUB_STEP_SUMMARY"
            echo "::error::wrangler.jsonc must contain account_id and name."
            exit 1
          }

          TOKEN_HTTP="$(curl --silent --show-error --output /tmp/cloudflare-token.json --write-out '%{http_code}' \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H 'Content-Type: application/json' \
            'https://api.cloudflare.com/client/v4/user/tokens/verify' || true)"
          TOKEN_ACTIVE="$(node -e "const fs=require('fs');let j={};try{j=JSON.parse(fs.readFileSync('/tmp/cloudflare-token.json','utf8'))}catch{};process.stdout.write(String(j.success===true&&j.result?.status==='active'))")"
          if [ "$TOKEN_HTTP" != "200" ] || [ "$TOKEN_ACTIVE" != "true" ]; then
            echo "cloudflare_failure_category=authentication" >> "$GITHUB_STEP_SUMMARY"
            echo "::error::Cloudflare rejected or did not confirm the production API token. HTTP $TOKEN_HTTP."
            exit 1
          fi

          WORKER_HTTP="$(curl --silent --show-error --output /tmp/cloudflare-worker.json --write-out '%{http_code}' \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H 'Content-Type: application/json' \
            "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/services/$WORKER_NAME" || true)"
          PROVIDER_CODE="$(node -e "const fs=require('fs');let j={};try{j=JSON.parse(fs.readFileSync('/tmp/cloudflare-worker.json','utf8'))}catch{};process.stdout.write(String(j.errors?.[0]?.code||''))")"

          if [ "$PROVIDER_CODE" = "7003" ]; then
            echo "cloudflare_failure_category=configuration" >> "$GITHUB_STEP_SUMMARY"
            echo "cloudflare_provider_code=$PROVIDER_CODE" >> "$GITHUB_STEP_SUMMARY"
            echo "::error::Cloudflare account/Worker route configuration does not match the provider account."
            exit 1
          fi

          if [ "$WORKER_HTTP" = "401" ] || [ "$PROVIDER_CODE" = "9109" ] || [ "$PROVIDER_CODE" = "6111" ]; then
            echo "cloudflare_failure_category=authentication" >> "$GITHUB_STEP_SUMMARY"
            echo "cloudflare_provider_code=${PROVIDER_CODE:-none}" >> "$GITHUB_STEP_SUMMARY"
            echo "::error::Cloudflare authentication failed during Worker authorization preflight."
            exit 1
          fi

          if [ "$WORKER_HTTP" = "403" ] || [ "$PROVIDER_CODE" = "10000" ]; then
            echo "cloudflare_failure_category=authorization" >> "$GITHUB_STEP_SUMMARY"
            echo "cloudflare_provider_code=${PROVIDER_CODE:-none}" >> "$GITHUB_STEP_SUMMARY"
            echo "::error::Cloudflare token is valid but lacks the required Workers permission."
            exit 1
          fi

          case "$WORKER_HTTP" in
            200|404)
              echo "Cloudflare preflight: token_valid=true account_configured=true workers_authorized=true" >> "$GITHUB_STEP_SUMMARY"
              ;;
            *)
              echo "cloudflare_failure_category=provider" >> "$GITHUB_STEP_SUMMARY"
              echo "cloudflare_provider_code=${PROVIDER_CODE:-none}" >> "$GITHUB_STEP_SUMMARY"
              echo "::error::Unexpected Cloudflare Worker preflight response HTTP $WORKER_HTTP."
              exit 1
              ;;
          esac
```

The `404` case is accepted only when provider code is not `7003`: it means the configured account endpoint was reachable but the Worker service may not exist yet, which is valid before an initial authorized create/deploy.

- [ ] **Step 2: Ensure selection occurs before preflight and preflight occurs before expensive gates**

Reorder workflow steps to:

```text
checkout
setup-node
Select Cloudflare deployment verification mode
Cloudflare authorization preflight
Install native media verification dependencies
Install locked dependencies
Verify complete repository
Deploy Workers Static Assets
...
```

The GitHub-App fallback path skips the direct preflight and continues to repository verification before checking the provider deployment check.

- [ ] **Step 3: Run the focused contract test and confirm GREEN**

Run:

```bash
npx vitest run tests/integration/cloudflare-static-assets-contract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the preflight**

```bash
git add .github/workflows/cloudflare-deploy.yml tests/integration/cloudflare-static-assets-contract.test.ts
git commit -m "ci: add early Cloudflare authorization preflight"
```

---

### Task 4: Update the operational runbook to prevent future secret proliferation

**Files:**
- Modify: `docs/runbooks/atlas-blocker-recovery-runbook.md`

**Interfaces:**
- Consumes: the finalized one-secret deployment contract.
- Produces: the human/agent recovery procedure used for future Cloudflare incidents.

- [ ] **Step 1: Replace the stale Cloudflare authorization section**

Section 4 must state:

```markdown
## 4. Cloudflare deployment authorization

### Canonical contract

- GitHub Environment: `production`
- Secret credential: `CLOUDFLARE_API_TOKEN` only
- Account ID: configured once in `wrangler.jsonc` as `account_id`
- Worker: `atlas-enterprise-suite-web`
- Do not create `CF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` secrets, module-specific tokens, or per-deploy tokens.

### Failure classes

- `configuration`: Wrangler account/Worker configuration mismatch, including provider code `7003`.
- `authentication`: invalid/malformed/revoked token, including `9109` or `6111`.
- `authorization`: valid token without required Workers permission, commonly provider code `10000`/HTTP 403.
- `provider`: unexpected Cloudflare API/runtime response after configuration/authentication/authorization checks.

### Recovery procedure

1. Read the preflight category and provider code from the failed GitHub job.
2. Do not rotate or create a new token merely because deployment failed.
3. For `configuration`, verify `wrangler.jsonc` account/Worker identity.
4. For `authentication`, repair the one canonical production token secret.
5. For `authorization`, expand the permissions of the same canonical Cloudflare principal to the approved Workers scope; do not create a second token.
6. Re-run the same failed deployment workflow on the exact intended SHA.
7. Require `verify:all`, Wrangler deploy, Worker probes, and ATLAS Manager evidence before marking production verified.
```

Update the `Current known human-only / external blockers` section so Cloudflare references only the one canonical token permission/provider boundary and does not claim `CLOUDFLARE_ACCOUNT_ID` is a required secret.

- [ ] **Step 2: Search the runbook for stale two-secret instructions**

Run:

```bash
grep -nE 'CLOUDFLARE_ACCOUNT_ID|both repository secrets|Configure both' docs/runbooks/atlas-blocker-recovery-runbook.md
```

Expected: no stale instructions that require the account ID as a secret. A literal account-ID field may appear only when explaining the canonical non-secret Wrangler configuration.

- [ ] **Step 3: Commit the runbook update**

```bash
git add docs/runbooks/atlas-blocker-recovery-runbook.md
git commit -m "docs: consolidate Cloudflare production recovery"
```

---

### Task 5: Full verification, review, and integration evidence

**Files:**
- No new implementation files unless a failing gate reveals a regression directly caused by Tasks 1–4.

**Interfaces:**
- Consumes: all prior task changes.
- Produces: exact-head verification evidence and a PR ready for merge; production deployment remains provider-gated until the single token has sufficient Workers authorization.

- [ ] **Step 1: Run focused tests**

```bash
npx vitest run tests/integration/cloudflare-static-assets-contract.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full repository gate**

```bash
npm run verify:all
```

Expected: PASS for audit threshold, typecheck, unit, integration, edge, Python and build.

- [ ] **Step 3: Inspect the final diff for credential leakage**

Run:

```bash
git diff main...HEAD -- . ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*'
git grep -nE 'CF_API_TOKEN|CF_ACCOUNT_ID|secrets\.CLOUDFLARE_ACCOUNT_ID|vars\.CLOUDFLARE_ACCOUNT_ID' -- .github wrangler.jsonc tests docs/runbooks || true
```

Expected: no alternate credential namespace or account-ID secret/variable dependency in the production deployment path.

- [ ] **Step 4: Confirm the final ordering contract**

The workflow must satisfy:

```text
Select deployment mode
< Cloudflare authorization preflight
< npm run verify:all
< wrangler@4 deploy
< Worker HTTP probes
< ATLAS Manager evidence
```

and must preserve the existing GitHub-App fallback without making it authoritative when the production token secret is present.

- [ ] **Step 5: Open PR to `main`**

PR title:

```text
ci: consolidate Cloudflare production authentication
```

PR body must explicitly state:

```markdown
- one GitHub production secret: `CLOUDFLARE_API_TOKEN`
- account ID pinned once in canonical `wrangler.jsonc`
- early non-mutating provider authorization preflight
- no DNS/route/Access weakening
- full `verify:all` remains before deploy
- production state is not claimed until provider deployment/probes pass
```

- [ ] **Step 6: Require exact-head CI before merge**

Do not merge on stale runs. Confirm the PR head SHA has the canonical consensus/CodeQL/repository checks required by current repository policy.

- [ ] **Step 7: Merge only after green branch evidence, then inspect the resulting `main` Cloudflare workflow**

If the canonical token still lacks Workers authorization, the expected `main` result is an **early classified authorization failure** before expensive verification; that is correct behavior and must be reported as `EXTERNAL DEPENDENCY`, not as a repository failure.

If authorization is sufficient, require fresh evidence for Wrangler deploy, the reported `workers.dev` URL, HTTP probes, and ATLAS Manager recording before marking `DEPLOYED` or `VERIFIED IN PRODUCTION`.

---

## Self-Review

- Spec coverage: one principal, one mutable secret, canonical Wrangler config, fail-early authorization, full verification before deploy, probes/evidence, no secret proliferation, no Access weakening are all mapped to Tasks 1–5.
- Placeholder scan: no `TBD`, `TODO`, unspecified code blocks, or unresolved identifiers remain.
- Type/name consistency: `CLOUDFLARE_API_TOKEN`, `account_id`, Worker `name`, `cloudflare_failure_category`, and the four failure categories are consistent across tests, workflow and runbook.
- Scope: DNS, Workers Routes, custom-domain mutation, secret synchronization into Supabase, and provider token creation are intentionally excluded from repository implementation because they require separate provider authorization or tooling.