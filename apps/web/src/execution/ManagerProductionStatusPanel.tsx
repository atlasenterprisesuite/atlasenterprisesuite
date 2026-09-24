import type { GuidedWorkflow } from './types';

type RawRecord = Record<string, unknown>;

function record(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {};
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readableDate(value: string | null) {
  if (!value) return 'Not verified';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function ManagerProductionStatusPanel({ workflow }: { workflow: GuidedWorkflow }) {
  const summary = record(record(workflow.context).production_verification);
  if (!Object.keys(summary).length) return null;

  const criticalRoutes = Array.isArray(summary.critical_routes)
    ? summary.critical_routes.map(record)
    : [];
  const history = Array.isArray(summary.history)
    ? summary.history.map(record)
    : [];
  const canaryVerified = summary.canary_verified === true;
  const deploymentSha = nullableString(summary.deployment_sha);
  const verifiedAt = nullableString(summary.verified_at);
  const versionId = nullableString(summary.version_id);
  const provider = nullableString(summary.provider);
  const providerState = nullableString(summary.provider_state);
  const regressionDetected = summary.regression_detected === true;
  const regressionReasons = Array.isArray(summary.regression_reasons)
    ? summary.regression_reasons.filter((value): value is string => typeof value === 'string' && Boolean(value))
    : [];
  const previousDeploymentSha = nullableString(summary.previous_deployment_sha);
  const lastKnownGoodSha = nullableString(summary.last_known_good_sha);
  const lastKnownGoodVerifiedAt = nullableString(summary.last_known_good_verified_at);
  const lastKnownGoodVersionId = nullableString(summary.last_known_good_version_id);
  const greenStreakCount = typeof summary.green_streak_count === 'number' && Number.isFinite(summary.green_streak_count)
    ? Math.max(0, Math.trunc(summary.green_streak_count))
    : 0;
  const greenStreakCapped = summary.green_streak_capped === true;

  return (
    <section className="execution-panel manager-production-panel" aria-labelledby="manager-production-title">
      <div className="manager-production-heading">
        <div>
          <p className="manager-production-kicker">ATLAS Manager</p>
          <h2 id="manager-production-title">Production verification</h2>
        </div>
        <div className="manager-production-badges">
          <span
            className="manager-production-badge"
            data-state={canaryVerified ? 'verified' : 'unverified'}
            aria-label={canaryVerified ? 'Production canary verified' : 'Production canary unverified'}
          >
            {canaryVerified ? 'Canary verified' : 'Canary unverified'}
          </span>
          <span
            className="manager-production-badge"
            data-state={regressionDetected ? 'regression' : 'verified'}
            aria-label={regressionDetected ? 'Production regression detected' : 'No production regression detected'}
          >
            {regressionDetected ? 'Regression detected' : 'No regression'}
          </span>
        </div>
      </div>

      <dl className="manager-production-meta">
        <div>
          <dt>Deployment SHA</dt>
          <dd><code>{deploymentSha ?? 'Unavailable'}</code></dd>
        </div>
        <div>
          <dt>Verified at</dt>
          <dd title={verifiedAt ?? undefined}>{readableDate(verifiedAt)}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{provider ? provider + (providerState ? ' · ' + providerState : '') : 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Version ID</dt>
          <dd><code>{versionId ?? 'Unavailable'}</code></dd>
        </div>
        <div>
          <dt>Compared with</dt>
          <dd><code>{previousDeploymentSha ?? 'No previous deployment'}</code></dd>
        </div>
        <div>
          <dt>Green streak</dt>
          <dd>{greenStreakCapped ? greenStreakCount + '+' : greenStreakCount} consecutive verified deployment{greenStreakCount === 1 ? '' : 's'}</dd>
        </div>
        <div>
          <dt>Last known good</dt>
          <dd>
            <code>{lastKnownGoodSha ?? 'Unavailable'}</code>
            {lastKnownGoodVerifiedAt ? <small className="manager-meta-subline">{readableDate(lastKnownGoodVerifiedAt)}</small> : null}
            {lastKnownGoodVersionId ? <small className="manager-meta-subline">Version {lastKnownGoodVersionId}</small> : null}
          </dd>
        </div>
      </dl>

      {regressionDetected ? (
        <div className="manager-regression-alert" role="alert">
          <strong>Production regression detected</strong>
          <span>{regressionReasons.join(' · ') || 'A required production verification regressed.'}</span>
          <span>
            Recovery candidate: <code>{lastKnownGoodSha ?? 'No verified prior deployment available'}</code>
          </span>
        </div>
      ) : null}

      <div className="manager-history-section">
        <div className="manager-route-heading">
          <h3>Recent production deployments</h3>
          <span>{history.length} shown</span>
        </div>
        {history.length ? (
          <ol className="manager-history-list">
            {history.map((item, index) => {
              const sha = nullableString(item.deployment_sha);
              const status = nullableString(item.status) ?? 'unknown';
              const itemProvider = nullableString(item.provider);
              const itemProviderState = nullableString(item.provider_state);
              const itemVerifiedAt = nullableString(item.verified_at);
              const verified =
                status === 'passed' &&
                item.production_commit_sha_verified === true &&
                item.manager_readiness_route_reachable === true &&
                item.critical_network_routes_reachable === true;
              return (
                <li key={nullableString(item.evidence_id) ?? sha ?? String(index)}>
                  <div className="manager-history-copy">
                    <strong>{index === 0 ? 'Current deployment' : 'Previous deployment'}</strong>
                    <code title={sha ?? undefined}>{sha ?? 'Unavailable'}</code>
                    <span>{readableDate(itemVerifiedAt)}</span>
                  </div>
                  <div className="manager-history-status">
                    <span className="manager-route-state" data-state={verified ? 'verified' : 'unverified'}>
                      {verified ? 'Verified' : status}
                    </span>
                    <small>{itemProvider ? itemProvider + (itemProviderState ? ' · ' + itemProviderState : '') : 'Provider unavailable'}</small>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="manager-route-empty">No deployment history is available yet.</p>
        )}
      </div>

      <div className="manager-route-section">
        <div className="manager-route-heading">
          <h3>Critical ATLAS Network routes</h3>
          <span>{criticalRoutes.length} monitored</span>
        </div>
        {criticalRoutes.length ? (
          <ul className="manager-route-list">
            {criticalRoutes.map((route) => {
              const path = nullableString(route.path) ?? 'unknown';
              const label = nullableString(route.label) ?? path;
              const state = nullableString(route.state) ?? 'unavailable';
              const verified = state === 'verified';
              const httpStatus = typeof route.http_status === 'number' ? route.http_status : null;
              return (
                <li key={path}>
                  <div>
                    <strong>{label}</strong>
                    <code>{path}</code>
                  </div>
                  <span className="manager-route-state" data-state={verified ? 'verified' : 'unverified'}>
                    {verified ? 'Verified' : state}
                    {httpStatus ? ' · HTTP ' + httpStatus : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="manager-route-empty">No critical-route evidence is available for the latest deployment.</p>
        )}
      </div>
    </section>
  );
}
