import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommerceApiError, publicCommerceApi } from '../commerceApi';
import type { PublicProduct, PublicStorefront, PublicVariant } from './types';

type CartLine = {
  variantId: string;
  title: string;
  sku: string;
  quantity: number;
  priceMinor: number;
  currency: string;
};

const CART_KEY = 'atlas-commerce-public-cart';

function addToLocalCart(line: CartLine) {
  let current: CartLine[] = [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]');
    current = Array.isArray(parsed) ? parsed : [];
  } catch {
    current = [];
  }
  const existing = current.find((item) => item.variantId === line.variantId);
  const next = existing
    ? current.map((item) => item.variantId === line.variantId
      ? { ...item, quantity: item.quantity + 1 }
      : item)
    : [...current, line];
  sessionStorage.setItem(CART_KEY, JSON.stringify(next));
}

export function PublicProductPage() {
  const { storefrontSlug = '', productSlug = '' } = useParams();
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [selected, setSelected] = useState<PublicVariant | null>(null);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    publicCommerceApi<{ storefront: PublicStorefront; product: PublicProduct }>(
      'storefront.product',
      { storefrontSlug, productSlug }
    )
      .then((result) => {
        if (!active) return;
        if (result.product.state !== 'published') {
          throw new CommerceApiError({ message: 'product_not_found', status: 404, code: 'product_not_found' });
        }
        setStorefront(result.storefront);
        setProduct(result.product);
        setSelected(result.product.variants?.find((variant) => variant.state === 'published') || null);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof CommerceApiError ? caught.message : 'Product unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [storefrontSlug, productSlug]);

  return (
    <main className="public-commerce">
      <nav className="public-commerce-breadcrumbs">
        <Link to={`/shop/${storefrontSlug}`}>{storefront?.name || 'Store'}</Link>
        <Link to={`/shop/${storefrontSlug}/cart`}>Cart</Link>
      </nav>

      {loading ? <section className="public-commerce-state">Loading product…</section> : null}
      {error ? <section className="public-commerce-state error" role="alert">{error}</section> : null}

      {product ? (
        <section className="public-product-detail">
          <div className="public-product-media large">
            {product.media?.length
              ? product.media.map((media) => (
                <span key={media.id}>{media.asset_source}:{media.asset_id}</span>
              ))
              : <span>No media</span>}
          </div>
          <div>
            <p className="public-commerce-eyebrow">Published product</p>
            <h1>{product.title}</h1>
            <p>{product.description || 'No description provided.'}</p>

            {product.variants?.length ? (
              <label className="public-variant-select">
                <span>Variant</span>
                <select
                  value={selected?.id || ''}
                  onChange={(event) => {
                    setSelected(product.variants.find((variant) => variant.id === event.target.value) || null);
                    setAdded(false);
                  }}
                >
                  {product.variants
                    .filter((variant) => variant.state === 'published')
                    .map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.title} · {formatMoney(variant.price_minor, variant.currency)}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <button
              className="public-commerce-button"
              type="button"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                addToLocalCart({
                  variantId: selected.id,
                  title: product.title,
                  sku: selected.sku,
                  quantity: 1,
                  priceMinor: Number(selected.price_minor),
                  currency: selected.currency
                });
                setAdded(true);
              }}
            >
              Add to cart
            </button>
            {added ? <p role="status">Added to cart.</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} —`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
}
