import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getActiveAtlasOrganization, getAtlasAccessToken } from '../../lib/atlasSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

type Readiness = {
  ok: boolean;
  organization_id?: string;
  role?: string;
  provider?: { id: string | null; state: string };
  issuance_enabled?: boolean;
  blocker?: string | null;
  checked_at?: string;
};

type IssueResult = {
  ok: boolean;
  credential_id?: string;
  provider_id?: string;
  state?: string;
  error?: string;
  errors?: string[];
};

type FormState = {
  propertyId: string;
  roomId: string;
  assignmentReference: string;
  startsAt: string;
  expiresAt: string;
  reason: 'guest_checkin' | 'replacement' | 'staff_authorized';
};

function defaultForm(): FormState {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const local = (date: Date) => {
    const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 16);
  };
  return {
    propertyId: '',
    roomId: '',
    assignmentReference: '',
    startsAt: local(start),
    expiresAt: local(end),
    reason: 'guest_checkin'
  };
}

async function callHospitality(api: 'readiness' | 'issue', init: RequestInit = {}) {
  const token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/atlas-hospitality-access?api=${api}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'invalid_response' }));
  if (!response.ok) throw Object.assign(new Error(data?.error || `request_failed_${response.status}`), { data });
  return data;
}

export function RoomAccessPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  const canAdminister = useMemo(
    () => ['owner', 'admin', 'platform_admin'].includes(readiness?.role || ''),
    [readiness?.role]
  );

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      await getActiveAtlasOrganization();
      const data = await callHospitality('readiness') as Readiness;
      setReadiness(data);
    } catch (error) {
      setReadiness(null);
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to load provider readiness.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await callHospitality('issue', {
        method: 'POST',
        body: JSON.stringify({
          property_id: form.propertyId,
          room_id: form.roomId,
          assignment_reference: form.assignmentReference,
          starts_at: new Date(form.startsAt).toISOString(),
          expires_at: new Date(form.expiresAt).toISOString(),
          reason: form.reason
        })
      }) as IssueResult;

      setMessage({
        kind: 'success',
        text: `Credential issued through ${result.provider_id || 'authorized provider'} · reference ${result.credential_id || 'recorded'}.`
      });
      await refresh();
    } catch (error: any) {
      const details = Array.isArray(error?.data?.errors) ? ` (${error.data.errors.join(', ')})` : '';
      setMessage({ kind: 'error', text: `${error instanceof Error ? error.message : 'Issuance failed'}${details}` });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality</p>
        <h1>Room Access</h1>
        <p>Governed issuance for authorized hotel room credentials. Provider secrets, card payloads and encoder commands stay server-side.</p>
      </header>

      <div className="hospitality-status-grid">
        <article className="feature-card">
          <p className="eyebrow">Identity boundary</p>
          <strong>{loading ? 'Checking…' : readiness?.organization_id ? 'Verified' : 'Unavailable'}</strong>
          <p>{readiness?.organization_id ? `Organization ${readiness.organization_id}` : 'An authenticated ATLAS organization is required.'}</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Access role</p>
          <strong>{loading ? 'Checking…' : readiness?.role || 'Unknown'}</strong>
          <p>{canAdminister ? 'Administrative issuance is permitted by the current ATLAS role.' : 'Owner, admin or platform_admin is required for issuance.'}</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Lock provider</p>
          <strong>{loading ? 'Checking…' : readiness?.provider?.state || 'Not available'}</strong>
          <p>{readiness?.provider?.id ? `Adapter: ${readiness.provider.id}` : 'No authorized lock/encoder adapter is configured yet.'}</p>
        </article>
      </div>

      {readiness?.blocker ? (
        <div className="notice strong" role="status">
          Production blocker: {readiness.blocker}. Identify the installed lock/encoder vendor and configure its authorized ATLAS adapter before a credential can be created.
        </div>
      ) : null}

      {message ? <div className={`hospitality-message ${message.kind}`} role="status">{message.text}</div> : null}

      <form className="hospitality-form feature-card wide" onSubmit={submit}>
        <div className="card-heading">
          <div><p className="eyebrow">Authorized operation</p><h2>Issue room credential</h2></div>
          <button className="text-link" type="button" onClick={() => void refresh()} disabled={loading || submitting}>Refresh readiness</button>
        </div>

        <div className="hospitality-form-grid">
          <label className="field"><span>Property ID</span><input value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required autoComplete="off" placeholder="Hotel property identifier" /></label>
          <label className="field"><span>Room</span><input value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} required autoComplete="off" placeholder="Room identifier" /></label>
          <label className="field"><span>Assignment / reservation reference</span><input value={form.assignmentReference} onChange={(e) => setForm({ ...form, assignmentReference: e.target.value })} required autoComplete="off" placeholder="Verified assignment reference" /></label>
          <label className="field"><span>Reason</span><select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as FormState['reason'] })}><option value="guest_checkin">Guest check-in</option><option value="replacement">Replacement credential</option><option value="staff_authorized">Authorized staff access</option></select></label>
          <label className="field"><span>Valid from</span><input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></label>
          <label className="field"><span>Expires</span><input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} required /></label>
        </div>

        <div className="hospitality-actions">
          <button className="action-button" type="submit" disabled={loading || submitting || !canAdminister || readiness?.provider?.state === 'not_configured'}>
            {submitting ? 'Issuing…' : 'Issue through authorized provider'}
          </button>
          <span>ATLAS records only the provider credential reference. It does not expose master keys, raw NFC/RFID data or encoder secrets.</span>
        </div>
      </form>
    </section>
  );
}
