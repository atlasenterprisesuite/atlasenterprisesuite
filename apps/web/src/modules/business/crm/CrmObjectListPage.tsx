import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CrmObjectType, CrmPage } from '../../../../../../packages/core/src/crm';
import { CrmApiError, crmApi } from './crmApi';

function errorMessage(error: unknown): string {
  if (!(error instanceof CrmApiError)) return 'CRM records are unavailable.';
  if (error.code === 'forbidden_scope') return 'Degraded connection: the provider did not grant the scope required for this workspace.';
  if (error.code === 'expired_credential') return 'Expired connection: reconnect HubSpot before reading CRM records.';
  if (error.code === 'connection_not_ready') return 'CRM connection is not ready for provider-backed reads.';
  if (error.code === 'rate_limited') {
    return error.retryAfterSeconds === null
      ? 'HubSpot rate limit reached. Try again shortly.'
      : `HubSpot rate limit reached. Retry after ${error.retryAfterSeconds} seconds.`;
  }
  return error.message;
}

export function CrmObjectListPage({
  objectType,
  title,
  description,
  detailBase
}: {
  objectType: CrmObjectType;
  title: string;
  description: string;
  detailBase?: string;
}) {
  const [page, setPage] = useState<CrmPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  const load = async (query: string, cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const operation = query ? 'crm.search' : 'crm.list';
      const result = await crmApi<{ page: CrmPage }>(operation, {
        objectType,
        limit: 25,
        cursor,
        ...(query ? { query } : {})
      });
      setPage(result.page);
    } catch (caught) {
      setPage(null);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchInput('');
    setActiveQuery('');
    void load('', null);
  }, [objectType]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchInput.trim();
    setActiveQuery(query);
    void load(query, null);
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
    void load('', null);
  };

  return (
    <section className="crm-page page-stack" aria-labelledby={`crm-${objectType}-title`}>
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM · HubSpot</p>
        <h1 id={`crm-${objectType}-title`}>{title}</h1>
        <p>{description}</p>
      </header>

      <form className="crm-search" role="search" onSubmit={submitSearch}>
        <label>
          <span>Search provider records</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
          />
        </label>
        <button type="submit" disabled={loading}>Search</button>
        {activeQuery ? <button type="button" onClick={clearSearch} disabled={loading}>Clear</button> : null}
      </form>

      {activeQuery ? <p className="crm-query-note">Provider search: “{activeQuery}”</p> : null}
      {loading ? <div className="crm-loading" role="status">Loading provider records…</div> : null}
      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}

      {!loading && !error && page?.records.length === 0 ? (
        <div className="empty-state">
          <strong>No provider records found</strong>
          <span>{activeQuery ? 'Try a different provider-backed search.' : 'The connected provider returned an empty page.'}</span>
        </div>
      ) : null}

      {!loading && !error && page && page.records.length > 0 ? (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <caption className="sr-only">{title} returned by HubSpot</caption>
            <thead><tr><th>Name</th><th>Source</th><th>Updated</th></tr></thead>
            <tbody>
              {page.records.map((record) => (
                <tr key={`${record.objectType}:${record.providerId}`}>
                  <td>
                    {detailBase ? (
                      <Link to={`${detailBase}/${encodeURIComponent(record.providerId)}`}>{record.displayName}</Link>
                    ) : record.displayName}
                  </td>
                  <td><span className="crm-source">HubSpot</span></td>
                  <td>{record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'Not provided'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="crm-pagination" aria-label="CRM pagination">
        <button
          type="button"
          disabled={loading || !page?.nextCursor}
          onClick={() => page?.nextCursor && void load(activeQuery, page.nextCursor)}
        >
          Next page
        </button>
        <span>{page?.nextCursor ? 'More provider records available' : 'End of current provider results'}</span>
      </div>
    </section>
  );
}

const activityTypes = [
  ['task', 'Tasks'],
  ['call', 'Calls'],
  ['meeting', 'Meetings'],
  ['note', 'Notes'],
  ['email', 'Emails']
] as const satisfies readonly (readonly [CrmObjectType, string])[];

export function CrmActivitiesPage() {
  const [objectType, setObjectType] = useState<CrmObjectType>('task');
  const label = activityTypes.find(([type]) => type === objectType)?.[1] ?? 'Activities';

  return (
    <div className="page-stack">
      <label className="crm-activity-filter">
        <span>Activity type</span>
        <select value={objectType} onChange={(event) => setObjectType(event.target.value as CrmObjectType)}>
          {activityTypes.map(([type, name]) => <option key={type} value={type}>{name}</option>)}
        </select>
      </label>
      <CrmObjectListPage
        key={objectType}
        objectType={objectType}
        title={label}
        description="Provider-backed activity history. ATLAS does not combine or invent activity records client-side."
      />
    </div>
  );
}
