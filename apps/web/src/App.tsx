import { Link, Route, Routes } from 'react-router-dom';
import { AtlasShell } from './components/AtlasShell';
import { PayablesPage } from './modules/finance/accounting/PayablesPage';

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function EnterpriseHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Enterprise Suite" title="One governed enterprise ecosystem" description="Core business modules share one shell, tenant context, permissions contract, and audit-ready architecture." />
      <div className="module-grid">
        <Link className="module-card enabled" to="/finance"><span>Business</span><strong>Finance</strong><p>Accounting and financial operations.</p></Link>
        <Link className="module-card enabled" to="/health"><span>Health</span><strong>ATLAS Health</strong><p>Known routes remain preserved while unavailable source packages are restored.</p></Link>
      </div>
    </section>
  );
}

function FinanceHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Finance" title="Finance" description="Governed finance operations with Accounting as the first enterprise domain." />
      <div className="module-grid">
        <Link className="module-card enabled" to="/finance/accounting/accounts-payable"><span>Accounting</span><strong>Accounts Payable</strong><p>Vendor bills, aging, balances, approvals and payment application state.</p></Link>
        <div className="module-card disabled" aria-disabled="true"><span>Accounting</span><strong>Remaining accounting routes</strong><p>Implemented in the approved Accounting milestone sequence, not represented as active yet.</p></div>
      </div>
    </section>
  );
}

function AccountingHome() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Finance" title="Accounting" description="Accounts Payable is the active accounting slice in this branch." />
      <Link className="module-card enabled single-card" to="/finance/accounting/accounts-payable"><span>Operations</span><strong>Open Accounts Payable</strong><p>Enter the working AP module.</p></Link>
    </section>
  );
}

function HealthDegraded() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="ATLAS Health" title="Health source unavailable in this repository snapshot" description="The current repository does not contain the Health package files imported by the historical application root. The route is preserved without fabricating clinical or research functionality." />
      <div className="notice strong">Development state: Health integration requires restoration or migration of the missing governed source packages.</div>
    </section>
  );
}

function NotFound() {
  return <section className="page-stack"><PageHeader eyebrow="Navigation" title="Route not found" description="This route is not part of the active ATLAS module graph." /><Link className="text-link" to="/">Return home</Link></section>;
}

export function App() {
  return (
    <AtlasShell>
      <Routes>
        <Route path="/" element={<EnterpriseHome />} />
        <Route path="/finance" element={<FinanceHome />} />
        <Route path="/finance/accounting" element={<AccountingHome />} />
        <Route path="/finance/accounting/accounts-payable" element={<PayablesPage />} />
        <Route path="/health/*" element={<HealthDegraded />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AtlasShell>
  );
}
