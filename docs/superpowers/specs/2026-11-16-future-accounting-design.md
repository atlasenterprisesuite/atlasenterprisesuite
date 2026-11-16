# Future initiatives: first verifiable accounting delivery

Date: 2026-11-16. Base: main f632c3140e20e99b34808682f3109f24146078b4.

## Intent
Turn the six researched future trends into work inside the existing ATLAS platform. Begin with a usable accounting capability relevant to the owner's experience; retain a dependency-aware roadmap for robotics, health, connectivity, energy and climate. A roadmap is not an implemented capability.

## Existing architecture and approach
Reuse packages/accounting, the React finance shell, its navigation graph, existing test/build scripts and canonical release pipeline. Finance currently reads registered bank/reconciliation sessions but has no statement comparison engine or import workspace. Existing payables, receivables and invoice ingestion remain unchanged.

Decision by implementer under the user's autonomous-execution instruction: add a local file comparison workspace at /finance/accounting/reconciliation. Alternatives were a new standalone app (duplicates the platform) and direct bank/ledger writes (requires verified provider access, authorization and a separate governed persistence contract). Local processing delivers useful functionality without inventing those integrations.

## Behavior and acceptance
- Two user-selected UTF-8 CSV files, each at most 2 MiB and 10,000 data rows. Required headers: id,date,amount,currency; optional reference,description. Reject unknown/duplicate headers, malformed quoting, inconsistent columns, duplicate/blank ids, impossible calendar dates, non-decimal or sub-cent amounts and unsafe integer arithmetic. Support BOM, CRLF, quoted delimiters, escaped quotes and quoted line breaks.
- Amount is signed from the cash-account perspective, with no thousands separators and at most two fractional digits. Store integer minor units. This first release supports currencies with two minor digits: USD, EUR, GBP, CAD and AUD. Both files must use one identical currency. No FX conversion or debit/credit inversion is inferred.
- Propose a pair only for equal signed amounts, equal nonempty references (trimmed/case-insensitive), dates within the selected 0–30 calendar-day window and mutually unique candidates. Many-to-one/one-to-many cases remain ambiguous; never silently discard duplicates or reuse a movement.
- Report proposals, bank/ledger exceptions, totals and difference. A zero difference is not approval. Every result requires human review.
- Export JSON containing normalized input rows, source filenames, SHA-256 of original file bytes, method/window, timestamp, full comparison and explicit local/unverified status. The export is unsigned and not a server audit record.
- Keep financial files in page memory only; no browser persistence, external requests, auto-posting, payments, bank connections or fabricated tenant identity. Clearing or replacing a source invalidates previous results. Guard asynchronous file selection so stale reads cannot overwrite a later selection or clear.
- Link the workspace from finance/accounting and the existing navigation graph. Reuse established layout classes; provide labels, status/error announcements, mobile overflow handling and keyboard-operable controls.

## Delivery boundary
Run meaningful parser/matching/UI tests, repository typecheck, full tests and build. Record all baseline failures. Source completion, PR creation, CI, merge, deployment and exact-SHA production verification are separate evidence states. No production claim without the existing 777 gates.

The new public route belongs to the existing P0 contract. If a classified edge challenge invokes the existing authorized fallback, its consumer must require this route's own HTTP 200, a nonempty observed version identity and the exact expected commit tag. Aggregate module booleans alone cannot certify it. An older deployed verifier without that proof must fail closed until updated.
