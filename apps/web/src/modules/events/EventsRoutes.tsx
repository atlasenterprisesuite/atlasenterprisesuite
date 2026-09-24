import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';

const areas = [
  ['Events', 'Plan multi-venue productions, dates, capacity and governed lifecycle state.'],
  ['Talent & Venues', 'Coordinate artists, promoters, venues, contracts and riders without duplicating CRM or Hospitality.'],
  ['Production', 'Run-of-show, technical production, vendors, staffing, equipment and incident operations.'],
  ['Ticketing & Access', 'Ticket tiers, capacity and credentials; external issuance stays closed until a provider is authorized.'],
  ['Commerce', 'Merchandise, F&B, promotions and sponsors connect to ATLAS Commerce and POS boundaries.'],
  ['Finance & Settlement', 'Budget, P&L, cash flow and artist/vendor settlement connect to the canonical Finance/Accounting ledger.'],
  ['Fan CRM', 'Consent-aware fan relationships and campaign handoff use the canonical CRM boundary.'],
  ['Live Command', 'A mobile-ready operational surface for show-day readiness, exceptions and approvals.']
] as const;

function EventsHome() {
  return <section className="page-stack">
    <header className="page-header"><p className="eyebrow">ATLAS Events & Entertainment</p><h1>Live entertainment operating system</h1><p>Artist → Promoter → Venue → Production → Ticket → Fan → Payment → Settlement, governed by ATLAS identity, tenant scope and audit boundaries.</p></header>
    <div className="notice strong">External ticketing, payments and artist-booking providers remain fail-closed until explicitly authorized and verified.</div>
    <div className="module-grid">{areas.map(([title, description]) => <article className="module-card enabled" key={title}><span>Events & Entertainment</span><strong>{title}</strong><p>{description}</p></article>)}</div>
    <div className="module-grid compact">
      <Link className="module-card enabled" to="/hospitality"><span>Shared capability</span><strong>Hospitality & event spaces</strong><p>Reuse properties, spaces and access-provider boundaries.</p></Link>
      <Link className="module-card enabled" to="/studio"><span>Shared capability</span><strong>Creator Studio</strong><p>Reuse approved media assets and campaign production workflows.</p></Link>
      <Link className="module-card enabled" to="/finance"><span>Shared capability</span><strong>Finance</strong><p>Keep accounting and settlement postings in the canonical financial system.</p></Link>
    </div>
  </section>;
}

export function EventsRoutes() {
  return <AtlasShell><RequireAtlasIdentity><Routes>
    <Route path="/events" element={<EventsHome />} />
    <Route path="/events/*" element={<Navigate to="/events" replace />} />
  </Routes></RequireAtlasIdentity></AtlasShell>;
}
