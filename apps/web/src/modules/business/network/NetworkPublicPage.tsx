import { Link } from 'react-router-dom';

export type NetworkPublicSection = 'network' | 'pricing' | 'commissions' | 'payouts' | 'compliance';

type SectionDefinition = {
  route: string;
  eyebrow: string;
  title: string;
  description: string;
  evidence: string;
  controls: Array<{ label: string; detail: string }>;
};

const SECTIONS: Record<NetworkPublicSection, SectionDefinition> = {
  network: {
    route: '/business/network',
    eyebrow: 'ATLAS Business · Network',
    title: 'ATLAS Network',
    description:
      'Governed partner, attribution, pricing, commission, payout and compliance architecture with organization-scoped records.',
    evidence:
      'Live partner and attribution records require ATLAS Identity and the active organization. This public route exposes the capability contract only.',
    controls: [
      {
        label: 'Partner lifecycle',
        detail: 'Partner identity, status, country, payout currency, sponsor relationship and rank are organization scoped.'
      },
      {
        label: 'Referral attribution',
        detail: 'Referral links and customer attribution keep source, campaign, policy version and conversion evidence distinct.'
      },
      {
        label: 'No recruitment-only commission',
        detail: 'Partner enrollment does not create a fee, commission event or rank-production event.'
      }
    ]
  },
  pricing: {
    route: '/business/network/pricing',
    eyebrow: 'ATLAS Network · Commercial controls',
    title: 'Network Pricing',
    description:
      'Versioned price books and product pricing with currency, effective dates, commissionability and explicit approval state.',
    evidence:
      'Price-book and product-price records are tenant scoped. Public visitors are not shown organization pricing or internal commercial records.',
    controls: [
      {
        label: 'Versioned price books',
        detail: 'Draft, active and retired states preserve effective dates and approval evidence.'
      },
      {
        label: 'Currency evidence',
        detail: 'Non-USD pricing requires a positive FX rate, source and capture time before the contract is complete.'
      },
      {
        label: 'Commissionability boundary',
        detail: 'Products can be explicitly noncommissionable and may carry bounded product-level commission caps.'
      }
    ]
  },
  commissions: {
    route: '/business/network/commissions',
    eyebrow: 'ATLAS Network · Earnings ledger',
    title: 'Network Commissions',
    description:
      'Immutable commission-event architecture tied to verified customer-sale evidence, approved rules and bounded payout economics.',
    evidence:
      'No commission amount is presented here without authenticated organization data. Recruitment alone is not commissionable.',
    controls: [
      {
        label: 'Verified source transaction',
        detail: 'Commission posting requires a source transaction, source line, approved rule, positive commissionable revenue and margin evidence.'
      },
      {
        label: 'Funded pool caps',
        detail: 'Rule, product and contribution-margin caps constrain the total allocable commission pool.'
      },
      {
        label: 'Append-only reversal evidence',
        detail: 'Reversals create counter-events instead of deleting the original commission record.'
      }
    ]
  },
  payouts: {
    route: '/business/network/payouts',
    eyebrow: 'ATLAS Network · Settlement',
    title: 'Network Payouts',
    description:
      'Governed payout batches move through explicit review, approval, processing, paid, held, failed and reversal states.',
    evidence:
      'Settlement execution is not represented as live until an authorized provider reference and organization evidence exist.',
    controls: [
      {
        label: 'State machine',
        detail: 'Only approved payout-state transitions are accepted; arbitrary jumps are rejected by the backend contract.'
      },
      {
        label: 'Approval boundary',
        detail: 'Payout approval requires the network payout permission for the active organization.'
      },
      {
        label: 'Settlement evidence',
        detail: 'Paid and reversed states require a provider reference instead of relying on a UI-only status.'
      }
    ]
  },
  compliance: {
    route: '/business/network/compliance',
    eyebrow: 'ATLAS Network · Governance',
    title: 'Network Compliance',
    description:
      'Compliance events, partner restrictions and exceptional rank changes retain explicit evidence and audit context.',
    evidence:
      'Sensitive compliance records remain identity-, permission- and organization-gated. This public surface does not expose partner cases.',
    controls: [
      {
        label: 'Evidence-backed events',
        detail: 'Compliance events capture type, severity, status, evidence and any action taken.'
      },
      {
        label: 'Governed restrictions',
        detail: 'A compliance action can hold partner payouts without rewriting unrelated history.'
      },
      {
        label: 'Rank-change audit',
        detail: 'Manual rank changes require a reason and produce rank-history evidence instead of silently overwriting state.'
      }
    ]
  }
};

const NAV_ITEMS = Object.values(SECTIONS);

export function NetworkPublicPage({ section }: { section: NetworkPublicSection }) {
  const definition = SECTIONS[section];

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">{definition.eyebrow}</p>
        <h1>{definition.title}</h1>
        <p>{definition.description}</p>
      </header>

      <nav className="filter-row" aria-label="ATLAS Network sections">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.route}
            className={item.route === definition.route ? 'status-chip' : 'status-chip neutral'}
            to={item.route}
            aria-current={item.route === definition.route ? 'page' : undefined}
          >
            {item.title.replace('Network ', '')}
          </Link>
        ))}
      </nav>

      <div className="notice strong">
        <strong>Evidence boundary</strong>
        <p>{definition.evidence}</p>
      </div>

      <div className="module-grid">
        {definition.controls.map((control) => (
          <article className="module-card enabled" key={control.label}>
            <span>Governed contract</span>
            <strong>{control.label}</strong>
            <p>{control.detail}</p>
          </article>
        ))}
      </div>

      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Secure operations</p>
            <h2>Organization data stays behind ATLAS Identity</h2>
          </div>
          <span className="status-chip warning">Authentication required</span>
        </div>
        <p>
          Network partner records, organization pricing, commission events, payout batches and compliance
          cases are protected by organization membership, RBAC and row-level security. This route does not
          fabricate balances, earnings, partner counts or provider settlement state.
        </p>
        <div className="filter-row">
          <Link to={`/identity?app=${encodeURIComponent(definition.route)}`}>Authenticate for governed workspace →</Link>
          <Link to="/business">Back to Business Suite →</Link>
        </div>
      </article>
    </section>
  );
}
