import { Link } from 'react-router-dom';
import type { AssistantUsageSummary } from '../../assistant/client';
import './EnterpriseUsageInsights.css';

type Props = {
  usage: AssistantUsageSummary | null;
};

function number(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat().format(value);
}

function dayLabel(date: string) {
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed);
}

/** Reports persisted AI request activity, not inferred revenue, productivity or team identities. */
export function EnterpriseUsageInsights({ usage }: Props) {
  const daily = usage?.daily_activity || [];
  const maxRequests = Math.max(1, ...daily.map(item => item.requests));
  const coverageLimited = usage?.source_coverage === 'potentially_truncated';
  const hasActivity = Boolean(usage && usage.total_requests > 0);
  const completionRate = hasActivity && usage
    ? (usage.completed_requests / usage.total_requests) * 100
    : null;

  return (
    <section className="enterprise-ai-insights creator-section" id="enterprise-ai-insights" aria-labelledby="enterprise-ai-insights-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Enterprise Intelligence · Admin-style insights</p>
          <h2 id="enterprise-ai-insights-title">AI adoption &amp; business outcomes</h2>
        </div>
        <span>{usage ? (usage.scope === 'organization' ? 'Organization-wide (authorized admin)' : 'Your activity only') : 'Data unavailable'}</span>
      </div>

      <p className="enterprise-ai-insights-lead">
        Unlike a promotional dashboard, these figures come only from ATLAS persisted AI request telemetry.
        Completion means the AI request ended successfully; it does not prove a business result.
      </p>

      {!usage ? (
        <div className="creator-empty" role="status">
          <strong>Telemetry unavailable</strong>
          <span>Usage metrics remain unavailable until the authenticated AI telemetry service responds. No illustrative values are shown.</span>
        </div>
      ) : (
        <>
          <div className="enterprise-ai-insights-metrics">
            <article>
              <strong>{number(usage.total_requests)}</strong>
              <span>Recorded AI requests</span>
            </article>
            <article>
              <strong>{number(usage.active_users)}</strong>
              <span>Distinct AI request actors</span>
            </article>
            <article>
              <strong>{completionRate === null ? '—' : completionRate.toFixed(1) + '%'}</strong>
              <span>Recorded completion rate</span>
            </article>
            <article>
              <strong>{number(usage.failed_requests)}</strong>
              <span>Failed AI requests</span>
            </article>
          </div>

          {(coverageLimited || usage.identity_coverage === 'partial') && (
            <p role="status" className="enterprise-ai-insights-warning">
              {coverageLimited
                ? 'Partial observation: the query reached its source row limit. Counts and rates describe the returned rows, not guaranteed organization totals.'
                : 'Some source rows lack actor identity. Unique active-user counts cannot be verified.'}
            </p>
          )}

          <div className="enterprise-ai-insights-panels">
            <section aria-labelledby="enterprise-ai-daily-title" className="enterprise-ai-insights-panel">
              <h3 id="enterprise-ai-daily-title">Daily AI activity</h3>
              <p>UTC calendar days within the reported {usage.days}-day rolling window; only persisted requests count.</p>
              {daily.length === 0 ? (
                <p className="enterprise-ai-insights-quiet">No verified daily breakdown from this endpoint.</p>
              ) : (
                <div className="enterprise-ai-insights-scroll">
                  <ol className="enterprise-ai-insights-chart" aria-label="Daily recorded AI requests">
                    {daily.map(item => (
                      <li key={item.date} aria-label={`${item.date}: ${item.requests} requests, ${item.completed} completed, ${item.failed} failed, ${item.active_users === null ? 'active actors unavailable' : item.active_users + ' active actors'}`}>
                        <strong>{item.requests}</strong>
                        <div className="enterprise-ai-insights-bar-track" aria-hidden="true">
                          <div style={{ height: `${item.requests === 0 ? 0 : Math.max(4, Math.round(item.requests * 100 / maxRequests))}%` }} />
                        </div>
                        <time dateTime={item.date}>{dayLabel(item.date)}</time>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="enterprise-ai-insights-quiet">
                {usage.period_start} – {usage.period_end}. There is no verified prior-period comparison; a growth percentage is not inferred.
              </p>
            </section>

            <section aria-labelledby="enterprise-ai-provider-title" className="enterprise-ai-insights-panel">
              <h3 id="enterprise-ai-provider-title">Usage by AI provider</h3>
              <p>Real recorded requests, not illustrative team distribution.</p>
              {usage.providers.length ? (
                <ul className="enterprise-ai-insights-providers">
                  {usage.providers.map(provider => {
                    const share = usage.total_requests ? Math.round(provider.requests * 100 / usage.total_requests) : 0;
                    return <li key={provider.provider}>
                      <div><span>{provider.provider}</span><strong>{number(provider.requests)} · {share}%</strong></div>
                      <div className="enterprise-ai-insights-provider-track" aria-hidden="true"><div style={{ width: `${share}%` }} /></div>
                    </li>;
                  })}
                </ul>
              ) : <p className="enterprise-ai-insights-quiet">No provider activity recorded in the selected window.</p>}
            </section>
          </div>
        </>
      )}

      <div className="enterprise-ai-insights-panels">
        <section className="enterprise-ai-insights-panel enterprise-ai-insights-gated" aria-labelledby="enterprise-ai-team-title">
          <h3 id="enterprise-ai-team-title">Usage by team</h3>
          <p><strong>Not verified.</strong> No verified team mapping is linked to AI actors in the current telemetry contract. ATLAS does not invent department percentages or expose individuals to unauthorized viewers.</p>
          <Link to="/work/team">Review organization &amp; team permissions</Link>
        </section>
        <section className="enterprise-ai-insights-panel enterprise-ai-insights-gated" aria-labelledby="enterprise-ai-outcomes-title">
          <h3 id="enterprise-ai-outcomes-title">Business outcome attribution</h3>
          <p><strong>Not verified.</strong> No verified business outcome attribution connects AI requests to approved accounting, payroll, revenue or operational records yet. Savings and ROI remain unavailable without source-linked evidence.</p>
          <Link to="/analytics">Review verified business metric sources</Link>
        </section>
      </div>
    </section>
  );
}
