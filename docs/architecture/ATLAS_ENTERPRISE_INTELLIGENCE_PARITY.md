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
