# ATLAS Connected Apps — Superpowers SDD Handoff

Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-connected-apps-integration-gateway`

## Binding inputs

Read first:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-09-12-atlas-connected-apps-integration-gateway-design.md`
3. `docs/superpowers/plans/2026-09-12-atlas-connected-apps-foundation-microsoft.md`

## Execution command

Execute `docs/superpowers/plans/2026-09-12-atlas-connected-apps-foundation-microsoft.md` using Superpowers Subagent-Driven Development.

Use an isolated worktree. Continue automatically through all 9 tasks. For every task use TDD: failing test first, minimal implementation, passing focused tests, coherent commit, independent spec-compliance review, independent code-quality review, and fixes/re-review before advancing. Maintain the SDD ledger required by Superpowers and perform a final whole-branch review.

Do not merge, deploy, publish, rotate/revoke live provider credentials, alter production provider configuration, or spend provider credits without explicit user approval.

The Microsoft adapter is the first end-to-end provider. A provider must never be represented as `verified` without a real authenticated provider probe. If Microsoft OAuth registration, callback configuration, protected secret storage, or another real external dependency is unavailable, implement and test through the real dependency boundary, leave the provider in a truthful non-live state, document the blocker, and continue every task that can be completed safely.

Do not expose provider access tokens, refresh tokens, API keys, client secrets, certificates, recovery codes, or provider passwords to browser state, LocalStorage, SessionStorage, URLs, logs, audit payloads, or source control.

Reuse the existing ATLAS Identity, organization membership, Supabase/RLS, web shell, modules, and shared provider patterns before adding parallel infrastructure.

Finish with evidence for `npm run typecheck`, `npm test`, and `npm run build`, plus the final independent whole-branch review. Leave the branch ready for human approval; do not merge or deploy.