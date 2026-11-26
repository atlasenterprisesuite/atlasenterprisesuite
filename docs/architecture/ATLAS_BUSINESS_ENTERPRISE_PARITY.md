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

## Increment 002 — authenticated AI usage transparency (this branch)

Reuses `atlas-execution`, `organization_members`, `atlas_ai_usage`, `/work/policies`
and the Work API rather than introducing a billing/identity silo.

- Operation: `get_enterprise_usage` via the canonical authenticated Edge handler.
- The existing `resolveContext` verifies Supabase JWT and active organization membership;
  `execution.read` is mandatory before the new operation.
- The server resolves user and organization IDs and uses both as mandatory filters on
  `atlas_ai_usage`; no actor override, plan, credits, scope or entitlement is trusted from the request body.
- Report covers current UTC month with an exact record count and up to 20 latest observed
  event rows. Values are historical usage records, not financial settlement totals.
- `/work/policies` renders real loading, refresh, empty, error and recorded-activity states;
  no fake budget, live provider or quota state is asserted.
- `creditLimitStatus: 'unconfigured'`, `creditsRemaining: null` and
  `paidExecutionEnabled: false` are **hard-coded fail-closed** until the canonical
  transactional allocation/settlement ledger is implemented and authorized.
- Pure unit tests cover scoped filters, full UTC window, malformed provider responses,
  authorization, zero-state truth, and absence of mutations; additional source contracts
  cover Edge integration and Work UI.

### Known limitations

- The existing `atlas_ai_usage` count is **not an atomic credit ledger**, so a request
  reported here is not proof of a bill, available credit or permitted provider action.
- Historical usage logs can be incomplete for external providers; `eventCount` is the
  exact count of rows in the source for the requested UTC window, not guaranteed total
  AI usage across ATLAS.
- This stage adds no live member invites, SSO, simultaneous editors or quota write API.
- Production exposure requires a deployed `atlas-execution` Edge build matching the
  app client; if the route is not deployed, the UI must show a truthful error and no data.
- The claim of server authority depends on the existing server-side `resolveContext`
  implementation and its authenticated membership check. Verify in production E2E,
  including revocation, invalid sessions and cross-organization attempts.
- This branch is **NO-GO** until the existing exact-SHA P0 release gates pass.

## Increment 003 — atomic credit ledger candidate (2026-11-26)

**Isolated PostgreSQL 17 evidence:** workflow run
https://github.com/atlasenterprisesuite/atlasenterprisesuite/actions/runs/45815754769
passed on commit 6ca1a18f9bb8076d6d1d9a405416a2e9a62234d5.
Tests created the candidate schema with synthetic users/organizations/tasks,
verified RLS and no direct authenticated grants, negative membership tests,
partial settle/refund, strict verified execution evidence, immutable audit
records and process-level races (two competing requests and duplicated keys).
This is isolated test evidence, not production migration evidence.

**Source of truth:** supabase/schema/atlas_enterprise_credit_ledger.sql is a
review candidate, NOT a deployed migration. No standalone billing provider,
second identity store or mutable client-owned quota source was introduced.
The optional ledger is scoped by the existing organization and authenticated
user; only service_role has DB write / RPC permissions. The user must never
be able to invoke ledger mutating functions directly.

SQL operations:
- atlas_enterprise_credit_set_limit: verified org admin/owner allocation; default
  disabled; reduction cannot undercut existing consumption and reservations
- atlas_enterprise_credit_reserve: account-row FOR UPDATE + unique request key,
  real task ownership and live membership checks, single-transaction audit
- atlas_enterprise_credit_settle: verified execution_evidence, partial refund,
  single-transaction reserve-to-spent transfer and immutable event
- atlas_enterprise_credit_release: idempotent cancellation even after
  membership revocation; same-transaction audit
- ledger event rows are append-only by trigger; no direct end-user grants

Read-only integration:
- Existing atlas-execution Edge session context resolves the actor from a
  validated JWT and active organization membership.
- get_enterprise_credit_status reads the actor's UTC-month account through a
  server-only database adapter, never accepting user_id, limits, flags or
  balances from the caller. Any malformed accounting data fails closed.
- /work/policies displays actual historical AI records and (when exposed)
  ledger allocation status separately. paidExecutionEnabled remains hardcoded
  false independent of account availability.

Important: a PostgreSQL credit reservation is NOT permission to execute a paid
AI request. The canonical action policy, approval, cost, provider-readiness and
execution evidence gates are independently mandatory. **No provider debit
adapter is wired in this increment.**

### Remaining P0

1. Generate and review a versioned migration with the installed Supabase CLI.
   Do not apply the candidate DDL to production before isolated RLS and
   integration verification; verify deployed schema and locked-down grants.
2. Connect the canonical orchestration transaction to reservation/finalization
   with idempotent reconciliation for worker failure, timeouts and retries.
3. Authenticated live E2E for session revocation, cross-tenant data isolation,
   user-group and organization membership expiry, API endpoint compatibility,
   real persistence and audit without exposing service keys.
4. Update this PR against current main and pass all mandatory checks at the
   exact final head SHA; review, merge, Cloudflare deploy and E2E must pass.
5. SSO, shared-workspace CRUD, simultaneous editing, self-hosted VPC install
   and contractual SLA remain distinct incomplete product capabilities.

**P0 release decision: NO-GO**. The synthetic PG17 PASS must not be treated
as proof that users can spend credits or that the system is deployed.

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
