import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ComplianceRequirement } from '../../../../../packages/compliance/types';
import { describeRideRequirement } from '../../../../../packages/ride/requirements';
import type { RideReadiness } from '../../../../../packages/ride/readiness';
import { getRideComplianceRequirements } from '../../lib/rideComplianceApi';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { RideSubnav } from './RideSubnav';

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function readinessCopy(readiness: RideReadiness | null) {
  if (!readiness) return null;
  if (readiness.state === 'eligible') return 'Eligible for new Ride activity based on the configured requirements returned by the server.';
  if (readiness.state === 'warning') return 'Eligible with compliance warnings. Review the affected requirements before accepting new activity.';
  if (readiness.state === 'blocked') return 'New Ride activity is blocked by one or more persisted compliance requirements.';
  return 'Readiness cannot be confirmed from the currently configured evidence.';
}

export function DocumentsPage() {
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [readiness, setReadiness] = useState<RideReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getRideComplianceRequirements()
      .then((response) => {
        if (!active) return;
        setRequirements(response.requirements);
        setReadiness(response.readiness);
        setError('');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'requirements_unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Ride Compliance</p>
        <h1>Documents & Credentials</h1>
        <p>Only persisted requirements returned by the active organization are actionable. Registry metadata never creates compliance state by itself.</p>
      </header>
      <RideSubnav />

      {loading ? <div className="ride-operation-status" aria-busy="true">Loading governed Ride requirements…</div> : null}
      {error ? <div className="ride-message error" role="alert"><strong>Requirements unavailable</strong><p>{error}</p></div> : null}
      {readiness ? (
        <div className={`ride-message ${readiness.state === 'blocked' ? 'error' : readiness.state === 'warning' || readiness.state === 'unknown' ? 'warning' : ''}`} role="status">
          <strong>Driver readiness: {readiness.state}</strong>
          <p>{readinessCopy(readiness)}</p>
        </div>
      ) : null}

      {!loading && !error && requirements.length === 0 ? (
        <div className="empty-state">
          <strong>No Ride compliance requirements are configured</strong>
          <span>ATLAS will not fabricate license, insurance, registration, inspection or screening status.</span>
        </div>
      ) : null}

      {requirements.length > 0 ? (
        <div className="module-grid" aria-label="Configured Ride compliance requirements">
          {requirements.map((requirement) => {
            const definition = describeRideRequirement(requirement.requirementType);
            const body = (
              <>
                <span>{definition.category} · {requirement.subjectType}</span>
                <strong>{definition.label}</strong>
                <p>{definition.description}</p>
                <ComplianceStatusBadge status={requirement.status} />
                <small>Due {formatDate(requirement.dueAt)} · Expires {formatDate(requirement.expiresAt)}</small>
              </>
            );

            return definition.actionPath ? (
              <Link className="module-card enabled ride-document-card" to={definition.actionPath} key={requirement.id}>
                {body}
              </Link>
            ) : (
              <article className="module-card ride-document-card" key={requirement.id} aria-label={definition.label}>
                {body}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
