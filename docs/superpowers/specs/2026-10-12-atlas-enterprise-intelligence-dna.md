# ATLAS Enterprise Intelligence — Enterprise DNA 2026

**Date:** 2026-10-12  
**Status:** Design specification, NOT an implementation or production-verification claim  
**Owner:** ATLAS Intelligence / Platform / Security  
**Canonical surfaces:** `/assistant`, `/work`, `/work/connections`, `/work/policies`, `/work/team`, `/automations`, `/suite`  
**Extends:** `docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md`

## 1. Intent and differentiator

Study the publicly documented *capabilities* of ChatGPT Enterprise without copying its proprietary implementation, interface, brand, assets, or contractual claims. ATLAS is **not** ChatGPT Enterprise, and an OpenAI API integration does not confer Enterprise subscription entitlements.

ATLAS Enterprise Intelligence will be a permission-aware, evidence-first intelligence layer inside the existing ATLAS ecosystem. Its differentiation is **business work to verified outcome**: organization knowledge -> grounded answer -> approved action -> domain record change -> audit evidence -> measurable business outcome. Priority domains include Accounting, Tax, Payroll, CRM, Work, Compliance and Analytics, reusing canonical ATLAS modules.

## 2. Public comparator (not ATLAS readiness evidence)

| Publicly documented Enterprise pattern | ATLAS design response |
| --- | --- |
| Organization-aware company knowledge with source permissions | Permission-filtered retrieval and source-linked answer provenance |
| Custom apps, MCP integrations and connector access governance | Reuse Work Connections and the existing Tool Gateway; per-app/per-action scopes |
| Workspace agents and delegated tasks | Reuse Universal Execution, governed agents, immutable manifests and job audit |
| Roles, identity, SSO/SCIM and administration | Reuse ATLAS tenant and RBAC authority; design enterprise IdP provisioning adapter only when justified |
| Usage, cost, security, compliance administration | Organization-scoped policy console, telemetry and evidence registry |
| Cloud coding/long-running workflows | Reuse ATLAS Work runtime / queue and release pipeline, never fork a second execution service |

Primary research checked 2026-10-12:
- https://help.openai.com/en/articles/12628342-company-knowledge-in-chatgpt
- https://help.openai.com/en/articles/20001143-chatgpt-workspace-agents-for-enterprise-and-business
- https://help.openai.com/en/articles/20001264-chatgpt-enterprise-admin-quickstart
- https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps
- https://help.openai.com/en/articles/10128477-chatgpt-enterprise-and-edu-release-notes

These sources describe a competing product; they do **not** prove a corresponding ATLAS capability has shipped.

## 3. Evidence-based baseline in main (inspection 2026-10-12)

| Capability | Repository evidence | Status boundary |
| --- | --- | --- |
| Unified chat / history / model selection | `apps/web/src/modules/intelligence/UnifiedAIChatPage.tsx`; merged PR #352 | Code present; runtime and production state not verified by this design |
| Organization identity and permission | `supabase/functions/atlas-copilot/atlas-intelligence-auth.mjs` (membership and `intelligence.use`) | Auth logic present; require integration, RLS and adversarial tests |
| Provider routing and readiness | `supabase/functions/atlas-copilot/intelligence-gateway.mjs`, `provider-registry.mjs` | Dynamic provider state; never infer all providers are online |
| Action approval separation | `supabase/functions/atlas-copilot/tool-gateway.mjs` | Proposal evaluation exists; no unrestricted mutations |
| Work and connection references | `apps/web/src/work/WorkConnectionsPage.tsx`, `WorkPoliciesPage.tsx` | Reference registration is NOT proof of provider authentication / retrieval |
| Shared execution | `packages/execution`, `packages/agents`, Work routes | Verify queue persistence, role enforcement and exact-head CI before release |
| Cross-app permission-aware knowledge with source citations | No complete E2E evidence established in this review | **UNVERIFIED / design target** |
| IdP SSO/SCIM and enterprise-wide compliance export | No complete E2E evidence established in this review | **UNVERIFIED / evaluate existing contracts first** |

## 4. One-core architecture and trust boundaries

```text
ATLAS /assistant or /work (authenticated tenant + accessible UI)
    -> ATLAS Identity + membership + permission / policy decision
    -> ATLAS Intelligence Gateway / atlas-copilot
        -> [a] Knowledge retrieval (authorized source adapters, new extension)
        -> [b] Provider registry + verified capability + budget routing
        -> [c] Tool Gateway: typed action proposal, approval, execution once
    -> Work / Universal Execution (durable authorized jobs only)
    -> Canonical domain APIs (Accounting, HR, Tax, CRM, ...)
    -> Audit + evidence ledger + attributable outcomes
```

**No parallel authority:** The assistant does not own membership, permissions, source access, credentials, job execution, billing or domain data. New code must integrate existing module APIs. All secret-bearing provider calls occur server-side.

### 4.1 Knowledge contract — planned, not yet present

Retrieval request: authenticated `organization_id`, `actor_id`, source filters, query, trace id and per-request budget. Server derives identity from session; it must ignore caller-supplied impersonation attempts.

Proposed internal `AuthorizedSourceResult` fields: `source_id`, `document_id`, `connector_id`, `org_id`, `access_decision_id`, `source_uri`, `title`, `snippet`, `retrieved_at`, `source_updated_at`, `content_digest`, `classification`, `citation_ref`, `redaction_reason?`. This is a **contract proposal**, not a deployed schema.

Every result must pass **both** source-provider authorization and ATLAS tenant/permission checks. Revalidate authorization at search, content fetch and response release; recheck immediately before any action. Never trust client-submitted org ids, synthetic source links or language-model assertions of access. Missing permission, expired grants, unknown classification or unavailable source auth => fail closed, omit content, log a redacted decision. Results without usable citations must be labeled unverified or omitted from evidence-backed responses.

Index isolation: tenant-specific partitioning + enforced RLS, source ACL metadata, encrypted storage, revocation/tombstone propagation, bounded retention, deletion workflow and provenance. Cache keys include org, actor/role ACL version and connector scope. Never cross-tenant reuse retrieval fragments by semantic similarity. Source data is untrusted instructions: treat it as data, not system instructions, and block prompt-injection attempts to invoke tools or exfiltrate content.

### 4.2 Agent/action contract

Each job binds `org_id`, `actor_id`, immutable agent version, requested capability, source set, permission snapshot version, risk class, idempotency key, approval record (where applicable), exact execution envelope, deadline and cost ceiling.

The provider may **propose** actions, not grant rights. The Tool Gateway validates tool allowlist, schema, current permission, policy, risk, spending, egress destination and action idempotency. Mutations and cost-bearing operations require existing explicit approval rules; human or privileged authorization must never be supplied by the agent itself. Revocation, tenant switch, expired consent, budget breach or missing audit evidence stops execution. External action outcome must reconcile against the canonical domain system of record; model text is not completion evidence.

### 4.3 Admin, telemetry and security

Use `/work/team`, `/work/policies` and existing Cloud/Security surfaces rather than duplicating administration. Future settings: provider/action allowlists, knowledge sources and source scopes, configurable retention, audit exports, per-org budgets, agent publication rights, group-based permissions, optional enterprise identity federation.

Operational metrics come from persisted events only: query count, cited-answer ratio, per-source permission denials, execution success rate, approval latency, revoked-token failure rate, per-tenant cost and response latency. All counts have explicit observation windows and coverage. No hypothetical uptime percentages or unsourced cost savings.

Security P0: tenant crossing, data exfiltration, unauthorized access, bypass of approval, secret exposure, provider falsely marked verified, idempotency failure on irreversible mutation, or a production SHA mismatch. P1: minor presentation issues and non-security degraded optional features, documented with owners.

## 5. UX journeys (mobile, desktop and accessible)

1. User signs in and selects an active ATLAS organization. The assistant labels active scope, provider readiness and source scope without exposing internal secrets.
2. User asks for an Accounts Receivable aging summary. ATLAS retrieves only their authorized AR sources, displays linked evidence and states missing/partial coverage.
3. User requests customer follow-up. Assistant drafts a proposed message; it does not send until the configured permission + approval path permits the action.
4. Admin reviews approval, policy, actor, source refs, domain record, result and auditable execution evidence.
5. User switches organization or revokes a connector: content and actions tied to the prior scope become unavailable; no cached cross-tenant answer or action is permitted.

Required states: authorized/denied, sources found/no sources, partially verified, provider unavailable, cost blocked, approval required/rejected, queued/running/failed/completed, revoked source and citation unavailable. Keyboard accessibility, focus, screen readers, contrast and reduced-motion apply to every state.

## 6. Release gates and red-team acceptance

### P0 (block merge / deployment)

- Different organizations cannot retrieve each other's source chunks, even with forged org ids or cache keys.
- A user without document permission receives neither text nor inference-bearing snippets/citations.
- Revocation between retrieval and response prevents previously allowed disclosure.
- Prompt injection inside a source cannot gain tool privileges or change policy.
- Provider action cannot bypass role, policy, approval, risk limits or spending cap; repeated delivery cannot duplicate a mutation.
- All connectors prove real authorization before displaying `connected` or executing queries.
- No credentials or personal/private source text appear in logs, artifacts, telemetry, error payloads or client bundles.
- Tests use mock/stub providers: no paid API calls, no production data.
- Typecheck, unit/integration, build, release gates, deployed exact SHA and authenticated/negative-path E2E verification are recorded.

### P1 (recorded, not silently waived)

- Accessible keyboard/mobile presentation and verifiable citation interactions.
- Document provenance, ingestion freshness and deletion/retention visibility.
- Admin usage reports label coverage and avoid fabricated costs/metrics.

## 7. Incremental delivery — one release train

**E0: Inventory and RED tests.** Map existing knowledge, connectors, RLS, ACL, agent execution and telemetry. Capture base SHA and negative tests before altering behavior.

**E1: Authorized knowledge MVP.** One approved organization-owned source (e.g. a test document collection), citations, revoked-access invalidation, no external writes. Production gate remains blocked pending real provider auth and E2E.

**E2: Governed agent.** Execute a read-only reconciliation summary and propose one domain action behind policy/approval/idempotency. Preserve canonical Work queue.

**E3: Enterprise admin.** Source access/role management, policy inspection and evidence-backed metrics on existing team/policies/security surfaces.

**E4: Vertical proof.** Accounting AR aging -> traced summary -> authorized follow-up draft -> audit event; measure only from actual stored events.

No E stage is marked implemented merely by adding this specification. Continue using `docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md` as the functional parity registry and `docs/governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md` as the governing delivery contract.
