# ATLAS Universal Execution Engine — Subagent-Driven Development Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Feature branch: `feat/universal-execution-engine`
Execution mode: Superpowers Subagent-Driven Development

## Binding sources

Read these before implementation:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-09-12-atlas-universal-execution-engine-design.md`
3. `docs/superpowers/plans/2026-09-12-atlas-universal-execution-foundation.md`
4. `docs/superpowers/plans/2026-09-12-atlas-universal-execution-foundation-review.md`

The design specification is the product authority. The implementation plan is the task contract. The review companion is binding where it tightens runtime-neutral UUID generation, execution-layer permissions, domain-permission fail-closed behavior, and approval version/digest binding.

## Execution instruction

Execute `docs/superpowers/plans/2026-09-12-atlas-universal-execution-foundation.md` using Superpowers Subagent-Driven Development.

Use an isolated worktree. Before implementation, fetch/update `main` and reconcile the feature branch without force-resetting or force-pushing away the approved design/plan commits. Preserve all approved commits already on `feat/universal-execution-engine`.

Run the full SDD lifecycle:

`worktree -> dependency setup -> clean baseline -> SDD workspace/ledger -> pre-flight scan -> Task 1 -> failing test -> minimal implementation -> focused tests -> commit -> independent task review (spec + code quality) -> fixes/re-review if required -> next task -> final whole-branch review -> full verification`

Continue automatically through all 9 tasks. Do not stop between tasks for routine approval. Record rulings in the SDD ledger when the spec/plan requires judgment.

## Non-negotiable constraints

- Do not merge to `main`.
- Do not deploy to production.
- Do not push or publish outside the feature branch without explicit authorization if the environment treats that as an external side effect.
- Do not spend paid provider credits.
- Do not add or expose secrets.
- Do not fabricate execution, approval, evidence, provider, user, employee, financial, health, or production state.
- Preserve organization/tenant isolation and existing ATLAS identity/RBAC patterns.
- RLS is the persistence isolation boundary; server-side authorization is the mutation boundary; owning-module adapters remain the domain authorization boundary.
- `execution.admin` is not equivalent to arbitrary domain permissions such as `payroll.write`, `accounting.post`, or `health.*`.
- A domain-specific approval must fail closed with `domain_permission_resolver_required` until a real owning-module authorization adapter verifies it.
- Approval decisions must be bound to the exact stored payload version and digest; stale approval cannot authorize a changed action.
- `packages/execution` must remain runtime-neutral: use Web Crypto (`crypto.randomUUID()`), not `node:crypto`, in shared package code.
- A task may become `completed` only when completion criteria, dependencies, approvals, evidence, and verification all pass.

## Verification gate

Before reporting implementation complete, run at repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Also verify:

- all task-level tests from the plan pass;
- Supabase schema contract and tenant/RLS tests pass;
- Edge Function authentication/authorization contracts pass;
- cross-module lineage is preserved without shadow business records;
- approval version/digest mismatch fails closed;
- no sensitive values appear in execution payloads, evidence, or audit events;
- no unrelated regression was introduced.

Do not claim production readiness from local tests alone. Production deploy and production verification are separate approval-gated steps.

## Final report contract

When all 9 tasks and final review are complete, report:

- task-by-task status and commits;
- tests run and exact outcomes;
- final typecheck/test/build results;
- any deferred Minor findings;
- every SDD ledger `Ruling:` entry with the cost if wrong;
- remaining external/production dependencies;
- exact feature-branch HEAD;
- whether the branch is ready for a PR/review.

Stop before merge/deploy and wait for explicit approval.