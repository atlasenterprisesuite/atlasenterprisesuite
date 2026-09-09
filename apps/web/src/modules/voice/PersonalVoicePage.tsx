export function PersonalVoicePage() {
  return (
    <main className="atlas-page atlas-module-page voice-page">
      <p className="atlas-eyebrow">ATLAS Voice / Personal Voice</p>
      <h1>Personal Voice</h1>
      <p className="atlas-page__lede">
        User-owned voice enrollment with explicit consent, microphone capture, recording-quality review and provider-gated generation.
      </p>

      <div className="atlas-card-grid">
        <article className="atlas-status-panel">
          <strong>Enrollment foundation</strong>
          <span>Consent, sound-check, recording and review contracts are implemented in the ATLAS Voice domain.</span>
        </article>
        <article className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Generation</strong>
          <span>Voice generation provider: Not configured</span>
        </article>
        <article className="atlas-status-panel">
          <strong>Safety boundary</strong>
          <span>Generation cannot become eligible until consent, ownership challenge, sample review and a verified provider are all satisfied.</span>
        </article>
      </div>
    </main>
  );
}
