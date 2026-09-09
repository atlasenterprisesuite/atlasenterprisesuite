export function AutomationsPage() {
  return (
    <main className="atlas-page atlas-module-page platform-capability-page">
      <p className="atlas-eyebrow">ATLAS Platform</p>
      <h1>ATLAS Automations</h1>
      <p className="atlas-page__lede">
        Cross-module workflow orchestration using the governed sequence Trigger → Conditions → Actions → Permissions → Result.
      </p>

      <div className="atlas-card-grid">
        <article className="atlas-status-panel">
          <strong>Triggers</strong>
          <span>Manual, schedule, module-event and network-event contracts are supported by the domain engine.</span>
        </article>
        <article className="atlas-status-panel">
          <strong>Conditions</strong>
          <span>Declarative equals, not-equals, membership and existence checks are validated before execution.</span>
        </article>
        <article className="atlas-status-panel">
          <strong>Actions &amp; permissions</strong>
          <span>Action adapters are explicit and permission-gated; unsafe executable payload keys are rejected.</span>
        </article>
        <article className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Persistence</strong>
          <span>Persistent automation repository: Not configured</span>
        </article>
      </div>
    </main>
  );
}
