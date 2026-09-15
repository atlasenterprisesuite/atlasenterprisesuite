import { Link, Route, Routes } from 'react-router-dom';

const routes = [
  { to: '/crm/contacts', title: 'Contacts', description: 'Provider-backed customer people records.' },
  { to: '/crm/companies', title: 'Accounts', description: 'Provider-backed company and account records.' },
  { to: '/crm/deals', title: 'Opportunities', description: 'Provider-backed deal and opportunity records.' },
  { to: '/crm/service', title: 'Service Cases', description: 'Provider-backed ticket and service records.' },
  { to: '/crm/activities', title: 'Activities', description: 'Tasks, calls, meetings, notes and email activity.' },
  { to: '/crm/integrations', title: 'Integrations', description: 'CRM provider connection and readiness controls.' }
] as const;

function CrmHome() {
  return (
    <section className="page-stack" aria-labelledby="crm-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Business Suite</p>
        <h1 id="crm-title">ATLAS CRM</h1>
        <p>Governed customer operations using the authenticated ATLAS organization and provider-backed data only.</p>
      </header>
      <div className="module-grid">
        {routes.map((item) => (
          <Link key={item.to} className="module-card enabled" to={item.to}>
            <span>CRM</span><strong>{item.title}</strong><p>{item.description}</p>
          </Link>
        ))}
      </div>
      <div className="notice">CRM records appear only after an authorized provider connection is verified.</div>
    </section>
  );
}

function CrmSection({ title, description }: { title: string; description: string }) {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS CRM</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="empty-state">
        <strong>Provider connection required</strong>
        <span>This route is active; records remain unavailable until the organization has a verified CRM provider connection.</span>
      </div>
      <Link className="text-link" to="/crm">Back to CRM</Link>
    </section>
  );
}

function CrmIntegrations() {
  return (
    <section className="page-stack">
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

export function CrmRoutes() {
  return (
    <Routes>
      <Route path="/crm" element={<CrmHome />} />
      <Route path="/crm/contacts" element={<CrmSection title="Contacts" description="Provider-backed contact records." />} />
      <Route path="/crm/contacts/:providerId" element={<CrmSection title="Contact" description="Provider-backed contact details and associations." />} />
      <Route path="/crm/companies" element={<CrmSection title="Accounts" description="Provider-backed company records." />} />
      <Route path="/crm/companies/:providerId" element={<CrmSection title="Account" description="Provider-backed account details and associations." />} />
      <Route path="/crm/deals" element={<CrmSection title="Opportunities" description="Provider-backed deal records." />} />
      <Route path="/crm/deals/:providerId" element={<CrmSection title="Opportunity" description="Provider-backed opportunity details and associations." />} />
      <Route path="/crm/service" element={<CrmSection title="Service Cases" description="Provider-backed ticket records." />} />
      <Route path="/crm/service/:providerId" element={<CrmSection title="Service Case" description="Provider-backed service case details and associations." />} />
      <Route path="/crm/activities" element={<CrmSection title="Activities" description="Provider-backed customer activity history." />} />
      <Route path="/crm/integrations" element={<CrmIntegrations />} />
      <Route path="/crm/integrations/hubspot" element={<CrmSection title="HubSpot Integration" description="Connection status and authorization controls." />} />
    </Routes>
  );
}
