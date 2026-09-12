import { useMemo, useState } from 'react';
import { demoAtlasContext, hasPermission } from '../../../../../../packages/core/src';
import {
  filterAutomotiveSales,
  manufacturerCreditsTotal,
  netFAndIRevenue,
  netVehicleCost,
  scopeAutomotiveReportingData,
  summarizeAutomotiveReporting,
  vehicleGrossProfit,
  type AutomotiveSalesChannel
} from '../../../../../../packages/accounting/src';
import {
  automotiveFixedOps,
  automotiveFloorplanPeriods,
  automotiveInventorySnapshots,
  automotiveReportingDemoNotice,
  automotiveReportingPeriod,
  automotiveSales
} from '../../../../../../data/demo/accounting/automotiveSalesReportingSeed';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const percent = (value: number | null) => (value === null ? '—' : `${number.format(value)}%`);
const channelLabel: Record<AutomotiveSalesChannel, string> = {
  new_retail: 'New retail',
  used_retail: 'Used retail',
  used_wholesale: 'Used wholesale'
};

const input = {
  scope: demoAtlasContext.scope,
  period: automotiveReportingPeriod,
  sales: automotiveSales,
  fixedOps: automotiveFixedOps,
  inventorySnapshots: automotiveInventorySnapshots,
  floorplanPeriods: automotiveFloorplanPeriods
};

function AutomotiveSalesReportingWorkspace() {
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState<AutomotiveSalesChannel | 'all'>('all');
  const scoped = useMemo(() => scopeAutomotiveReportingData(input), []);
  const summary = useMemo(() => summarizeAutomotiveReporting(input), []);
  const visibleSales = useMemo(
    () => filterAutomotiveSales(scoped.sales, { query, channel }),
    [scoped.sales, query, channel]
  );

  const departmentRows = [
    ['New vehicle retail', summary.channels.new_retail.revenue, summary.channels.new_retail.grossProfit, summary.channels.new_retail.grossMargin, summary.channels.new_retail.units, summary.channels.new_retail.grossProfitPerUnit],
    ['Used vehicle retail', summary.channels.used_retail.revenue, summary.channels.used_retail.grossProfit, summary.channels.used_retail.grossMargin, summary.channels.used_retail.units, summary.channels.used_retail.grossProfitPerUnit],
    ['Used vehicle wholesale', summary.channels.used_wholesale.revenue, summary.channels.used_wholesale.grossProfit, summary.channels.used_wholesale.grossMargin, summary.channels.used_wholesale.units, summary.channels.used_wholesale.grossProfitPerUnit],
    ['Service', summary.fixedOps.service.revenue, summary.fixedOps.service.grossProfit, summary.fixedOps.service.grossMargin, null, null],
    ['Parts', summary.fixedOps.parts.revenue, summary.fixedOps.parts.grossProfit, summary.fixedOps.parts.grossMargin, null, null],
    ['Collision', summary.fixedOps.collision.revenue, summary.fixedOps.collision.grossProfit, summary.fixedOps.collision.grossMargin, null, null],
    ['F&I, net', summary.fAndINetRevenue, summary.fAndINetRevenue, 100, summary.retailUnits, summary.fAndIPerRetailUnit]
  ] as const;

  return (
    <div className="page-stack">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">Finance / Accounting / Reports</p>
          <h1>Automotive Sales Financial Reporting</h1>
          <p>Departmental automotive retail reporting for vehicle sales, F&I, fixed operations, inventory and floorplan carrying cost from one tenant-scoped accounting dataset.</p>
        </div>
        <div className="asof-card"><span>Period</span><strong>Aug 2026 demo</strong></div>
      </header>

      <div className="notice" role="status">{automotiveReportingDemoNotice}</div>

      <section className="metric-grid" aria-label="Automotive reporting summary">
        <article><span>Total revenue</span><strong>{currency.format(summary.totalRevenue)}</strong><small>Vehicle + fixed ops + F&I net</small></article>
        <article><span>Total gross profit</span><strong>{currency.format(summary.totalGrossProfit)}</strong><small>{percent(summary.totalGrossMargin)} consolidated gross margin</small></article>
        <article><span>Retail units</span><strong>{summary.retailUnits}</strong><small>New + used retail only</small></article>
        <article><span>F&I per retail unit</span><strong>{summary.fAndIPerRetailUnit === null ? '—' : currency.format(summary.fAndIPerRetailUnit)}</strong><small>Net of chargebacks</small></article>
      </section>

      <section className="workspace-card">
        <div className="card-heading"><div><p className="eyebrow">Department P&L</p><h2>Variable + fixed operations</h2></div><span className="status-chip neutral">Demo</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Department</th><th>Revenue</th><th>Gross profit</th><th>Gross margin</th><th>Units</th><th>Gross / unit</th></tr></thead>
            <tbody>{departmentRows.map(([label, revenue, gross, margin, units, gpu]) => (
              <tr key={label}><td><strong>{label}</strong></td><td className="money">{currency.format(revenue)}</td><td className="money">{currency.format(gross)}</td><td>{percent(margin)}</td><td>{units ?? '—'}</td><td className="money">{gpu === null ? '—' : currency.format(gpu)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="workspace-card">
        <div className="card-heading"><div><p className="eyebrow">Inventory & floorplan</p><h2>Carrying position</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Inventory</th><th>Units on hand</th><th>Carrying value</th><th>Floorplan payable</th><th>Days supply</th><th>Snapshot</th></tr></thead>
            <tbody>
              <tr><td><strong>New retail</strong></td><td>{summary.inventory.new.unitsOnHand ?? '—'}</td><td className="money">{summary.inventory.new.inventoryCarryingValue === null ? '—' : currency.format(summary.inventory.new.inventoryCarryingValue)}</td><td className="money">{summary.inventory.new.floorplanPayable === null ? '—' : currency.format(summary.inventory.new.floorplanPayable)}</td><td>{summary.inventory.new.daysSupply === null ? '—' : `${number.format(summary.inventory.new.daysSupply)} days`}</td><td>{summary.inventory.new.asOf ?? '—'}</td></tr>
              <tr><td><strong>Used retail</strong></td><td>{summary.inventory.used.unitsOnHand ?? '—'}</td><td className="money">{summary.inventory.used.inventoryCarryingValue === null ? '—' : currency.format(summary.inventory.used.inventoryCarryingValue)}</td><td className="money">{summary.inventory.used.floorplanPayable === null ? '—' : currency.format(summary.inventory.used.floorplanPayable)}</td><td>{summary.inventory.used.daysSupply === null ? '—' : `${number.format(summary.inventory.used.daysSupply)} days`}</td><td>{summary.inventory.used.asOf ?? '—'}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="detail-grid">
          <dl><dt>Manufacturer credits recognized</dt><dd>{currency.format(summary.manufacturerCredits)}</dd></dl>
          <dl><dt>Floorplan assistance in vehicle gross</dt><dd>{currency.format(summary.floorplanAssistance)}</dd></dl>
          <dl><dt>Floorplan interest expense</dt><dd>{currency.format(summary.floorplanInterestExpense)}</dd></dl>
          <dl><dt>Net inventory carrying cost</dt><dd>{currency.format(summary.netInventoryCarryingCost)}</dd></dl>
        </div>
      </section>

      <section className="workspace-card">
        <div className="toolbar">
          <label className="field wide-field"><span>Search deals</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Stock, VIN, store" /></label>
          <label className="field"><span>Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value as AutomotiveSalesChannel | 'all')}><option value="all">All vehicle sales</option><option value="new_retail">New retail</option><option value="used_retail">Used retail</option><option value="used_wholesale">Used wholesale</option></select></label>
        </div>
        {visibleSales.length === 0 ? <div className="empty-state"><strong>No deals match these filters</strong><span>Change the search or sales channel.</span></div> : <div className="table-wrap"><table><thead><tr><th>Deal</th><th>Channel</th><th>Vehicle revenue</th><th>Net vehicle cost</th><th>Front gross</th><th>F&I net</th><th>Manufacturer credits</th></tr></thead><tbody>{visibleSales.map((sale) => <tr key={sale.id}><td><strong>{sale.stockNumber}</strong><small>{sale.vin}</small></td><td>{channelLabel[sale.channel]}</td><td className="money">{currency.format(sale.vehicleRevenue)}</td><td className="money">{currency.format(netVehicleCost(sale))}</td><td className="money">{currency.format(vehicleGrossProfit(sale))}</td><td className="money">{currency.format(netFAndIRevenue(sale))}</td><td className="money">{currency.format(manufacturerCreditsTotal(sale.manufacturerCredits))}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="detail-panel">
        <div className="detail-heading"><div><p className="eyebrow">Accounting controls</p><h2>Automotive reporting guardrails</h2></div><div className="detail-balance"><span>F&I chargebacks</span><strong>{currency.format(summary.fAndIChargebacks)}</strong></div></div>
        <div className="detail-grid">
          <dl><dt>Vehicle sale</dt><dd>Recognize when the customer contract is complete, financing/collectibility is supportable, and control transfers.</dd></dl>
          <dl><dt>F&I</dt><dd>Report net of estimated/actual chargebacks; wholesale deals do not create retail F&I PVR.</dd></dl>
          <dl><dt>OEM credits</dt><dd>Tied holdback, floorplan assistance and eligible incentives reduce vehicle carrying cost/COGS when earned and the related vehicle is sold.</dd></dl>
          <dl><dt>Fixed ops</dt><dd>Service, parts and collision remain separate profit centers; internal reconditioning must not create false consolidated profit.</dd></dl>
        </div>
        <div className="connection-gate"><strong>Production data connections required</strong><span>Next gate: authorized DMS/deal-jacket, CRM, VIN inventory, lender/F&I, GL, bank and Supabase adapters with tenant-level RLS and audit evidence. Until then this page remains explicitly DEMO.</span></div>
      </section>
    </div>
  );
}

export function AutomotiveSalesReportingPage() {
  if (!hasPermission(demoAtlasContext.permissions, 'accounting.read')) {
    return <section className="page-stack"><header className="page-header"><p className="eyebrow">Finance / Accounting</p><h1>Access denied</h1><p>Your current ATLAS role does not include permission to read automotive financial reporting.</p></header></section>;
  }
  return <AutomotiveSalesReportingWorkspace />;
}
