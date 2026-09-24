import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type CartLine = {
  variantId: string;
  title: string;
  sku: string;
  quantity: number;
  priceMinor: number;
  currency: string;
};

const CART_KEY = 'atlas-commerce-public-cart';

function readCart(): CartLine[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function PublicCartPage() {
  const { storefrontSlug = '' } = useParams();
  const [lines, setLines] = useState<CartLine[]>(readCart);

  const displayTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0),
    [lines]
  );
  const currency = lines[0]?.currency || 'USD';

  const persist = (next: CartLine[]) => {
    setLines(next);
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
  };

  return (
    <main className="public-commerce">
      <nav className="public-commerce-breadcrumbs">
        <Link to={`/shop/${storefrontSlug}`}>Continue shopping</Link>
      </nav>
      <header className="public-commerce-header">
        <div>
          <p className="public-commerce-eyebrow">ATLAS Commerce</p>
          <h1>Cart</h1>
          <p>Display totals are provisional. Server checkout remains authoritative.</p>
        </div>
      </header>

      {lines.length === 0 ? (
        <section className="public-commerce-state">Your cart is empty.</section>
      ) : (
        <section className="public-cart-lines">
          {lines.map((line) => (
            <article key={line.variantId}>
              <div>
                <strong>{line.title}</strong>
                <span>{line.sku}</span>
              </div>
              <div className="public-cart-actions">
                <span>{line.quantity} × {formatMoney(line.priceMinor, line.currency)}</span>
                <button
                  type="button"
                  onClick={() => persist(lines.filter((item) => item.variantId !== line.variantId))}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
          <div className="public-cart-total">
            <span>Display total</span>
            <strong>{formatMoney(displayTotal, currency)}</strong>
          </div>
        </section>
      )}

      <section className="public-checkout-blocker" role="status">
        <h2>Checkout unavailable</h2>
        <p>A live payment provider is not configured for public Commerce checkout. ATLAS will not fabricate payment authorization or order success.</p>
      </section>
    </main>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100);
}
