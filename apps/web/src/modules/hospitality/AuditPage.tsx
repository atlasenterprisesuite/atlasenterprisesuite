import { useEffect, useMemo, useState } from 'react';
import {
  getHospitalityAudit,
  getHospitalityReadiness,
  hasHospitalityPermission,
  type HospitalityAuditRow,
  type HospitalityPermission,
  type HospitalityProvider
} from '../../lib/hospitalityApi';
import { HospitalitySubnav } from './HospitalitySubnav';

export function AuditPage() {
  const [providers, setProviders] = useState<HospitalityProvider[]>([]);
  const [permissions, setPermissions] = useState<HospitalityPermission[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [rows, setRows] = useState<HospitalityAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const properties = useMemo(
    () => [...new Set(providers.map((provider) => provider.property_id).filter(Boolean))],
    [providers]
  );
  const canReadAudit = hasHospitalityPermission(permissions, 'hospitality.access.audit');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const readiness = await getHospitalityReadiness();
        setProviders(readiness.providers || []);
        setPermissions(readiness.permissions || []);
        setPropertyId(readiness.providers?.find((provider) => provider.property_id)?.property_id || '');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load audit permissions.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!propertyId || !canReadAudit) {
      setRows([]);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        setRows(await getHospitalityAudit(propertyId));
      } catch (cause) {
        setRows([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load Hospitality audit events.');
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, canReadAudit]);

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality</p>
        <h1>Access Audit</h1>
        <p>Organization- and property-scoped evidence for credential requests, issuance, revocation, reconciliation, and provider outcomes.</p>
      </header>
      <HospitalitySubnav />

      <div className="hospitality-toolbar">
        <label className="field hospitality-property-select">
          <span>Property</span>
          <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={properties.length === 0 || !canReadAudit}>
            {properties.length === 0 ? <option value="">No configured properties</option> : null}
            {properties.map((property) => <option key={property} value={property}>{property}</option>)}
          </select>
        </label>
        <p>{loading ? 'Loading audit…' : `${rows.length} event${rows.length === 1 ? '' : 's'}`}</p>
      </div>

      {!canReadAudit && !loading ? (
        <div className="hospitality-message error" role="alert">Your ATLAS permissions do not allow Hospitality audit access.</div>
      ) : null}
      {error ? <div className="hospitality-message error" role="alert">{error}</div> : null}

      {canReadAudit && !loading && !error && rows.length === 0 ? (
        <div className="feature-card wide hospitality-empty"><h2>No audit events found</h2><p>No Hospitality access operations have been recorded for this property.</p></div>
      ) : null}

      {rows.length ? (
        <div className="feature-card wide hospitality-table-wrap">
          <table className="hospitality-table">
            <thead><tr><th>Time</th><th>Action</th><th>User</th><th>Record</th><th>Safe metadata</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={String(row.id)}>
                <td>{row.created_at}</td>
                <td>{row.action}</td>
                <td>{row.user_id || 'System'}</td>
                <td>{row.record_id || '—'}</td>
                <td><code className="hospitality-audit-json">{JSON.stringify(row.new_data || {})}</code></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
