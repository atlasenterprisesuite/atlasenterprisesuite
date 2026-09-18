import { Link } from 'react-router-dom';
import { AW_FINANCE_FIRM, BRAND_PRINT_PROMO_DELIVERABLES, BUSINESS_LAUNCH_360, calculateLaunchReadiness } from '../../../../../packages/advisory/src';

const emptyEvidence = {
  business_setup:false, brand:false, website:false, contact_channels:false, crm:false,
  payments:false, accounting:false, marketing:false, compliance:false, analytics:false
} as const;

export function AdvisoryOfficePage() {
  const readiness = calculateLaunchReadiness(emptyEvidence);
  return <section className="page-stack">
    <header className="page-header">
      <p className="eyebrow">ATLAS Advisory Office</p>
      <h1>{AW_FINANCE_FIRM.name}</h1>
      <p>Firm #{AW_FINANCE_FIRM.firmNumber} · Client and engagement operations with governed launch, billing, compliance and portal boundaries.</p>
    </header>
    <div className="notice">No client, revenue, invoice or readiness metric is fabricated. Production records appear only after authenticated persistence is connected.</div>
    <div className="stat-grid">
      <article><strong>0</strong><span>active clients recorded</span></article>
      <article><strong>0</strong><span>open engagements recorded</span></article>
      <article><strong>{readiness.score}</strong><span>Launch Readiness evidence score</span></article>
      <article><strong>001</strong><span>firm number</span></article>
    </div>
    <div className="module-grid">
      <article className="module-card enabled"><span>Firm operations</span><strong>Clients & Engagements</strong><p>Firm → Client → Engagement is the governed Advisory hierarchy. Persistence is gated until the organization-scoped backend is wired.</p></article>
      <article className="module-card enabled"><span>Service catalog</span><strong>{BUSINESS_LAUNCH_360.name}</strong><p>{BUSINESS_LAUNCH_360.phases.length} evidence-driven phases from foundation through the 30-day review.</p></article>
      <article className="module-card enabled"><span>Physical + digital</span><strong>Brand, Print & Promotional Launch</strong><p>{BRAND_PRINT_PROMO_DELIVERABLES.length} approved deliverable categories with proof approval required before vendor ordering.</p></article>
      <article className="module-card disabled" aria-disabled="true"><span>Client Portal</span><strong>Identity + persistence gated</strong><p>Portal access remains closed until authenticated client scope and durable organization persistence are verified.</p></article>
      <article className="module-card disabled" aria-disabled="true"><span>Billing bridge</span><strong>Accounting event boundary</strong><p>Invoices and payments remain in Finance/Accounting. Advisory links them by firm, client and engagement without creating a second ledger.</p></article>
      <article className="module-card disabled" aria-disabled="true"><span>Print vendors</span><strong>Provider authorization required</strong><p>No order, shipment or fulfillment state is shown without provider evidence or verified manual entry.</p></article>
    </div>
    <article className="feature-card wide">
      <p className="eyebrow">Business Launch 360</p><h2>Launch operating system</h2>
      <p>Foundation → Brand → Website → CRM & Sales → Brand, Print & Promo → Marketing → Launch → 30-Day Review.</p>
      <p>Launch fee, monthly management, media spend and print/production costs remain separate billing components.</p>
    </article>
    <Link className="text-link" to="/business">Return to Business Suite</Link>
  </section>;
}
