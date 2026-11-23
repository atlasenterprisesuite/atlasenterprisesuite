# ATLAS Business + Enterprise Capability Parity — Emergent Public Reference

Date: 2026-11-23
Status: phased implementation; **NOT** Business/Enterprise parity certified
Source: https://emergent.sh/pricing (publicly documented product features)
Canonical source: `atlasenterprisesuite/atlasenterprisesuite`, branch `main`

## Scope and legal boundary

Build an original ATLAS implementation of comparable capabilities; do not copy vendor code,
assets, prompts, internal architecture, contractual SLA, identity settings, or branding.
No Emergent subscription, login, credential, integration, or vendor spend is required.

Default posture remains a private owner-only ATLAS workspace. Collaborative sharing must
be explicitly configured and authorized. Do not broaden existing organization grants.

## Reuse inventory and evidence

| Public Emergent capability | Existing ATLAS owner | Current gap / truth |
| --- | --- | --- |
| Pro: conversational application generation | `packages/execution`; App Factory draft PR #973 | Draft prototype has safe plan/static preview, **not** full generation/deployment; do not merge PR #973 wholesale |
| Pro: custom AI agents / models | `atlas-copilot` registry, `packages/agents` | Runtime provider readiness varies; do not claim all models available |
| Business: RBAC | `packages/core/src/permissions.ts`, `packages/execution/src/policy-fabric.ts` | Authorization exists; must be enforced on every enterprise endpoint |
| Business: SSO | ATLAS Identity, existing auth architecture | Enterprise IdP provisioning, session semantics, SCIM and SSO E2E unverified |
| Business: shared workspaces | `/work/team`, current organization and execution role | Shared workspace CRUD/membership lifecycle and RLS not established |
| Business: real-time co-editing | Existing Work/communication architecture | No verified collaborative editing operation or conflict resolution |
| Enterprise: user-level credit limits | `packages/execution/src/enterprise-workspace-policy.ts` | **Pure preflight only**; transactional server quota ledger and enforcement pending |
| Enterprise: audit logs | `packages/governance/src/audit.ts`, execution audit | Per-request immutable debit + decision audit linkage pending |
| Enterprise: self-hosted database support | Existing Supabase/DB design | Deployment/adapters and portability E2E remain unverified |
| Enterprise: SLA / priority support | ATLAS Service Operations | Operational contracts, SLO monitors and response policies not established |
| Enterprise: user groups | ATLAS Identity/organization membership | Identity-group mapping and authoritative group revocation pending |
| Enterprise: deploy into own cloud/VPC | Existing Cloudflare production path | Independent private-cloud/VPC installation and rollback not verified |
| Enterprise: usage analytics | ATLAS Analytics / MAX governor | Server-sourced usage accounting + per-user reports pending |

## Increment 001 — workspace execution preflight (this branch)

New policy function: `evaluateEnterpriseWorkspacePolicy`. It REUSES
`evaluateAtlasPolicy` rather than creating an alternate orchestrator, billing engine or
authorization source. Inputs MUST be resolved server-side from authenticated canonical
identity, workspace membership and quota records.

The function:
- denies client-origin claims, missing identity, inactive membership and mismatched tenant/org;
- enforces read-only workspace seats, required granular permissions and spend/approval gates;
- denies malformed or exhausted user credit allocations;
- returns a non-mutating decision plus observed remaining credits;
- NEVER writes credits, invents audit IDs, changes subscriptions or performs deployment.

**Important:** A caller-supplied `contextSource: 'server'` is NOT proof of server authority.
Do not wire this function to a public endpoint unless the adapter resolves every protected
field itself, verifies RLS/RBAC, and guarantees atomic quota debit and audit persistence.

Test specification: `tests/unit/atlas-enterprise-workspace-policy.test.ts`.
TDD intent is recorded; local RED/GREEN runtime observation and CI must be evaluated
independently. This branch does not certify runtime enforcement.

## Next increments and acceptance

1. **P0:** Inspect the existing Supabase execution and identity tables/RLS; identify
   canonical membership/usage entities before any migration; no duplicate truth.
2. **P0:** Add an authenticated server adapter deriving scope and membership from trusted
   session/DB state, never from request bodies. Require explicit action permissions.
3. **P0:** Implement transactional quota reservation/settlement/refund with idempotency
   by request ID, concurrency tests, row/tenant locks and immutable audit evidence.
   Preserve monetary budget controls alongside credits; zero-spend mode by default.
4. **P0:** Add revocation, session expiry, cross-tenant and privilege-escalation E2E;
   never leak user usage across organizations.
5. **P0:** Build actual owner-only workspace UI first; allow group invites, SSO and
   coediting only behind explicit configuration and tested RLS. No fake online users.
6. **P1:** Add usage dashboards from real ledger records, not sample metrics.
7. **P1:** Document self-hosted database and private cloud portability; execute
   private-cloud tests before claiming VPC parity.
8. **P1:** Define measurable support SLOs; do not claim Emergent's contractual SLA.

## Production verification contract

Run `npm ci`, `npm run verify:all`, ATLAS Consensus CI and CodeQL.
Require successful review, PR merge, exact merged SHA, Cloudflare authorized deployment,
the canonical P0 production verifier and public HTTP/version-tag checks.
Use existing `scripts/verify-production-p0.mjs` and
`scripts/verify-global-production.mjs`; do not create new readiness systems.
**Fail closed** when any P0 evidence is missing or failed.
