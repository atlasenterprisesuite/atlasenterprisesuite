# ATLAS Accounting Back-to-Front Completion — Execution Note

Date: 2026-09-15
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Canonical production backend: Supabase project `atlas-core`
Governing design: `docs/superpowers/specs/2026-09-03-atlas-core-accounting-design.md`
Governing plan: `docs/superpowers/plans/2026-09-03-atlas-core-accounting-implementation.md`

## Purpose

Complete the existing Accounting module without creating a parallel accounting system. Work from verified financial outputs backward to source ingestion.

## Execution order

1. Financial statements and ledger reporting derive only from posted journal lines.
2. Period-close readiness consumes posted journals, reconciliations, AR/AP review, and explicit exceptions.
3. Bank reconciliation consumes imported statement transactions and book activity; it may close only at zero unexplained variance.
4. Journal posting converts reviewed source transactions into balanced, immutable double-entry entries, with governed reversal.
5. Classification/review separates external income/expense from own-account transfers, debt proceeds, refunds/reimbursements, card payments, and ambiguous activity.
6. Source ingestion imports Finances transaction identifiers idempotently into `accounting_transactions`, preserving provenance/evidence.
7. Bank-account and chart-of-accounts mapping uses the existing `accounting_entities`, `accounting_bank_accounts`, and `chart_of_accounts` tables.
8. The web Accounting routes use these same production contracts; no hard-coded report totals or fake connected states.

## Current production facts at execution start

- Organization: ATLAS.
- Accounting entities: Winder Aranguren (Personal), Atlas Enterprise Suite Inc, AW Finance Advisory LLC.
- Five linked financial accounts exist in `accounting_bank_accounts`; all provider accounts are personal according to the authorized Finances source and must initially map to the personal entity.
- `accounting_transactions`, `journal_entries`, and `journal_lines` are empty at execution start.
- Existing Accounting migrations already provide RLS, audit coverage, journal validation/reversal, reconciliation, close, fixed assets, budgeting, multicurrency, and consolidation foundations.
- Current chart of accounts contains only five generic accounts and must be expanded rather than replaced.

## Safety and truth rules

- No linked personal account is assigned to a company without source evidence.
- Matched own-account transfers and card repayments are not revenue or expense.
- Confirmed loans/advances are liabilities, not revenue.
- Low-confidence or contradictory rows remain in review; they are not auto-posted.
- Posted journals are balanced and immutable except through reversal.
- Reports expose posted-book truth plus explicit unreviewed/unreconciled exceptions.
- Periods are not marked closed while required exceptions remain.
- Every write remains organization/entity scoped, RLS-governed, and auditable.
