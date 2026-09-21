import { useEffect, useState } from 'react';
import type { ComplianceRequirement } from '../../../../../packages/compliance/types';
import { describeRideRequirement } from '../../../../../packages/ride/requirements';
import type { RideReadiness } from '../../../../../packages/ride/readiness';
import { getRideComplianceRequirements } from '../../lib/rideComplianceApi';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { RideSubnav } from './RideSubnav';

export function RideReadinessPage() {
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [readiness, setReadiness] = useState<RideReadiness | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
        setError(cause instanceof Error ? cause.message : 'readiness_unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Ride Readiness</p>
        <h1>Driver & Vehicle Readiness</h1>
        <p>Eligibility is derived from persisted compliance requirements in the active organization. It is never a manually painted status.</p>
      </header>
      <RideSubnav />

      {loading ? <div className="ride-operation-status" aria-busy="true">Evaluating governed readiness…</div> : null}
      {error ? <div className="ride-message error" role="alert"><strong>Readiness unavailable</strong><p>{error}</p></div> : null}

      {readiness ? (
        <div className={`ride-requirement-card ride-readiness-summary ride-readiness-${readiness.state}`}>
          <span className="eyebrow">New trip gate</span>
          <h2>{readiness.eligibleForNewTrips ? 'Eligible for new trips' : 'Not eligible for new trips'}</h2>
          <p>State: <strong>{readiness.state}</strong> · Evaluated requirements: {readiness.evaluatedRequirementCount}</p>
          <div className="ride-metadata-grid">
            <div><dt>Blocking</dt><dd>{readiness.blockingRequirementIds.length}</dd></div>
            <div><dt>Warnings</dt><dd>{readiness.warningRequirementIds.length}</dd></div>
            <div><dt>Satisfied</dt><dd>{readiness.satisfiedRequirementIds.length}</dd></div>
          </div>
        </div>
      ) : null}

      {!loading && !error && requirements.length === 0 ? (
        <div className="ride-message warning" role="status">
          <strong>Evidence incomplete</strong>
          <p>No persisted Ride requirements were returned, so ATLAS keeps readiness fail-closed.</p>
        </div>
      ) : null}

      {requirements.length > 0 ? (
        <div className="module-grid" aria-label="Readiness requirements">
          {requirements.map((requirement) => {
            const definition = describeRideRequirement(requirement.requirementType);
            return (
              <article className="module-card ride-document-card" key={requirement.id}>
                <span>{definition.subjectType}</span>
                <strong>{definition.label}</strong>
                <ComplianceStatusBadge status={requirement.status} />
                <p>{requirement.eligibilityEffect === 'block_new_activity'
                  ? 'Blocks new Ride activity until resolved.'
                  : requirement.eligibilityEffect === 'warning'
                    ? 'Creates a readiness warning while unresolved.'
                    : 'No explicit eligibility effect is configured.'}</p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
