# ATLAS Work Soberano — Subagent-Driven Development Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-work-sovereign`
Status: Design approved by user; implementation plans complete; implementation not started by this handoff.

## Authority order

1. `docs/superpowers/specs/2026-09-12-atlas-work-sovereign-design.md` — binding product/architecture specification.
2. `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-core-web.md` — Core Web implementation contract.
3. `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-router-policy.md` — routing/policy implementation contract.
4. `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-runtime-connections-browser.md` — runtime/connections/browser implementation contract.
5. `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-openai-domain-pilot.md` — first end-to-end pilot and enterprise-hardening contract.
6. Existing Universal Execution Engine, Guided Execution, ATLAS Manager, ATLAS Assistant and Sovereign AI Orchestrator contracts after reconciliation.

The specification is product authority. The four plans are implementation contracts for their slices. If an implementation plan appears to conflict with the approved spec, stop the affected task, preserve completed independent work, and resolve in favor of the spec.

## Required Superpowers workflow

Use `superpowers:subagent-driven-development`.

Before implementation, use `superpowers:using-git-worktrees` to create an isolated worktree for `feat/atlas-work-sovereign`.

For every implementation task:

`failing test -> minimal implementation -> focused tests -> commit -> independent spec review -> independent quality review -> corrections/re-review if required -> next task`

Do not batch multiple plan tasks into one review gate.

## Pre-flight reconciliation

The Work branch was created from `main` for the approved design. Before Task 1, reconcile the two approved execution foundations without discarding history:

```bash
git fetch origin main feat/universal-execution-engine feat/atlas-guided-execution
git status --short
git merge --no-ff origin/feat/universal-execution-engine
git merge --no-ff origin/feat/atlas-guided-execution
```

Rules:

- no force-reset;
- no force-push;
- preserve approved commits from both dependency branches;
- resolve conflicts by retaining the strongest current canonical implementation and the approved Work spec;
- do not recreate execution-engine or Guided Execution files if the reconciled branches already provide them.

Then run baseline:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Do not begin Work Task 1 until baseline is understood. If a dependency branch is already fully present because it was merged upstream, record that evidence and do not merge it a second time.

## Execution sequence — 28 tasks

### Slice 1 — Core Web — 7 tasks

Execute `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-core-web.md` Tasks 1 through 7 in order.

Exit gate:

- `/work` is a real first-level ATLAS surface;
- natural-language goal preview does not claim execution;
- canonical Work workflow can be created/listed for the active organization;
- `/execution/:workflowId` remains the detailed execution surface;
- no second workflow state machine/persistence exists;
- focused tests + typecheck + full test + build pass.

### Slice 2 — Router + Policy — 6 tasks

Execute `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-router-policy.md` Tasks 1 through 6.

Exit gate:

- API, Browser and Hybrid use one deterministic router;
- Manual, Guided and Autonomous are policies, not separate engines;
- `$0` paid-provider default is enforced;
- browser envelope is fail-closed;
- UI cannot self-authorize;
- focused tests + full verification pass.

### Slice 3 — Runtimes + Connections + Browser — 7 tasks

Execute `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-runtime-connections-browser.md` Tasks 1 through 7.

Exit gate:

- Local, Self-Hosted and Cloud Ephemeral share one runtime broker;
- OAuth/session/vault are represented by secret-free opaque connection refs;
- runtime enrollment returns a token only once and stores a SHA-256 hash;
- runtime-token operations use the separate runtime authentication path, not Supabase end-user authentication;
- runtime jobs are leased, scoped and resumable;
- no paid cloud browser is provisioned;
- focused tests + full verification pass.

### Slice 4 — OpenAI Domain Pilot + Enterprise Hardening — 8 tasks

Execute `docs/superpowers/plans/2026-09-12-atlas-work-sovereign-openai-domain-pilot.md` Tasks 1 through 8.

Exit gate:

- `manager.openai_domain_verification` template exists;
- active OpenAI verification value is observed at runtime, never hard-coded from chat/screenshots;
- Guided DNS mutation is bound to the exact approved payload;
- mutation may use authorized DNS API or constrained browser fallback;
- interrupted mutation reconciles provider/public DNS state before retry;
- public DNS exact match and OpenAI `verified` are required for completion;
- non-secret evidence and audit are persisted;
- cross-tenant access fails closed;
- focused tests + full verification pass.

## Live production boundary

This handoff authorizes implementation and automated testing only. It does **not** authorize a production deploy, merge to `main`, provider spending, or an unreviewed live DNS mutation.

The production-oriented pilot is `Verify atlasenterprisesuite.com with OpenAI`, but live execution must occur only after all of these are true:

1. the implementation branch has passed final verification and review;
2. an authorized OpenAI browser session is available;
3. the authoritative DNS provider has been resolved with real evidence;
4. an authorized DNS API connection or healthy authorized browser runtime exists;
5. the exact TXT mutation has been generated from the current OpenAI requirement;
6. Approval Center has approved that exact current payload/digest if policy requires it;
7. paid-provider cost is `$0` or separately authorized.

MFA, CAPTCHA, reauthentication, changed consent/legal terms, missing credentials or new provider authorization must hand control to an authorized human. After resolution, resume from canonical state rather than restarting.

## Final branch review

After Task 28:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Then perform one final independent branch review against all 15 acceptance criteria in the spec. Verify at minimum:

- no parallel workflow/approval/audit/tenant persistence;
- no leaked secrets in source, tests, logs, UI, evidence or runtime-job results;
- cross-org queries fail closed;
- stale/revoked runtimes cannot receive mutation work;
- Autonomous cannot bypass hard policy;
- approval payload binding survives no payload drift;
- retry/recovery does not duplicate uncertain mutations;
- browser actions cannot escape the execution envelope;
- no fake `verified`, `connected`, `online`, `live` or `completed` state;
- desktop/tablet/mobile Work surfaces remain usable.

Fix every blocking review finding and rerun final verification.

## Completion boundary

Do not merge to `main`.
Do not deploy production.
Do not spend provider credits.
Do not mutate live DNS from CI.
Do not claim the OpenAI domain pilot is complete unless a separately authorized live run has observed OpenAI state `verified` and persisted the required evidence.
