import { ATLAS_PAY_PRINCIPLES } from '../../../../../packages/pay/src';

const CAPABILITIES = [
  {
    label: 'ATLAS Wallet',
    state: 'Control plane',
    description: 'Organization-scoped balances and wallet experience, with regulated custody remaining external-gated until verified.'
  },
  {
    label: 'ATLAS Issuing',
    state: 'Issuer-gated',
    description: 'Virtual, physical, business, payroll and vendor card contracts behind a replaceable authorized issuer adapter.'
  },
  {
    label: 'ATLAS Payouts',
    state: 'Provider-gated',
    description: 'Standard and instant payout orchestration with explicit eligibility, fee disclosure, routing and reconciliation.'
  },
  {
    label: 'ATLAS Financial Compliance',
    state: 'Coverage-gated',
    description: 'Provider authorization, KYC/KYB, regulatory coverage and audit evidence must be verified before money movement.'
  }
] as const;

export function AtlasPayPage() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Finance · Pay</p>
        <h1>ATLAS Pay & Issuing</h1>
        <p>
          Provider-neutral financial orchestration for wallets, issuing and payouts. ATLAS owns the
          control plane while regulated issuers, sponsor banks, processors and payment rails remain
          replaceable adapters.
        </p>
      </header>

      <div className="notice strong">
        External-gated: this surface does not claim a bank charter, live card issuance, direct rail
        access, deposit insurance, completed payout or settlement without authenticated provider evidence.
      </div>

      <div className="module-grid">
        {CAPABILITIES.map((capability) => (
          <article className="module-card enabled" key={capability.label}>
            <span>{capability.state}</span>
            <strong>{capability.label}</strong>
            <p>{capability.description}</p>
          </article>
        ))}
      </div>

      <article className="feature-card wide">
        <p className="eyebrow">Canonical architecture</p>
        <h2>One ATLAS financial control plane</h2>
        <p>
          Accounting remains the canonical general ledger. ATLAS Pay routes regulated actions through
          verified provider adapters, preserves idempotency and evidence, and sends confirmed financial
          events back to reconciliation and Accounting instead of maintaining a shadow ledger.
        </p>
      </article>

      <article className="feature-card wide">
        <p className="eyebrow">Fail-closed rules</p>
        <h2>Evidence before financial state</h2>
        <ul>
          {ATLAS_PAY_PRINCIPLES.map((principle) => <li key={principle}>{principle}</li>)}
        </ul>
      </article>

      <article className="feature-card wide">
        <p className="eyebrow">Evolution path</p>
        <h2>ATLAS Pay → ATLAS Issuing → licensed payments → optional banking charter</h2>
        <p>
          The software architecture is intentionally independent from any single processor. Stripe Connect,
          sponsor-bank issuing, ACH, RTP, FedNow or card-network access can be attached only when the
          corresponding authorization, credentials and regulatory coverage are verified.
        </p>
      </article>
    </section>
  );
}
