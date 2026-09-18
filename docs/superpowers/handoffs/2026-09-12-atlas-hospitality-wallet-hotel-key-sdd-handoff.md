# ATLAS Hospitality Wallet Hotel Key — Sovereign SDD Handoff

Execute the approved ATLAS Hospitality Wallet Hotel Key implementation with Superpowers Subagent-Driven Development under the ATLAS sovereign operating model.

Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Execution branch: `feat/hospitality-wallet-hotel-key`
Control-plane authority: ATLAS Manager on Supabase `atlas-core`
Public edge: Cloudflare

Read first and treat as binding:

1. `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`
2. `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-hotel-key-implementation.md`
3. `docs/architecture/ATLAS_MANAGER_SPEC.md`
4. Then execute the three detailed Hospitality plans in the master plan's mandatory order.

## Sovereign execution model

- Codex performs implementation inside an isolated worktree on `feat/hospitality-wallet-hotel-key`.
- GitHub remains the canonical source repository and audit/collaboration record, but GitHub Actions, hosted runners, self-hosted runners, VPS infrastructure, or Vercel are NOT runtime prerequisites for this work.
- ATLAS Manager/Supabase is the runtime/control-plane authority for backend state, approvals, audit evidence, readiness, migrations, Edge Functions, and production verification.
- Reuse the existing ATLAS Manager substrate instead of creating a parallel control plane: `atlas-infra-status`, `atlas-infra-evidence`, `atlas-runtime-verifier`, `atlas-sovereign-control-plane`, `atlas-platform-controls`, and `atlas-repair-bridge`.
- Cloudflare remains the primary frontend/public-edge layer.
- Production state, source-control state, test state, backend state, provider readiness, edge state, and public production verification are separate facts. Never collapse them into one `ready` state.
- Optional providers such as Vercel must not become blockers unless explicitly selected for a release.

## Execution protocol

- Use an isolated git worktree for `feat/hospitality-wallet-hotel-key`.
- Before touching implementation code, fetch current `origin/main` and reconcile any newer commits into the feature branch without force-reset or force-push; preserve all approved Wallet Hotel Key documents and all newer `main` changes.
- Run baseline repository verification before Task 1. If baseline tests fail for an unrelated pre-existing reason, record exact evidence in the SDD ledger and investigate before attributing failure to this feature.
- Use Superpowers Subagent-Driven Development with a fresh implementer per task, TDD, task-scoped spec review, task-scoped code-quality/security review, fix/re-review loops, and a final whole-branch review.
- Maintain the plan-specific `.superpowers/sdd/.../progress.md` ledger so execution can resume safely after compaction or interruption.
- Execute all 18 tasks automatically in the exact Milestone A → B → C order. Do not stop for routine confirmations.
- The approved design spec is the binding authority when plan text or implementation details conflict.
- External PMS/access/wallet contracts that are not officially documented and authorized remain fail-closed; never invent undocumented endpoints, signatures, payloads, cryptographic material, or wallet behavior.
- Never expose or persist raw hotel lock credentials, NFC/RFID data, master keys, provider tokens, wallet private keys, decrypted provision tokens, authorization blobs, or equivalent secret material in browser state, logs, Git, or business tables.
- Remote door unlock remains out of scope.
- Never report a PMS, access provider, Wallet platform, property, or room mapping as `ready` based only on configuration presence.
- A mock/sandbox result may prove implementation correctness but must not be labeled production-ready.

## External side-effect gates

Do not perform any of the following without explicit human approval:

- merge to `main`;
- production DDL or migration application;
- production Supabase Edge Function deployment;
- production Cloudflare deployment or routing changes;
- provider onboarding that incurs cost;
- spend provider credits;
- enable a real hotel/property Wallet-key automation policy;
- issue a real guest credential against a live property;
- rotate or create production secrets unless the approved task specifically requires it and the human approves the security-sensitive action.

Repository commits on the isolated feature branch are permitted as part of SDD execution. Do not force-push.

## Final branch gate before requesting merge/deploy approval

Run on the exact final feature-branch SHA:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Also run every focused Hospitality Wallet/PMS test named by the three detailed plans.

Then verify the sovereign control-plane integration boundaries non-destructively:

- ATLAS Manager components referenced by the implementation exist and are reused rather than duplicated;
- Supabase project authority remains `atlas-core`;
- no production migration/function/deployment was applied without approval;
- no GitHub Actions/VPS/Vercel dependency was introduced as a mandatory runtime gate;
- Cloudflare remains an external deployment gate until explicit production approval.

## Completion report

The final report must include:

- final feature-branch SHA;
- all 18 task statuses and task commits;
- SDD ledger summary;
- exact verification commands and results;
- per-task review outcomes and final whole-branch review;
- every reviewer/controller ruling;
- unresolved PMS/access-provider/Wallet prerequisites;
- security/readiness evidence;
- any production actions intentionally NOT performed;
- explicit separation between `implementation_verified`, `external_gates_pending`, and `production_ready`.

Do not mark the feature `production_ready` until an authorized hotel property has passed the controlled end-to-end validation required by the approved design.