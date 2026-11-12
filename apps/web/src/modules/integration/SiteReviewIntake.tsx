import React, { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { prepareSiteReviewTarget, type PreparedSiteReviewTarget } from './site-review-target';
import { auditHtmlSnapshot, MAX_HTML_SNAPSHOT_BYTES, type HtmlSnapshotAudit } from './site-review-html-audit';
import './site-review-intake.css';

/** Offline website target preparation; intentionally performs no network requests. */
export function SiteReviewIntake() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<PreparedSiteReviewTarget | null>(null);
  const [snapshot, setSnapshot] = useState<HtmlSnapshotAudit | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const epoch = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  function invalidateSnapshot() {
    epoch.current += 1;
    setSnapshot(null);
    setSnapshotError(null);
    setReading(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function importHtml(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // Clear browser file input immediately: the content is never persisted.
    event.currentTarget.value = '';
    invalidateSnapshot();
    if (!file || !target) return;
    if (!/\\.html?$/i.test(file.name) || file.size > MAX_HTML_SNAPSHOT_BYTES || file.size === 0) {
      setSnapshotError('Choose a nonempty .html or .htm file of at most 256 KiB.');
      return;
    }
    const currentEpoch = epoch.current;
    const selectedOrigin = target.origin;
    setReading(true);
    try {
      const source = await file.text();
      if (epoch.current !== currentEpoch) return;
      setSnapshot(auditHtmlSnapshot(source, selectedOrigin));
    } catch {
      if (epoch.current === currentEpoch) {
        setSnapshotError('Unable to read this local HTML file. No audit was recorded.');
      }
    } finally {
      if (epoch.current === currentEpoch) setReading(false);
    }
  }

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidateSnapshot();
    const result = prepareSiteReviewTarget(value);
    setError(result.ok ? null : result.reason);
    setTarget(result.ok ? result.target : null);
  }

  function clear() {
    invalidateSnapshot();
    setValue('');
    setTarget(null);
    setError(null);
  }

  return (
    <section className="site-review-intake" aria-labelledby="site-review-intake-title">
      <div className="site-review-intake-heading">
        <p className="eyebrow">Web Intelligence · Phases 1–2</p>
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
            onChange={(event) => { invalidateSnapshot(); setValue(event.target.value); setTarget(null); setError(null); }}
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
      <section className="site-review-snapshot" aria-labelledby="site-review-snapshot-title">
        <h3 id="site-review-snapshot-title">Local HTML snapshot audit</h3>
        <p>Upload an HTML file that you are authorized to inspect. Analysis runs only in this browser, without network crawling, script execution, HTML preview, storage or external upload. Checks are structural heuristics, not proof of compliance.</p>
        <label htmlFor="site-review-html-file">HTML snapshot (.html or .htm, max 256 KiB)</label>
        <input
          ref={fileInput}
          id="site-review-html-file"
          type="file"
          accept=".html,.htm,text/html"
          disabled={!target || reading}
          onChange={(event) => void importHtml(event)}
          aria-describedby="site-review-snapshot-help"
        />
        <p id="site-review-snapshot-help">{target ? 'Choose a local HTML snapshot associated with the prepared origin.' : 'Prepare a public HTTPS origin above to enable a local audit.'}</p>
        {reading ? <p role="status">Reading the local snapshot…</p> : null}
        {snapshotError ? <p role="alert" className="site-review-intake-error">{snapshotError}</p> : null}
        {snapshot ? (
          <div className="site-review-snapshot-report" aria-live="polite">
            <h4>Static source signals · Not a live site scan</h4>
            <p>{snapshot.presentCount} signals present · {snapshot.reviewCount} need review · {snapshot.unavailableCount} checks not configured</p>
            <ul>
              {snapshot.findings.map((finding) => (
                <li key={finding.ruleId}>
                  <strong>{finding.ruleId}</strong>
                  <span>{finding.status.replaceAll('_', ' ')}</span>
                  <p>{finding.message}</p>
                </li>
              ))}
            </ul>
            <p role="note">HTML structure is estimated by a bounded lexical parser. Malformed markup may produce inaccurate signals; WCAG, performance and live security verification require separate authorized checks. Raw source, file name and attribute values are never shown or retained in this report.</p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
