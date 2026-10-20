# ATLAS Growth + Trust — foundation contract
Date: 2026-10-20
Status: PROPOSED / NOT DEPLOYED

## Reuse first
- Business Suite, CRM and Analytics own customer/campaign reporting surfaces.
- Advisory `paid_media` owns external provider readiness; do not duplicate provider connections.
- Canonical Identity, `authorize(...)`, tenancy/RLS and Approval Center remain the source of truth.
- Existing voice consent and stewardship rules remain domain-specific; this foundation must not silently replace them.

## Scope of this PR
Introduce a pure, **non-integrated** policy gate with unit tests. It refuses advertising authorization when any canonical authorization, tenant verification, provider readiness, organization authorization, matching consent or spend-budget evidence is missing. Its booleans are inputs from **trusted server-side sources only**, never proof from a browser or AI agent.

## P0 release conditions
1. Backend derives actor, subject, purpose, tenant scope and consent from authoritative stores. Store append-only non-secret audit evidence and revocation timestamps; define RLS for each table.
2. A subject may opt out/revoke permission at any time; deny future relevant operations on revocation. Digital consent receipts are not proof of ongoing interpersonal consent and must NEVER grant personal/sexual authorization.
3. Personal relationship, health or intimate consent records must never be transmitted to advertising systems or used for behavioral targeting.
4. Campaign spending requires verified connection + explicit organization permission, approved budget and approval chain. Monetary amounts use integer cents and are rechecked atomically server-side before expenditure.
5. Obtain vendor API terms, legal/privacy assessment, provider sandbox access, data minimization and retention limits. No external calls, credentials or real spend until reviewed.
6. Run unit/integration/security tests, CI and production exact-SHA E2E; P0 fail closed. P1 issues documented.

## Non-goals
This PR does not activate AppLovin, AppLove, campaign spend, a consent database, a public UI, or production deployment. It establishes a testable building block for subsequent bounded integration.

## Phase 2 implementation — 2026-10-20
Implemented `authorizeGovernedGrowthAdDelivery(...)` under Advisory, exported from the existing package entry point. This server-side policy adapter uses `packages/core/src/permissions.ts::authorize` for `advisory.manage`, existing `resolveAdvisoryProviderReadiness` for `paid_media`, and non-sensitive canonical audit events.

### Schema discovery (read-only)
Existing Supabase production schema was inspected without DDL or data mutations:
- `public.atlas_integration_connections`: organization scope, provider state, provider verification, last verified time, revocation.
- `public.advisory_provider_authorizations`: organization **and firm** scope, capability, explicit authorization, revocation.
- `public.atlas_voice_consents`: personal-voice-specific consent. **Not suitable** for advertising: do not reuse personal/relationship/voice consent as marketing consent.
- `public.atlas_approvals`: existing high-risk approval records, not a substitute for explicit current consent.

### Implemented fail-closed checks
1. Canonical actor permission and tenant/organization scope match.
2. Explicit authorization belongs to the same advisory firm as the approved campaign; revoked authorizations are denied.
3. Provider is for the same campaign provider, connected, verified, not revoked, and re-verified within the last 24 hours (server time).
4. Explicit, purpose-bound, subject-specific advertising consent matches tenant and organization, has started, has not expired, has not been revoked, and is still granted.
5. Approved campaign belongs to the same organization/tenant. Integer-cent budget check rejects overspend, missing approvals, and invalid amounts.
6. An authorization-only audit event is returned with no consent payload, identity secrets or provider credentials.

### Still blocked / required before use
- A separate, privacy-minimized advertising-consent source of truth with encrypted-at-rest treatment, server-only verification, append-only revocation evidence, RLS and deletion/retention semantics. Never source advertising consent from `atlas_voice_consents` or personal AppLove records.
- A server-only gateway to load canonical actor, scoped provider connection, firm authorization, and ad consent from the database rather than trusting incoming request data.
- An atomic spend reservation/ledger transaction for concurrent campaigns, idempotency and reconciliation; this pure preflight is **not** atomic financial authorization.
- High-risk Approval Center and stewardship enforcement, vendor sandbox verification, vendor API and DPA review, tests against actual multi-tenant RLS, audit persistence, privacy/opt-out UI, CI and exact-SHA E2E.
- No provider credentials, campaign launches, costs or deployed endpoints are introduced by this PR.

Release status: **DRAFT / FAIL CLOSED**. GitHub Actions checks for phase 2 must be verified on the final commit before any promotion.
