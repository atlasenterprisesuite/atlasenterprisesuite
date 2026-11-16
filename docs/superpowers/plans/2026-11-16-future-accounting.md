# Future accounting implementation plan

> For agentic workers: execute task-by-task using the existing autonomous ATLAS workflow and test-driven development.

**Goal:** Deliver a truthful local CSV reconciliation workspace and a six-track implementation roadmap.
**Architecture:** Extend packages/accounting and the existing React finance/navigation surfaces. Keep local comparisons separate from authenticated ledger state.
**Tech Stack:** Existing TypeScript, React, Vitest, Web Crypto; no new dependencies.
**Spec:** docs/superpowers/specs/2026-11-16-future-accounting-design.md

## Global constraints
Two files, 2 MiB each, 10,000 data rows each. Required CSV headers id,date,amount,currency; optional reference,description. Signed integer minor units; USD/EUR/GBP/CAD/AUD only, same currency throughout. Mutually unique candidates, date window 0–30. Memory-only processing. No external or financial mutations. All results require review.

## Review focus
- Identical references and amounts with multiple candidates must not produce greedy matches.
- A new invalid file, overlapping reads or Clear must not leave an exportable stale result.
- Unicode/BOM/quoted cells and impossible dates must be handled deterministically.
- Large or unsafe amounts, totals and files must fail closed.
- Source hashes describe original bytes; exports must not imply identity verification, approval or server persistence.

### Task 1: Safe comparison domain
Files: packages/accounting/src/bankReconciliation.ts; packages/accounting/src/index.ts; tests/unit/accounting-bank-reconciliation.test.ts.
Interfaces: parseReconciliationCsv(text) returns ReconciliationEntry[]; reconcileStatements(bank, ledger, {dateWindowDays}) returns ReconciliationResult; buildReconciliationEvidence(sources, options, createdAt) returns an unsigned local report.
- [x] Write behavior tests for CSV parsing, cents/dates/currency validation, matching and ambiguity, totals and evidence.
- [x] Run focused tests and retain expected failure evidence before adding implementation.
- [x] Implement minimal domain functions and export them from the accounting package.
- [x] Run domain tests and adjacent accounting tests; commit.

### Task 2: Usable workspace and roadmap
Files: apps/web/src/modules/finance/accounting/BankReconciliationPage.tsx; App.tsx; FinanceControlCenterPanel.tsx; registry.ts; navigation/atlasNavigation.ts; tests/integration/accounting-bank-reconciliation-ui.test.tsx; docs/roadmaps/2026-11-16-future-initiatives.md.
Consumes Task 1 interfaces. Produces /finance/accounting/reconciliation with two file inputs, validated import state, comparison, clear, CSV template downloads and full JSON export.
- [x] Write real-component tests for empty/import/compare/error/reset/race/export behavior; observe failure.
- [x] Implement UI and navigation using existing classes and file-byte SHA-256.
- [x] Document all six tracks with reused modules, acceptance evidence, next steps and actual dependencies.
- [ ] Run focused UI/domain checks, typecheck, npm test and production build; inspect affected route at mobile/desktop sizes.
- [x] Review the branch; fix material findings with failing regression tests; commit and prepare a draft PR through authorized tooling.
- [ ] Record CI and production dependencies separately; do not represent pending gates as passed.

Local full tests, typecheck and build passed. Local browser access was blocked; the existing accessibility workflow now owns the browser acceptance fixture and route audit. Wait for its evidence before claiming responsive/browser acceptance.
