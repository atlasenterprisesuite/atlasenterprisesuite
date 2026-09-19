import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { CrmObjectType, CrmRecord } from '../../../../../../packages/core/src/crm';
import type { SocialCrmHandoff, SocialCrmObjectType } from '../../../../../../packages/social/src/inbox';
import { CrmApiError, crmApi } from './crmApi';
import './crm.css';

type LocationState = { socialHandoff?: SocialCrmHandoff };

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() ?? '', lastName: parts.join(' ') };
}

function initialFields(handoff: SocialCrmHandoff, objectType: SocialCrmObjectType): Record<string, string> {
  if (objectType === 'contact') {
    const name = splitName(handoff.contactName);
    return { firstName: name.firstName, lastName: name.lastName, email: '', phone: '', lifecycleStage: 'lead' };
  }
  if (objectType === 'deal') {
    return { name: `${handoff.contactName} · ${handoff.platform} opportunity`, amount: '', currency: 'USD', pipeline: '', stage: '', closeDate: '' };
  }
  return { subject: `Social inquiry · ${handoff.contactName}`, pipeline: '', stage: '', priority: '' };
}

function targetRoute(record: CrmRecord) {
  if (record.objectType === 'contact') return `/crm/contacts/${encodeURIComponent(record.providerId)}`;
  if (record.objectType === 'deal') return `/crm/deals/${encodeURIComponent(record.providerId)}`;
  if (record.objectType === 'ticket') return `/crm/service/${encodeURIComponent(record.providerId)}`;
  return '/crm';
}

const labels: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  lifecycleStage: 'Lifecycle stage',
  name: 'Deal name',
  amount: 'Amount',
  currency: 'Currency',
  pipeline: 'Pipeline ID',
  stage: 'Stage ID',
  closeDate: 'Close date',
  subject: 'Ticket subject',
  priority: 'Priority'
};

export function CrmSocialHandoffPage() {
  const location = useLocation();
  const handoff = (location.state as LocationState | null)?.socialHandoff;
  const initialType = handoff?.suggestedObjectType ?? 'contact';
  const [objectType, setObjectType] = useState<SocialCrmObjectType>(initialType);
  const [fields, setFields] = useState<Record<string, string>>(() => handoff ? initialFields(handoff, initialType) : {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CrmRecord | null>(null);

  const sourceSummary = useMemo(() => handoff
    ? `${handoff.platform} · ${handoff.contactName}${handoff.handle ? ` · ${handoff.handle}` : ''}`
    : '', [handoff]);

  if (!handoff || handoff.source !== 'atlas-social') {
    return (
      <section className="crm-page page-stack">
        <header className="page-header"><p className="eyebrow">ATLAS CRM</p><h1>Social CRM handoff</h1><p>No Social Command Center conversation was supplied.</p></header>
        <Link className="text-link" to="/studio/social">Return to Social Command Center</Link>
      </section>
    );
  }

  function changeType(next: SocialCrmObjectType) {
    setObjectType(next);
    setFields(initialFields(handoff!, next));
    setCreated(null);
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setCreated(null);
    const payloadFields = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== '')
    );
    try {
      const result = await crmApi<{ record: CrmRecord }>('crm.create', {
        objectType: objectType as CrmObjectType,
        fields: payloadFields,
        sourceThreadId: handoff!.threadId
      });
      setCreated(result.record);
    } catch (caught) {
      if (caught instanceof CrmApiError && caught.code === 'connection_not_ready') {
        setError('HubSpot is not connected or verified for this organization. Connect it before creating the CRM record.');
      } else if (caught instanceof CrmApiError && caught.code === 'forbidden_scope') {
        setError('HubSpot is connected but the granted scopes do not allow this CRM write.');
      } else {
        setError(caught instanceof Error ? caught.message : 'CRM handoff failed');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="crm-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM · Social handoff</p>
        <h1>Convert conversation to CRM</h1>
        <p>Create a provider-backed CRM record from a traceable ATLAS Social thread. The write executes only through an authorized HubSpot connection.</p>
      </header>

      <div className="crm-banner connected" role="status">
        <strong>{sourceSummary}</strong>
        <span>{handoff.preview}</span>
        <small>Received {new Date(handoff.receivedAt).toLocaleString()} · Source thread {handoff.threadId}</small>
      </div>

      <form className="crm-social-handoff-form" onSubmit={submit}>
        <label>
          <span>CRM record type</span>
          <select value={objectType} onChange={(event) => changeType(event.target.value as SocialCrmObjectType)}>
            <option value="contact">Contact</option>
            <option value="deal">Opportunity</option>
            <option value="ticket">Service case</option>
          </select>
        </label>

        <div className="crm-field-grid">
          {Object.entries(fields).map(([key, value]) => (
            <label key={key}>
              <span>{labels[key] || key}</span>
              <input value={value} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>

        <div className="crm-pagination">
          <button type="submit" disabled={saving}>{saving ? 'Creating…' : `Create ${objectType} in HubSpot`}</button>
          <Link className="text-link" to="/crm/integrations/hubspot">HubSpot connection</Link>
        </div>
      </form>

      {error ? <div className="crm-banner error" role="alert">{error}</div> : null}
      {created ? (
        <div className="crm-banner connected" role="status">
          <strong>CRM record created</strong>
          <span>{created.displayName} · HubSpot ID {created.providerId}</span>
          <Link className="text-link" to={targetRoute(created)}>Open CRM record</Link>
        </div>
      ) : null}
    </section>
  );
}
