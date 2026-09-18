import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CommerceApiError, commerceApi } from './commerceApi';

type OrderDetailResponse = {
  order: {
    id: string;
    state: string;
    payment_state: string;
    fulfillment_state: string;
    currency: string;
    total_minor: string | number;
  };
  payments: Array<{ state: string; provider: string; provider_reference: string | null }>;
  deliveries: Array<{
    event_id: string;
    target_module: string;
    status: string;
    reason_code: string | null;
  }>;
};

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    commerceApi<OrderDetailResponse>('orders.get', { orderId: id })
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof CommerceApiError
            ? caught.message
            : 'Commerce order detail is unavailable'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  return (
    <section className="commerce-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Commerce · Orders</p>
        <h1>Order {id}</h1>
        <p>Authoritative order facts and downstream delivery state.</p>
      </header>

      {loading ? <div className="notice">Loading order…</div> : null}
      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {data ? (
        <>
          <div className="commerce-state-grid">
            <article><span>Business</span><strong>Order state: {data.order.state}</strong></article>
            <article><span>Payment</span><strong>Payment state: {data.order.payment_state}</strong></article>
            <article><span>Fulfillment</span><strong>Fulfillment state: {data.order.fulfillment_state}</strong></article>
          </div>

          <section className="commerce-panel">
            <h2>Integration delivery</h2>
            {data.deliveries.length === 0 ? (
              <div className="empty-state">
                <strong>No delivery records</strong>
                <span>No downstream delivery result has been recorded yet.</span>
              </div>
            ) : (
              <div className="commerce-list compact">
                {data.deliveries.map((delivery) => (
                  <article className="commerce-delivery" key={`${delivery.event_id}:${delivery.target_module}`}>
                    <strong>{delivery.target_module}: {delivery.status}</strong>
                    {delivery.reason_code ? <span>{delivery.reason_code}</span> : <span>No blocker code</span>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
