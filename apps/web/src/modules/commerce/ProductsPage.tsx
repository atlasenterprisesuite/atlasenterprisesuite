import { useEffect, useMemo, useState } from 'react';
import { CommerceApiError, commerceApi } from './commerceApi';

type CommerceProductView = {
  id: string;
  storefront_id: string;
  title: string;
  slug: string;
  description: string | null;
  state: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function ProductsPage() {
  const [products, setProducts] = useState<CommerceProductView[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    commerceApi<{ products: CommerceProductView[] }>('catalog.list')
      .then((result) => {
        if (!active) return;
        setProducts(Array.isArray(result.products) ? result.products : []);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof CommerceApiError
            ? caught.message
            : 'Commerce catalog is unavailable'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) =>
      [product.title, product.slug, product.description || '', product.state]
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [products, query]);

  return (
    <section className="commerce-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Commerce · Catalog</p>
        <h1>Products</h1>
        <p>Source-backed catalog records for the active ATLAS organization.</p>
      </header>

      <label className="commerce-search">
        <span>Search products</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, slug, state"
        />
      </label>

      {loading ? <div className="notice">Loading products…</div> : null}
      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="empty-state">
          <strong>{query.trim() ? 'No matching products' : 'No products'}</strong>
          <span>{query.trim() ? 'Change the search to view returned catalog records.' : 'No catalog records were returned for this organization.'}</span>
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <div className="commerce-list">
          {filtered.map((product) => (
            <article className="commerce-record" key={product.id}>
              <div>
                <span className="eyebrow">{product.state}</span>
                <h2>{product.title}</h2>
                <p>{product.description || 'No product description provided.'}</p>
              </div>
              <dl>
                <div><dt>Slug</dt><dd>{product.slug}</dd></div>
                <div><dt>Storefront</dt><dd>{product.storefront_id}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
