# ATLAS Financial OS — Day 1: Transaction Truth Engine
Date: 2026-10-12
Status: implementation proposed on a feature branch; NOT live banking.

## Reuse and scope
- Keep the canonical `packages/pay` provider-neutral financial domain and `apps/web/src/modules/finance/pay/AtlasPayPage.tsx` workspace.
- Keep Accounting as the only canonical general ledger; there is no transaction ledger, card issuance, payment rail, or money-movement feature added by this change.
- Use existing organization identity and `pay.read` / `pay.manage` / `pay.execute` boundaries; the read-only lifecycle projector does not authorize operations.
- Keep the public `/finance/pay` route free of customer transaction information.

## Phase-1 model
`deriveTransactionTruth(scope, evidence)` is a pure, deterministic read-only function. It distinguishes:
- `unverified`: no trusted evidence, or a release event without an authorization.
- `held`: provider-verified card authorization that is not known to be fully released or posted.
- `posted`: a provider-verified settled/posted debit; a later authorization release is not a purchase refund.
- `released`: a provider-verified full reversal/release of a known authorization, **not** a guarantee that the account's funds are immediately available.
- `conflict`: malformed, conflicting, mixed-currency or unsupported complex lifecycle evidence. Fail closed.

The `amountMinor` field describes a specific event, NEVER total balance, actual liquidity or a reconciled general-ledger entry.

## P0 trust boundary
1. Only a trusted authenticated server adapter may set `verifiedByServer: true` after validating webhook signatures or an authenticated provider read and the exact organization/account/provider binding. Client-supplied `verifiedByServer` is untrusted.
2. All reads/writes require verified organization scoping, canonical RBAC/RLS and auditable provenance. Never trust a client-provided organization ID in place of the authenticated organization.
3. Provider event IDs are deduplicated. Contradictory repetitions fail closed rather than mutating or doubling money.
4. No inferred release date, balance availability, bank charter, FDIC status or banking partnership; never mark the live provider feed connected without authenticated evidence.
5. No browser-controlled financial writes. No personal hotel transaction data, card numbers or screenshots stored in the repository.
6. Multiple authorizations or postings against a single transaction reference are intentionally unsupported until provider-specific splitting and partial-capture reconciliation are audited.
7. The gateway must handle signature verification, replay defense, durable receipt history, idempotent event storage and an evidence audit trail before real events are ingested.

## Day-1 acceptance evidence
- Unit cases: absent/unverified events, authorization vs posting, partial/full releases, posting precedence, stale releases, unrelated tenant/provider/account, duplicate retries, invalid and contradictory events.
- Integration source contract: workspace clearly declares that live event reads remain provider-gated.
- Required before merge: GitHub exact-head CI actually executes typecheck, unit/integration tests and build; security review.
- Required before production: approved RLS-backed storage + verified provider adapter, actual signed test fixtures, auth-isolation tests, release pipeline, exact-SHA Cloudflare verification.

## Follow-up implementation stages
- Day 2: add an append-only, organization-scoped evidence schema and signature-verifying server adapter behind feature flags; stage and test RLS (including negative cross-tenant reads).
- Day 3: authenticated read-only transaction case list, detail view, accessible dispute/help actions, retries and reconciliation; do not invent balances when providers cannot supply lifecycle events.
- Later: enterprise provider contracts, money-movement governance, compliance/legal checks and eligible partner approvals.

## Current blockers
No bank transaction-event provider is wired or certified. The workspace therefore shows a truthful provider gate instead of demo balances, fake releases or a fabricated operational list.
