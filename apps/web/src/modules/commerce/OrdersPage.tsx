import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CommerceApiError, commerceApi } from './commerceApi';

type CommerceOrderView = {
  id: string;
  storefront_id: string;
  customer_ref: string | null;
  channel: string;
  state: string;
  payment_state: string;
  fulfillment_state: string;
  currency: string;
  total_minor: string | number;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

function money(amountMinor: string | number, currency: string) {
  const amount = Number(amountMinor);
  if (!Number.isFinite(amount)) return `${currency} —`;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(amount / 100);
}

export function OrdersPage() {
  const [orders, setOrders] = useState<CommerceOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    commerceApi<{ orders: CommerceOrderView[] }>('orders.list')
      .then((result) => {
        if (!active) return;
        setOrders(Array.isArray(result.orders) ? result.orders : []);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof CommerceApiError
            ? caught.message
            : 'Commerce orders are unavailable'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="commerce-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Commerce · Orders</p>
        <h1>Orders</h1>
        <p>Business, payment and fulfillment state remain separate so blocked integrations cannot masquerade as successful execution.</p>
      </header>

      {loading ? <div className="notice">Loading orders…</div> : null}
      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {!loading && !error && orders.length === 0 ? (
        <div className="empty-state">
          <strong>No orders</strong>
          <span>No Commerce orders were returned for this organization.</span>
        </div>
      ) : null}

      {!loading && !error && orders.length > 0 ? (
        <div className="commerce-list">
          {orders.map((order) => (
            <Link className="commerce-record commerce-record-link" key={order.id} to={`/commerce/orders/${order.id}`}>
              <div>
                <span className="eyebrow">{order.channel}</span>
                <h2>Order {order.id}</h2>
                <p>{money(order.total_minor, order.currency)}</p>
              </div>
              <dl>
                <div><dt>Order</dt><dd>{order.state}</dd></div>
                <div><dt>Payment</dt><dd>{order.payment_state}</dd></div>
                <div><dt>Fulfillment</dt><dd>{order.fulfillment_state}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
