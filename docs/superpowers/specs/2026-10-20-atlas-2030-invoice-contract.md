# ATLAS 2030 Invoice (Template 10) — Implementation Contract (2026-10-20)

Status: PARTIAL UI IMPLEMENTATION / NOT PRODUCTION READY. Owner selection: template **10 ATLAS 2030** supersedes **02 Midnight Tech** and **01 Executive Classic**. Scope is an enhancement of canonical Accounting and Receivables, not a new ledger.

## Verified repository integration points (main at inspection)
- `apps/web/src/lib/receivablesApi.ts`: authenticated/RLS-scoped customers, invoices, invoice lines, payments, `issueInventoryInvoice` (RPC `issue_inventory_invoice_v1`), and `recordReceivablesPayment`.
- `packages/accounting/src/invoiceIngestion.ts`: normalized sale/purchase invoice totals and balanced draft journals.
- `apps/web/src/modules/inventory/ProcureToPayPage.tsx`: purchasing receipts and weighted-average inventory cost.
- `supabase/migrations/20260920190000_procure_to_pay_inventory_margin.sql`: existing inventory/COGS infrastructure.
- `supabase/migrations/20260920193000_invoice_line_issue_guard_fix.sql`: draft-only invoice line updates.

## Presentation
- Reuse existing invoice IDs, organization/client IDs, lines, fiscal posting and immutable issued invoice snapshots.
- ATLAS 2030 style: deep blue / navy / teal accents, white print background, legible contrast >= WCAG AA, responsive single-column mobile, A4/Letter and 80mm receipt-specific print CSS; no low-contrast ink-heavy printed invoices.
- Render EN/ES labels from a single semantic data model, locale-specific number/date/currency formatting, immutable amounts; translations must never alter computations.
- Header: approved ATLAS logo, legal issuer name, verified tax ID (EIN only if legally/operationally appropriate), billing address, email and verified phone; customer legal name, billing/shipping address, contact, customer PO, issuer reference, invoice number, issue/due dates, payment terms, currency, seller/contact.
- Item table: SKU/service code, description, quantities, units, unit price, discounts, taxable base, tax jurisdiction/rate/tax amount, line totals. Document total, paid, remaining, refunds/credits.
- Branded QR: server-issued opaque random token linking to an authenticated, tenant-scoped invoice view; separate provider-authorized hosted payment link when configured. No bank credentials, session tokens, taxpayer IDs or personal data encoded in QR. Expiration/revocation/audit. No 'pay now' when provider readiness is absent.
- Signing: use verifiable document digest + signer identity, timestamp, certificate/trust validation policy; only claim *digital signature* when actually performed, otherwise clearly label approval/unsigned. Preserve signed PDF hash and attached supporting documents with RBAC-scoped storage, scanning and integrity checks.
- Banking instructions are verified organization-configured accounts only, never fabricated; prohibit silent changes after issue without approval, preserve audit trail. Credit/debit, ACH, check, bank transfer, and crypto are optional provider-gated payment rails, not presumed live.
- Country profiles control local mandatory fields, tax rates/exemptions/e-invoicing, invoice series, and retention. Fail closed on unknown tax status; do not default to tax-exempt. Protect PII.
- Printable docs: semantic HTML, accessible reading order, keyboard navigable preview, tagged PDF requirement, accessible text and high-contrast 80mm receipt.

## Canonical lifecycle / accounting invariants
1. CRM request -> quotation -> acceptance/customer PO -> sales order -> warehouse reservation -> receipt/fulfillment -> invoice issue -> settlement.
2. Inventory purchases post to inventory/AP only from validated receipts/vendor bills, with three-way match PO/receipt/bill and proper costing; receiving and vendor bill must not double debit inventory.
3. The customer sales PO is not a vendor purchasing PO. Reservation is not COGS. Physical fulfillment and transfer-of-control rules govern inventory decrement + COGS posting; pure services do not consume stock.
4. Invoice issue posts AR debit + revenue credit + tax liability credit *exactly once* when recognition conditions are met; inventory movement posts COGS debit + inventory credit *exactly once*. Reuse existing authoritative procedures; never post twice from UI rendering, downloads, webhooks or retries.
5. Payment settlement posts cash/clearing debit, processor fee debit when applicable, AR credit, reconciles net deposits, and maintains payment-specific processor IDs/idempotency keys.
6. Issued financial facts are immutable; voids, credit notes, reversals, discounts, returns and refunds create referenced adjusting documents and journals. Closed periods cannot be silently changed.
7. Tenant/org/RBAC/RLS checked server side on every read, write, attachment, payment and print link. Enforce unique (org, invoice_number), immutable snapshots and a monotonically chained audit log or equivalent cryptographic integrity evidence.

## Acceptance tests (P0 must block)
- P0: cross-tenant invoice/QR/document accesses rejected; invalid/revoked/expired tokens rejected.
- P0: duplicate issue, payment callback, fulfillment and concurrent retries never double-post AR/revenue/inventory/COGS.
- P0: every journal balanced; taxes and line-item sums reconcile; credit memos do not overwrite originals; negative stock prevention obeys configured policy.
- P0: unsigned document never labeled digitally signed, payment button disabled without verified provider; banking instructions cannot be injected by client-controlled invoice fields.
- P0: rate/exemption jurisdiction unresolved -> block issue and show reason; multi-currency conversion uses persisted authoritative rates.
- P0: period locks and tenant permissions respected; original PDF/export hash and audit records reproducible.
- P1: EN/ES linguistic review, WCAG keyboard/screen-reader/contrast, mobile/tablet/desktop, Letter/A4 and 80mm thermal printer rendering verified.
- P1: CSV/XLSX/PDF export numbers match canonical ledger to cent; customer statement and AP/AR aging reconcile.

## Development sequencing
1. Inspect actual AR UI/print components, migrations, tests and design tokens; reuse before editing.
2. Add pure, tested invoice presentation view model that receives canonical issued invoice snapshots; no accounting side effects.
3. Build accessible ATLAS 2030 browser/print/PDF renderers with provider-gated QR, banking instructions and signed document artifact.
4. Wire existing RLS-scoped AR route and issue/fulfill/pay events; add guards or migrations only for fields demonstrably missing.
5. Run typecheck, unit tests, integration tests, build, security tests and mobile print checks; open PR with evidence.
6. Run CI and E2E on deployed SHA; confirm Cloudflare production, canonical main exact SHA, tax/legal configurations before declaring live.

## Implementation progress (review branch only)
- Added `apps/web/src/lib/invoice2030.ts`: pure, read-only, organization-scoped presentation model validating line totals to the cent.
- Added `apps/web/src/modules/finance/accounting/AtlasInvoice2030.tsx` and CSS: EN/ES selector, ATLAS-branded printable invoice view, mobile and 80mm receipt layout (printer hardware not validated).
- Wired presentation to existing `ReceivablesPage`. Printing has no financial side effects.
- Added `tests/unit/atlas-invoice-2030.test.tsx` for cross-organization rejections, amount mismatch, markup escaping, warning labels and non-posting behavior. Source is committed but CI execution is not yet attested.
- Replaced and removed superseded Midnight Tech component and tests on the same branch; one active invoice preview remains.
- The legal issuer address/EIN, customer billing/shipping addresses, customer purchase order, verified logo asset, signed PDF, encrypted/authorized attachments, jurisdiction tax profile, provider-created payment QR, banking instructions, fiscal/e-invoicing export and accessible tagged PDF are still **not integrated** in the persisted schema/UI.
- Until these gaps are closed, preview is intentionally stamped **INTERNAL PREVIEW — NOT VALID FOR CUSTOMER DELIVERY**, regardless of invoice status. No payment provider or signature authority is represented as active.

## Outstanding P0 and verification
- The current AR issuance path still needs verified country tax profile, legal issuer data and issue-time gates. This preview only fails closed on inconsistencies it can detect; it does not retroactively enforce missing accounting backend controls.
- Run repo typecheck, unit/integration, build and CI; inspect actual check outputs, printer layouts, and DB RPC idempotency; verify precise deployed SHA. This document alone cannot attest passing tests.
- No provider has been activated; no production financial records created; no deployment or production verification is claimed.
