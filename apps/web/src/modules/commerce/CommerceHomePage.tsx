import { Link } from 'react-router-dom';

export function CommerceHomePage() {
  return (
    <section className="commerce-page page-stack">
      <header className="page-header">
        <p className="eyebrow">Business · ATLAS Commerce</p>
        <h1>ATLAS Commerce</h1>
        <p>Governed catalog and order operations using server-authoritative pricing, tenant scope and truthful provider state.</p>
      </header>

      <div className="module-grid">
        <Link className="module-card enabled" to="/commerce/products">
          <span>Catalog</span>
          <strong>Products</strong>
          <p>Review organization-scoped products and publication state.</p>
        </Link>
        <Link className="module-card enabled" to="/commerce/orders">
          <span>Orders</span>
          <strong>Orders</strong>
          <p>Inspect order, payment, fulfillment and downstream integration states separately.</p>
        </Link>
      </div>

      <div className="notice">
        Payment and downstream integrations remain fail-closed until an authorized provider or canonical writer is configured.
      </div>
    </section>
  );
}
