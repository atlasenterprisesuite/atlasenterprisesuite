# ATLAS Enterprise Intelligence Parity

Date: 2026-09-20
Route: `/assistant`

ATLAS Enterprise Intelligence follows the interaction model expected from a modern enterprise AI workspace while preserving ATLAS identity, architecture, tenant isolation, provider neutrality and governance.

## Canonical feature mapping

| Enterprise AI capability | ATLAS implementation |
| --- | --- |
| Conversational workspace | `/assistant` + `atlas-copilot` |
| Conversation history/search | ATLAS conversation store + client-side history filtering |
| Model/provider choice | IntelligenceRouter modes: Auto, ATLAS Local, OpenAI, Bedrock, Gemini, Codex Sovereign, Council |
| Reasoning controls | Fast, Balanced, Deep profiles |
| Long-running work | `/work` and Universal Execution |
| Workspace agents / automation | `/automations` + governed Work orchestration |
| Apps / connectors | `/work/connections` and ATLAS integration modules |
| Team / roles | `/work/team` + existing organization membership / RBAC |
| Policies / approvals | `/work/policies` + ATLAS Tool Gateway / Approval boundaries |
| Enterprise app catalog | `/suite` |
| Tenant isolation | Active ATLAS organization + server-side scope |
| Tool actions | ATLAS Tool Gateway; side effects and cost-sensitive actions remain approval gated |
| Audit | Existing ATLAS execution/governance audit paths |

## Truthfulness rules

- Never present a provider as live unless server readiness verifies it.
- Never claim a connection exists when the backing provider/runtime is not configured.
- Never bypass tenant, role, permission, approval or cost controls.
- Never copy OpenAI source code, trademarks, proprietary assets or internal implementation.
- Product inspiration is functional and interaction-level only; ATLAS branding and architecture remain first-party.
- External provider execution must remain behind server-side credentials and governed adapters.

## UX contract

The Assistant surface provides:
- persistent conversation rail;
- search over loaded conversation titles;
- new-chat action;
- enterprise navigation to Work, Agents, Apps, Team, Policies and Modules;
- provider and reasoning selectors;
- provider/readiness indicators;
- prompt starters;
- Enter-to-send / Shift+Enter newline behavior;
- responsive desktop, tablet and mobile layouts.

This document is the canonical parity contract for future additions such as organization knowledge retrieval, shared projects, richer workspace-agent management, analytics and identity-provider administration.


## 2026-10-12 — Enterprise DNA evolution (design stage)

The merged ATLAS Enterprise Intelligence workspace (PR #352) is an established **code baseline**, not proof that every enterprise workflow is live or that the deployed production SHA matches this branch. This registry remains canonical.

- Target architecture and comparator evidence: `docs/superpowers/specs/2026-10-12-atlas-enterprise-intelligence-dna.md`
- Incremental TDD, implementation, CI and E2E gates: `docs/superpowers/plans/2026-10-12-atlas-enterprise-intelligence-dna.md`
- Priority gap: document-level, permission-aware organization knowledge retrieval with source-linked provenance and revocation. **Not verified as implemented**.
- Next: governed action execution with bounded permissions, approval, idempotency and audited business outcome. **Not verified as implemented**.
- Existing authenticated `/assistant`, `atlas-copilot`, Work Connections, Work Policies, Universal Execution and Tool Gateway remain the integration authorities; do not duplicate them.
- Enterprise SSO/SCIM, full compliance export, connector-authenticated retrieval and production readiness require separate implementation and release evidence; comparison with ChatGPT Enterprise alone proves none of these.
