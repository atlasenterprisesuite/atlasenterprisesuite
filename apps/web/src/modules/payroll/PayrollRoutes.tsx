import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { HelpDrawer } from './HelpDrawer';
import { PayrollHome } from './PayrollHome';
import { PayrollRunsPage } from './PayrollRunsPage';
import { PayrollSettingsPage } from './PayrollSettingsPage';
import { PeoplePage } from './PeoplePage';
import { SetupWizard } from './SetupWizard';
import { TimePtoPage } from './TimePtoPage';
import './payroll.css';

const nav=[
  ['/payroll','Overview'],
  ['/payroll/setup/company','Setup'],
  ['/payroll/runs','Payroll runs'],
  ['/payroll/people','People'],
  ['/payroll/time','Time & PTO'],
  ['/payroll/reports','Reports'],
  ['/payroll/settings','Settings'],
  ['/payroll/help','Help']
] as const;

function PayrollLayout({children}:{children:ReactNode}) {
  const location=useLocation();
  return <div className="payroll-layout">
    <nav className="payroll-nav" aria-label="Payroll">
      {nav.map(([to,label])=>{
        const active=to==='/payroll'?location.pathname==='/payroll':location.pathname.startsWith(to);
        return <Link className={active?'active':''} key={to} to={to}>{label}</Link>;
      })}
    </nav>
    <main className="payroll-content">{children}</main>
  </div>;
}

function PayrollBoundaryPage({title,description}:{title:string;description:string}) {
  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header"><p className="payroll-kicker">ATLAS PAYROLL</p><h1>{title}</h1><p>{description}</p></header>
    <div className="payroll-callout">
      <div><strong>No external completion state is assumed.</strong><p>ATLAS exposes this governed boundary without claiming filing, payment, coverage, compliance or provider execution until authenticated evidence exists.</p></div>
    </div>
  </section>;
}

function Routed({children}:{children:ReactNode}) {
  return <PayrollLayout>{children}</PayrollLayout>;
}

export function PayrollRoutes() {
  return <RequireAtlasIdentity>
    <Routes>
      <Route index element={<Routed><PayrollHome /></Routed>} />
      <Route path="overview" element={<Routed><PayrollHome title="Payroll Overview" showBack /></Routed>} />
      <Route path="setup" element={<Navigate to="/payroll/setup/company" replace />} />
      <Route path="setup/:step" element={<Routed><SetupWizard /></Routed>} />
      <Route path="people" element={<Routed><PeoplePage /></Routed>} />
      <Route path="contractors" element={<Routed><PeoplePage /></Routed>} />
      <Route path="time" element={<Routed><TimePtoPage /></Routed>} />
      <Route path="pto" element={<Routed><TimePtoPage /></Routed>} />
      <Route path="time-earnings" element={<Routed><TimePtoPage title="Time & Earnings" /></Routed>} />
      <Route path="runs" element={<Routed><PayrollRunsPage /></Routed>} />
      <Route path="pay-runs" element={<Routed><PayrollRunsPage title="Pay Runs" /></Routed>} />
      <Route path="taxes" element={<Routed><PayrollBoundaryPage title="Payroll taxes" description="Validated tax rules can calculate governed payroll. Filing and remittance require separately authenticated external rails." /></Routed>} />
      <Route path="deductions" element={<Routed><PayrollBoundaryPage title="Deductions" description="Effective-dated worker deductions feed payroll calculation when configured." /></Routed>} />
      <Route path="benefits" element={<Routed><PayrollBoundaryPage title="Benefits" description="Benefits administration does not imply insurance issuance or carrier transmission." /></Routed>} />
      <Route path="reports" element={<Routed><PayrollBoundaryPage title="Payroll reports" description="Reports are generated only from persisted payroll runs and calculation snapshots." /></Routed>} />
      <Route path="settings" element={<Routed><PayrollSettingsPage /></Routed>} />
      <Route path="settings/permissions" element={<Routed><PayrollBoundaryPage title="Payroll permissions" description="Payroll authority is governed by organization membership and server-side role bindings." /></Routed>} />
      <Route path="settings/billing" element={<Routed><PayrollSettingsPage /></Routed>} />
      <Route path="help" element={<Routed><HelpDrawer /></Routed>} />
      <Route path="*" element={<Navigate to="/payroll" replace />} />
    </Routes>
  </RequireAtlasIdentity>;
}
