import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { SocialCrmHandoff } from '../../../../../../packages/social/src/inbox';
import './crm.css';

type LocationState = { socialHandoff?: SocialCrmHandoff };

function reviewRoute(handoff: SocialCrmHandoff): string {
  if (handoff.suggestedObjectType === 'deal') return '/crm/deals';
  if (handoff.suggestedObjectType === 'ticket') return '/crm/service';
  return '/crm/contacts';
}

function reviewLabel(handoff: SocialCrmHandoff): string {
  if (handoff.suggestedObjectType === 'deal') return 'Open provider-backed opportunities';
  if (handoff.suggestedObjectType === 'ticket') return 'Open provider-backed service cases';
  return 'Open provider-backed contacts';
}

export function CrmSocialHandoffPage() {
  const location = useLocation();
  const handoff = (location.state as LocationState | null)?.socialHandoff;

  const sourceSummary = useMemo(() => handoff
    ? `${handoff.platform} · ${handoff.contactName}${handoff.handle ? ` · ${handoff.handle}` : ''}`
    : '', [handoff]);

  if (!handoff || handoff.source !== 'atlas-social') {
    return (
      <section className="crm-page page-stack">
        <header className="page-header">
          <p className="eyebrow">ATLAS CRM</p>
          <h1>Social CRM handoff</h1>
          <p>No Social Command Center conversation was supplied.</p>
        </header>
        <Link className="text-link" to="/studio/social">Return to Social Command Center</Link>
      </section>
    );
  }

  return (
    <section className="crm-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM · Social handoff</p>
        <h1>Review conversation in CRM</h1>
        <p>HubSpot P0 is read-only. ATLAS preserves the Social thread context here without creating or modifying provider business data.</p>
      </header>

      <div className="crm-banner connected" role="status">
        <strong>{sourceSummary}</strong>
        <span>{handoff.preview}</span>
        <small>Received {new Date(handoff.receivedAt).toLocaleString()} · Source thread {handoff.threadId}</small>
      </div>

      <div className="notice">
        Suggested workspace: {handoff.suggestedObjectType}. Use provider-backed search to locate an existing authorized HubSpot record. No CRM record will be created from this handoff.
      </div>

      <div className="crm-actions" aria-label="Read-only CRM handoff actions">
        <Link className="text-link" to={reviewRoute(handoff)}>{reviewLabel(handoff)}</Link>
        <Link className="text-link" to="/crm/integrations/hubspot">HubSpot connection</Link>
        <Link className="text-link" to="/studio/social">Return to Social Command Center</Link>
      </div>
    </section>
  );
}
