import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getTelephonyReadiness,
  startTelephonyCall,
  type TelephonyCallAccepted,
  type TelephonyReadiness
} from '../../lib/telephonyApi';
import './atlas-telephony.css';

function humanize(value: string | null | undefined) {
  if (!value) return 'None';
  return value.replaceAll('_', ' ');
}

export function AtlasTelephonyPage() {
  const [readiness, setReadiness] = useState<TelephonyReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<TelephonyCallAccepted | null>(null);
  const [to, setTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [consentReference, setConsentReference] = useState('');

  const refresh = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      setReadiness(await getTelephonyReadiness());
    } catch (cause) {
      setReadiness(null);
      setError(cause instanceof Error ? cause.message : 'readiness_unavailable');
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const callable = readiness?.verified === true && readiness.state === 'verified';
  const credentialCount = useMemo(
    () => readiness ? Object.values(readiness.credentials).filter(Boolean).length : 0,
    [readiness]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!callable || calling) return;
    setCalling(true);
    setError('');
    setAccepted(null);
    try {
      const result = await startTelephonyCall({
        to: to.trim(),
        purpose: purpose.trim(),
        consentReference: consentReference.trim()
      });
      setAccepted(result);
      setTo('');
      setPurpose('');
      setConsentReference('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'call_request_failed');
    } finally {
      setCalling(false);
    }
  }

  return (
    <section className="page-stack atlas-telephony" aria-labelledby="atlas-telephony-title">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">ATLAS Connect · Communication</p>
          <h1 id="atlas-telephony-title">ATLAS Calling</h1>
          <p>Governed outbound calling through a server-side provider adapter. ATLAS verifies the configured provider immediately before each call and never exposes provider secrets to the browser.</p>
        </div>
        <button className="atlas-telephony-refresh" type="button" onClick={refresh} disabled={checking}>
          {checking ? 'Verifying…' : 'Verify provider'}
        </button>
      </header>

      <div className={'atlas-telephony-gate ' + (callable ? 'ready' : 'blocked')} role="status" aria-live="polite">
        <div>
          <span>Provider gate</span>
          <strong>{loading ? 'Checking…' : callable ? 'Verified' : 'Fail-closed'}</strong>
        </div>
        <p>
          {readiness
            ? callable
              ? 'Live provider probe passed at ' + new Date(readiness.checked_at).toLocaleString() + '.'
              : 'Calling remains blocked. ' + humanize(readiness.blocker) + '.'
            : error
              ? 'Readiness unavailable: ' + humanize(error) + '.'
              : 'Provider readiness has not been verified.'}
        </p>
      </div>

      <div className="stat-grid" aria-label="ATLAS calling readiness">
        <article><strong>{readiness?.provider || 'None'}</strong><span>provider adapter</span></article>
        <article><strong>{credentialCount}/5</strong><span>server settings present</span></article>
        <article><strong>{callable ? 'Enabled' : 'Blocked'}</strong><span>outbound origination</span></article>
        <article><strong>Off</strong><span>recording by default</span></article>
      </div>

      <div className="atlas-telephony-layout">
        <form className="atlas-telephony-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">Controlled outbound call</p>
            <h2>Start a verified call</h2>
            <p>A fresh provider check, active organization membership, RBAC permission, purpose, and consent evidence are required before ATLAS submits the call.</p>
          </div>

          <label className="field">
            <span>Destination · E.164</span>
            <input value={to} onChange={(event) => setTo(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+1407…" maxLength={16} required disabled={!callable || calling} />
          </label>

          <label className="field">
            <span>Call purpose</span>
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Authorized appointment follow-up" maxLength={300} required disabled={!callable || calling} />
          </label>

          <label className="field">
            <span>Consent / authorization reference</span>
            <input value={consentReference} onChange={(event) => setConsentReference(event.target.value)} placeholder="Internal consent record or authorization reference" maxLength={300} required disabled={!callable || calling} />
          </label>

          <button className="atlas-telephony-call" type="submit" disabled={!callable || calling || !to.trim() || !purpose.trim() || !consentReference.trim()}>
            {calling ? 'Submitting verified call…' : 'Start call'}
          </button>

          {!callable ? <p className="atlas-telephony-helper">This control unlocks only after the live provider probe returns verified.</p> : null}
        </form>

        <aside className="atlas-telephony-card" aria-label="Telephony trust boundary">
          <div><p className="eyebrow">Trust boundary</p><h2>What ATLAS verifies</h2></div>
          <ul className="atlas-telephony-checks">
            <li>Authenticated ATLAS session and active organization</li>
            <li>Telephony RBAC permission</li>
            <li>Server-side provider credentials only</li>
            <li>Exact Call Control connection readiness</li>
            <li>E.164 destination validation</li>
            <li>Purpose and consent reference</li>
            <li>Signed provider webhook before lifecycle updates</li>
            <li>Duplicate provider events rejected by persistent evidence ID</li>
          </ul>
          <div className="notice strong">Emergency calling is not inferred from ordinary PSTN connectivity and remains separately gated.</div>
        </aside>
      </div>

      {accepted ? (
        <div className="atlas-telephony-result" role="status">
          <span>Provider accepted the request</span>
          <strong>{accepted.state}</strong>
          <p>ATLAS session: {accepted.call_session_id}</p>
          <p>The final connected/completed state is updated only from verified provider webhooks.</p>
        </div>
      ) : null}

      {error ? <div className="atlas-telephony-error" role="alert"><strong>Request blocked</strong><span>{humanize(error)}</span></div> : null}

      <div className="row-actions">
        <Link className="text-link" to="/voice">Open ATLAS Voice</Link>
        <Link className="text-link" to="/connect/wireless">Open ATLAS Wireless</Link>
        <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
      </div>
    </section>
  );
}
