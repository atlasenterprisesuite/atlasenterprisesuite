import { Link } from 'react-router-dom';

export function FinanceHome() {
  return <section className="page-stack"><header className="page-header"><p className="eyebrow">ATLAS Finance</p><h1>Finance</h1><p>Governed finance operations with Accounting as the first enterprise domain.</p></header><div className="module-grid"><Link className="module-card enabled" to="/finance/accounting"><span>Finance</span><strong>Accounting</strong><p>Open the Accounting workspace.</p></Link><Link className="module-card enabled" to="/finance/accounting/accounts-payable"><span>Accounting</span><strong>Accounts Payable</strong><p>Vendor bills, aging, balances and payment state.</p></Link></div></section>;
}

export function AccountingHome() {
  return <section className="page-stack"><header className="page-header"><p className="eyebrow">ATLAS Finance</p><h1>Accounting</h1><p>Accounts Payable is the active accounting slice in this release.</p></header><Link className="module-card enabled single-card" to="/finance/accounting/accounts-payable"><span>Operations</span><strong>Open Accounts Payable</strong><p>Enter the working AP module.</p></Link></section>;
}
