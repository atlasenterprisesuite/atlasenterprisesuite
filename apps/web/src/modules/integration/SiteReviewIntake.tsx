import { useState, type FormEvent } from 'react';
import { prepareSiteReviewTarget, type PreparedSiteReviewTarget } from './site-review-target';
import './site-review-intake.css';

/** Offline website target preparation; intentionally performs no network requests. */
export function SiteReviewIntake() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<PreparedSiteReviewTarget | null>(null);

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = prepareSiteReviewTarget(value);
    setError(result.ok ? null : result.reason);
    setTarget(result.ok ? result.target : null);
  }

  function clear() {
    setValue('');
    setTarget(null);
    setError(null);
  }

  return (
    <section className="site-review-intake" aria-labelledby="site-review-intake-title">
      <div className="site-review-intake-heading">
        <p className="eyebrow">Web Intelligence · Phase 1</p>
        <h2 id="site-review-intake-title">Prepare a website review</h2>
        <p>Check a public HTTPS target locally before any authorized live inspection. No crawler, network request or provider connection is triggered here.</p>
      </div>

      <form className="site-review-intake-form" onSubmit={prepare}>
        <label htmlFor="site-review-target-url">Website address</label>
        <div className="site-review-intake-controls">
          <input
            id="site-review-target-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.example.com/"
            value={value}
            maxLength={2048}
            onChange={(event) => setValue(event.target.value)}
            required
            aria-describedby="site-review-intake-help"
          />
          <button type="submit">Prepare review</button>
        </div>
        <p id="site-review-intake-help">HTTPS only. Credentials, local addresses, IP literals and nonstandard ports are excluded.</p>
      </form>

      {error ? <p className="site-review-intake-error" role="alert">{error}</p> : null}

      {target ? (
        <div className="site-review-intake-result" aria-live="polite">
          <div className="site-review-intake-result-heading">
            <h3>Local target assessment</h3>
            <span>Prepared · Not scanned</span>
          </div>
          <dl>
            <div><dt>Public origin</dt><dd>{target.origin}</dd></div>
            <div><dt>Hostname</dt><dd>{target.hostname}</dd></div>
            <div><dt>Path segments</dt><dd>{target.pathDepth}</dd></div>
            <div><dt>Query parameters</dt><dd>{target.queryParameterCount} (values hidden)</dd></div>
            <div><dt>URL fragment</dt><dd>{target.fragmentPresent ? 'Present (hidden)' : 'None'}</dd></div>
            <div><dt>Live crawl, DNS, headers, SEO, CWV</dt><dd>Not configured</dd></div>
          </dl>
          <p role="note">A valid URL is not proof of site existence, ownership, security, uptime, accessibility or permission to crawl. A separate consented, server-enforced scan is required for evidence-backed findings.</p>
          <button className="site-review-intake-clear" type="button" onClick={clear}>Clear target</button>
        </div>
      ) : (
        <p className="site-review-intake-empty">No site has been inspected or stored. Prepare an address to view safe metadata only.</p>
      )}
    </section>
  );
}
