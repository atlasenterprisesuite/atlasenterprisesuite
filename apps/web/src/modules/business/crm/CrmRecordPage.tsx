import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  CrmAssociation,
  CrmAssociationPage,
  CrmObjectType,
  CrmRecord
} from '../../../../../../packages/core/src/crm';
import { CrmApiError, crmApi } from './crmApi';

function routeForObject(objectType: CrmObjectType, providerId: string): string | null {
  const encoded = encodeURIComponent(providerId);
  if (objectType === 'contact') return `/crm/contacts/${encoded}`;
  if (objectType === 'company') return `/crm/companies/${encoded}`;
  if (objectType === 'deal') return `/crm/deals/${encoded}`;
  if (objectType === 'ticket') return `/crm/service/${encoded}`;
  return null;
}

function fieldLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase());
}

export function CrmRecordPage({
  objectType,
  title,
  associationTargets
}: {
  objectType: CrmObjectType;
  title: string;
  associationTargets: readonly CrmObjectType[];
}) {
  const { providerId = '' } = useParams();
  const [record, setRecord] = useState<CrmRecord | null>(null);
  const [associations, setAssociations] = useState<CrmAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [associationWarning, setAssociationWarning] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setAssociationWarning(false);
      try {
        const result = await crmApi<{ record: CrmRecord }>('crm.get', {
          objectType,
          providerId
        });
        if (!active) return;
        setRecord(result.record);

        const associationResults = await Promise.allSettled(
          associationTargets.map(async (targetObjectType) => {
            const pages: CrmAssociation[] = [];
            const seenCursors = new Set<string>();
            let cursor: string | null = null;
            do {
              const result: { associations: CrmAssociationPage } = await crmApi<{ associations: CrmAssociationPage }>('crm.associations', {
                objectType,
                providerId,
                targetObjectType,
                cursor
              });
              pages.push(...result.associations.associations);
              const nextCursor: string | null = result.associations.nextCursor;
              if (!nextCursor) break;
              if (seenCursors.has(nextCursor)) {
                throw new Error('CRM association pagination returned a repeated cursor');
              }
              seenCursors.add(nextCursor);
              cursor = nextCursor;
            } while (true);
            return pages;
          })
        );
        if (!active) return;
        const normalized: CrmAssociation[] = [];
        let partial = false;
        for (const resultItem of associationResults) {
          if (resultItem.status === 'fulfilled') {
            normalized.push(...resultItem.value);
          } else {
            partial = true;
          }
        }
        setAssociations(normalized);
        setAssociationWarning(partial);
      } catch (caught) {
        if (!active) return;
        setRecord(null);
        setAssociations([]);
        setError(
          caught instanceof CrmApiError
            ? caught.message
            : 'CRM record is unavailable.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [objectType, providerId, associationTargets]);

  return (
    <section className="crm-page page-stack" aria-labelledby="crm-record-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM · HubSpot</p>
        <h1 id="crm-record-title">{record?.displayName || title}</h1>
        <p>Provider-backed detail view. Only fields returned by the authorized provider are rendered.</p>
      </header>

      {loading ? <div className="crm-loading" role="status">Loading provider record…</div> : null}
      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}

      {!loading && !error && record ? (
        <>
          <div className="crm-record-meta">
            <span className="crm-source">Source: HubSpot</span>
            <span>Provider ID: {record.providerId}</span>
            {record.updatedAt ? <span>Updated: {new Date(record.updatedAt).toLocaleString()}</span> : null}
          </div>

          <dl className="crm-field-grid">
            {Object.entries(record.fields).map(([key, value]) => (
              <div key={key}>
                <dt>{fieldLabel(key)}</dt>
                <dd>{value === null || value === '' ? 'Not provided' : String(value)}</dd>
              </div>
            ))}
          </dl>
          {Object.keys(record.fields).length === 0 ? (
            <div className="empty-state"><strong>No additional fields returned</strong><span>The provider response did not include optional fields for this record.</span></div>
          ) : null}

          <section className="crm-associations" aria-labelledby="crm-associations-title">
            <h2 id="crm-associations-title">Associations</h2>
            {associationWarning ? <div className="crm-banner degraded" role="status">Some association types are unavailable with the current provider scopes.</div> : null}
            {associations.length === 0 ? (
              <div className="empty-state"><strong>No associations returned</strong><span>The provider returned no authorized associations for this record.</span></div>
            ) : (
              <ul>
                {associations.map((association) => {
                  const route = routeForObject(association.toObjectType, association.toProviderId);
                  const label = `${association.toObjectType} ${association.toProviderId}`;
                  return (
                    <li key={`${association.toObjectType}:${association.toProviderId}:${association.associationType ?? ''}`}>
                      {route ? <Link to={route}>{label}</Link> : <span>{label}</span>}
                      {association.associationType ? <small>{association.associationType}</small> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
