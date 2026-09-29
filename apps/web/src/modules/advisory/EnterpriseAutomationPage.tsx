import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  calculateAutomationScenario,
  DEFAULT_AUTOMATION_INPUT,
  type AutomationInput
} from './enterpriseAutomationModel';
import './enterpriseAutomation.css';

const fields: { key: keyof AutomationInput; label: string; help: string }[] = [
  { key: 'companies', label: 'Companies', help: 'Distinct legal entities in this scenario' },
  { key: 'documentsPerCompany', label: 'AP + AR documents per company / month', help: 'Split equally between payable and receivable' },
  { key: 'bankAccountsPerCompany', label: 'Bank accounts per company', help: 'One monthly reconciliation per account' },
  { key: 'employeesPerCompany', label: 'Employees per company', help: 'Monthly HR and payroll activity assumption' },
  { key: 'inventoryMovesPerCompany', label: 'Inventory movements per company', help: 'Use zero for service companies without stock' },
  { key: 'requestsPerCompany', label: 'Purchase / operations requests per company', help: 'Governed purchasing requests' },
  { key: 'adminDocumentsPerCompany', label: 'Administrative documents per company', help: 'Intake, review and filing workload' },
  { key: 'hourlyCost', label: 'Fully loaded hourly cost ($)', help: 'Cost of capacity, not guaranteed cash savings' },
  { key: 'monthlyPlatformCost', label: 'Monthly platform cost ($)', help: 'Scenario assumption; not an ATLAS price quote' },
  { key: 'setupCost', label: 'One-time implementation cost ($)', help: 'Scenario assumption; not an ATLAS price quote' }
];

const workflow = [
  { title: 'Client and organization', detail: 'Identity, legal entity, role and permissions.', route: '/advisory/clients', action: 'Open clients' },
  { title: 'Customer and revenue', detail: 'Lead, order, invoice, collections and bank application.', route: '/revenue', action: 'Open revenue' },
  { title: 'Purchase and stock', detail: 'Request, PO, receiving, inventory and three-way match.', route: '/inventory/procure-to-pay', action: 'Open procurement' },
  { title: 'Payables and accounting', detail: 'Vendor obligation, approval, payment status and GL.', route: '/finance/accounting/accounts-payable', action: 'Open payables' },
  { title: 'People and payroll', detail: 'Employee context, time, pay-run review and posting.', route: '/people', action: 'Open people' },
  { title: 'Reconcile and close', detail: 'Bank differences, accounting review and period controls.', route: '/finance/accounting', action: 'Open accounting' },
  { title: 'Measure and improve', detail: 'Compare measured cycle time, errors and exceptions.', route: '/analytics', action: 'Open analytics' },
  { title: 'Governed execution', detail: 'Route approved tasks through the existing ATLAS engine.', route: '/work', action: 'Open work' }
] as const;

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const decimal = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);

export function EnterpriseAutomationPage() {
  const [input, setInput] = useState<AutomationInput>(DEFAULT_AUTOMATION_INPUT);
  const result = useMemo(() => calculateAutomationScenario(input), [input]);

  return <div className="enterprise-automation">
    <header className="page-header">
      <p className="eyebrow">ATLAS Advisory · Enterprise Automation</p>
      <h2>From intake to measured close</h2>
      <p>Explore the complete operating cycle and calculate an editable planning scenario for multiple companies. Results below are projections, never observed production metrics.</p>
    </header>

    <nav className="automation-jump" aria-label="Enterprise automation sections">
      <a href="#automation-cycle">Operating cycle</a>
      <a href="#automation-scenario">Scenario calculator</a>
      <a href="#automation-controls">Controls and measurement</a>
    </nav>

    <section id="automation-cycle" aria-labelledby="automation-cycle-title">
      <h3 id="automation-cycle-title">The complete internal cycle</h3>
      <p>Each action opens an existing ATLAS route under its own session, tenant and permission rules. The links do not imply that every downstream integration is active.</p>
      <div className="automation-cycle-grid">
        {workflow.map((step, index) => <article key={step.title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <h4>{step.title}</h4><p>{step.detail}</p>
          <Link to={step.route}>{step.action} →</Link>
        </article>)}
      </div>
      <p className="automation-loop">After measurement, exceptions and approved improvements return to intake and configuration for the next cycle.</p>
    </section>

    <section id="automation-scenario" aria-labelledby="automation-scenario-title">
      <h3 id="automation-scenario-title">Editable financial scenario</h3>
      <p>Time assumptions are shown in the table. Adjust actual volumes and costs before treating the result as a business case. No scenario values are sent to a server or saved as company records.</p>
      <div className="automation-inputs">
        {fields.map((field) => <label key={field.key}>
          <span>{field.label}</span>
          <input type="number" min="0" max="1000000" step={field.key === 'hourlyCost' || field.key === 'monthlyPlatformCost' || field.key === 'setupCost' ? '0.01' : '1'}
            value={input[field.key]}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value >= 0 && value <= 1000000) setInput((current) => ({ ...current, [field.key]: value }));
            }} />
          <small>{field.help}</small>
        </label>)}
      </div>
      <button className="automation-reset" type="button" onClick={() => setInput({ ...DEFAULT_AUTOMATION_INPUT })}>Restore example</button>

      <div className="automation-results" aria-live="polite">
        <article><span>Manual workload</span><strong>{decimal(result.manualHours)} h/mo</strong></article>
        <article><span>Assisted workload</span><strong>{decimal(result.assistedHours)} h/mo</strong></article>
        <article><span>Capacity recovered</span><strong>{decimal(result.savedHours)} h/mo</strong></article>
        <article><span>Gross capacity value</span><strong>{money(result.grossMonthlyCapacity)}/mo</strong></article>
        <article><span>First-year net scenario</span><strong>{money(result.firstYearNet)}</strong></article>
        <article><span>Setup payback</span><strong>{result.paybackMonths === null ? 'Not reached' : `${decimal(result.paybackMonths)} months`}</strong></article>
      </div>
      <div className="automation-table-wrap"><table>
        <caption>Monthly workload assumptions and calculated time across all selected companies</caption>
        <thead><tr><th scope="col">Process</th><th scope="col">Volume</th><th scope="col">Manual min/item</th><th scope="col">Assisted min/item</th><th scope="col">Hours recovered</th></tr></thead>
        <tbody>{result.rows.map((row) => <tr key={row.id}><th scope="row"><Link to={row.route}>{row.label}</Link></th><td>{decimal(row.volume)} {row.unit}</td><td>{row.manual}</td><td>{row.assisted}</td><td>{decimal(row.savedHours)}</td></tr>)}</tbody>
      </table></div>
      <p className="automation-loop">First-year ROI: {result.firstYearRoi === null ? 'No cost entered' : `${decimal(result.firstYearRoi * 100)}%`}. This is a hypothetical planning calculation. Recovered capacity becomes cash savings only when it reduces paid work or external cost; do not count the same hours again as revenue.</p>
    </section>

    <section id="automation-controls" aria-labelledby="automation-controls-title">
      <h3 id="automation-controls-title">Evidence before automation claims</h3>
      <div className="automation-cycle-grid">
        <article><h4>Baseline</h4><p>Record actual volume, touch time, errors and cycle time per company for one complete operating period.</p></article>
        <article><h4>Exceptions</h4><p>Hold duplicate invoices, unmatched receipts, bank differences, changed payees and unusual payroll for authorized review.</p></article>
        <article><h4>Authorization</h4><p>Keep payments, changes to bank details, payroll release and period close subject to existing roles and approvals.</p></article>
        <article><h4>Outcome</h4><p>Compare before and after by legal entity. Mark reconciled, approved or paid only after source evidence exists.</p></article>
      </div>
      <p>Suggested next pilot: two companies with different complexity, one measured month each, then recalculate the business case using observed data. External banking, payroll and provider execution remain behind their existing gates.</p>
    </section>
  </div>;
}
