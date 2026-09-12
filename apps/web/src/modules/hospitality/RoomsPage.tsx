import { useEffect, useMemo, useState } from 'react';
import {
  getHospitalityReadiness,
  listHospitalityRooms,
  type HospitalityProvider,
  type HospitalityRoom
} from '../../lib/hospitalityApi';
import { HospitalitySubnav } from './HospitalitySubnav';

export function RoomsPage() {
  const [providers, setProviders] = useState<HospitalityProvider[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<HospitalityRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const properties = useMemo(
    () => [...new Set(providers.map((provider) => provider.property_id).filter(Boolean))],
    [providers]
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const readiness = await getHospitalityReadiness();
        const nextProviders = readiness.providers || [];
        setProviders(nextProviders);
        const firstProperty = nextProviders.find((provider) => provider.property_id)?.property_id || '';
        setPropertyId((current) => current || firstProperty);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load Hospitality properties.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setRooms([]);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        setRooms(await listHospitalityRooms(propertyId));
      } catch (cause) {
        setRooms([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load room mappings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId]);

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality</p>
        <h1>Room Mappings</h1>
        <p>Map each ATLAS room to the corresponding room identifier in the authorized access-control provider. Only verified mappings may be used for issuance.</p>
      </header>
      <HospitalitySubnav />

      <div className="hospitality-toolbar">
        <label className="field hospitality-property-select">
          <span>Property</span>
          <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={properties.length === 0}>
            {properties.length === 0 ? <option value="">No configured properties</option> : null}
            {properties.map((property) => <option key={property} value={property}>{property}</option>)}
          </select>
        </label>
        <p>{loading ? 'Loading mappings…' : `${rooms.length} room mapping${rooms.length === 1 ? '' : 's'}`}</p>
      </div>

      {error ? <div className="hospitality-message error" role="alert">{error}</div> : null}
      {!loading && !error && !propertyId ? (
        <div className="feature-card wide hospitality-empty">
          <h2>No property provider is configured</h2>
          <p>Create and verify an authorized provider instance before room mappings can be reviewed.</p>
        </div>
      ) : null}
      {!loading && !error && propertyId && rooms.length === 0 ? (
        <div className="feature-card wide hospitality-empty">
          <h2>No room mappings found</h2>
          <p>ATLAS will block credential issuance until the requested room has a verified provider mapping.</p>
        </div>
      ) : null}

      {rooms.length ? (
        <div className="feature-card wide hospitality-table-wrap">
          <table className="hospitality-table">
            <thead><tr><th>ATLAS room</th><th>Provider room</th><th>Provider instance</th><th>Status</th><th>Last verified</th></tr></thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.atlas_room_id}</td>
                  <td>{room.provider_room_id}</td>
                  <td>{room.provider_instance_id}</td>
                  <td><span className={`hospitality-state hospitality-state-${room.status === 'verified' ? 'ready' : 'configured_unverified'}`}>{room.status}</span></td>
                  <td>{room.last_verified_at || 'Never verified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
