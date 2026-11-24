# ATLAS Bank — Financing Evidence V1 (read-only)

Date: 2026-11-07
Tracking: #1023
Status: feature branch candidate; **NOT banking, NOT production verified**.

## Purpose
Project the documented state of a corporate financing case without opening a bank account, moving money, fabricating account balances or recording unverified financing as assets. Preserve the canonical **ATLAS Pay + Accounting** architecture.

## Source contracts
- \`packages/pay/src/financingEvidence.ts\`: deterministic \`deriveFinancingTruth(scope,evidence)\`.
- \`packages/pay/src/index.ts\`: publicly exports the pure domain projector.
- \`tests/unit/atlas-financing-evidence.test.ts\`: negative-first behavior coverage.
- \`packages/pay/src/transactionTruth.ts\`: comparable event provenance and tenant scoping conventions.
- \`docs/finance/TRANSACTION_TRUTH_DAY1.md\`: no live bank feed or custody claim.

## Evidence lifecycle
The caller supplies exact \`organizationId\`, \`financingReference\`, currency and expected amount in minor units.
Events must match the exact scoped case and be **server-attested**; only a trusted authenticated adapter may set \`verifiedByServer\` after independently authenticating the issuer/reviewer, document references, bank/provider identity, and organization binding.

Kinds:
- \`official_approval\`, \`signed_agreement\`: independent reviewed-document evidence with amount.
- \`compliance_clearance\`: documented legal/compliance review, no dollar amount.
- \`receiving_account\`: authenticated banking-provider confirmation, no dollar amount.
- \`bank_settlement\`: authenticated banking-provider settlement evidence for exact case amount.

States:
- \`unverified\`: no trustworthy inputs or invalid scope.
- \`under_review\`: documentary prerequisites incomplete, including if a bank settlement appears without prerequisites.
- \`contracted\`: all prerequisites, but no verified settlement.
- \`received\`: all prerequisites PLUS one verified bank settlement; still **not** a claim of available deposit balance.
- \`conflict\`: tampering/contradictions, invalid source, wrong amount/currency, multiple settlements, invalid events.

\`accountAvailableMinor\` is always \`null\`, \`canExecute\` always \`false\`. The projector **does not record journals, settle money, open accounts, issue approvals, perform KYC/OFAC checks, or validate bank signatures**.

## P0 risk and exclusions
1. Never accept a client-provided \`verifiedByServer\` flag as authentic: API boundaries must ignore incoming flags and derive attestation server-side.
2. No direct browser financial writes. Keep organization-scoped RBAC/RLS for future server storage.
3. No auto-posting to Accounting; financing receipts become liabilities only with verified bank evidence, approved mapping and reconciliation.
4. V1 supports only one exact-amount bank settlement; partial draws/multiple tranches stay closed pending a separate audited model.
5. Evidence IDs are deduplicated; contradicting duplicate IDs fail closed.
6. This repo is public. Never commit actual account/routing identifiers, passports, signatures, contracts, credentials or confidential sovereign communications.
7. External government approval and the USD 21 million funding discussed by a user are **unverified claims**, never seed bank balances or an actual approved case in production.

## Verification tasks
- [x] Test-first definition on feature branch.
- [x] Local Node 22 type-strip behavioral harness: 15/15 passed; this does NOT prove repository-wide Vitest, typecheck or deployment.
- [ ] GitHub PR CI exact-head: Vitest unit and full regression suite.
- [ ] Security review of attestation and source-reference binding.
- [ ] Real storage model, audit trail, authenticated bank integration, negative RLS tests (future PR).
- [ ] E2E on authenticated preview / exact-SHA production (future PR).
- [ ] Independent legal validation of any real bank account, financing source, and transaction (external blocker).

## Acceptance criteria
A feature may be reported as merged only when required GitHub exact-SHA checks and reviews permit merge. **Even after merge, this feature never authorizes external banking operations or validates the existence of the claimed financing.**
