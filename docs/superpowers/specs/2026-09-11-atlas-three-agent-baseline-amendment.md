# ATLAS Sovereign AI — Three-Agent Baseline Amendment

Date: 2026-09-11  
Status: User approved  
Tracking issue: #71  
Implementation PR: #72

## Decision

ATLAS Sovereign AI will use the following required initial collaboration baseline:

1. **ChatGPT / OpenAI — Architect + Orchestrator**
2. **Codex — Engineer + QA**
3. **Gemini — Independent Reviewer + Research**

GitHub Copilot is optional and is not a blocking dependency for the baseline.

## Responsibilities

### ChatGPT / OpenAI

Owns task decomposition, architecture, evidence correlation, governed workflow state, and the human-facing control loop. The consumer ChatGPT session is not treated as an undocumented programmatic runtime endpoint.

### Codex

Owns repository implementation, refactors, focused code review, test execution, commits, and PR preparation. Codex works in isolated branches/worktrees, follows repository `AGENTS.md`, and cannot approve or deploy its own production release.

### Gemini

Acts as an independent reviewer/research provider through the existing governed ATLAS intelligence runtime. Gemini may review architecture, security, research, and implementation evidence, but has no direct production mutation authority.

## Runtime architecture

Do not create a second AI bus.

Reuse:

`supabase/functions/atlas-copilot/`

The governed intelligence gateway remains authoritative for runtime provider selection, tenant/org scope, permissions, persistence, telemetry, and provider reporting.

OpenAI remains the default runtime provider. Gemini is selected explicitly and audibly through `provider_id`; no silent failover may report an incorrect provider.

Codex is an engineering agent operating on the code/repository workflow. It is not a browser-side runtime provider and does not need to be inserted into `IntelligenceRouter` merely to count as an agent.

## Collaboration flow

`ChatGPT plan -> Codex implement/test -> Gemini independent review -> Codex fix -> ATLAS QA / 3-of-3 CI -> human approval -> deploy -> post-deploy verification`

## Governance

- No agent may self-certify CI success.
- No agent may self-approve production release.
- No model receives unrestricted production deployment authority.
- Existing tenant isolation, RBAC, audit, Supabase persistence, and human approval gates remain authoritative.
- Secrets remain server-side and never appear in source, issues, PRs, logs, prompts, or browser code.
- `connected`, `verified`, `ready`, `live`, and `production` require fresh evidence.
- Local tests do not replace required CI or runtime verification.

## Verification status at amendment time

- ChatGPT/OpenAI: operational as architecture/control surface and existing runtime provider.
- Gemini federation code: implemented on PR #72; live runtime verification remains gated by approved deployment and a real provider probe.
- Codex: approved as required engineering/QA agent; repository operating rules are encoded in root `AGENTS.md`.
- GitHub Copilot: optional; absence does not block the three-agent baseline.
- GitHub Actions 3-of-3 CI: currently treated as blocked when jobs terminate before workflow steps execute; this must not be misreported as code failure or success.

## Superseded decision

This amendment supersedes the earlier required baseline `ChatGPT + Copilot + Gemini`.
