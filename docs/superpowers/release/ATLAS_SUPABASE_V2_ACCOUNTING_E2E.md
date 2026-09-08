# ATLAS Supabase v2 — Accounting Lifecycle E2E Evidence

**Project:** `atlas-core-v2` (`qawxltbplsxcjvwxdkes`)  
**Date:** 2026-09-07  
**Canonical branch:** `release/atlas-a-z`

## Truth state

This document records an executed database-level authenticated Accounting lifecycle test. It does not claim full frontend, GitHub CI, deployment, or production readiness.

The reproducible pure-SQL test is:

`supabase/v2/tests/accounting-lifecycle.e2e.sql`

The executed test used one synthetic authenticated user, a synthetic tenant/org, and synthetic Accounting records inside a database transaction that ended with `ROLLBACK`.

## Executed lifecycle

The test successfully exercised:

1. tenant/org bootstrap through the service-role-only bootstrap RPC;
2. authenticated JWT identity resolution;
3. scoped Chart of Accounts creation;
4. Accounting settings with default AR/AP accounts;
5. Accounting period creation;
6. balanced manual journal creation and posting;
7. governed journal reversal;
8. customer creation;
9. invoice creation, lines, posting, payment and paid status;
10. vendor creation;
11. bill creation, lines, approval, posting, payment and paid status;
12. bank account creation;
13. manual bank inflow and outflow evidence;
14. reconciliation session creation;
15. exact matching of bank transactions to posted cash journal lines;
16. reconciliation close with statement balance equal to ledger balance;
17. fixed asset creation;
18. month-end straight-line depreciation posting;
19. close task creation and evidence-backed completion;
20. Accounting period close;
21. explicit negative test proving a closed period rejects journal posting;
22. governed period reopen with mandatory reason;
23. posting after reopen;
24. successful second period close;
25. Trial Balance equality (`sum(debit) = sum(credit)`);
26. Profit & Loss expected values for the fixture;
27. Balance Sheet equation (`assets = liabilities + equity`, including Current Earnings);
28. non-empty General Ledger output.

## Expected financial assertions

The synthetic fixture asserted:

- invoice final status: `paid`
- bill final status: `paid`
- reconciliation final status: `closed`
- Accounting period final status: `closed`
- original manual journal final status: `reversed`
- reversal journal final status: `posted`
- August depreciation event: `100.0000`
- August revenue: `100`
- August expense: `195`
- Trial Balance debit total equals credit total
- Balance Sheet assets equal liabilities + equity
- General Ledger contains at least 10 rows for the fixture period

## First-run test defect and correction

The first lifecycle execution reached the final report assertions but the test itself used PL/pgSQL variables named `total_debit` and `total_credit`, which collided with Trial Balance output column names. PostgreSQL correctly raised an ambiguous-column error.

No business RPC had failed. The transaction aborted and a fresh database check confirmed zero persisted fixture rows.

The test was corrected by using non-conflicting variable names (`tb_debits`, `tb_credits`, etc.) and rerun from the beginning. The corrected complete lifecycle finished without SQL errors and reached the final period close before `ROLLBACK`.

## Cleanup evidence

A fresh post-run query confirmed:

- auth users: **0**
- tenants: **0**
- organizations: **0**
- memberships: **0**
- Accounting accounts: **0**
- journals: **0**
- invoices: **0**
- bills: **0**
- bank transactions: **0**
- reconciliation sessions: **0**
- fixed assets: **0**
- Accounting periods: **0**
- audit fixtures: **0**

The E2E therefore leaves no synthetic business or identity data behind.

## Remaining Accounting production gates

Accounting v1 is now verified at the database lifecycle level, but production readiness still requires:

- full generated Supabase `Database` type adoption in repository/providers;
- frontend-to-v2 E2E through the browser/application runtime;
- full ATLAS Forge / repository typecheck, unit, integration, dependency audit and build;
- real authenticated bootstrap and real-data onboarding under an approved production workflow;
- ATLAS Tax integration before non-zero invoice/bill tax posting is enabled;
- deployment and production verification only after the broader A-Z release gates are satisfied.
