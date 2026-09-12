# ATLAS Guided Execution — Subagent-Driven Development Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Feature branch: `feat/atlas-guided-execution`
Execution mode: Superpowers Subagent-Driven Development

## Binding sources

Read these before implementation, in order:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-09-12-atlas-guided-execution-design.md`
3. `docs/superpowers/plans/2026-09-12-atlas-guided-execution-core-web.md`
4. `docs/superpowers/plans/2026-09-12-atlas-guided-execution-manager-pilot.md`
5. `docs/superpowers/plans/2026-09-12-atlas-guided-execution-assistant.md`
6. The reconciled Universal Execution Foundation contracts under `packages/execution`, `supabase/migrations/20260912_universal_execution_engine.sql`, and `supabase/functions/atlas-execution/index.ts`.

The design specification is product authority. The three plans are implementation contracts for their respective slices.

## Current dependency state

At handoff creation, `feat/atlas-guided-execution` descends from Universal Execution Foundation commit:

`4bb9841ffac142676039cee5af104c266d9882a9`

Before implementation, fetch/recheck `feat/universal-execution-engine`. If it has advanced, reconcile those new approved foundation commits into `feat/atlas-guided-execution` without force-resetting or discarding Guided Execution commits.

## Execution sequence

Execute sequentially:

1. Core Web plan — 8 tasks.
2. ATLAS Manager read-only readiness pilot — 6 tasks.
3. ATLAS Assistant integration — 4 tasks.
4. Final whole-branch review and full verification.

Do not start Manager Pilot before Core Web review passes. Do not start Assistant before Core Web review passes. Sequential Manager -> Assistant is preferred to minimize shared web-file conflicts.

## SDD lifecycle

Use an isolated worktree and run:

`worktree -> dependency setup -> clean baseline -> SDD ledger -> pre-flight -> failing test -> minimal implementation -> focused tests -> commit -> independent spec review -> independent code-quality review -> fix/re-review if required -> next task -> final whole-branch review -> full verification`

Continue automatically through routine task boundaries once execution is authorized. Record any design judgment in the SDD ledger as `Ruling:` with the cost if wrong.

## Binding self-review clarifications

- `parseExecutionResponse` in Core Web `apps/web/src/execution/api.ts` must be exported because the Manager Pilot reuses it. Do not duplicate the response parser.
- Core Web creates `requestExecutionApproval` and `decideExecutionApproval` in Task 5, not Task 1. Task 1 creates the normalized read model, parser, fixtures, and `loadGuidedExecutionState`.
- Approval request payloads do not contain client-supplied `payload_version` or `payload_digest`; the current execution server computes and validates approval binding.
- Manager Pilot consumes `atlas-infra-status.provider_status.<provider>.state`, not a hypothetical `providers.*.status` shape.
- Manager Pilot must not mark a task completed until Task 4 evidence persistence exists and `evaluateTaskCompletion` passes. Task 3 leaves all-ready/no-evidence state as `now`.
- Manager Pilot uses distinct evidence kinds: `infra_verification.github`, `.supabase`, `.cloudflare`, `.production`.
- A blocked Manager task recovers through `blocked -> now`, then may complete through `now -> completed`; never write or audit `blocked -> completed`.
- `get_audit` is read-only and requires `execution.audit`; audit authorization failure must not prevent an otherwise authorized user from reading their workflow.

## Non-negotiable constraints

- Do not merge to `main`.
- Do not deploy to production.
- Do not spend paid provider credits.
- Do not launch, terminate, configure, or mutate AWS EC2 resources.
- Do not mutate Cloudflare, GitHub, Vercel, Supabase infrastructure, DNS, deployments, provider secrets, or production resources as part of the readiness pilot.
- Do not expose or commit secrets, provider credentials, authorization headers, recovery codes, private keys, or raw sensitive action payloads.
- Do not fabricate workflow, provider, approval, evidence, audit, completion, or production state.
- Preserve organization/tenant isolation, server-side execution permission checks, owning-module authorization, Approval Center binding, Evidence requirements, and immutable audit semantics.
- No browser-only state may become the source of truth for execution progress.
- `continue`/`resume` in Assistant is navigation/context resolution only in this slice; conversation is not authorization and does not directly execute providers.

## Verification gate

At the end of each plan run its focused tests. Before final review run from repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Also verify:

- `/execution/:workflowId` is identity-protected and canonical-state-backed;
- raw `action_payload` does not cross the normalized UI boundary;
- task groups, steps, breadcrumbs, blockers, approvals, evidence and audit behave as specified;
- audit visibility is permission-gated without breaking normal workflow reads;
- refresh/resume reloads backend state rather than local progress;
- stale approval binding fails closed;
- Manager readiness uses the real existing `atlas-infra-status` read-only path;
- optional Vercel does not block required-path readiness;
- blocked required providers never appear completed;
- provider-specific evidence gates completion;
- Manager recovery follows legal execution state transitions;
- Assistant reads the exact same Guided Execution state;
- AWS unavailable-adapter state remains truthful and non-executable;
- desktop/tablet/mobile, keyboard, focus, ARIA and reduced-motion checks pass;
- adjacent existing ATLAS routes remain intact;
- no paid/destructive/provider mutation occurred.

Do not claim production readiness from branch-local verification. Production deploy and public production verification remain separate approval-gated work.

## Final report contract

After all 18 tasks and final whole-branch review are complete, report:

- task-by-task status and commit SHA;
- independent review outcome after each task;
- focused test commands/outcomes;
- final `typecheck`, `test`, and `build` outcomes;
- all `Ruling:` ledger entries and cost if wrong;
- any deferred Minor findings;
- exact branch HEAD;
- whether the branch is ready for PR/review;
- remaining external/production dependencies.

Stop before merge/deploy and wait for explicit approval.
