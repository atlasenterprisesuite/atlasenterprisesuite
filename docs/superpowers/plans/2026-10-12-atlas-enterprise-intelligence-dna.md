# ATLAS Enterprise Intelligence — Delivery Plan

Date: 2026-10-12  
Status: Approved design work; **implementation, CI, deploy and E2E are not yet complete**.  
Spec: `docs/superpowers/specs/2026-10-12-atlas-enterprise-intelligence-dna.md`  
Canonical parity: `docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md`  
Baseline: `main` at `9920912d859503220b4bb87499f5bdca73b90e3a`.

## Non-negotiable controls

Extend `/assistant` and `supabase/functions/atlas-copilot`. Reuse ATLAS membership/RBAC/RLS, Work Connections, Universal Execution, agent registry, Tool Gateway and evidence registry. Do not introduce a second chatbot backend, credential store, identity system, source catalog, scheduler or audit ledger. Keep all third-party credentials server-side. Fail closed on unknown tenant, permission, connector, readiness, approval, classification, or cost. No paid provider tests.

## Execution backlog

### E0 — code/data inventory + failing security contracts
- [ ] Read current source schemas/migrations for memory, documents, Work Connections, agent publication and execution; reconcile with production-backed interfaces.
- [ ] Record exact `main` baseline and existing tests, known provider state and reusable auth APIs.
- [ ] Write RED cases for forged tenant, revoked source grant, ACL cache collision, prompt injection, stale citation, source deletion and paid provider deny.
- [ ] Identify capability owner for each interface and record evidence links; no guessed implementation status.
- **Exit:** reproducible RED before behavior changes and source-authority diagram signed off in PR.

### E1 — first tenant-safe knowledge source
- [ ] Define authorized-source adapter backed by an existing ATLAS-owned document store or one approved connection; preserve opaque provider credentials.
- [ ] Enforce server-side actor/org/doc permission at discovery, fetch and response emission.
- [ ] Add source refs, document digests, timestamp, partial-coverage/error UI; prevent model-fabricated citations.
- [ ] Add per-tenant partition/index and grant version to cache key; invalidate on revocation/delete; audit denied retrieval without source text.
- [ ] GREEN: unit, API integration, two-tenant negative isolation, revocation race, prompt-injection attempts, a11y and empty/error states.
- **Exit:** read-only, source-cited answers from the permitted pilot corpus, no writes, no external provider claims.

### E2 — agent actions under ATLAS policy
- [ ] Extend existing agent/task contracts with source scope, immutable version and idempotency key; do not fork executor.
- [ ] Add an AR read-only analysis task; side-effectful follow-up remains a proposal behind Tool Gateway and real approval.
- [ ] Validate action schemas, permissions, budget, approved egress and expiry at execution time.
- [ ] GREEN: denied privilege escalation, repeated mutation prevention, approval expiry, failure recovery and audit reconciliation.
- **Exit:** one end-to-end approved action with persisted evidence; no double-write.

### E3 — administration and metering
- [ ] Surface source allowlists / permission visibility through `/work/team` and `/work/policies` or existing equivalent pages.
- [ ] Render only persisted per-org metrics: citation rate, coverage window, action state, budget use, access denials.
- [ ] GREEN: admin/non-admin visibility and tenant isolation, 0-data view, accessibility, negative provider state.
- **Exit:** operator can inspect and revoke access, view exact evidence and distinguish inactive/unverified/blocked.

### E4 — 777 REVIEW release pipeline
- [ ] `npm ci`; `npm run typecheck`; `npm test`; `npm run build`; applicable security/design/edge/evidence gates.
- [ ] Branch -> review -> PR -> CI on exact head; correct P0 failures without waiver.
- [ ] Only after approval/rules allow: merge to `main`; deploy using existing Cloudflare workflow.
- [ ] Verify deployed exact SHA plus authenticated `/assistant`, per-tenant knowledge retrieval, revoked access, denied action, approved action and audit result in E2E.
- [ ] Record P1 with owner and remedial actions; never mark final production verified from CI alone.
- **Exit:** verified exact source/deployment identity and all P0 closed.

## Work product / status truth

This PR is **architecture/design only**. Neither new retrieval, connector provisioning, SSO/SCIM, agent action execution, production deployment nor new provider readiness is established by this change. Runtime implementation PRs should reference this plan, and their acceptance tests must attach observable evidence rather than screenshots/claims alone.
