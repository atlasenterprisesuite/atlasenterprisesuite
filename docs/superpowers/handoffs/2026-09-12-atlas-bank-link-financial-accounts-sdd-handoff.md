# ATLAS Bank Link + Financial Accounts — SDD Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target feature branch: `feat/atlas-bank-link-financial-accounts`
Execution mode: Superpowers Subagent-Driven Development

## Binding documents

Read and obey, in this order:

1. `docs/superpowers/specs/2026-09-12-atlas-bank-link-financial-accounts-design.md`
2. `docs/superpowers/plans/2026-09-12-atlas-bank-link-financial-accounts.md`
3. this handoff

The spec is binding when the plan and implementation details conflict.

## Pre-flight branch reconciliation

Before implementation, fetch the current `main` and reconcile the feature branch safely.

Current observed repository state at handoff creation:

- feature branch contains the approved spec and implementation plan
- branch is 230 commits behind current `main`
- branch is 2 commits ahead of the historical merge base

Requirements:

- preserve the approved spec and plan commits/content
- incorporate current `main` before Task 1 implementation
- do not use force-reset or force-push
- resolve conflicts in favor of current canonical architecture unless the approved Bank Link spec explicitly requires otherwise
- work in an isolated git worktree
- record reconciliation evidence in the SDD ledger

## Execute with Superpowers Subagent-Driven Development

Create/verify an isolated worktree and this plan's SDD workspace/ledger. Run the complete pre-flight scan required by the Superpowers SDD skill before Task 1.

Then execute all 10 tasks in the implementation plan continuously.

For every task use this exact lifecycle:

`failing test -> verify failure -> minimal implementation -> focused tests -> commit -> independent spec review -> independent quality review -> corrections/re-review if required -> ledger completion -> next task`

Use a fresh implementer subagent per task unless the SDD skill explicitly permits batching small same-shape work. Do not allow implementers to dispatch their own subagents/reviewers.

## Constraints

- Do not merge to `main`.
- Do not deploy.
- Do not enable Plaid Production.
- Do not spend provider credits or incur provider charges.
- Do not fabricate `Connected`, `Live`, `Verified`, balances, transactions, or account capabilities.
- Keep provider secrets server-side only.
- Preserve tenant/org isolation, backend RBAC, RLS, idempotency, audit evidence, and Accounting boundaries.
- Existing ATLAS Payables, Payroll, Health, Hospitality, Identity, and shell routes must remain green.
- Future virtual banking/BaaS remains architecture-only and disabled until separately approved and regulated-provider prerequisites exist.

## Final verification

After Tasks 1–10 and the broad whole-branch review, run:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Also run the plan-specific focused suites and any migration/schema validation called for by the plan.

Do not claim completion without command evidence.

## Final state

Stop with the branch ready for human review. Do not merge or deploy.

The final report must include:

- task-by-task commits
- test evidence
- spec-review verdicts
- quality-review verdicts
- final whole-branch review
- final verification commands/results
- unresolved blockers, if any
- all SDD ledger rulings
- explicit confirmation that merge/deploy/Plaid Production were not performed
