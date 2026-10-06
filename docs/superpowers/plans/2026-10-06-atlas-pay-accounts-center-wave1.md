# ATLAS Pay Accounts Center — Wave 1 Implementation Plan

Date: 2026-10-06
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-pay-accounts-center`

## Goal

Add a source-backed Accounts Center + Balance Evidence layer to the existing ATLAS Pay control plane without duplicating Accounting, identity/RBAC, or regulated provider responsibilities.

## Execution

- [x] Audit existing ATLAS Pay architecture, migration, web surface, API and tests.
- [x] Confirm reuse of existing `/finance/pay`, `pay.read/manage/execute`, provider connections, instrument intents, payout intents and Accounting invariant.
- [ ] RED: extend unit tests for balance-domain separation and latest-evidence deduplication.
- [ ] RED: extend web integration tests for Accounts Center, Balance domains and Payout Hub.
- [ ] Add pure balance evidence types + summarization helper to `packages/pay`.
- [ ] Add migration for `atlas_pay_accounts` and `atlas_pay_balance_evidence`.
- [ ] Extend ATLAS Pay API snapshot with accounts and balance evidence.
- [ ] Extend `AtlasPayPage` with account/balance/payout/security surfaces.
- [ ] Extend architecture documentation.
- [ ] Run CI and fix regressions.
- [ ] Merge only after required checks are green.
- [ ] Verify `https://www.atlasenterprisesuite.com/` and `/finance/pay` after deployment.

## TDD acceptance

1. Historical balance snapshots from the same account/domain/currency/source are reduced to the most recent observation.
2. Wallet, earnings, rewards and credits are never merged into one total.
3. USD and non-USD evidence are never merged.
4. Unavailable evidence is not presented as available money.
5. UI clearly says the source is evidence-backed and external-gated.
6. Browser writes to new tables are revoked.
7. Existing ATLAS Pay fail-closed provider behavior remains unchanged.
