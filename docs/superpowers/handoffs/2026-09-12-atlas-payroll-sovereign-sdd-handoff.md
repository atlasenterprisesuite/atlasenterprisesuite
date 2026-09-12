# ATLAS Payroll — Sovereign SDD Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Payroll branch: `feat/atlas-payroll-core-commercial`
Execution mode: `ATLAS Sovereign AI + Superpowers Subagent-Driven Development`

## Binding artifacts

- Payroll spec: `docs/superpowers/specs/2026-09-12-atlas-payroll-core-commercial-design.md`
- Payroll implementation plan: `docs/superpowers/plans/2026-09-12-atlas-payroll-core-commercial.md`
- Tracking issue: `#86`

## Sovereign execution contract

ATLAS Payroll is to be executed through the governed ATLAS Sovereign AI collaboration model rather than as an ungoverned single-agent run.

Required initial federation:

1. **ChatGPT / OpenAI — Architect + Orchestrator**
   - owns task decomposition, task-state coordination, evidence correlation, rulings, and human-facing control;
   - does not self-approve production release.

2. **Codex — Engineer + QA**
   - owns repository implementation, isolated worktree execution, TDD, focused tests, commits, fixes, and PR preparation;
   - has no direct production deployment authority.

3. **Gemini — Independent Reviewer + Research**
   - produces independent review/findings through the existing governed intelligence-provider path when configured and verified;
   - has no production deployment authority.

GitHub Copilot remains optional and is not a required dependency for this execution.

## Superpowers execution sequence

Use `superpowers:subagent-driven-development` for the Payroll implementation plan.

Required sequence:

`isolated worktree -> baseline -> SDD ledger -> pre-flight scan -> Task 1 -> RED test -> minimal implementation -> GREEN test -> commit -> independent spec review -> independent code-quality review -> fix/re-review loop -> next task -> final whole-branch review`

Execute all 10 Payroll tasks continuously unless a Superpowers stop condition is reached.

## Sovereign task-state mapping

The sovereign controller should represent the Payroll execution with governed state transitions rather than informal status text. Suggested mapping:

`draft -> queued -> planning -> implementation -> review -> qa -> ci -> awaiting_human_approval`

Do not transition to `approved`, `deploying`, `verified`, or `completed` as a production-release claim without the required human approval and actual evidence.

## Governance constraints

- No merge without explicit user approval.
- No deploy without explicit user approval.
- Do not spend or purchase provider credits without explicit user approval.
- Never expose or commit credentials, tokens, recovery codes, passwords, private keys, or provider secrets.
- Preserve tenant/organization isolation, RBAC, audit, and Supabase RLS.
- Preserve `internal_comp` as server-authorized, tenant-scoped, auditable, and $0 ATLAS software fee only for the ATLAS internal owner organization.
- External customer organizations remain billable; do not invent public prices.
- Do not fabricate `connected`, `verified`, `filed`, `paid`, `compliant`, direct-deposit, banking, tax-remittance, insurance, or provider states.
- External-provider costs remain external even when the ATLAS software fee is $0 for the internal organization.

## Sovereign runtime readiness gate

The current canonical repository must be inspected before execution. The Sovereign Orchestrator design currently exists on branch `atlas/sovereign-ai-orchestrator-design` with:

- `docs/superpowers/specs/2026-09-05-atlas-sovereign-ai-orchestrator-design.md`
- `docs/superpowers/plans/2026-09-06-atlas-sovereign-ai-orchestrator.md`

Do **not** claim the Sovereign runtime is active merely because those design/plan files exist.

Before using the runtime as an execution authority, verify that its required implementation is present in the working base, including the governed task protocol, governance, persistence, agent registry, orchestrator runtime, and required evidence gates.

If that runtime is not implemented and verified, set execution state to:

`blocked: sovereign_runtime_unavailable`

Then complete/reconcile the approved Sovereign Orchestrator implementation before resuming Payroll. Do not silently fall back to an ungoverned executor and label it Sovereign.

## Existing sovereign references

- Sovereign design branch: `atlas/sovereign-ai-orchestrator-design`
- Sovereign task bootstrap: Issue `#25`
- Approved initial federation: Issue `#71` (`ChatGPT + Gemini + Codex`; Copilot optional)

## Completion evidence

After all 10 Payroll tasks and final review, report:

- every task commit;
- focused RED/GREEN test evidence;
- full `npm run typecheck`, `npm test`, and `npm run build` results;
- final whole-branch review findings;
- all SDD ledger `Ruling:` entries;
- sovereign task-state history;
- any provider/runtime component that remained `not_configured`, `blocked`, or unverified.

Do not merge or deploy as part of this handoff.