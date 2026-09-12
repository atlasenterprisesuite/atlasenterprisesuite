# ATLAS Universal Execution Core — SDD Handoff

## Authority

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
- Feature branch: `feat/atlas-universal-execution-core`
- Binding spec: `docs/superpowers/specs/2026-09-12-atlas-universal-execution-core-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-12-atlas-universal-execution-core.md`
- Pull request: `#83`

## Execution method

Use Superpowers Subagent-Driven Development for any remaining implementation or fix work. Work in an isolated worktree derived from the feature branch. Run a fresh implementer per task/fix surface, then independent spec-compliance review and code-quality review. Use TDD for every behavior change. Finish with a whole-branch review.

Do not merge, deploy, publish, file taxes, issue cards, move money, mutate production infrastructure, or spend provider credits without explicit human approval. No model, agent, workflow, provider, or UI may self-grant permission or approval.

## Verification gate

The Core milestone is not complete merely because code exists. Before any completion or production-readiness claim, execute fresh verification and capture the real output of:

```bash
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

The branch includes `.github/workflows/universal-execution-self-hosted-ci.yml` so the existing self-hosted runner can execute those gates without a deploy job. A queued/offline runner is a verification blocker, not a PASS.

## Security and truthfulness invariants

- Organization scope comes from authenticated membership, not an untrusted request body.
- Browser access to universal execution tables is read-only through RLS; server-side mutation policy is authoritative.
- Cross-domain admin permissions do not imply global administration.
- `high` and `regulated` execution require Approval Center policy satisfaction unless a separately validated preauthorization applies.
- Provider capabilities are executable only in the `verified` provider state.
- Provider status must never be upgraded in UI or API copy without registry/probe evidence.
- Workflow `completed` requires its completion policy and required verified evidence.
- Audit/event metadata must not persist authorization headers, service-role secrets, access/refresh tokens, passwords, PAN/CVV/CVC, or equivalent secret fields.
- Ambiguous external results are not automatically retried.
- No dependent module may bypass the Universal Execution Core by implementing a private approval, provider, evidence, cost, or task engine.

## Follow-on implementation order after Core verification

1. **Studio Music + Creator Library persistence** — provider-neutral music jobs, verified provider configuration, asset provenance, versions, search and permissions.
2. **Finance Modeling + Document Intelligence** — deterministic workbook calculation graph, assumptions/scenarios, source documents, field-level provenance/confidence and governed corrections.
3. **Tax Execution Agent** — document extraction, validation, calculation, draft forms, review and approval; no filing/transmission until a separately authorized filing integration exists.
4. **ATLAS Pay / Wallet & Cards** — tokenized payment/card references only; no PAN/CVV persistence; issuance/provisioning/money movement remain approval- and provider-gated.
5. **Weather Context Service** — shared normalized weather/location context with consent, provider/source timestamps, caching and truthful unavailable/error states.
6. **Secondary module adoption + ATLAS Director shared-contract adoption** — migrate remaining modules to Task/Workflow/Approval/Evidence/Provider contracts where compatible instead of duplicating orchestration.

Each follow-on area receives its own approved design spec and implementation plan. Do not combine these regulated/provider subsystems into one giant implementation branch.

## Finish condition

When all five verification commands pass on the current HEAD, complete the final whole-branch review, record any rulings, and present merge options to the user. Do not merge or deploy automatically.
