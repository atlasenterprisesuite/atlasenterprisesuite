# ATLAS Pay & Issuing — Governed Financial Control Plane

Date: 2026-10-01
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Owner module: `ATLAS Pay`
Route: `/finance/pay`

## Decision

ATLAS Pay is the canonical financial orchestration layer for wallets, issuing and payouts. Accounting remains the canonical general ledger.

External financial institutions and rails are adapters, not the ATLAS system of record:

```text
ATLAS Pay control plane
  -> provider policy / readiness
  -> issuing adapter
  -> payout router
  -> authenticated provider evidence
  -> reconciliation
  -> Accounting ledger
```

Supported adapter vocabulary currently includes Stripe Connect, sponsor-bank issuers, ACH, RTP, FedNow and card-network providers. Listing a provider kind does not assert that ATLAS has access to that provider or rail.

## Implemented in this slice

- Provider-neutral issuing and payout domain contracts.
- Fail-closed unavailable issuing and payout adapters.
- Eligibility checks for:
  - provider authorization;
  - credential verification;
  - verified regulatory coverage;
  - capability support;
  - currency support.
- Payout-route selection using only routes marked both available and verified.
- Explicit provider-fee + ATLAS-fee quote arithmetic using integer minor units.
- Organization-scoped Supabase control-plane tables for:
  - provider connection evidence;
  - instrument intents;
  - payout intents;
  - audit events.
- RLS-protected read access.
- Direct authenticated browser writes revoked.
- Service-role-only persistence boundary for consequential writes.
- ATLAS Pay web surface under Finance.
- Live organization-scoped evidence read through the existing authenticated ATLAS session boundary.
- Production route contract includes `/finance/pay`.

## Explicitly not claimed

This slice does not claim or enable:

- a banking charter;
- ATLAS as a regulated deposit-taking bank;
- FDIC insurance;
- direct Visa/Mastercard membership;
- direct Federal Reserve master-account access;
- direct FedNow access;
- approved ACH/RTP origination;
- a sponsor-bank agreement;
- a live issuer processor;
- live Stripe Connect credentials;
- live card issuance;
- live payout execution;
- settlement;
- custody of customer funds;
- KYC/KYB completion;
- money-transmitter or payment-instrument-issuer licensing.

Those states require authenticated legal/provider evidence before capability activation.

## Security model

Consequential financial writes are denied to the browser. A future server execution boundary must derive organization scope from authenticated identity and verify, at minimum:

1. `pay.execute` permission;
2. explicit user or policy approval for the consequential action;
3. provider authorization;
4. credential evidence;
5. regulatory coverage for the organization/customer/jurisdiction/product;
6. destination or instrument eligibility;
7. amount/currency/limit rules;
8. idempotency;
9. provider response authenticity;
10. append-only audit evidence;
11. reconciliation outcome;
12. Accounting posting contract.

Ambiguous provider results must become `reconciliation_required`, never fabricated success.

## Evolution

### Phase A — ATLAS Pay control plane
Current software direction. Provider-neutral contracts and fail-closed readiness.

### Phase B — ATLAS Issuing via authorized partner
Attach a verified issuer processor + sponsor bank while ATLAS owns the product experience, policy, routing, reconciliation and audit.

### Phase C — ATLAS regulated payments entity
After verified legal/compliance readiness, add jurisdiction-specific MSB / money-transmitter / payment-instrument-issuer capabilities where applicable.

### Phase D — optional ATLAS banking institution
Only after a separate charter, capital, management, compliance, insurance and network-access program. This is not implied by the software architecture.

## Canonical invariant

ATLAS Pay never creates a shadow general ledger. It owns regulated-action orchestration and evidence; Accounting owns financial books and journals.
