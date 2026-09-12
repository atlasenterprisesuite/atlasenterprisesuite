import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getHospitalityReadiness,
  hasHospitalityPermission,
  issueHospitalityCredential,
  listHospitalityCredentials,
  listHospitalityRooms,
  revokeHospitalityCredential,
  type HospitalityCredential,
  type HospitalityPermission,
  type HospitalityProvider,
  type HospitalityRoom
} from '../../lib/hospitalityApi';
import { HospitalitySubnav } from './HospitalitySubnav';

function localInputValue(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

function initialTimes() {
  const start = new Date();
  return {
    startsAt: localInputValue(start),
    expiresAt: localInputValue(new Date(start.getTime() + 24 * 60 * 60 * 1000))
  };
}

export function CredentialsPage() {
  const [providers, setProviders] = useState<HospitalityProvider[]>([]);
  const [permissions, setPermissions] = useState<HospitalityPermission[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState<HospitalityRoom[]>([]);
  const [credentials, setCredentials] = useState<HospitalityCredential[]>([]);
  const [assignmentReference, setAssignmentReference] = useState('');
  const [{ startsAt, expiresAt }, setTimes] = useState(initialTimes);
  const [reason, setReason] = useState<'guest_checkin' | 'replacement' | 'staff_authorized'>('guest_checkin');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const properties = useMemo(
    () => [...new Set(providers.map((provider) => provider.property_id).filter(Boolean))],
    [providers]
  );
  const propertyProviders = useMemo(
    () => providers.filter((provider) => provider.property_id === propertyId),
    [providers, propertyId]
  );
  const selectedProvider = propertyProviders.find((provider) => provider.id === providerId) || null;
  const verifiedRooms = useMemo(
    () => rooms.filter((room) => room.status === 'verified' && (!providerId || room.provider_instance_id === providerId)),
    [rooms, providerId]
  );
  const canIssuePermission = hasHospitalityPermission(permissions, 'hospitality.access.issue');
  const canRevoke = hasHospitalityPermission(permissions, 'hospitality.access.revoke');
  const canIssue = Boolean(
    canIssuePermission &&
    selectedProvider?.state === 'ready' &&
    selectedProvider.capabilities?.includes('credential.issue') &&
    verifiedRooms.some((room) => room.atlas_room_id === roomId)
  );

  async function refreshReadiness() {
    const readiness = await getHospitalityReadiness();
    const nextProviders = readiness.providers || [];
    setProviders(nextProviders);
    setPermissions(readiness.permissions || []);
    const firstProperty = nextProviders.find((provider) => provider.property_id)?.property_id || '';
    setPropertyId((current) => current || firstProperty);
  }

  async function refreshProperty(property: string) {
    if (!property) {
      setRooms([]);
      setCredentials([]);
      return;
    }
    const [nextRooms, nextCredentials] = await Promise.all([
      listHospitalityRooms(property),
      listHospitalityCredentials(property)
    ]);
    setRooms(nextRooms);
    setCredentials(nextCredentials);
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        await refreshReadiness();
      } catch (cause) {
        setMessage({ kind: 'error', text: cause instanceof Error ? cause.message : 'Unable to load credential readiness.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const firstProvider = propertyProviders[0]?.id || '';
    if (!propertyProviders.some((provider) => provider.id === providerId)) setProviderId(firstProvider);
  }, [propertyProviders, providerId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        await refreshProperty(propertyId);
      } catch (cause) {
        setRooms([]);
        setCredentials([]);
        setMessage({ kind: 'error', text: cause instanceof Error ? cause.message : 'Unable to load credential data.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId]);

  useEffect(() => {
    if (!verifiedRooms.some((room) => room.atlas_room_id === roomId)) {
      setRoomId(verifiedRooms[0]?.atlas_room_id || '');
    }
  }, [verifiedRooms, roomId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canIssue || !selectedProvider) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const credential = await issueHospitalityCredential({
        property_id: propertyId,
        provider_instance_id: selectedProvider.id,
        room_id: roomId,
        assignment_reference: assignmentReference.trim(),
        starts_at: new Date(startsAt).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        reason
      });
      setMessage({ kind: 'success', text: `Credential reference ${credential.id} recorded.` });
      setAssignmentReference('');
      setTimes(initialTimes());
      await refreshProperty(propertyId);
      await refreshReadiness();
    } catch (cause) {
      setMessage({ kind: 'error', text: cause instanceof Error ? cause.message : 'Credential issuance failed.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(credential: HospitalityCredential) {
    if (!canRevoke || !credential.id || !propertyId) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await revokeHospitalityCredential({
        property_id: propertyId,
        credential_id: credential.id,
        reason: 'authorized_operator_revoke'
      });
      setMessage({ kind: 'success', text: `Credential reference ${credential.id} revoked.` });
      await refreshProperty(propertyId);
    } catch (cause) {
      setMessage({ kind: 'error', text: cause instanceof Error ? cause.message : 'Credential revocation failed.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality</p>
        <h1>Room Credentials</h1>
        <p>Issue and revoke only through a verified provider and verified room mapping. ATLAS stores external credential references and lifecycle status, not credential material.</p>
      </header>
      <HospitalitySubnav />

      {message ? <div className={`hospitality-message ${message.kind}`} role="status">{message.text}</div> : null}

      <form className="feature-card wide hospitality-form" onSubmit={submit}>
        <div className="card-heading">
          <div><p className="eyebrow">Authorized operation</p><h2>Issue credential</h2></div>
          <span className={`hospitality-state ${canIssue ? 'hospitality-state-ready' : 'hospitality-state-configured_unverified'}`}>
            {canIssue ? 'Ready' : 'Blocked'}
          </span>
        </div>

        <div className="hospitality-form-grid">
          <label className="field"><span>Property</span><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={loading || properties.length === 0}>{properties.length === 0 ? <option value="">No configured properties</option> : null}{properties.map((property) => <option key={property} value={property}>{property}</option>)}</select></label>
          <label className="field"><span>Provider</span><select value={providerId} onChange={(event) => setProviderId(event.target.value)} disabled={loading || propertyProviders.length === 0}>{propertyProviders.length === 0 ? <option value="">No provider</option> : null}{propertyProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.display_name} · {provider.state}</option>)}</select></label>
          <label className="field"><span>Verified room</span><select value={roomId} onChange={(event) => setRoomId(event.target.value)} disabled={loading || verifiedRooms.length === 0}>{verifiedRooms.length === 0 ? <option value="">No verified rooms</option> : null}{verifiedRooms.map((room) => <option key={room.id} value={room.atlas_room_id}>{room.atlas_room_id}</option>)}</select></label>
          <label className="field"><span>Reservation / assignment reference</span><input value={assignmentReference} onChange={(event) => setAssignmentReference(event.target.value)} required autoComplete="off" /></label>
          <label className="field"><span>Valid from</span><input type="datetime-local" value={startsAt} onChange={(event) => setTimes((current) => ({ ...current, startsAt: event.target.value }))} required /></label>
          <label className="field"><span>Expires</span><input type="datetime-local" value={expiresAt} onChange={(event) => setTimes((current) => ({ ...current, expiresAt: event.target.value }))} required /></label>
          <label className="field"><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}><option value="guest_checkin">Guest check-in</option><option value="replacement">Replacement</option><option value="staff_authorized">Authorized staff access</option></select></label>
        </div>

        <div className="hospitality-actions">
          <button className="action-button" type="submit" disabled={!canIssue || submitting || !assignmentReference.trim()}>{submitting ? 'Processing…' : 'Issue through verified provider'}</button>
          <span>{!canIssuePermission ? 'Your ATLAS permissions do not allow issuance.' : selectedProvider?.state !== 'ready' ? 'The selected provider is not verified ready.' : verifiedRooms.length === 0 ? 'No verified room mapping is available.' : 'A verified provider, capability, and room mapping are required.'}</span>
        </div>
      </form>

      <div className="feature-card wide hospitality-table-wrap">
        <div className="card-heading"><div><p className="eyebrow">Lifecycle references</p><h2>Credentials</h2></div><span>{credentials.length}</span></div>
        {credentials.length === 0 ? <p>No credential references have been recorded for this property.</p> : (
          <table className="hospitality-table">
            <thead><tr><th>Room</th><th>Assignment</th><th>Type</th><th>Status</th><th>Valid until</th><th>Action</th></tr></thead>
            <tbody>{credentials.map((credential) => (
              <tr key={credential.id}>
                <td>{credential.room_id || '—'}</td>
                <td>{credential.assignment_reference || '—'}</td>
                <td>{credential.credential_type || 'provider reference'}</td>
                <td><span className={`hospitality-state hospitality-state-${credential.status === 'issued' ? 'ready' : 'configured_unverified'}`}>{credential.status || 'unknown'}</span></td>
                <td>{credential.expires_at || '—'}</td>
                <td><button className="text-link" type="button" disabled={!canRevoke || submitting || credential.status !== 'issued'} onClick={() => void revoke(credential)}>Revoke</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
