# ATLAS Bank — sovereign financial infrastructure roadmap
Date: 2026-10-16
Status: engineering design; not a licensed bank or live money movement.

## Canonical ownership
Reuse packages/pay, apps/web/src/modules/finance/pay/AtlasPayPage.tsx and existing /finance/pay route. Accounting is the ONLY general ledger. Do not duplicate account, authentication, audit or ledger subsystems. The transfer policy introduced in packages/core/src/banking is a temporary isolated policy foundation and MUST be consolidated into packages/pay before any merge.

## Product layers
1. ATLAS Accounts: identity-linked account profiles and source-evidenced balances, never misrepresented as bank deposits.
2. ATLAS Transfers: consent, recipient/account eligibility, verified transferable funds, risk, limits, idempotent transfer intent, and lifecycle.
3. ATLAS Treasury: settlement evidence, reserve and liquidity controls, reconciliation with canonical Accounting.
4. ATLAS Compliance: jurisdiction and product eligibility, identity verification, sanctions/AML review where applicable, suspicious activity escalation, retention and audit.
5. ATLAS Banking Network: replaceable regulated external rail interface; production disabled until valid bank or network membership and legal approval.

## Required engineering controls
- RBAC pay.read/pay.manage/pay.execute; server-side auth and tenant-bound RLS.
- Durable unique (organization_id, idempotency_key), immutable approvals, append-only audit, verified step-up.
- Signed/replay-protected provider events; terminal-state and reversal policies.
- Separate observed, available and settled balances. No invented liquidity.
- No overdraft/SpotMe counted as transferable funds.
- Strict double-entry reconciliation only in canonical Accounting.
- No browser direct financial writes; no secrets in source.
- Feature flags default OFF and a kill switch.
- Test mock mode is not production; no fabricated successful settlements.

## Banking institution gate
Do not describe ATLAS as a chartered bank, FDIC insured, direct ACH originator, FedNow participant or deposit custodian until documentary regulatory evidence exists. A standalone US bank entails chartering, capital, governance, AML/BSA, consumer protection, supervisory examination and payment network participation. Product software alone does not grant these rights.

## Phase acceptance
A. Existing packages/pay inventory and contract mapping.
B. Unified policy code and TDD in packages/pay; remove redundant parallel engine.
C. RLS schema, server intent endpoint, audit and durable idempotency.
D. Simulation-only E2E, reconciliation and threat model.
E. Regulatory route decision and authenticated network access.
F. Controlled live pilot, CI/PR/merge/deploy, exact-SHA production verification.

P0 fail closed: no regulatory authorization, no verified banking rail, no live transfers.
