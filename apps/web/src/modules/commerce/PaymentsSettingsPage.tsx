import { useEffect, useState } from 'react';
import { CommerceApiError, commerceApi } from './commerceApi';

type PaymentStatusResponse = {
  provider: {
    id: string;
    displayName: string;
    enabled: boolean;
    credentialsConfigured: boolean;
    environment: 'sandbox' | 'production';
    currency: string;
    ready: boolean;
    tokenization: string;
    storesRawBankData: boolean;
  };
};

export function PaymentsSettingsPage() {
  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    commerceApi<PaymentStatusResponse>('payments.status')
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
            : 'Payment provider status is unavailable'
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
        <p className="eyebrow">ATLAS Commerce · Payments</p>
        <h1>Payment providers</h1>
        <p>Authorize.net eCheck.Net is integrated behind a fail-closed provider boundary.</p>
      </header>

      {loading ? <div className="notice">Checking provider readiness…</div> : null}
      {error ? <div className="notice strong" role="alert">{error}</div> : null}

      {data ? (
        <section className="commerce-panel payment-provider-card">
          <div className="payment-provider-heading">
            <div>
              <span className="eyebrow">ACH / eCheck</span>
              <h2>{data.provider.displayName}</h2>
            </div>
            <strong className={data.provider.ready ? 'provider-ready' : 'provider-blocked'}>
              {data.provider.ready ? 'Server ready' : 'Setup required'}
            </strong>
          </div>

          <dl className="payment-provider-facts">
            <div><dt>Feature gate</dt><dd>{data.provider.enabled ? 'Enabled' : 'Disabled'}</dd></div>
            <div><dt>Credentials</dt><dd>{data.provider.credentialsConfigured ? 'Configured' : 'Missing'}</dd></div>
            <div><dt>Environment</dt><dd>{data.provider.environment}</dd></div>
            <div><dt>Currency</dt><dd>{data.provider.currency}</dd></div>
            <div><dt>Tokenization</dt><dd>Accept.js opaque nonce</dd></div>
            <div><dt>Raw bank data in ATLAS</dt><dd>{data.provider.storesRawBankData ? 'Stored' : 'Not stored'}</dd></div>
          </dl>

          <div className="notice">
            The server adapter remains blocked until eCheck.Net is approved and the organization-scoped credentials are present in ATLAS Vault. Public storefront eCheck checkout stays disabled until the customer tokenization and post-settlement reconciliation flows are also enabled.
          </div>

          <a
            className="commerce-provider-link"
            href="https://account.authorize.net/"
            target="_blank"
            rel="noreferrer"
          >
            Open Authorize.net merchant account
          </a>
        </section>
      ) : null}
    </section>
  );
}
