import { Link } from 'react-router-dom';
import { CloudSubnav } from './AtlasCloudNextLevel';

const RELEASE_OPERATIONS_SURFACES = [
  {
    eyebrow: 'Deployment',
    title: 'Release Center',
    description: 'Read organization-scoped release state from the existing ATLAS Release Control authority.',
    route: '/cloud/releases'
  },
  {
    eyebrow: 'Production',
    title: 'Production Verification',
    description: 'Verify build, deployment, runtime, security and exact-SHA evidence without manufacturing green state.',
    route: '/cloud/production-verification'
  },
  {
    eyebrow: 'Infrastructure',
    title: 'Manager Readiness',
    description: 'Evaluate provider requirements, environment readiness and real blockers before deployment claims.',
    route: '/execution/manager/readiness'
  },
  {
    eyebrow: 'Governance',
    title: 'Release Control',
    description: 'Inspect release gates, approval evidence and production verification from the canonical release control plane.',
    route: '/release'
  },
  {
    eyebrow: 'Runtime',
    title: 'Runtime Integrity',
    description: 'Classify browser and application runtime incidents without treating extension noise as a production outage.',
    route: '/cloud/runtime-integrity'
  }
] as const;

export function AtlasCloudReleaseOperations() {
  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <CloudSubnav />

      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Release & Operations</p>
        <h1>One release truth, multiple evidence surfaces</h1>
        <p>
          Source merge, CI, provider deployment and production verification remain separate facts. This hub
          converges the existing ATLAS release surfaces without creating a second release database, provider
          registry or deployment authority.
        </p>
      </header>

      <section className="atlas-cloud-operation-list atlas-cloud-release-operations" aria-label="Release and operations surfaces">
        {RELEASE_OPERATIONS_SURFACES.map((surface, index) => (
          <article key={surface.route}>
            <span className="atlas-cloud-method">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <small>{surface.eyebrow}</small>
              <h2>{surface.title}</h2>
              <p>{surface.description}</p>
            </div>
            <Link to={surface.route}>Open <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      <div className="atlas-cloud-truth-note">
        This is a convergence surface only. Each destination continues to read its existing authoritative
        evidence and permission boundary. A source merge never implies provider deployment or Production Verified.
      </div>
    </section>
  );
}
