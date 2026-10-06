import { Link } from 'react-router-dom';
import { getCommercialCatalog } from '../../../../../packages/core/src/commercial';

function pricingLabel(mode: 'negotiated' | 'fixed') {
  return mode === 'negotiated' ? 'Negotiated' : 'Fixed';
}

export function CommercialPricingPage() {
  const catalog = getCommercialCatalog();

  return (
    <main className="commercial-page page-stack">
      <header className="page-header commercial-hero">
        <p className="eyebrow">ATLAS Enterprise Suite · Commercial catalog</p>
        <h1>ATLAS pricing</h1>
        <p>
          Choose the governed operating scope that matches your organization. Commercial terms come from the
          versioned ATLAS catalog; provider-gated and regulated capabilities remain separately verified.
        </p>
        <div className="commercial-actions">
          <Link className="action-link" to="/request-demo">Request a demo</Link>
          <Link className="action-link" to="/security">Review security</Link>
        </div>
      </header>

      <section className="commercial-offer-grid" aria-label="ATLAS commercial offers">
        {catalog.offers.map((offer) => (
          <article className="feature-card commercial-offer" key={offer.id}>
            <p className="eyebrow">{pricingLabel(offer.pricing.pricing_mode)} · {offer.pricing.currency}</p>
            <h2>{offer.name}</h2>
            <p>{offer.description}</p>
            <dl className="commercial-terms">
              <div><dt>Billing</dt><dd>{offer.pricing.billing_period}</dd></div>
              <div><dt>Minimum term</dt><dd>{offer.pricing.minimum_term_months} month{offer.pricing.minimum_term_months === 1 ? '' : 's'}</dd></div>
              <div><dt>Implementation</dt><dd>{offer.pricing.implementation_fee_mode}</dd></div>
              <div><dt>Support</dt><dd>{offer.pricing.support_tier}</dd></div>
            </dl>
            <p className="commercial-boundary">
              {offer.pricing.base_price == null
                ? 'Final price is established by an approved commercial order; no public list price is asserted.'
                : `Catalog base price: ${offer.pricing.currency} ${offer.pricing.base_price}.`}
            </p>
            <Link className="action-link" to="/request-demo">Discuss {offer.name}</Link>
          </article>
        ))}
      </section>

      <div className="notice">
        Catalog {catalog.catalog_version} · effective {catalog.effective_date}. A published offer does not by itself
        prove the current production release is commercially SELLABLE; the Commercial Release Gate remains fail-closed.
      </div>
    </main>
  );
}
