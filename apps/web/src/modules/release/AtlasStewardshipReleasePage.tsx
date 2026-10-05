import { Link } from 'react-router-dom';

const releaseFacts = [
  { icon: '<>', label: 'Production SHA', value: '07ec921444137b656cffbe3123f42dd0d9b59aaf', mono: true },
  { icon: '△', label: 'TDD RED → GREEN', value: 'complete' },
  { icon: '⚙', label: 'Build + Production Readiness', value: 'SUCCESS' },
  { icon: '⌕', label: 'CodeQL Advanced', value: 'SUCCESS' },
  { icon: '☁', label: 'Cloudflare Deploy', value: 'SUCCESS' },
  { icon: '⌁', label: 'P0 Health', value: '/api/v1/health = healthy', mono: true },
  { icon: '◇', label: 'Security headers verified', value: 'HSTS + CSP' },
  { icon: '▤', label: 'Exact-SHA attestation', value: 'verified' },
  { icon: '▥', label: 'Failure count', value: '0' }
] as const;

const governanceFlow = [
  { mark: '◎', label: 'Purpose' },
  { mark: '◉', label: 'Identity' },
  { mark: '◇', label: 'Trust / Assurance' },
  { mark: '◌', label: 'Responsibility' },
  { mark: '⚙', label: 'Service' },
  { mark: '▤', label: 'Evidence' },
  { mark: '▰', label: 'Legacy' }
] as const;

export function AtlasStewardshipReleasePage() {
  return (
    <section className="stewardship-release-page" aria-labelledby="stewardship-release-title">
      <div className="stewardship-ambient" aria-hidden="true" />

      <header className="stewardship-hero">
        <div className="stewardship-side-copy stewardship-side-copy-left" aria-hidden="true">
          GOVERN<br />SECURE<br />ENABLE<br />ASSURE<br />DELIVER<br />FOR WHAT<br />MATTERS NEXT
        </div>
        <div className="stewardship-side-copy stewardship-side-copy-right" aria-hidden="true">
          PEOPLE<br />DATA<br />TRUST<br />GOVERNANCE<br />A MORE RESILIENT<br />TOMORROW
        </div>

        <div className="stewardship-wordmark" aria-label="ATLAS Enterprise Suite">
          <strong>ATLAS</strong>
          <span>ENTERPRISE SUITE</span>
        </div>

        <div className="stewardship-orbit-scene" aria-hidden="true">
          <div className="stewardship-globe">
            <span className="orbit orbit-a" />
            <span className="orbit orbit-b" />
            <span className="orbit orbit-c" />
          </div>
          <div className="stewardship-shield">
            <div className="stewardship-shield-core">
              <span className="stewardship-mark-left" />
              <span className="stewardship-mark-right" />
              <span className="stewardship-mark-tip" />
            </div>
          </div>
          <div className="stewardship-pedestal"><span /><span /><span /></div>
        </div>

        <div className="stewardship-title-lockup">
          <p className="stewardship-kicker">ATLAS</p>
          <h1 id="stewardship-release-title">ATLAS Stewardship Governance</h1>
          <p className="stewardship-release-line">Wave 1 — Merged • Deployed • Production Verified</p>
        </div>
      </header>

      <section className="stewardship-status-panel" aria-labelledby="production-release-status">
        <div className="stewardship-panel-heading">
          <h2 id="production-release-status">Production Release Status</h2>
          <span className="stewardship-verified-badge"><span aria-hidden="true">✓</span> Production Verified</span>
        </div>

        <p className="stewardship-evidence-note">
          <strong>Historical production evidence</strong> — Wave 1 snapshot verified on 2026-10-05. This view preserves the evidence for that release and does not claim that later deployments inherit the same status.
        </p>

        <dl className="stewardship-status-list">
          {releaseFacts.map((item) => (
            <div className="stewardship-status-row" key={item.label}>
              <dt><span className="stewardship-status-icon" aria-hidden="true">{item.icon}</span>{item.label}</dt>
              <dd className={item.mono ? 'is-mono' : undefined}>{item.value}</dd>
              <span className="stewardship-row-check" aria-label="verified">✓</span>
            </div>
          ))}
        </dl>
      </section>

      <section className="stewardship-flow-panel" aria-labelledby="governance-flow-title">
        <h2 id="governance-flow-title">Governance Flow</h2>
        <ol className="stewardship-flow-list">
          {governanceFlow.map((item, index) => (
            <li key={item.label}>
              <span className="stewardship-flow-icon" aria-hidden="true">{item.mark}</span>
              <span>{item.label}</span>
              {index < governanceFlow.length - 1 ? <i aria-hidden="true">→</i> : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="stewardship-actions" aria-label="Release governance actions">
        <Link to="/release">Back to Release Control</Link>
        <Link className="primary" to="/execution/manager/readiness">Open current readiness</Link>
      </div>

      <footer className="stewardship-footer">
        <span>ATLAS Enterprise Suite — Governance layer active in production</span>
      </footer>
    </section>
  );
}
