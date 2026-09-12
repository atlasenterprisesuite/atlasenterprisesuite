# ATLAS Hospitality Wallet Hotel Key — SDD Handoff

Execute the approved ATLAS Hospitality Wallet Hotel Key implementation with Superpowers Subagent-Driven Development.

Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Execution branch: `feat/hospitality-wallet-hotel-key`

Read first and treat as binding:

1. `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`
2. `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-hotel-key-implementation.md`
3. Then execute the three detailed plans in the master plan's mandatory order.

Execution protocol:

- Use an isolated git worktree for `feat/hospitality-wallet-hotel-key`.
- Before touching implementation code, `git fetch origin main` and reconcile any newer `origin/main` commits into the feature branch without force-reset or force-push; preserve all approved Wallet Hotel Key documents and all newer main changes.
- Run the baseline repository verification before Task 1. If baseline code tests fail for an unrelated pre-existing reason, record exact evidence in the SDD ledger and investigate before attributing failure to this feature.
- Use Superpowers Subagent-Driven Development with a fresh implementer per task, TDD, task-scoped spec review, task-scoped code-quality/security review, fix/re-review loops, and final whole-branch review.
- Maintain the plan-specific `.superpowers/sdd/.../progress.md` ledger so execution can resume safely after compaction or interruption.
- Execute all 18 tasks automatically in the exact Milestone A → B → C order. Do not stop for routine confirmations.
- The spec is the binding authority when plan text or implementation details conflict.
- External PMS/access/wallet contracts that are not officially documented and authorized remain fail-closed; never invent undocumented endpoints, signatures, payloads, cryptographic material, or wallet behavior.
- Never expose or persist raw hotel lock credentials, NFC/RFID data, master keys, provider tokens, wallet private keys, decrypted provision tokens, or authorization blobs in browser state, logs, Git, or business tables.
- Remote door unlock remains out of scope.
- Do not merge to `main`, deploy production DDL/Edge Functions/web, publish externally, spend provider credits, or enable a real property/provider Wallet combination without explicit human approval.
- A mock/sandbox result may prove implementation correctness but must not be labeled production-ready.

Final branch gate before asking for merge/deploy approval:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Also run every focused Hospitality Wallet/PMS test named by the three detailed plans on the exact final SHA.

Completion report must include: final SHA, task/commit ledger, verification commands and results, all reviewer rulings, unresolved external provider prerequisites, security/readiness evidence, and explicit separation of implementation-verified vs production-ready states.
