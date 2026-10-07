import { Link, Route, Routes } from 'react-router-dom';
import { CrmHomePage } from './CrmHomePage';
import { CrmActivitiesPage, CrmObjectListPage } from './CrmObjectListPage';
import { CrmRecordPage } from './CrmRecordPage';
import { HubSpotIntegrationPage } from './HubSpotIntegrationPage';
import { SalesforceIntegrationPage } from './SalesforceIntegrationPage';
import { CrmSocialHandoffPage } from './CrmSocialHandoffPage';
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
        <Link className="module-card enabled" to="/crm/integrations/salesforce">
          <span>Direct provider</span><strong>Salesforce</strong><p>ATLAS-owned OAuth, immutable org verification, inventory and read-only CRM access.</p>
        </Link>
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

      <Route path="/crm/salesforce/contacts" element={
        <CrmObjectListPage provider="salesforce" objectType="contact" title="Contacts" description="Salesforce-backed contact records." detailBase="/crm/salesforce/contacts" />
      } />
      <Route path="/crm/salesforce/contacts/:providerId" element={
        <CrmRecordPage provider="salesforce" objectType="contact" title="Contact" associationTargets={contactAssociations} />
      } />
      <Route path="/crm/salesforce/companies" element={
        <CrmObjectListPage provider="salesforce" objectType="company" title="Accounts" description="Salesforce-backed account records." detailBase="/crm/salesforce/companies" />
      } />
      <Route path="/crm/salesforce/companies/:providerId" element={
        <CrmRecordPage provider="salesforce" objectType="company" title="Account" associationTargets={companyAssociations} />
      } />
      <Route path="/crm/salesforce/deals" element={
        <CrmObjectListPage provider="salesforce" objectType="deal" title="Opportunities" description="Salesforce-backed opportunity records." detailBase="/crm/salesforce/deals" />
      } />
      <Route path="/crm/salesforce/deals/:providerId" element={
        <CrmRecordPage provider="salesforce" objectType="deal" title="Opportunity" associationTargets={dealAssociations} />
      } />
      <Route path="/crm/salesforce/service" element={
        <CrmObjectListPage provider="salesforce" objectType="ticket" title="Service Cases" description="Salesforce-backed case records." detailBase="/crm/salesforce/service" />
      } />
      <Route path="/crm/salesforce/service/:providerId" element={
        <CrmRecordPage provider="salesforce" objectType="ticket" title="Service Case" associationTargets={ticketAssociations} />
      } />
      <Route path="/crm/salesforce/activities" element={<CrmActivitiesPage provider="salesforce" />} />

      <Route path="/crm/social-handoff" element={<CrmSocialHandoffPage />} />
      <Route path="/crm/integrations" element={<CrmIntegrations />} />
      <Route path="/crm/integrations/hubspot" element={<HubSpotIntegrationPage />} />
      <Route path="/crm/integrations/salesforce" element={<SalesforceIntegrationPage />} />
    </Routes>
  );
}
