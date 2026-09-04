import { commandCenterAlerts, commandCenterMetrics } from '../../../../../../data/demo/health/commandCenter';
import { healthModuleCatalog } from '../../../../../../packages/health/src';
import { HealthDataNotice } from '../shared/HealthDataNotice';
import { HealthModuleCard } from '../shared/HealthModuleCard';

export function CommandCenterPage() {
  const visibleMetrics = commandCenterMetrics.filter((metric) => metric.sourceState === 'demo');
  const visibleAlerts = commandCenterAlerts.filter((alert) => alert.sourceState === 'demo');

  return (
    <div className="page-stack command-center">
      <HealthDataNotice
        state="demo"
        text="DEMO DATA — values are derived from ATLAS demonstration datasets, not AdventHealth production systems."
      />

      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Operations</p>
        <h1>Smart Health Command Center</h1>
        <p>One governed operational view across the approved ATLAS Health module portfolio.</p>
      </header>

      <section className="metric-grid" aria-label="Command center metrics">
        {visibleMetrics.map((metric) => (
          <article key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>Demo source</small>
          </article>
        ))}
      </section>

      <section className="workspace-card" aria-label="Command center alerts">
        <div className="toolbar">
          <div className="field wide-field">
            <span>Open demo alerts</span>
            <strong>{visibleAlerts.filter((alert) => alert.status === 'open').length}</strong>
          </div>
        </div>
        {visibleAlerts.length === 0 ? (
          <div className="empty-state"><strong>No demo alerts</strong><span>No governed demonstration alerts are available.</span></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alert</th><th>Module</th><th>Severity</th><th>Status</th><th>Source</th></tr></thead>
              <tbody>
                {visibleAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td><strong>{alert.title}</strong></td>
                    <td>{healthModuleCatalog.find((item) => item.id === alert.moduleId)?.name ?? alert.moduleId}</td>
                    <td><span className="status-pill">{alert.severity}</span></td>
                    <td>{alert.status}</td>
                    <td>DEMO</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page-stack" aria-label="Health modules">
        <header className="page-header">
          <p className="eyebrow">Module portfolio</p>
          <h2>18 governed Health modules</h2>
          <p>Every card has a working destination; Research & Innovation continues into the governed Health Frontiers workspace.</p>
        </header>
        <div className="module-grid health-module-grid">
          {healthModuleCatalog.map((module) => (
            <div key={module.id} data-testid="health-module-card">
              <HealthModuleCard title={module.name} description={module.description} to={module.route} eyebrow="Health module" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
