import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  listWirelessLineClaims,
  submitWirelessLineClaim,
  type WirelessLineClaim
} from '../../lib/wirelessLineApi';

export function AtlasWirelessLinePage() {
  const [claims, setClaims] = useState<WirelessLineClaim[] | null>(null);
  const [number, setNumber] = useState('');
  const [ownershipAsserted, setOwnershipAsserted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    listWirelessLineClaims()
      .then((result) => { if (alive) setClaims(result); })
      .catch(() => { if (alive) setError('Line registry unavailable. Nothing was changed.'); });
    return () => { alive = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownershipAsserted || loading) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await submitWirelessLineClaim(number, ownershipAsserted);
      setClaims((previous) => [result, ...(previous || [])]);
      setSuccess(`Request recorded for ${result.masked_number}. Ownership is not yet verified.`);
      setNumber('');
      setOwnershipAsserted(false);
    } catch {
      setError('Unable to record this request. Confirm the number and your ATLAS organization permissions; do not remove your existing eSIM.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-line-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless</p>
        <h1 id="atlas-wireless-line-title">Register a line for future ATLAS service</h1>
        <p>This private enrollment records your request for a number you control. It does not activate mobile service, verify ownership, transfer a number or change your current carrier.</p>
      </header>

      <div className="notice" role="status">
        Self-attested enrollment only. ATLAS activation and number portability remain fail-closed until an authorized network partner and a verified ownership/port-in process are available.
      </div>

      <article className="feature-card">
        <h2>Request line association</h2>
        <form onSubmit={submit}>
          <label htmlFor="atlas-line-number">US mobile phone number</label>
          <input
            id="atlas-line-number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="+1 (786) 555-0123"
            required
          />
          <label>
            <input
              type="checkbox"
              checked={ownershipAsserted}
              onChange={(event) => setOwnershipAsserted(event.target.checked)}
              required
            />
            I own or am authorized to manage this phone number, and I request its registration for future verification with ATLAS.
          </label>
          <button type="submit" disabled={!ownershipAsserted || loading}>
            {loading ? 'Recording request…' : 'Register verification request'}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
      </article>

      <article className="feature-card">
        <h2>Your ATLAS line requests</h2>
        {claims === null && <p>Loading private line requests…</p>}
        {claims?.length === 0 && <p>No requests recorded for this ATLAS identity.</p>}
        {claims?.map((claim) => (
          <div key={claim.id}>
            <strong>{claim.masked_number}</strong>
            <p>State: {claim.status}. Carrier verification: pending. Cellular service: not provided by ATLAS.</p>
          </div>
        ))}
      </article>

      <Link className="text-link" to="/connect/wireless">Back to ATLAS Wireless</Link>
    </section>
  );
}
