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
  const canaryVerified = summary.canary_verified === true;
  const deploymentSha = nullableString(summary.deployment_sha);
  const verifiedAt = nullableString(summary.verified_at);
  const versionId = nullableString(summary.version_id);
  const provider = nullableString(summary.provider);
  const providerState = nullableString(summary.provider_state);

  return (
    <section className="execution-panel manager-production-panel" aria-labelledby="manager-production-title">
      <div className="manager-production-heading">
        <div>
          <p className="manager-production-kicker">ATLAS Manager</p>
          <h2 id="manager-production-title">Production verification</h2>
        </div>
        <span
          className="manager-production-badge"
          data-state={canaryVerified ? 'verified' : 'unverified'}
          aria-label={canaryVerified ? 'Production canary verified' : 'Production canary unverified'}
        >
          {canaryVerified ? 'Canary verified' : 'Canary unverified'}
        </span>
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
      </dl>

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
