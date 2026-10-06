# ATLAS Pay Accounts Center — Design

Date: 2026-10-06
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Owner module: `ATLAS Pay`
Primary route: `/finance/pay`
Branch: `feat/atlas-pay-accounts-center`

## Objective

Extend ATLAS Pay with an account-centered control surface that separates identity/profile scope, wallets/instruments, balance evidence, earnings/rewards/credits, payouts, and security/permissions without creating a shadow ledger or claiming unverified financial custody.

The design borrows the useful pattern of a unified account/payment control center while preserving ATLAS invariants:

- one organization-scoped control plane;
- Accounting remains the canonical general ledger;
- balances are source-backed evidence, not fabricated bookkeeping;
- earnings, rewards, credits, and wallet balances remain distinct domains;
- external providers remain replaceable adapters;
- browser writes remain revoked;
- tenant isolation, RBAC and auditability remain authoritative;
- regulated actions remain fail-closed until provider/legal evidence exists.

## Product model

ATLAS Pay becomes a five-surface financial control experience:

1. **Accounts Center**
   - organization-scoped financial profiles;
   - profile kind: person, organization, brand, creator, external;
   - active/suspended/archived lifecycle;
   - no duplicate login/authentication system.

2. **Wallet**
   - existing instrument intents and verified provider connections;
   - virtual/physical/business/payroll/vendor card intents remain issuer-gated;
   - no claim of custody or live issuing without provider evidence.

3. **Balances & Earnings**
   - append-only source-backed balance snapshots;
   - domains: wallet, earnings, rewards, credits;
   - state: available, pending, held, unavailable;
   - source kind: ATLAS control-plane evidence, external provider evidence, or reviewed manual evidence;
   - currency remains explicit and balances are never silently merged across domains or currencies.

4. **Payout Hub**
   - existing payout intents and reconciliation states;
   - standard/instant payout remains provider-gated;
   - ambiguous provider responses become reconciliation_required.

5. **Security & Permissions**
   - reuses canonical identity permissions/RLS;
   - does not create a second authorization model;
   - financial actions continue to require governed server workflows.

## Data architecture

### atlas_pay_accounts

Organization-scoped financial profiles used only to associate source evidence and financial product intent with a business/person/brand/creator context.

Fields:
- id
- org_id
- account_key
- display_label
- account_kind
- state
- created_at
- updated_at

### atlas_pay_balance_evidence

Append-only balance snapshots.

Fields:
- id
- org_id
- account_id
- provider_connection_id
- balance_kind
- amount_minor
- currency
- state
- source_kind
- source_reference
- observed_at
- expires_at
- created_at

No row is treated as live custody merely because it exists. UI must surface provenance and observation time.

## Canonical invariants

1. Accounting owns journals and books.
2. ATLAS Pay owns orchestration, source evidence, policy, routing, reconciliation and UX.
3. The latest balance evidence may be summarized, but historical snapshots must not be double-counted.
4. Wallet, earnings, rewards and credits are separate balance domains.
5. Currency boundaries are explicit.
6. External-gated capabilities fail closed.
7. Sensitive writes remain server-only.
8. UI may not claim "paid", "settled", "insured", "bank-backed", or "available funds" without authenticated evidence.

## UX

The existing `/finance/pay` page remains the canonical entry point and gains:

- Accounts Center summary;
- Balance domains summary;
- Wallet & issuing section;
- Payout Hub section;
- Security & permissions section;
- provider evidence;
- explicit external-gated notice.

No duplicate route is required in Wave 1.

## Security

RLS uses existing `pay.read`, `pay.manage`, and `pay.execute` permissions. Browser insert/update/delete stays revoked. Service-role persistence is allowed only behind governed server workflows.

Audit events are extended to recognize account and balance-evidence entities.

## Verification

Required gates:

- unit test proving historical balance snapshots are deduplicated by latest source observation and not merged across balance domain/currency;
- integration test proving Accounts Center / Balance domains / Payout Hub are present and remain evidence-gated;
- migration checks for RLS and revoked browser writes;
- existing ATLAS Pay tests remain green;
- production route contract for `/finance/pay` remains unchanged.
