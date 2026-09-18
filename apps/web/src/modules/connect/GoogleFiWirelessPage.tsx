import { useState } from 'react';
import { Link } from 'react-router-dom';

type SelectedStatement = {
  name: string;
  size: number;
  type: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GoogleFiWirelessPage() {
  const [statement, setStatement] = useState<SelectedStatement | null>(null);

  return (
    <section className="page-stack" aria-labelledby="google-fi-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless</p>
        <h1 id="google-fi-title">Google Fi Wireless</h1>
        <p>Secure account handoff and local statement intake with an explicit external-provider boundary.</p>
      </header>

      <div className="stat-grid" aria-label="Google Fi integration status">
        <article>
          <strong>External-gated</strong>
          <span>provider state</span>
        </article>
        <article>
          <strong>Official portal</strong>
          <span>account management path</span>
        </article>
        <article>
          <strong>No API claim</strong>
          <span>customer account access</span>
        </article>
      </div>

      <div className="notice" role="status">
        No public Google Fi customer account API is configured for ATLAS. Usage, billing, plan changes, line management and carrier status are not represented as live data.
      </div>

      <div className="module-grid">
        <article className="feature-card">
          <p className="eyebrow">Account management</p>
          <h2>Official Google Fi portal</h2>
          <p>Continue to Google Fi for authenticated carrier operations. ATLAS does not request or retain your Google Fi password.</p>
          <a
            className="action-link"
            href="https://fi.google.com/account"
            target="_blank"
            rel="noreferrer noopener"
          >
            Open Google Fi account
          </a>
        </article>

        <article className="feature-card">
          <p className="eyebrow">Statement intake</p>
          <h2>Attach a billing file</h2>
          <p>Select a CSV, JSON or PDF file from your device. Selecting a file does not imply carrier synchronization or persistence.</p>
          <label className="field">
            <span>Statement file</span>
            <input
              type="file"
              accept=".csv,.json,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setStatement(file ? { name: file.name, size: file.size, type: file.type || 'unknown' } : null);
              }}
            />
          </label>
          {statement ? (
            <div className="notice" aria-live="polite">
              <strong>{statement.name}</strong><br />
              Selected locally · {formatBytes(statement.size)} · {statement.type}. ATLAS has not synced this file to Google Fi.
            </div>
          ) : (
            <div className="empty-state">
              <strong>No statement selected</strong>
              <span>Choose a supported file to stage it locally in this session.</span>
            </div>
          )}
        </article>
      </div>

      <div className="module-grid compact">
        <article className="module-card disabled" aria-disabled="true">
          <span>Usage</span>
          <strong>Not connected</strong>
          <p>No verified Google Fi usage feed is available to ATLAS.</p>
        </article>
        <article className="module-card disabled" aria-disabled="true">
          <span>Billing</span>
          <strong>Not connected</strong>
          <p>No verified Google Fi billing API is available to ATLAS.</p>
        </article>
        <article className="module-card disabled" aria-disabled="true">
          <span>Plans & lines</span>
          <strong>Official portal only</strong>
          <p>Carrier plan and line changes remain in Google Fi until an authorized provider interface exists.</p>
        </article>
      </div>

      <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
    </section>
  );
}
