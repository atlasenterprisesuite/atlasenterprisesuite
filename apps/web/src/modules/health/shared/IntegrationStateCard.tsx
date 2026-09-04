import type { HealthIntegration } from '../healthDomain';
import { HealthStatusBadge } from './HealthStatusBadge';

export function IntegrationStateCard({ integration }: { integration: HealthIntegration }) {
  return <article className="health-panel integration-card"><div className="health-panel-heading"><h3>{integration.name}</h3><HealthStatusBadge state={integration.state} /></div><p>{integration.authorized ? 'Authorization is present.' : 'No active authorization is represented.'}</p><small>{integration.lastHealthCheckAt ? `Last successful health check: ${integration.lastHealthCheckAt}` : 'No successful live health check recorded.'}</small></article>;
}
