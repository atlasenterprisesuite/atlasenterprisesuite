import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  calculateAutomationScenario,
  DEFAULT_AUTOMATION_INPUT,
  type AutomationInput
} from './enterpriseAutomationModel';
import {
  DEFAULT_SIX_DIMENSION_ASSUMPTIONS,
  evaluateSixDimensionPaths,
  type SixDimensionAssumptions
} from './enterpriseSixDimensionModel';
import {
  DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS,
  evaluateFifthDimensionFutures,
  type FifthDimensionAssumptions
} from './enterpriseFifthDimensionModel';
import { EnterpriseConsequencePanel } from './EnterpriseConsequencePanel';
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

const fifthFields: { key: keyof FifthDimensionAssumptions; label: string; help: string }[] = [
  { key: 'demandShiftPercent', label: 'Demand variation (%)', help: 'Increase or decrease variable document and inventory workload across alternative cases' },
  { key: 'exceptionShiftPercent', label: 'Exception variation (%)', help: 'Relative change in RPA exception rate across operational futures' },
  { key: 'productivityShiftPercent', label: 'Automation productivity variation (%)', help: 'Relative change in modeled RPA time savings across scenarios' }
];

const sixFields: { key: keyof SixDimensionAssumptions; label: string; help: string; max: number }[] = [
  { key: 'rpaCoveragePercent', label: 'RPA pilot coverage (%)', help: 'Share of lower-risk work items proposed for the simulated pilot', max: 100 },
  { key: 'rpaTimeReductionPercent', label: 'RPA time reduction (%)', help: 'Hypothetical reduction in assisted touch time for covered items', max: 100 },
  { key: 'exceptionRatePercent', label: 'RPA exception rate (%)', help: 'Assumed share of covered work needing human review', max: 100 },
  { key: 'reviewMinutesPerException', label: 'Review minutes per exception', help: 'Additional human review time per projected exception', max: 1000000 }
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
  const [sixAssumptions, setSixAssumptions] = useState<SixDimensionAssumptions>(DEFAULT_SIX_DIMENSION_ASSUMPTIONS);
  const sixResult = useMemo(() => evaluateSixDimensionPaths(input, sixAssumptions), [input, sixAssumptions]);
  const sixPreferred = sixResult.paths.find((path) => path.id === sixResult.recommendedId);
  const [fifthAssumptions, setFifthAssumptions] = useState<FifthDimensionAssumptions>(DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS);
  const fifthResult = useMemo(
    () => evaluateFifthDimensionFutures(input, fifthAssumptions, sixAssumptions),
    [input, fifthAssumptions, sixAssumptions]
  );
  const robust = fifthResult.robustness.find((item) => item.pathId === fifthResult.robustPathId);
  const robustLabel = sixResult.paths.find((path) => path.id === fifthResult.robustPathId)?.label ?? 'Unavailable';

  return <div className="enterprise-automation">
    <header className="page-header">
      <p className="eyebrow">ATLAS Advisory · Enterprise Automation</p>
      <h2>From intake to measured close</h2>
      <p>Explore the complete operating cycle and calculate an editable planning scenario for multiple companies. Results below are projections, never observed production metrics.</p>
    </header>

    <nav className="automation-jump" aria-label="Enterprise automation sections">
      <a href="#automation-cycle">Operating cycle</a>
      <a href="#automation-scenario">Scenario calculator</a>
      <a href="#automation-fifth-dimension">5D alternative futures</a>
      <a href="#automation-six-dimension">6D operating controls</a>
      <a href="#automation-consequence">Decision & consequence explorer</a>
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

    <section id="automation-fifth-dimension" aria-labelledby="automation-fifth-dimension-title">
      <h3 id="automation-fifth-dimension-title">5D · Alternative operational futures</h3>
      <p>Explore alternative possible workloads, not actual parallel universes or reliable future predictions. Every modeled future reuses the same ATLAS 6D calculator and its restrictions; no bank, payroll or accounting operation is initiated.</p>
      <div className="automation-dimension-grid" aria-label="Five future-planning lenses">
        {fifthResult.lenses.map((lens, index) => <article key={lens.id}>
          <span>0{index + 1}</span><h4>{lens.label}</h4><p>{lens.description}</p>
        </article>)}
      </div>
      <div className="automation-inputs">
        {fifthFields.map((field) => <label key={field.key}>
          <span>{field.label}</span>
          <input type="number" min="0" max="100" step="1" value={fifthAssumptions[field.key]}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next >= 0 && next <= 100) {
                setFifthAssumptions((current) => ({ ...current, [field.key]: next }));
              }
            }} />
          <small>{field.help}</small>
        </label>)}
      </div>
      <button className="automation-reset" type="button" onClick={() => setFifthAssumptions({ ...DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS })}>Reset 5D assumptions</button>
      <div className="automation-results" aria-live="polite">
        <article><span>Resilient modeled strategy</span><strong>{robustLabel}</strong></article>
        <article><span>Highest scenario monthly cost</span><strong>{robust ? money(robust.worstCaseMonthlyCost) : 'Unavailable'}</strong></article>
        <article><span>Futures compared</span><strong>{fifthResult.futures.length}</strong></article>
      </div>
      <div className="automation-table-wrap"><table>
        <caption>5D comparison: hypothetical demand variations; each route is evaluated with the same 6D rules</caption>
        <thead><tr><th scope="col">Workload future</th><th scope="col">Work items/mo</th>
          <th scope="col">Manual cost/mo</th><th scope="col">Assisted cost/mo</th>
          <th scope="col">RPA cost/mo</th><th scope="col">Preferred in that future</th>
          <th scope="col">RPA exceptions/mo</th>
        </tr></thead>
        <tbody>{fifthResult.futures.map((future) => <tr key={future.id}>
          <th scope="row">{future.label}</th>
          <td>{decimal(future.evaluation.totalItems)}</td>
          <td>{money(future.evaluation.paths[0].operatingCost)}</td>
          <td>{money(future.evaluation.paths[1].operatingCost)}</td>
          <td>{money(future.evaluation.paths[2].operatingCost)}</td>
          <td>{future.evaluation.paths.find((path) => path.id === future.evaluation.recommendedId)?.label ?? 'Unavailable'}</td>
          <td>{decimal(future.evaluation.paths[2].projectedExceptions ?? 0)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="automation-loop">5D compares three what-if situations; the resilience choice minimizes the largest modeled monthly expense, rather than predicting which scenario will happen. Probability is not estimated. Staffing, number of legal entities, bank accounts and monthly closes remain fixed; only variable workloads change. Costs omit additional RPA licensing and setup, and no cash savings are guaranteed.</p>
    </section>

    <section id="automation-six-dimension" aria-labelledby="automation-six-dimension-title">
      <h3 id="automation-six-dimension-title">Six-dimensional decision explorer</h3>
      <p>Compare manual, assisted and governed RPA paths across six operational axes. The "sixth dimension" is a planning metaphor, not an assertion about physics or knowledge of future outcomes. All numbers are assumptions for planning, not measured production results.</p>
      <div className="automation-dimension-grid" aria-label="Six business decision dimensions">
        {sixResult.dimensions.map((dimension, index) => <article key={dimension.id}>
          <span>0{index + 1}</span>
          <h4>{dimension.label}</h4>
          <p>{dimension.description}</p>
        </article>)}
      </div>
      <div className="automation-inputs">
        {sixFields.map((field) => <label key={field.key}>
          <span>{field.label}</span>
          <input type="number" min="0" max={field.max} step="1" value={sixAssumptions[field.key]}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next >= 0 && next <= field.max) {
                setSixAssumptions((current) => ({ ...current, [field.key]: next }));
              }
            }} />
          <small>{field.help}</small>
        </label>)}
      </div>
      <button className="automation-reset" type="button" onClick={() => setSixAssumptions({ ...DEFAULT_SIX_DIMENSION_ASSUMPTIONS })}>Reset RPA assumptions</button>
      <div className="automation-results" aria-live="polite">
        <article><span>Monthly work items</span><strong>{decimal(sixResult.totalItems)}</strong></article>
        <article><span>RPA-eligible work items</span><strong>{decimal(sixResult.eligibleVolume)}</strong></article>
        <article><span>Gated process categories</span><strong>{sixResult.restrictedProcesses.length}</strong></article>
        <article><span>Preferred modeled route</span><strong>{sixPreferred?.label ?? 'Unavailable'}</strong></article>
      </div>
      <div className="automation-table-wrap"><table>
        <caption>Simulated paths ranked by estimated monthly operating cost, not actual automation outcomes</caption>
        <thead><tr>
          <th scope="col">Operating path</th><th scope="col">Human hours/mo</th><th scope="col">Modeled cost/mo</th>
          <th scope="col">Capacity recovered/mo</th><th scope="col">RPA exceptions/mo</th><th scope="col">Difference vs manual/mo</th>
        </tr></thead>
        <tbody>{sixResult.paths.map((path) => <tr key={path.id}>
          <th scope="row">{path.label}{path.id === sixResult.recommendedId ? ' · lowest modeled cost' : ''}</th>
          <td>{decimal(path.humanHours)} h</td>
          <td>{money(path.operatingCost)}</td>
          <td>{decimal(path.capacityRecovered)} h</td>
          <td>{path.projectedExceptions === null ? 'Not modeled' : decimal(path.projectedExceptions)}</td>
          <td>{money(path.monthlyCostDifferenceFromManual)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="automation-loop">This comparison reuses canonical ATLAS operating volumes and assumes the same entered monthly platform cost for assisted and RPA paths, with no additional RPA license or setup premium. Review time is added back to the RPA estimate. Actual costs, error rates, throughput and provider readiness must be measured separately.</p>
      <p><strong>Fail-closed control:</strong> Accounts payable, bank reconciliations, GL close, and people/payroll remain outside this RPA pilot. No path invokes an automation runner, writes business records, approves payees, releases payments, processes payroll, or declares production readiness. Each sensitive action continues through its existing authenticated approvals and audit trail.</p>
    </section>

    <EnterpriseConsequencePanel futures={fifthResult} />

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
