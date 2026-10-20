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
