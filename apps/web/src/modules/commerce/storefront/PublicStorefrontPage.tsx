import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommerceApiError, publicCommerceApi } from '../commerceApi';
import type { PublicProduct, PublicStorefront } from './types';

export function PublicStorefrontPage() {
  const { storefrontSlug = '' } = useParams();
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    publicCommerceApi<{ storefront: PublicStorefront; products: PublicProduct[] }>(
      'storefront.catalog',
      { storefrontSlug }
    )
      .then((result) => {
        if (!active) return;
        setStorefront(result.storefront);
        setProducts(
          Array.isArray(result.products)
            ? result.products.filter((product) => product.state === 'published')
            : []
        );
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof CommerceApiError ? caught.message : 'Storefront unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [storefrontSlug]);

  return (
    <main className="public-commerce">
      <header className="public-commerce-header">
        <div>
          <p className="public-commerce-eyebrow">ATLAS Commerce</p>
          <h1>{storefront?.name || (loading ? 'Storefront' : storefrontSlug)}</h1>
          <p>Published catalog from ATLAS Commerce.</p>
        </div>
        <Link className="public-commerce-cart-link" to={`/shop/${storefrontSlug}/cart`}>Cart</Link>
      </header>

      {loading ? <section className="public-commerce-state">Loading catalog…</section> : null}
      {error ? <section className="public-commerce-state error" role="alert">{error}</section> : null}
      {!loading && !error && products.length === 0 ? (
        <section className="public-commerce-state">No published products are available.</section>
      ) : null}

      <section className="public-product-grid">
        {products.map((product) => {
          const firstVariant = product.variants?.find((variant) => variant.state === 'published');
          const firstMedia = product.media?.[0];
          return (
            <Link
              className="public-product-card"
              key={product.id}
              to={`/shop/${storefrontSlug}/products/${product.slug}`}
            >
              <div className="public-product-media">
                {firstMedia ? (
                  <span>{firstMedia.asset_source}:{firstMedia.asset_id}</span>
                ) : (
                  <span>No media</span>
                )}
              </div>
              <div>
                <h2>{product.title}</h2>
                <p>{product.description || 'No description provided.'}</p>
                {firstVariant ? (
                  <strong>{formatMoney(firstVariant.price_minor, firstVariant.currency)}</strong>
                ) : (
                  <span>Price unavailable</span>
                )}
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function formatMoney(value: string | number, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} —`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
}
