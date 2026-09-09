export function ApplePersonalVoicePage() {
  return (
    <main className="atlas-page atlas-module-page voice-page">
      <p className="atlas-eyebrow">ATLAS Voice / Apple</p>
      <h1>Apple Personal Voice</h1>
      <p className="atlas-page__lede">
        Device-local capability boundary for Apple Personal Voice. The web application does not simulate native Apple APIs or telephony control.
      </p>

      <div className="atlas-card-grid">
        <article className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Bridge state</strong>
          <span>Requires ATLAS iOS app</span>
        </article>
        <article className="atlas-status-panel">
          <strong>Audio export</strong>
          <span>Audio export: Unavailable</span>
        </article>
        <article className="atlas-status-panel">
          <strong>Telephony</strong>
          <span>Telephony: Unavailable</span>
        </article>
        <article className="atlas-status-panel">
          <strong>Server synthesis</strong>
          <span>Server synthesis: Unavailable</span>
        </article>
      </div>
    </main>
  );
}
