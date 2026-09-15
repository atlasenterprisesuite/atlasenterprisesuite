# ATLAS Unified Intelligence — Binding Plan Self-Review Notes

This file is a binding companion to `docs/superpowers/plans/2026-09-12-atlas-unified-intelligence-chatgpt-codex.md`. It resolves ambiguities found during the required writing-plans self-review. The design specification remains the product authority.

## 1. Codex App Server account mode and no-spend policy

The bridge must verify the Codex runtime account after `initialize` by calling the current v2 `account/read` method before accepting engineering tasks.

The first implementation accepts only an account response whose `account.type` is `chatgpt`. If `account.type` is `apiKey`, `amazonBedrock`, `headers`, `agentIdentity`, or any other non-ChatGPT billing/auth mode, bridge readiness must be `configured_unverified` with blocker `cost_approval_required` and `/v1/tasks` must fail closed. This enforces the user's instruction not to spend provider/API credits during this work.

The bridge must never initiate API-key login or persist OpenAI credentials. Interactive ChatGPT/device login is an administrator/runtime setup step outside this implementation plan.

The bridge `/healthz` response may expose only:

```json
{
  "ok": true,
  "service": "atlas-codex-bridge",
  "runtime": "codex-app-server",
  "configured": true,
  "verified": true,
  "auth_mode": "chatgpt"
}
```

It must not expose email, tokens, auth URLs, user codes, or account identifiers.

## 2. Exact fail-closed behavior for server-initiated approvals

The bridge must never auto-approve Codex escalation requests.

For these two current App Server requests:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`

respond with:

```json
{"id":"<same request id>","result":{"decision":"decline"}}
```

For `item/permissions/requestApproval`, do not guess a grant/result schema. Respond with a JSON-RPC-lite error and terminate the ATLAS engineering task as blocked:

```json
{"id":"<same request id>","error":{"code":-32001,"message":"approval_denied_by_atlas_policy"}}
```

The resulting ATLAS/Codex task state is `blocked` with blocker `approval_required`. This is intentionally conservative and satisfies the requirement that the bridge cannot grant new permissions on its own.

Any other unknown server-initiated request receives:

```json
{"id":"<same request id>","error":{"code":-32601,"message":"method_not_supported"}}
```

and the task must not be marked `completed` if that request was required for the turn to proceed.

## 3. App Server protocol source of truth

Implementation consumes the current v2 App Server surface. Before Task 3 is committed, the implementer must run the installed runtime's:

```bash
codex app-server generate-ts
```

or inspect the matching generated v2 schema from the pinned Codex runtime and confirm the fields consumed by ATLAS for:

- `initialize` / `initialized`;
- `account/read`;
- `thread/start`;
- `turn/start`;
- `turn/completed`;
- `item/commandExecution/requestApproval`;
- `item/fileChange/requestApproval`;
- `item/permissions/requestApproval`.

The task report records the Codex CLI/App Server version tested. Do not couple ATLAS to undocumented fields not present in that generated schema.

## 4. Provenance has one owner

Task 8 must create:

`supabase/functions/atlas-copilot/engineering-provenance.mjs`

with a pure export:

```js
export function buildEngineeringProvenance(result) { /* bounded mapping */ }
```

`intelligence-gateway.mjs` imports this helper. `atlas-intelligence-store.mjs` remains unchanged because its existing `appendMessage(... provenance=[])` contract already persists arbitrary bounded provenance arrays.

The helper may emit only these provenance object families:

```js
{ kind: 'engineering_task', task_id, runtime }
{ kind: 'repository', repository, branch, base_sha, head_sha }
{ kind: 'file_change', path }
{ kind: 'command', command, exit_code }
{ kind: 'test', command, passed }
{ kind: 'blocker', code }
```

Do not persist raw prompts, raw stdout/stderr, environment variables, authorization data, hidden reasoning, or secrets.

## 5. Scope decomposition ruling

The approved design spans several concerns, but this plan intentionally implements one independently testable first slice: unified capability routing + a local/server-side Codex App Server bridge + same-conversation provenance. Universal Execution Engine persistence, production hosting, broad module adoption, remote push/merge/deploy automation, and billing-aware provider orchestration remain separate follow-on work.

## 6. Self-review result

- Spec coverage: Tasks 1-9 cover capability routing, one identity, Codex task/result contracts, App Server integration, authorization, truthful readiness, same-conversation continuity, provenance, UI semantics, and verification.
- Placeholder scan: no `TBD`/`TODO` implementation gaps are permitted. The runtime-generated schema check in Task 3 is a compatibility verification step, not an invitation to invent wire shapes.
- Type consistency: `CodexTask`, `CodexResult`, engineering capability names, execution modes, and permission names defined in Tasks 1-2 are authoritative for later tasks.
- Security consistency: bridge authentication is server-to-server; App Server escalation is always denied; ATLAS authorizes the task before dispatch; non-ChatGPT Codex auth modes fail closed under the current no-spend instruction.
