import { useEffect, useState } from 'react';
import { ExecutionConfiguration } from './ExecutionConfiguration';
import { getEnterpriseCreditStatus, getEnterpriseUsage, type EnterpriseCreditStatus, type EnterpriseUsageReport } from './api';
import { WorkSubnav } from './WorkSubnav';

function recordedAt(value: string) {
  return new Date(value).toLocaleString();
}

export function WorkPoliciesPage() {
  const [report, setReport] = useState<EnterpriseUsageReport | null>(null);
  const [credit, setCredit] = useState<EnterpriseCreditStatus | null>(null);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [creditLoading, setCreditLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getEnterpriseUsage()
      .then((value) => { if (active) setReport(value); })
      .catch((caught) => {
        if (!active) return;
        setReport(null);
        setError(caught instanceof Error ? caught.message : 'enterprise_usage_unavailable');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    setCreditLoading(true);
    setCreditError(null);
    void getEnterpriseCreditStatus()
      .then((next) => { if (active) setCredit(next); })
      .catch((caught) => {
        if (!active) return;
        setCredit(null);
        setCreditError(caught instanceof Error ? caught.message : 'enterprise_credit_unavailable');
      })
      .finally(() => { if (active) setCreditLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Policies</h1><p>Current fail-closed defaults for new Work workflows. Provider authorization, permissions and approvals remain server-authoritative.</p></header>
      <WorkSubnav />
      <section className="execution-panel" aria-labelledby="work-default-policy-title">
        <h2 id="work-default-policy-title">Default execution policy</h2>
        <ExecutionConfiguration executionMode="hybrid" autonomyLevel="guided" runtimePreference="auto" budgetLimit={0} />
        <p className="notice">Autonomous never bypasses tenant scope, permissions, approval policy, execution envelopes, regulated-domain rules or the paid-provider budget.</p>
      </section>
      <section className="execution-panel" aria-labelledby="enterprise-usage-title">
        <h2 id="enterprise-usage-title">Enterprise usage transparency</h2>
        <p>Only your recorded AI requests for your authenticated organization are retrieved. This is not a credit balance or a billing statement.</p>
        <p className="notice">No paid AI credits are authorized by this Enterprise reporting control. A recorded balance never grants permission to call a provider; quota debit and collaborative sharing remain gated.</p>
        {creditLoading ? <p role="status" aria-live="polite">Checking authenticated credit ledger status…</p> : null}
        {creditError ? <p role="alert" className="work-error">Unable to verify credit ledger: {creditError}. Spending remains blocked.</p> : null}
        {credit && (credit.status === 'unconfigured' || credit.status === 'not_installed')
          ? <p className="notice">Credit limits are not configured in this integration. {credit.status === 'not_installed' ? 'The ledger schema is not installed or not exposed to the backend.' : 'No allocation exists for this UTC month.'}</p>
          : null}
        {credit ? (
          <dl className="work-preview-facts" aria-label="Authenticated credit ledger">
            <div><dt>Ledger status</dt><dd>{credit.status === 'allocated' ? 'Allocated' : credit.status === 'disabled' ? 'Disabled' : credit.status === 'not_installed' ? 'Unavailable' : 'Not configured'}</dd></div>
            <div><dt>Period</dt><dd>{credit.period}</dd></div>
            <div><dt>Internal credit limit</dt><dd>{credit.limitCredits ?? '—'}</dd></div>
            <div><dt>Reserved / used</dt><dd>{credit.reservedCredits ?? '—'} / {credit.spentCredits ?? '—'}</dd></div>
            <div><dt>Available internal credits</dt><dd>{credit.availableCredits ?? '—'}</dd></div>
            <div><dt>Paid provider execution</dt><dd>Blocked until separately authorized</dd></div>
          </dl>
        ) : null}
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || creditLoading}>
          {loading || creditLoading ? 'Loading…' : 'Refresh recorded activity'}
        </button>
        {loading ? <p role="status" aria-live="polite">Loading authenticated usage…</p> : null}
        {error ? <p role="alert" className="work-error">Unable to verify usage: {error}. No activity or credit balance is being inferred.</p> : null}
        {report ? (
          <>
            <dl className="work-preview-facts">
              <div><dt>UTC month</dt><dd>{report.period}</dd></div>
              <div><dt>Recorded requests</dt><dd>{report.eventCount.toLocaleString()}</dd></div>
              <div><dt>Paid execution</dt><dd>Not authorized by this control</dd></div>
            </dl>
            <h3>Recent recorded activity</h3>
            {report.recentEvents.length === 0
              ? <p>No AI usage records were found for your account in the current UTC month.</p>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th scope="col">Recorded at</th><th scope="col">Task class</th><th scope="col">Status</th><th scope="col">Tokens in / out</th><th scope="col">Estimated USD</th></tr></thead>
                    <tbody>
                      {report.recentEvents.map((item) => (
                        <tr key={item.id}>
                          <td>{recordedAt(item.createdAt)}</td>
                          <td>{item.taskClass ?? '—'}</td>
                          <td>{item.status ?? '—'}</td>
                          <td>{item.inputTokens ?? '—'} / {item.outputTokens ?? '—'}</td>
                          <td>{item.estimatedCostUsd === null ? '—' : `$${item.estimatedCostUsd}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            {!report.sampleIsComplete ? <p className="notice">Showing only the 20 most recent records; the recorded request count includes the full UTC month.</p> : null}
          </>
        ) : null}
      </section>
    </section>
  );
}
