import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMailProvisioningReadiness,
  provisionMailAliases,
  type MailAliasResult,
  type MailProvisioningReadiness
} from '../../lib/mailProvisioningApi';

const DEPARTMENT_ALIASES = [
  'office', 'executive', 'accounting', 'finance', 'billing', 'payroll', 'hr',
  'careers', 'knowledge', 'health', 'patients', 'enterprise', 'commerce',
  'democracy', 'reconstruction', 'energy', 'water', 'agriculture', 'industry',
  'tourism', 'logistics', 'mobility', 'publicsafety', 'emergency', 'security',
  'media', 'communications', 'documents', 'specialprojects', 'venezuela',
  'southamerica', 'centralamerica', 'latincommand', 'support', 'privacy',
  'legal', 'security-alerts'
] as const;

export function AtlasMailProvisioningPage() {
  const [readiness, setReadiness] = useState<MailProvisioningReadiness | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<MailAliasResult[]>([]);

  useEffect(() => {
    getMailProvisioningReadiness()
      .then((value) => { setReadiness(value); setError(''); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'readiness_unavailable'));
  }, []);

  const domain = readiness?.domain || 'atlasenterprisesuite.com';
  const canProvision = readiness?.provider_verified === true && readiness.provisioning_enabled === true;
  const resultByAddress = useMemo(
    () => new Map(results.map((result) => [result.address, result])),
    [results]
  );

  async function provisionAll() {
    if (!canProvision) return;
    setBusy(true);
    setError('');
    try {
      const response = await provisionMailAliases([...DEPARTMENT_ALIASES]);
      setResults(response.results);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'provisioning_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-stack" aria-labelledby="atlas-mail-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Communications</p>
        <h1 id="atlas-mail-title">ATLAS Mail Provisioning</h1>
        <p>Governed departmental aliases for the ATLAS domain. Secrets remain server-side and provider mutations stay fail-closed until authenticated evidence verifies Cloudflare Email Routing.</p>
      </header>

      <div className="notice" role="status">
        State: {readiness?.state || 'checking'}. Provider: {readiness?.provider || 'not configured'}.
        {readiness?.blocker ? ` Blocker: ${readiness.blocker}.` : ''}
        {error ? ` Error: ${error}.` : ''}
      </div>

      <div className="stat-grid" aria-label="Mail provisioning status">
        <article><strong>{DEPARTMENT_ALIASES.length}</strong><span>approved departmental aliases</span></article>
        <article><strong>{readiness?.destination_verified ? 'Verified' : 'Unverified'}</strong><span>forwarding destination</span></article>
        <article><strong>{canProvision ? 'Enabled' : 'Blocked'}</strong><span>provider mutations</span></article>
      </div>

      <article className="feature-card">
        <p className="eyebrow">Provisioning gate</p>
        <h2>{canProvision ? 'Ready to create aliases' : 'Authorization required'}</h2>
        <p>This creates inbound forwarding aliases, not independent paid mailboxes. Sending as the ATLAS domain requires a separately verified outbound mail provider.</p>
        <button type="button" onClick={provisionAll} disabled={!canProvision || busy}>
          {busy ? 'Provisioning…' : 'Provision approved aliases'}
        </button>
      </article>

      <article className="feature-card">
        <p className="eyebrow">Approved address plan</p>
        <h2>{domain}</h2>
        <ul>
          {DEPARTMENT_ALIASES.map((localPart) => {
            const address = `${localPart}@${domain}`;
            const result = resultByAddress.get(address);
            return <li key={localPart}>{address}{result ? ` — ${result.status}` : ''}</li>;
          })}
        </ul>
      </article>

      <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
    </section>
  );
}
