# ATLAS Unified Intelligence — Subagent-Driven Development Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Feature branch: `feat/unified-atlas-intelligence`
Execution mode: Superpowers Subagent-Driven Development

## Binding sources

Read these before implementation:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-09-12-atlas-unified-intelligence-chatgpt-codex-design.md`
3. `docs/superpowers/plans/2026-09-12-atlas-unified-intelligence-chatgpt-codex.md`
4. `docs/superpowers/plans/2026-09-12-atlas-unified-intelligence-chatgpt-codex-review.md`

The design specification is product authority. The implementation plan is the task contract. The binding review notes override ambiguous plan wording where they tighten App Server protocol verification, ChatGPT-only auth mode, no-spend behavior, approval denial, and engineering provenance.

## Execution instruction

Execute `docs/superpowers/plans/2026-09-12-atlas-unified-intelligence-chatgpt-codex.md` using Superpowers Subagent-Driven Development.

Use an isolated worktree. Before implementation, fetch/update `main` and reconcile the feature branch without force-reset or force-push. Preserve all approved commits already on `feat/unified-atlas-intelligence`.

Run the complete SDD lifecycle:

`worktree -> dependency setup -> clean baseline -> SDD workspace/ledger -> pre-flight scan -> Task 1 -> failing test -> minimal implementation -> focused tests -> commit -> independent task review (spec compliance + code quality) -> fixes/re-review when required -> next task -> final whole-branch review -> full verification`

Continue automatically through all 9 tasks. Do not pause between routine tasks for human confirmation. Record any rulings in the SDD ledger.

## Non-negotiable architecture

ATLAS exposes one user-facing intelligence identity: **ATLAS Assistant**.

- Conversational/reasoning work continues through the existing `atlas-copilot` / OpenAI Responses path.
- Repository-aware engineering work routes through a governed Codex App Server bridge.
- Do not add a ChatGPT/Codex selector to normal user flows.
- Do not create a second assistant, second conversation store, second RBAC system, or competing orchestration service.
- Preserve one conversation lineage across reasoning and engineering execution.
- Universal Execution Engine integration is a follow-on boundary; do not reimplement its state machine inside Intelligence.

## Codex runtime requirements

- Codex App Server is the canonical engineering runtime boundary.
- Verify the installed runtime protocol using the pinned runtime's generated v2 schema (`codex app-server generate-ts` or equivalent matching generated schema) before coupling ATLAS to fields.
- Required protocol surface includes `initialize`, `initialized`, `account/read`, `thread/start`, `turn/start`, `turn/completed`, `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, and `item/permissions/requestApproval`.
- Record the exact Codex CLI/App Server version tested in the task report.
- Shared ATLAS contracts must not depend on undocumented runtime fields.

## No-spend rule

This work must not spend provider/API credits.

After Codex App Server initialization, call `account/read` and accept engineering execution only when the runtime reports ChatGPT authentication (`account.type = chatgpt`).

If auth mode is API key, Bedrock, headers, agent identity, or any other potentially billable/non-ChatGPT mode:

- readiness is not verified;
- return blocker `cost_approval_required`;
- do not execute the engineering task;
- do not initiate API-key login;
- do not create or persist new OpenAI credentials.

## Permissions and approval policy

- `intelligence.use` is not enough to execute or publish code.
- Keep distinct permissions for code read, execution, review, repository write, and repository publish.
- Tenant mismatch fails closed before engineering dispatch.
- First-slice automated turns use non-escalating Codex policy: `approvalPolicy: "never"`.
- Read-only operations use `sandbox: "read-only"`.
- Authorized local/worktree modifications use `sandbox: "workspace-write"`.
- Never use `danger-full-access` in this implementation.

The bridge must never auto-approve Codex escalation.

For:
- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`

respond with the same request id and `{"result":{"decision":"decline"}}`.

For `item/permissions/requestApproval`, fail closed with JSON-RPC-lite error code `-32001`, message `approval_denied_by_atlas_policy`, and mark the ATLAS engineering result blocked with `approval_required`.

Unknown server-initiated methods receive `-32601 method_not_supported`.

Push, merge, deploy/publish, and billable activity remain explicit human-approval gates.

## Security

- Keep OpenAI/Codex/GitHub/Supabase/provider credentials server-side.
- Never place secrets, tokens, environment variables, auth URLs, user codes, or account identifiers in task payloads, conversation history, provenance, audit output, or user-visible errors.
- Do not expose hidden chain-of-thought.
- Do not let Codex repository access bypass ATLAS RBAC.
- Do not let conversational intelligence bypass engineering controls by performing equivalent external writes directly.

## Provenance contract

Task 8 creates `supabase/functions/atlas-copilot/engineering-provenance.mjs` with `buildEngineeringProvenance(result)`.

Permitted provenance families only:

- `{ kind: 'engineering_task', task_id, runtime }`
- `{ kind: 'repository', repository, branch, base_sha, head_sha }`
- `{ kind: 'file_change', path }`
- `{ kind: 'command', command, exit_code }`
- `{ kind: 'test', command, passed }`
- `{ kind: 'blocker', code }`

Do not persist raw prompts, raw stdout/stderr, environment variables, authorization material, secrets, or hidden reasoning.

## Truthful execution requirements

ATLAS must not claim code was changed, tested, reviewed, committed, pushed, merged, or deployed unless structured evidence supports the claim.

A Codex result may be `planned`, `running`, `blocked`, `awaiting_approval`, `failed`, or `completed`.

`completed` requires the requested validation gates to have actually passed.

When the Codex runtime is unavailable or unverified, return a real blocker such as `code_runtime_not_configured`, `code_runtime_unverified`, or `cost_approval_required`. Never simulate a running engineering agent.

## Task-review requirements

After every task:

1. generate the SDD review package from the exact task base/head range;
2. dispatch an independent reviewer;
3. require both spec-compliance and code-quality verdicts;
4. route Critical/Important findings through the SDD fix loop;
5. record Minor findings and rulings in the plan ledger;
6. do not start the next task with unresolved load-bearing findings.

After Task 9, perform the required broad whole-branch review on the most capable available reviewer model.

## Verification gate

Before reporting the branch complete, run at repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Also verify:

- existing conversational ATLAS requests still pass without regression;
- engineering requests route through the same Intelligence Gateway;
- one conversation can span reasoning -> Codex task -> engineering result -> assistant response;
- bridge readiness does not expose private account data;
- only ChatGPT-authenticated Codex runtime passes the no-spend gate;
- unavailable/non-ChatGPT runtime fails closed;
- repository tenant/permission controls hold;
- server-initiated Codex approval requests are never auto-approved;
- test/build/review evidence is truthful and structured;
- engineering provenance stays within the bounded allowed families;
- no secrets or raw sensitive execution data are persisted;
- no unrelated regression was introduced.

Do not claim production readiness from local tests alone.

## Final report contract

When all 9 tasks and the final whole-branch review are complete, report:

- each task status and commits;
- exact Codex CLI/App Server version tested;
- focused tests and outcomes per task;
- final `npm run typecheck`, `npm test`, and `npm run build` outcomes;
- final whole-branch review verdict;
- deferred Minor findings;
- every ledger `Ruling:` entry and the cost if wrong;
- blockers/external setup still required;
- exact feature-branch HEAD;
- whether the branch is ready for PR/review.

## Stop conditions

Do not merge to `main`.
Do not deploy or publish.
Do not push to a shared/protected branch unless explicitly authorized.
Do not spend paid provider/API credits.
Do not provision paid infrastructure.

Stop at the feature branch with verified evidence and wait for explicit approval for any merge, deploy, publish, shared push, or paid-provider action.