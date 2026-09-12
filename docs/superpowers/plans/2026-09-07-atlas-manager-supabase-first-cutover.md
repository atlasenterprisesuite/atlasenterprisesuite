# ATLAS Manager Supabase-First Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify Vercel as optional, make Supabase `atlas-core` the ATLAS Manager control-plane authority, and ensure GitHub CI reports truthful Supabase-first readiness without claiming a Cloudflare deployment that has not yet been verified.

**Architecture:** The first cutover isolates provider-readiness logic into a pure, testable module shared by the Supabase Edge Function. The existing deployed `atlas-infra-status` function is downloaded into source control, refactored to treat GitHub/Supabase/Cloudflare/production as required and Vercel as optional, then redeployed to `atlas-core` (`ggmanzcgtlrvqfoccgsh`). The current GitHub workflow is converted from a Vercel deployment workflow into a build/readiness gate; actual Cloudflare frontend deployment is a separate follow-on implementation plan because it is an independent subsystem.

**Tech Stack:** TypeScript, Vitest 3.2.6, Supabase Edge Functions/Deno, Supabase project `ggmanzcgtlrvqfoccgsh`, GitHub Actions, Vite 6.4.3.

**Spec:** `docs/architecture/ATLAS_MANAGER_SPEC.md`

## Global Constraints

- Canonical repository is `atlasenterprisesuite/atlasenterprisesuite`.
- Primary backend/control-plane project is Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`).
- Required production path is `GitHub → Supabase ATLAS Manager → Cloudflare → Production`.
- Vercel is optional unless an active release explicitly selects it as required.
- Optional providers MUST NOT reduce production readiness.
- No secret value may be committed, echoed to logs, or returned by status APIs.
- Existing `atlas-infra-status`, `atlas-infra-evidence`, `atlas-runtime-verifier`, `atlas-sovereign-control-plane`, `atlas-platform-controls`, and `atlas-repair-bridge` are reused; no parallel control plane is created.
- Production state, CI state, provider state, runtime state, and public-edge verification remain separate facts.
- Cloudflare frontend deployment is intentionally outside this first cutover plan and receives its own plan after this provider contract is stable.

---

## File Structure

Files created or modified in this plan:

- Create `supabase/functions/_shared/infrastructure-readiness.ts` — pure provider requirement/blocker/readiness evaluation.
- Create `supabase/functions/atlas-infra-status/index.ts` — source-controlled version of the existing deployed Edge Function.
- Create `tests/unit/atlas-manager-infrastructure-readiness.test.ts` — provider requirement and readiness contract tests.
- Create `tests/integration/atlas-manager-status-source.test.ts` — static integration checks that the Edge Function uses the required provider contract and does not hard-block on Vercel.
- Modify `.github/workflows/production-deploy.yml` — remove mandatory Vercel authorization/deployment and make the workflow a truthful build + readiness gate pending the Cloudflare deployment plan.
- Modify `README.md` — align the operating description with Supabase-first + Cloudflare and Vercel optionality.

### Task 1: Provider requirement and readiness contract

**Files:**
- Create: `supabase/functions/_shared/infrastructure-readiness.ts`
- Create: `tests/unit/atlas-manager-infrastructure-readiness.test.ts`

**Interfaces:**
- Produces `ProviderName`, `ProviderSnapshot`, `InfrastructureBlocker`, `InfrastructureEvaluation`.
- Produces `evaluateInfrastructure(providers)` consumed by `atlas-infra-status`.

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/atlas-manager-infrastructure-readiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateInfrastructure } from '../../supabase/functions/_shared/infrastructure-readiness';

describe('ATLAS Manager infrastructure readiness', () => {
  it('does not block when optional Vercel is unconfigured', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'ready', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: false }
    });

    expect(result.status).toBe('ready');
    expect(result.blockers).toEqual([]);
    expect(result.providers.vercel.state).toBe('optional_provider_unconfigured');
  });

  it('blocks when required Cloudflare is not verified', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'not_verified', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: false }
    });

    expect(result.status).toBe('partial');
    expect(result.blockers).toEqual([
      {
        provider: 'cloudflare',
        reason: 'not_verified',
        nextAction: 'verify_or_repair_cloudflare'
      }
    ]);
  });

  it('blocks on Vercel only when a release explicitly makes it required', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'ready', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: true }
    });

    expect(result.status).toBe('partial');
    expect(result.blockers[0]).toEqual({
      provider: 'vercel',
      reason: 'not_configured',
      nextAction: 'verify_or_repair_vercel'
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because the module does not exist**

Run:

```bash
npm run test:unit -- --run tests/unit/atlas-manager-infrastructure-readiness.test.ts
```

Expected: FAIL resolving `supabase/functions/_shared/infrastructure-readiness`.

- [ ] **Step 3: Implement the minimal pure evaluator**

Create `supabase/functions/_shared/infrastructure-readiness.ts`:

```ts
export type ProviderName = 'github' | 'supabase' | 'cloudflare' | 'production' | 'vercel';

export type ProviderSnapshot = {
  state: string;
  required: boolean;
};

export type InfrastructureBlocker = {
  provider: ProviderName;
  reason: string;
  nextAction: string;
};

export type InfrastructureEvaluation = {
  status: 'ready' | 'partial';
  providers: Record<ProviderName, ProviderSnapshot>;
  blockers: InfrastructureBlocker[];
  requiredPath: ProviderName[];
};

const REQUIRED_DEFAULT: ProviderName[] = ['github', 'supabase', 'cloudflare', 'production'];

export function evaluateInfrastructure(
  input: Record<ProviderName, ProviderSnapshot>
): InfrastructureEvaluation {
  const providers = { ...input };

  if (!providers.vercel.required && ['not_configured', 'project_not_configured', 'authorization_missing'].includes(providers.vercel.state)) {
    providers.vercel = { ...providers.vercel, state: 'optional_provider_unconfigured' };
  }

  const blockers = (Object.entries(providers) as Array<[ProviderName, ProviderSnapshot]>)
    .filter(([, snapshot]) => snapshot.required && snapshot.state !== 'ready')
    .map(([provider, snapshot]) => ({
      provider,
      reason: snapshot.state,
      nextAction: `verify_or_repair_${provider}`
    }));

  return {
    status: blockers.length === 0 ? 'ready' : 'partial',
    providers,
    blockers,
    requiredPath: REQUIRED_DEFAULT
  };
}
```

- [ ] **Step 4: Run the unit test**

```bash
npm run test:unit -- --run tests/unit/atlas-manager-infrastructure-readiness.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run all unit tests**

```bash
npm run test:unit
```

Expected: all existing unit tests plus the new contract tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/infrastructure-readiness.ts tests/unit/atlas-manager-infrastructure-readiness.test.ts
git commit -m "feat: add ATLAS Manager provider readiness contract"
```

### Task 2: Bring `atlas-infra-status` under source control and make Vercel optional

**Files:**
- Create: `supabase/functions/atlas-infra-status/index.ts`
- Create: `tests/integration/atlas-manager-status-source.test.ts`

**Interfaces:**
- Consumes `evaluateInfrastructure()` from Task 1.
- Preserves the current deployed authorization behavior: authenticated user + active organization membership + role `owner`, `admin`, or `platform_admin`.
- Preserves current canonical repo `atlasenterprisesuite/atlasenterprisesuite` and production URL `https://www.atlasenterprisesuite.com`.

- [ ] **Step 1: Download the deployed function source from authoritative `atlas-core`**

Discover CLI syntax first:

```bash
supabase functions download --help
```

Then download the existing function from project `ggmanzcgtlrvqfoccgsh`:

```bash
supabase functions download atlas-infra-status --project-ref ggmanzcgtlrvqfoccgsh
```

Expected: `supabase/functions/atlas-infra-status/index.ts` matches the currently deployed function before edits.

- [ ] **Step 2: Write a static integration test that captures the new contract**

Create `tests/integration/atlas-manager-status-source.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-infra-status/index.ts', 'utf8');

describe('atlas-infra-status source contract', () => {
  it('uses the provider readiness evaluator', () => {
    expect(source).toContain("from '../_shared/infrastructure-readiness.ts'");
    expect(source).toContain('evaluateInfrastructure');
  });

  it('does not hard-code Vercel as a blocking required stage', () => {
    expect(source).not.toContain("blockers.push({ stage: 'vercel'");
    expect(source).toContain("required: false");
  });

  it('declares the Supabase-first required path', () => {
    expect(source).toContain("github: { state:");
    expect(source).toContain("supabase: { state:");
    expect(source).toContain("cloudflare: { state:");
    expect(source).toContain("production: { state:");
  });
});
```

- [ ] **Step 3: Run the integration test and verify it fails against the downloaded v8 source**

```bash
npm run test:integration -- --run tests/integration/atlas-manager-status-source.test.ts
```

Expected: FAIL because the current deployed function still manually adds a Vercel blocker and does not import the evaluator.

- [ ] **Step 4: Refactor the Edge Function after provider probes complete**

Add this import at the top:

```ts
import { evaluateInfrastructure } from '../_shared/infrastructure-readiness.ts';
```

After the existing GitHub, Vercel, Cloudflare, Supabase, and production probes have produced their states, replace provider-specific blocker assembly with:

```ts
const normalized = evaluateInfrastructure({
  github: {
    state: ['ready', 'oidc_bridge_reachable_token_not_present'].includes(github.state)
      ? 'ready'
      : github.state,
    required: true
  },
  supabase: {
    state: releaseQ.error || runtimeQ.error || infraQ.error || controlQ.error ? 'degraded' : 'ready',
    required: true
  },
  cloudflare: {
    state: cloudflare.state,
    required: true
  },
  production: {
    state: productionRoot.reachable ? 'ready' : 'public_site_unreachable',
    required: true
  },
  vercel: {
    state: vercel.state,
    required: false
  }
});
```

Keep non-provider blockers that remain genuinely required, including repair bridge, runtime verification, infrastructure-deployment verification, infrastructure-control verification, and the routing bridge. Merge them with `normalized.blockers`; do not restore a Vercel blocker when `required` is false.

Return these additional top-level fields:

```ts
required_path: normalized.requiredPath,
provider_requirements: {
  github: true,
  supabase: true,
  cloudflare: true,
  production: true,
  vercel: false
},
```

Return Vercel state inside `infrastructure.vercel`, but its absence must not determine `production_readiness` unless explicitly marked required by a later release configuration.

- [ ] **Step 5: Run the new integration test and all tests**

```bash
npm run test:integration -- --run tests/integration/atlas-manager-status-source.test.ts
npm run test:unit
npm run test:integration
npm run typecheck
npm run build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-infra-status/index.ts tests/integration/atlas-manager-status-source.test.ts
git commit -m "feat: make ATLAS infra status Supabase-first"
```

### Task 3: Deploy and verify the Supabase control-plane function

**Files:**
- No new source files; deploy Task 1 and Task 2 source to project `ggmanzcgtlrvqfoccgsh`.

**Interfaces:**
- Deployment target: Supabase `atlas-core`, project ref `ggmanzcgtlrvqfoccgsh`.
- Function: `atlas-infra-status`.
- JWT verification remains enabled.

- [ ] **Step 1: Confirm CLI command shape and project linkage**

```bash
supabase --version
supabase functions deploy --help
```

- [ ] **Step 2: Deploy only the changed function**

```bash
supabase functions deploy atlas-infra-status --project-ref ggmanzcgtlrvqfoccgsh
```

Expected: deployment succeeds and increments the active function version.

- [ ] **Step 3: Confirm unauthenticated access is still rejected**

```bash
curl -i https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-infra-status
```

Expected: HTTP 401; the function must not expose infrastructure state publicly.

- [ ] **Step 4: Verify function metadata and runtime logs**

Use the Supabase provider tooling to confirm `atlas-infra-status` is `ACTIVE`, `verify_jwt=true`, and its deployed source hash/version changed from the pre-cutover deployment. Review function logs for deployment/runtime errors; no secret values may appear.

- [ ] **Step 5: Commit any source changes produced by the CLI download/deploy flow**

```bash
git status --short
git add supabase/functions/atlas-infra-status supabase/functions/_shared
git commit -m "chore: align deployed ATLAS Manager function source" || true
```

The `|| true` is permitted only because the prior commits may already contain every source change; it is not permitted to hide a test or deployment failure.

### Task 4: Remove Vercel from the default GitHub production gate without claiming Cloudflare deployment

**Files:**
- Modify: `.github/workflows/production-deploy.yml`
- Test: existing repository build/test commands plus workflow text inspection.

**Interfaces:**
- Produces a successful build/readiness gate when application validation passes.
- Does not deploy to Vercel.
- Does not claim the frontend was deployed to Cloudflare.

- [ ] **Step 1: Replace workflow identity and watched paths**

Set:

```yaml
name: ATLAS Build + Production Readiness Gate
```

Keep `workflow_dispatch` and `push` on `main`. Remove `vercel.json` from the path trigger. Add:

```yaml
      - "supabase/functions/**"
      - "docs/architecture/ATLAS_MANAGER_SPEC.md"
```

- [ ] **Step 2: Remove the Vercel-only environment and deployment steps**

Delete:

```yaml
env:
  VERCEL_SCOPE: winderaranguren-gifs-projects
```

Delete the steps named:

```text
Validate Vercel authorization
Install Vercel CLI
Deploy production
Verify production routes
```

- [ ] **Step 3: Add a truthful readiness summary after the production build**

Add:

```yaml
      - name: Record Supabase-first readiness boundary
        run: |
          {
            echo "## ATLAS Supabase-first readiness gate"
            echo "- Canonical source validation: passed"
            echo "- Security audit: passed"
            echo "- Typecheck: passed"
            echo "- Unit tests: passed"
            echo "- Integration tests: passed"
            echo "- Vite production build: passed"
            echo "- Vercel: optional; not part of this gate"
            echo "- Cloudflare production deployment: separate required stage; not claimed by this workflow"
          } >> "$GITHUB_STEP_SUMMARY"
```

This workflow success means the canonical build is deployable; it does not mean public production is verified.

- [ ] **Step 4: Run local validation**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: PASS.

- [ ] **Step 5: Inspect the workflow for removed Vercel hard dependency**

```bash
! grep -q 'VERCEL_TOKEN' .github/workflows/production-deploy.yml
! grep -q 'vercel deploy' .github/workflows/production-deploy.yml
grep -q 'Cloudflare production deployment: separate required stage' .github/workflows/production-deploy.yml
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/production-deploy.yml
git commit -m "ci: remove Vercel from default ATLAS production gate"
```

### Task 5: Align repository documentation and perform cutover verification

**Files:**
- Modify: `README.md`
- Verify: `docs/architecture/ATLAS_MANAGER_SPEC.md`

**Interfaces:**
- Repository-facing documentation must match the approved Supabase-first architecture.

- [ ] **Step 1: Update the README operating rule**

Replace the sentence that lists ATLAS Manager as managing `GitHub, Vercel, Cloudflare, Supabase` with:

```md
ATLAS Manager is the shared infrastructure control plane and deployment brain for the required GitHub → Supabase → Cloudflare → Production path. Vercel and other deployment providers are optional adapters unless an approved release explicitly marks them required.
```

- [ ] **Step 2: Run the complete repository verification suite**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: every command PASS.

- [ ] **Step 3: Verify architecture/source consistency**

```bash
grep -q 'GitHub → Supabase ATLAS Manager → Cloudflare → Production' docs/architecture/ATLAS_MANAGER_SPEC.md
grep -q 'Vercel is no longer a required production stage' docs/architecture/ATLAS_MANAGER_SPEC.md
grep -q 'Vercel and other deployment providers are optional adapters' README.md
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit documentation alignment**

```bash
git add README.md
git commit -m "docs: align repository with Supabase-first ATLAS Manager"
```

- [ ] **Step 5: Compare the feature branch with main before opening the PR**

```bash
git diff --check main...HEAD
git log --oneline main..HEAD
```

Expected: no whitespace errors; commits are limited to the ATLAS Manager architecture/cutover work.

- [ ] **Step 6: Open a pull request**

PR title:

```text
ATLAS Manager: make Supabase the primary control plane
```

PR body must explicitly state:

```md
## What changes
- makes `atlas-core` the ATLAS Manager backend/control-plane authority
- makes Vercel optional by default
- source-controls and updates `atlas-infra-status`
- replaces the Vercel deploy workflow with a truthful build/readiness gate
- preserves Cloudflare deployment as a required, separately verified follow-on stage

## What this PR does not claim
- it does not claim the current frontend has been deployed to Cloudflare
- it does not claim `www.atlasenterprisesuite.com` serves the new build until public verification exists
- it does not promote `atlas-core-v2`
```

## Self-Review

- Spec coverage: required/optional providers, `atlas-core` authority, Vercel reclassification, existing Supabase control-plane reuse, truthful status, no false production claim, and workflow cutover are covered.
- Scope boundary: actual Cloudflare Pages/Workers provisioning and domain cutover are intentionally separated because they are an independent deploy subsystem and require their own provider-resource discovery and verification.
- Placeholder scan: implementation steps contain concrete file paths, commands, interfaces, test expectations, and code for the new readiness contract.
- Type consistency: `ProviderName`, `ProviderSnapshot`, `InfrastructureBlocker`, `InfrastructureEvaluation`, and `evaluateInfrastructure()` use the same names across Tasks 1 and 2.

## Follow-On Plan

After this PR is verified, create the next implementation plan for **ATLAS Cloudflare Frontend Delivery**, covering current Cloudflare zone/project discovery, Workers/Pages selection based on actual account state, Vite artifact deployment, DNS/SSL binding, `/healthz`, `/atlas/infra/status` routing, public route verification, rollback, and production evidence persistence in Supabase.
