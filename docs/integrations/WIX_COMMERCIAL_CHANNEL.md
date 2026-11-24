# Wix Commercial Channel — ATLAS 777 REVIEW

Status: **IMPLEMENTING / NOT CONNECTED TO ATLAS**. Baseline inspected October 11, 2026.

## Architecture and ownership

- Canonical ATLAS repository: `atlasenterprisesuite/atlasenterprisesuite`; branch `main`.
- Primary delivery target: Cloudflare; business identity and governed data live in ATLAS's existing Supabase-backed tenant architecture.
- Wix is an **optional public commercial channel**, not a new ERP, tenant store, source of truth, identity provider, or production environment for ATLAS.
- Reuse `ATLAS_INTEGRATION_PROVIDERS`, `evaluateIntegrationExecutionGate`, the existing audit/permissions architecture and `ModuleExperiencePage`.
- The new `wix` provider registration identifies a possible provider only. It does **not** provision credentials, authenticate Wix, enable a webhook, synchronize customers, or establish live connectivity.
- Runtime capability checks remain denied until site-owner OAuth authorization, credential custody, provider verification, tenant scope and explicit capabilities all pass. Enforce RBAC and audit for writes. Only publicly approved marketing content may cross into Wix.
- Never send accounting, HR, payroll, health, customer tax documents, or other tenant-restricted data to a public Wix site.

## Wix inventory, independently inspected

Published: `Atlas Enterprise Sui` (Wix site ID `edf9e479-814e-423c-be2d-f9273611684b`), URL `https://winderaranguren.wixsite.com/atlas-enterprise-sui`, plan Free, Velo disabled.

- Eight published site's static page SEO records: Home, Platform, Solutions, Industries, AI, Security, Developers, Company.
- Existing apps: Wix Forms and Wix Invoices. Those apps being installed do **not** prove integrated ATLAS intake or billing.
- Wix regional setting corrected from `America/Chicago` to `America/New_York`; Wix settings snapshot version 15.
- SEO descriptions and page focus keywords saved successfully for eight pages **to Wix draft only** on Oct 11 (bulk metadata: 8 success, 0 failures). Do not claim public SEO is live.
- Related ATLAS Wix drafts S 1 (5 pages), S 2 (8 pages), S 3 (4 pages), with overlapping content. Reconcile before archiving or deleting anything.
- Separate AW Finance Advisory Wix draft has Wix Bookings, Members, Pricing Plans, Store Catalog V3, Forms, Invoices and other apps. Keep separate client site and consent boundary.

## Accessibility release gate

Wix Accessibility Scans API completed full-site audit on Oct 11, 2026 (scan `3b9d3f35-2f85-42a1-93b4-66c918bb826f`). All 8 pages scanned; none failed to scan. **35 findings, all serious**, spread across all eight pages:

| Page | Findings |
| --- | ---: |
| Platform | 7 |
| Home | 6 |
| Solutions | 5 |
| AI | 4 |
| Industries | 4 |
| Company | 3 |
| Developers | 3 |
| Security | 3 |

Classification: 16 heading-structure, 11 alternative-text, 8 color-contrast; 27 also involve screen reader coverage and overlap the previous categories (not additive). The scanner's read API **does not edit page elements**. Content issues that require determination of heading meaning or image purpose need editorial decisions; do not invent page content. Remediation:

1. Fix meaningful hierarchy (exactly one page-level H1, no skipped levels), confirm with page owners when intent is ambiguous (WCAG 1.3.1 / 2.4.6).
2. Describe informational images and mark purely decorative images appropriately (WCAG 1.1.1).
3. Repair text/background contrast to WCAG AA 1.4.3 and measure the final ratios.
4. Retest keyboard focus/skip link and screen reader behavior across all eight pages and all supported breakpoints.
5. Rerun full Wix scan with a **new** idempotency key; require zero serious findings before accessibility sign-off.

A passing automated scan by itself is insufficient for full human accessibility assurance.

## Production and operational gates

- **P0 ACCESSIBILITY: BLOCKED** until all 35 serious findings are corrected and new scan evidence exists.
- **P0 ATLAS INTEGRATION: BLOCKED**: Wix OAuth, tenant-scoped authorization, capability checks, secure webhooks/data transfer and E2E verification not yet implemented. Presence of the provider in the registry is not a live connection.
- **SEO: DRAFT ONLY**; pages should only be published after reviews, tests and source/content verification.
- **GOVERNANCE:** require PR, CI tests, release-manifest SHA, deployed-artifact SHA and public URL E2E before "FINAL PRODUCTION VERIFIED".
- Never redirect the canonical ATLAS production domain to Wix or duplicate ATLAS Auth and tenant tables.
- Data ownership, consent, webhook signing/replay protection, rate limits and idempotency are necessary before any Wix CRM/form/invoice bridge is enabled.

## Next implementation slice (not yet complete)

Design the least-privileged OAuth connection lifecycle, per-site registration and credential vault references. Establish a read-only `sites.read` capability first. Add signed webhook ingestion and public lead opt-in only after verification. Tests must demonstrate no cross-tenant data leakage, replay denial, no provider spoofing and fail-closed behavior with missing permissions. Add real status UI only when backed by runtime evidence.

**Last verified state:** Wix SEO draft save 8/8, Wix timezone updated, baseline scan 35 serious findings. No accessibility fix, production publication, or Wix-to-ATLAS live connection has been verified.
