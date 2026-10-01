import { useEffect, useMemo, useState } from 'react';
import { ATLAS_PAY_PRINCIPLES } from '../../../../../packages/pay/src';
import { loadAtlasPaySnapshot, type AtlasPaySnapshot } from '../../../lib/payApi';

const CAPABILITIES = [
  {
    label: 'ATLAS Wallet',
    state: 'Control plane',
    description: 'Organization-scoped balances and wallet experience, with regulated custody remaining external-gated until verified.'
  },
  {
    label: 'ATLAS Issuing',
    state: 'Issuer-gated',
    description: 'Virtual, physical, business, payroll and vendor card contracts behind a replaceable authorized issuer adapter.'
  },
  {
    label: 'ATLAS Payouts',
    state: 'Provider-gated',
    description: 'Standard and instant payout orchestration with explicit eligibility, fee disclosure, routing and reconciliation.'
  },
  {
    label: 'ATLAS Financial Compliance',
    state: 'Coverage-gated',
    description: 'Provider authorization, KYC/KYB, regulatory coverage and audit evidence must be verified before money movement.'
  }
] as const;

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not verified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recorded' : date.toLocaleString();
}

export function AtlasPayPage() {
  const [snapshot, setSnapshot] = useState<AtlasPaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadAtlasPaySnapshot()
      .then((result) => {
        if (!active) return;
        setSnapshot(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSnapshot(null);
        setError(cause instanceof Error ? cause.message : 'atlas_pay_evidence_unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const verifiedProviders = useMemo(
    () => snapshot?.providers.filter((provider) =>
      provider.authorization_state === 'authorized'
      && provider.regulatory_coverage_state === 'verified'
      && Boolean(provider.credentials_verified_at)
    ) || [],
    [snapshot]
  );

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Finance · Pay</p>
        <h1>ATLAS Pay & Issuing</h1>
        <p>
          Provider-neutral financial orchestration for wallets, issuing and payouts. ATLAS owns the
          control plane while regulated issuers, sponsor banks, processors and payment rails remain
          replaceable adapters.
        </p>
      </header>

      <div className="notice strong">
        External-gated: this surface does not claim a bank charter, live card issuance, direct rail
        access, deposit insurance, completed payout or settlement without authenticated provider evidence.
      </div>

      {loading ? <div className="notice">Loading organization-scoped ATLAS Pay evidence…</div> : null}
      {error ? (
        <div className="notice strong" role="alert">
          Live provider evidence unavailable ({error}). No regulated capability is treated as ready.
        </div>
      ) : null}

      <div className="stat-grid" aria-label="ATLAS Pay live readiness">
        <article><strong>{snapshot ? snapshot.providers.length : '—'}</strong><span>provider records</span></article>
        <article><strong>{snapshot ? verifiedProviders.length : '—'}</strong><span>fully verified providers</span></article>
        <article><strong>{snapshot ? snapshot.instrumentIntents.length : '—'}</strong><span>instrument intents</span></article>
        <article><strong>{snapshot ? snapshot.payoutIntents.length : '—'}</strong><span>payout intents</span></article>
      </div>

      <div className="module-grid">
        {CAPABILITIES.map((capability) => (
          <article className="module-card enabled" key={capability.label}>
            <span>{capability.state}</span>
            <strong>{capability.label}</strong>
            <p>{capability.description}</p>
          </article>
        ))}
      </div>

      <article className="feature-card wide">
        <p className="eyebrow">Provider evidence</p>
        <h2>Verified connections only</h2>
        {!snapshot?.providers.length ? (
          <p>No authorized provider evidence is currently available for this organization.</p>
        ) : (
          <div className="module-grid compact">
            {snapshot.providers.map((provider) => (
              <article className="module-card enabled" key={provider.id}>
                <span>{provider.provider_kind} · {provider.environment}</span>
                <strong>{provider.provider_key}</strong>
                <p>Authorization: {provider.authorization_state}</p>
                <p>Regulatory coverage: {provider.regulatory_coverage_state}</p>
                <p>Credential evidence: {formatTimestamp(provider.credentials_verified_at)}</p>
                <p>Last verified: {formatTimestamp(provider.last_verified_at)}</p>
              </article>
            ))}
          </div>
        )}
      </article>

      <article className="feature-card wide">
        <p className="eyebrow">Canonical architecture</p>
        <h2>One ATLAS financial control plane</h2>
        <p>
          Accounting remains the canonical general ledger. ATLAS Pay routes regulated actions through
          verified provider adapters, preserves idempotency and evidence, and sends confirmed financial
          events back to reconciliation and Accounting instead of maintaining a shadow ledger.
        </p>
      </article>

      <article className="feature-card wide">
        <p className="eyebrow">Fail-closed rules</p>
        <h2>Evidence before financial state</h2>
        <ul>
          {ATLAS_PAY_PRINCIPLES.map((principle) => <li key={principle}>{principle}</li>)}
        </ul>
      </article>

      <article className="feature-card wide">
        <p className="eyebrow">Evolution path</p>
        <h2>ATLAS Pay → ATLAS Issuing → licensed payments → optional banking charter</h2>
        <p>
          The software architecture is intentionally independent from any single processor. Stripe Connect,
          sponsor-bank issuing, ACH, RTP, FedNow or card-network access can be attached only when the
          corresponding authorization, credentials and regulatory coverage are verified.
        </p>
      </article>
    </section>
  );
}
