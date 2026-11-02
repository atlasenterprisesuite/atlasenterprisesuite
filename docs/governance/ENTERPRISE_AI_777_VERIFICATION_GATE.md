# Enterprise AI 777 verification gate

Status: IN PROGRESS — NOT PRODUCTION VERIFIED
Scope: /assistant, /work, /automations, /work/connections, /work/team, /work/policies and atlas-copilot.
Source of truth: docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md.
Implementation must reuse existing components, APIs, permissions and audit pipelines.

## P0 acceptance gates (fail closed)
1. Every protected request authenticates the principal, resolves the active organization server-side and rejects cross-tenant access (including conversation IDs and tool invocations).
2. RBAC denies unauthorized access and side effects; sensitive actions require explicit approval and generate immutable audit evidence.
3. Provider readiness reflects verified runtime state, not a UI flag; unconfigured providers are never shown as live.
4. AI provider keys remain server-side; no client secret exposure; cost policy and fallback approval cannot be bypassed.
5. Prompt injection and malicious tool output cannot elevate permissions or trigger unapproved actions.
6. Enterprise identity: verify SSO/SCIM lifecycle or explicitly mark unavailable, without claiming support.
7. Conversation and knowledge access: organization boundaries, deletion/retention rules and data export authorization tested.
8. CI typecheck, tests, build and security checks pass at the exact release commit SHA.
9. Production E2E verifies login, assistant, model routing, denied actions, tenant isolation, mobile layout and rollback health at the exact deployed SHA.

## P1 acceptance gates (documented warnings)
- Analytics, administrative reporting, accessibility improvements and optional provider coverage.

## Required evidence
Record each gate with test command, CI run URL, commit SHA, result, reviewer, environment and timestamp.
P0 unknown/fail => BLOCKED. No merge or deployment before all P0 gates pass and owner authorization.
Do not copy proprietary ChatGPT implementation; functional parity only.

## Existing assets discovered
- docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md
- supabase/functions/atlas-copilot/intelligence-gateway.mjs
- AGENTS.md

## Current audit gaps
No execution of typecheck, unit/integration tests, production build, tenant-isolation tests, SSO/SCIM lifecycle, or live E2E is evidenced by this document. All remain UNVERIFIED.
