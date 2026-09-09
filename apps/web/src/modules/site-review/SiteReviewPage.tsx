import { useState, type FormEvent } from 'react';
import { auditDocument, type AuditFinding } from '../../../../../packages/site-review/src';

export function SiteReviewPage() {
  const [pageUrl, setPageUrl] = useState('');
  const [markup, setMarkup] = useState('');
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runAudit = (event: FormEvent) => {
    event.preventDefault();
    try {
      setFindings(auditDocument(markup, pageUrl));
      setError(null);
    } catch (auditError) {
      setFindings([]);
      setError(auditError instanceof Error ? auditError.message : 'Site Review audit could not run');
    }
  };

  return (
    <main className="atlas-page atlas-module-page platform-capability-page site-review-page">
      <p className="atlas-eyebrow">ATLAS Platform</p>
      <h1>ATLAS Site Review</h1>
      <p className="atlas-page__lede">
        Deterministic local review of supplied HTML for security, SEO, content and accessibility signals. External measurements remain disabled until their providers are connected.
      </p>

      <form className="atlas-status-panel" onSubmit={runAudit}>
        <label>
          Page URL
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            placeholder="https://example.com/page"
            inputMode="url"
            required
          />
        </label>
        <label>
          HTML markup
          <textarea
            value={markup}
            onChange={(event) => setMarkup(event.target.value)}
            rows={8}
            placeholder="Paste the page HTML to audit locally"
            required
          />
        </label>
        <div className="atlas-action-row">
          <button type="submit">Run local audit</button>
        </div>
      </form>

      {error && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Audit error</strong>
          <span>{error}</span>
        </section>
      )}

      {findings.length > 0 && (
        <section className="atlas-card-grid" aria-label="Site Review findings">
          {findings.map((finding) => (
            <article className="atlas-status-panel" key={finding.id}>
              <strong>{finding.ruleId}</strong>
              <span>{finding.status} · {finding.severity}</span>
              <span>{finding.message}</span>
            </article>
          ))}
        </section>
      )}

      <div className="atlas-card-grid">
        <article className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Performance provider</strong>
          <span>Core Web Vitals: Not configured</span>
        </article>
        <article className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Google integration</strong>
          <span>Search Console: Not configured</span>
        </article>
        <article className="atlas-status-panel atlas-status-panel--degraded">
          <strong>Live crawler</strong>
          <span>Network crawl and live broken-link validation: Not configured</span>
        </article>
      </div>
    </main>
  );
}
