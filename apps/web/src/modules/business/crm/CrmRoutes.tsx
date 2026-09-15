import { Link, Route, Routes } from 'react-router-dom';
import { CrmHomePage } from './CrmHomePage';
import { CrmActivitiesPage, CrmObjectListPage } from './CrmObjectListPage';
import { CrmRecordPage } from './CrmRecordPage';
import './crm.css';

const contactAssociations = ['company', 'deal'] as const;
const companyAssociations = ['contact', 'deal', 'ticket'] as const;
const dealAssociations = ['contact', 'company', 'ticket'] as const;
const ticketAssociations = ['contact', 'company', 'deal'] as const;

function CrmIntegrations() {
  return (
    <section className="crm-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM</p>
        <h1>Integrations</h1>
        <p>Connect and verify CRM providers without exposing provider credentials to the browser.</p>
      </header>
      <div className="module-grid compact">
        <Link className="module-card enabled" to="/crm/integrations/hubspot">
          <span>Provider</span><strong>HubSpot</strong><p>OAuth connection, verification and governed disconnect controls.</p>
        </Link>
      </div>
    </section>
  );
}

function HubSpotPlaceholder() {
  return (
    <section className="crm-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM · Integration</p>
        <h1>HubSpot Integration</h1>
        <p>Connection controls are governed by the ATLAS integration boundary.</p>
      </header>
      <div className="empty-state">
        <strong>Connection controls loading in the next implementation slice</strong>
        <span>No connected state is simulated on this route.</span>
      </div>
    </section>
  );
}

export function CrmRoutes() {
  return (
    <Routes>
      <Route path="/crm" element={<CrmHomePage />} />
      <Route path="/crm/contacts" element={
        <CrmObjectListPage objectType="contact" title="Contacts" description="Provider-backed contact records." detailBase="/crm/contacts" />
      } />
      <Route path="/crm/contacts/:providerId" element={
        <CrmRecordPage objectType="contact" title="Contact" associationTargets={contactAssociations} />
      } />
      <Route path="/crm/companies" element={
        <CrmObjectListPage objectType="company" title="Accounts" description="Provider-backed company records." detailBase="/crm/companies" />
      } />
      <Route path="/crm/companies/:providerId" element={
        <CrmRecordPage objectType="company" title="Account" associationTargets={companyAssociations} />
      } />
      <Route path="/crm/deals" element={
        <CrmObjectListPage objectType="deal" title="Opportunities" description="Provider-backed deal records." detailBase="/crm/deals" />
      } />
      <Route path="/crm/deals/:providerId" element={
        <CrmRecordPage objectType="deal" title="Opportunity" associationTargets={dealAssociations} />
      } />
      <Route path="/crm/service" element={
        <CrmObjectListPage objectType="ticket" title="Service Cases" description="Provider-backed ticket records." detailBase="/crm/service" />
      } />
      <Route path="/crm/service/:providerId" element={
        <CrmRecordPage objectType="ticket" title="Service Case" associationTargets={ticketAssociations} />
      } />
      <Route path="/crm/activities" element={<CrmActivitiesPage />} />
      <Route path="/crm/integrations" element={<CrmIntegrations />} />
      <Route path="/crm/integrations/hubspot" element={<HubSpotPlaceholder />} />
    </Routes>
  );
}
