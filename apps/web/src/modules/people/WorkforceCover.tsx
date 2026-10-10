import { Link } from 'react-router-dom';
import './workforce-cover.css';

const steps = [
  'Clock in/out',
  'Timecard review',
  'Supervisor approval',
  'Payroll preparation',
  'Payment provider gated'
] as const;

/**
 * Visual landing for the canonical People route. This is a blueprint-informed
 * illustration, not a claim that an external timeclock, schedule provider, or
 * payroll disbursement is connected.
 */
export function WorkforceCover() {
  return (
    <>
      <section className="workforce-cover" aria-labelledby="workforce-cover-title">
        <img
          className="workforce-cover-art"
          src="/atlas/design/atlas-workforce-skyline.svg"
          alt=""
          aria-hidden="true"
        />
        <div className="workforce-cover-vignette" aria-hidden="true" />
        <div className="workforce-cover-header">
          <div className="workforce-cover-brand" aria-label="ATLAS Enterprise Suite">
            <svg className="workforce-brand-mark" viewBox="0 0 68 68" aria-hidden="true" focusable="false">
              <defs><linearGradient id="workforce-mark" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f4fbff"/><stop offset=".55" stopColor="#23b9fd"/><stop offset="1" stopColor="#1862ad"/></linearGradient></defs>
              <path d="M30 5 4 57h16l12-27 15 27h17L37 5Z" fill="url(#workforce-mark)"/>
              <path d="M13 52c22-4 34-15 48-38-7 22-22 40-48 45Z" fill="#59d9ff"/>
            </svg>
            <span className="workforce-brand-words"><strong>ATLAS</strong><small>ENTERPRISE SUITE</small></span>
          </div>
          <span className="workforce-reference-chip">Concept visual · operational links verified by route</span>
        </div>

        <div className="workforce-cover-title-block">
          <p className="workforce-cover-overline">ATLAS ENTERPRISE SUITE</p>
          <p className="workforce-cover-atlas">ATLAS</p>
          <h1 id="workforce-cover-title">WORKFORCE<br />MANAGEMENT</h1>
          <p className="workforce-cover-tagline">Right people. Right place. Right time.</p>
          <div className="workforce-cover-rule" aria-hidden="true" />
        </div>

        <div className="workforce-cover-panels" aria-hidden="true">
          <div className="workforce-hud workforce-hud-stats"><span>WORKFORCE / OVERVIEW</span><i/><i/><i/></div>
          <div className="workforce-hud workforce-hud-chart"><span>TIME / OPERATIONS</span><div className="workforce-hud-bars"><i/><i/><i/><i/><i/><i/></div></div>
        </div>

        <nav className="workforce-cover-features" aria-label="Workforce Management capabilities">
          <span className="workforce-cover-feature is-planned" aria-disabled="true">
            <span className="workforce-feature-icon" aria-hidden="true">▦</span>
            <strong>Scheduling</strong>
            <small>Integration gated</small>
          </span>
          <Link className="workforce-cover-feature" to="/people/time">
            <span className="workforce-feature-icon" aria-hidden="true">◷</span>
            <strong>Time &amp; Attendance</strong>
            <small>Open time records</small>
          </Link>
          <Link className="workforce-cover-feature" to="/analytics">
            <span className="workforce-feature-icon" aria-hidden="true">▥</span>
            <strong>Productivity</strong>
            <small>Open analytics</small>
          </Link>
          <Link className="workforce-cover-feature" to="/people/knowledge">
            <span className="workforce-feature-icon" aria-hidden="true">⬡</span>
            <strong>Compliance</strong>
            <small>Open knowledge</small>
          </Link>
        </nav>
      </section>

      <section className="workforce-journey" aria-labelledby="workforce-journey-heading">
        <div className="workforce-journey-intro">
          <div>
            <p className="eyebrow">Time → Approval → Pay</p>
            <h2 id="workforce-journey-heading">From clock-in to payroll</h2>
            <p>The approved process uses organization-scoped People and Payroll records. Timeclock automation, schedules and external payments remain gated until independently verified.</p>
          </div>
          <div className="workforce-journey-actions">
            <Link to="/people/time" className="workforce-action-primary">Open timecards <span aria-hidden="true">→</span></Link>
            <Link to="/payroll" className="workforce-action-secondary">Prepare payroll <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <ol className="workforce-journey-steps">
          {steps.map((step, index) => <li key={step} className={index === 4 ? 'is-gated' : ''}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
            {index === 4 ? <small>External authorization required</small> : null}
          </li>)}
        </ol>
      </section>
    </>
  );
}
