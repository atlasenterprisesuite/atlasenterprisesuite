import { type FormEvent, useState } from 'react';
import { CloudSubnav } from './AtlasCloudNextLevel';

const CONTROL_URL =
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-observability';

type DomainVerification = {
  ok: boolean;
  hostname: string;
  record_type: 'TXT';
  verified: boolean;
  answers: string[];
  authority: string;
  mutation_capability: 'blocked_without_authorized_adapter';
  checkedAt: string;
};

function sessionHeaders() {
  const token = localStorage.getItem('atlas_access_token') || '';
  const orgId = localStorage.getItem('atlas_org_id') || '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers['x-atlas-org-id'] = orgId;
  return headers;
}

export function AtlasCloudDomains() {
  const [hostname, setHostname] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [result, setResult] = useState<DomainVerification | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const url = new URL(CONTROL_URL);
      url.searchParams.set('api', 'cloud-domain-verify');
      url.searchParams.set('hostname', hostname.trim());
      url.searchParams.set('expected', expectedValue.trim());
      const response = await fetch(url, { headers: sessionHeaders(), cache: 'no-store' });
      const body = await response.json().catch(() => ({ error: 'invalid_response' }));
      if (!response.ok) throw new Error(String(body?.error || `request_failed_${response.status}`));
      setResult(body as DomainVerification);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'domain_verification_failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="atlas-cloud-page atlas-cloud-control-page">
      <CloudSubnav />
      <header className="atlas-cloud-header">
        <p className="eyebrow">ATLAS Cloud · Domain Control</p>
        <h1>Domain & DNS Manager</h1>
        <p>
          Verify public DNS evidence through the ATLAS control plane. DNS mutations remain fail-closed
          until an authenticated provider adapter is configured and authorized.
        </p>
      </header>

      <section className="atlas-cloud-kpi-grid">
        <article><span>Verification</span><strong>Public DNS</strong></article>
        <article><span>Record type</span><strong>TXT</strong></article>
        <article><span>Mutation mode</span><strong>Blocked</strong></article>
        <article><span>Provider claims</span><strong>Evidence only</strong></article>
      </section>

      <form className="atlas-cloud-toolbox atlas-form" onSubmit={verify}>
        <div>
          <p className="eyebrow">DNS evidence</p>
          <h2>Verify TXT record</h2>
          <p>
            The expected value is used only for this verification request. This surface does not save
            credentials, provider tokens or DNS secrets.
          </p>
        </div>
        <label>
          <span>Hostname</span>
          <input
            required
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="_openai.atlasenterprisesuite.com"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label>
          <span>Expected TXT value</span>
          <input
            required
            value={expectedValue}
            onChange={(event) => setExpectedValue(event.target.value)}
            placeholder="Verification value"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" disabled={running}>{running ? 'Verifying…' : 'Verify public DNS'}</button>
      </form>

      {error ? (
        <div className="atlas-cloud-state error" role="alert">
          <strong>DNS verification blocked</strong><span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <section className="atlas-cloud-toolbox">
          <div className="atlas-cloud-section-heading">
            <div><p className="eyebrow">Evidence result</p><h2>{result.hostname}</h2></div>
            <strong>{result.verified ? 'Verified' : 'Not verified'}</strong>
          </div>
          <dl>
            <div><dt>Record type</dt><dd>{result.record_type}</dd></div>
            <div><dt>Authority</dt><dd>{result.authority}</dd></div>
            <div><dt>Checked</dt><dd>{result.checkedAt}</dd></div>
            <div><dt>Mutation capability</dt><dd>{result.mutation_capability}</dd></div>
          </dl>
          <pre className="atlas-cloud-json-result">{JSON.stringify({ verified: result.verified, answers: result.answers }, null, 2)}</pre>
        </section>
      ) : null}

      <p className="atlas-cloud-truth-note">
        This manager verifies public DNS state only. It does not claim registrar ownership, Cloudflare
        connectivity, zone write access or successful DNS mutation without authenticated provider evidence.
      </p>
    </section>
  );
}
