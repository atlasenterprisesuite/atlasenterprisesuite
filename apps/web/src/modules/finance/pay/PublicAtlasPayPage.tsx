import { Link } from 'react-router-dom';
import './public-atlas-pay.css';

const capabilities = [
  {
    label: 'ATLAS Wallet',
    eyebrow: 'Unified experience',
    description: 'One governed wallet layer for compatible payment instruments and financial product access, with custody remaining external-gated until verified.'
  },
  {
    label: 'Accounts Center',
    eyebrow: 'Profiles & organizations',
    description: 'Organize personal, company, brand and creator financial contexts without creating a second identity or permission system.'
  },
  {
    label: 'Earnings & Rewards',
    eyebrow: 'Separated by design',
    description: 'Wallet balances, earnings, rewards and credits remain distinct, source-backed domains instead of being merged into one misleading total.'
  },
  {
    label: 'Payout Hub',
    eyebrow: 'Governed movement',
    description: 'Standard and instant payout orchestration with eligibility, routing, fee disclosure, reconciliation and provider evidence.'
  },
  {
    label: 'ATLAS Issuing',
    eyebrow: 'Cards & instruments',
    description: 'Virtual, physical, business, payroll and vendor card experiences designed behind replaceable authorized issuer adapters.'
  },
  {
    label: 'Security & Compliance',
    eyebrow: 'Identity-first',
    description: 'RBAC, RLS, audit evidence, approvals and regulatory gates protect consequential actions before any regulated capability can activate.'
  },
  {
    label: 'Financial Network',
    eyebrow: 'Provider-neutral rails',
    description: 'A long-term network architecture for authorized banks, processors, ACH, RTP, FedNow and card networks without hard-wiring ATLAS to one provider.'
  }
] as const;

const networkNodes = ['Identity', 'Wallet', 'Earnings', 'Issuing', 'Payouts', 'Accounting'] as const;

export function PublicAtlasPayPage() {
  const workspaceTarget = '/identity?app=%2Ffinance%2Fpay%2Fworkspace';

  return (
    <main className="atlas-pay-public">
      <header className="atlas-pay-public-nav">
        <Link to="/" className="atlas-pay-public-brand" aria-label="ATLAS Enterprise Suite home">
          <span className="atlas-pay-public-mark">A</span>
          <span><strong>ATLAS</strong><small>PAY</small></span>
        </Link>
        <nav aria-label="ATLAS Pay public navigation">
          <a href="#platform">Platform</a>
          <a href="#network">Network</a>
          <a href="#security">Security</a>
        </nav>
        <Link className="atlas-pay-public-nav-cta" to={workspaceTarget}>Sign in</Link>
      </header>

      <section className="atlas-pay-public-hero">
        <div className="atlas-pay-public-hero-copy">
          <p className="atlas-pay-public-eyebrow">ATLAS Financial Network · Provider-neutral by design</p>
          <h1>Money infrastructure for the ATLAS ecosystem.</h1>
          <p className="atlas-pay-public-lead">
            Wallets, accounts, earnings, issuing and payouts under one governed control plane.
            ATLAS coordinates the experience while regulated institutions and payment rails remain
            explicit, replaceable and evidence-gated.
          </p>
          <div className="atlas-pay-public-actions">
            <Link className="atlas-pay-public-primary" to={workspaceTarget}>Get started</Link>
            <a className="atlas-pay-public-secondary" href="#platform">Explore the platform</a>
          </div>
          <p className="atlas-pay-public-truth">
            No customer balance, provider credential or account identifier is exposed here. Public product
            presentation never implies custody, settlement, insurance, issuing approval or live money movement.
          </p>
        </div>

        <aside className="atlas-pay-public-visual" aria-label="ATLAS Pay control-plane visualization">
          <div className="atlas-pay-card-halo" aria-hidden="true" />
          <div className="atlas-pay-card">
            <div className="atlas-pay-card-top">
              <span>ATLAS</span>
              <span className="atlas-pay-card-chip" aria-hidden="true" />
            </div>
            <div className="atlas-pay-card-center">
              <small>FINANCIAL CONTROL PLANE</small>
              <strong>PAY</strong>
            </div>
            <div className="atlas-pay-card-bottom">
              <span>Wallet · Issuing · Payouts</span>
              <span>External-gated</span>
            </div>
          </div>
          <div className="atlas-pay-orbit atlas-pay-orbit-one" aria-hidden="true"><span>IDENTITY</span></div>
          <div className="atlas-pay-orbit atlas-pay-orbit-two" aria-hidden="true"><span>ACCOUNTING</span></div>
          <div className="atlas-pay-orbit atlas-pay-orbit-three" aria-hidden="true"><span>NETWORK</span></div>
        </aside>
      </section>

      <section className="atlas-pay-public-principles" aria-label="ATLAS Pay principles">
        <article><strong>Provider-neutral</strong><span>Replaceable external financial adapters</span></article>
        <article><strong>Evidence-backed</strong><span>No fabricated balances or provider states</span></article>
        <article><strong>Accounting-first</strong><span>One canonical general ledger</span></article>
        <article><strong>Fail-closed</strong><span>Regulated actions require verified gates</span></article>
      </section>

      <section className="atlas-pay-public-section" id="platform">
        <div className="atlas-pay-public-section-heading">
          <p className="atlas-pay-public-eyebrow">One financial control plane</p>
          <h2>Everything connected. Nothing falsely merged.</h2>
          <p>
            ATLAS Pay keeps product experiences unified while preserving hard boundaries between identity,
            source-backed balances, accounting books and external regulated execution.
          </p>
        </div>
        <div className="atlas-pay-public-capability-grid">
          {capabilities.map((capability, index) => (
            <article key={capability.label} className={index === 6 ? 'atlas-pay-public-capability atlas-pay-public-capability-wide' : 'atlas-pay-public-capability'}>
              <span>{capability.eyebrow}</span>
              <h3>{capability.label}</h3>
              <p>{capability.description}</p>
              <small>{index < 4 ? 'Control-plane capability' : 'Activation depends on verified external readiness'}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="atlas-pay-public-network" id="network">
        <div className="atlas-pay-public-network-copy">
          <p className="atlas-pay-public-eyebrow">ATLAS Financial Network</p>
          <h2>One path from identity to reconciliation.</h2>
          <p>
            ATLAS Pay does not create a shadow ledger. Confirmed financial events reconcile into ATLAS Accounting,
            while providers remain responsible for the regulated capabilities they are authorized to perform.
          </p>
          <div className="atlas-pay-public-rail-note">
            <span>Future-compatible rails</span>
            <strong>Authorized banks · Processors · ACH · RTP · FedNow · Card networks</strong>
          </div>
        </div>
        <div className="atlas-pay-public-network-map" aria-label="ATLAS Pay architecture flow">
          {networkNodes.map((node, index) => (
            <div className="atlas-pay-public-node" key={node}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{node}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="atlas-pay-public-security" id="security">
        <div>
          <p className="atlas-pay-public-eyebrow">Security & compliance</p>
          <h2>Financial access starts with governed identity.</h2>
        </div>
        <div className="atlas-pay-public-security-grid">
          <article><span>01</span><strong>Identity & RBAC</strong><p>Organization scope and canonical permissions control access.</p></article>
          <article><span>02</span><strong>Provider evidence</strong><p>Authorization, credentials and regulatory coverage must be verified.</p></article>
          <article><span>03</span><strong>Server-only writes</strong><p>Consequential financial mutations do not originate from unrestricted browser writes.</p></article>
          <article><span>04</span><strong>Audit & reconciliation</strong><p>Evidence and ambiguous outcomes remain traceable until resolved.</p></article>
        </div>
      </section>

      <section className="atlas-pay-public-cta">
        <p className="atlas-pay-public-eyebrow">Enter ATLAS Pay</p>
        <h2>Public outside. Governed inside.</h2>
        <p>
          Sign in to access your organization-scoped Accounts Center, balance evidence, provider readiness,
          wallet instruments and payout workflows.
        </p>
        <Link className="atlas-pay-public-primary" to={workspaceTarget}>Open ATLAS Pay workspace</Link>
      </section>

      <footer className="atlas-pay-public-footer">
        <Link to="/">ATLAS Enterprise Suite</Link>
        <span>ATLAS Pay · Financial orchestration, not a bank.</span>
        <Link to={workspaceTarget}>Sign in</Link>
      </footer>
    </main>
  );
}
