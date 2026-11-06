import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { calculateCampaignEconomics, parseUsdCents } from '../../../../../packages/advisory/src/campaignEconomics';
import './enterpriseAutomation.css';

const empty = { spend: '', clicks: '', leads: '', customers: '', revenue: '' };
const fields = [
  ['spend', 'Advertising spend (USD)', true],
  ['clicks', 'Clicks', false],
  ['leads', 'Leads', false],
  ['customers', 'Customers', false],
  ['revenue', 'Attributed revenue (USD)', true]
] as const;
const labels = { cpcCents: 'Cost per click', costPerLeadCents: 'Cost per lead', adCostPerCustomerCents: 'Advertising cost per customer', roas: 'Attributed revenue / advertising spend' };
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function CampaignEconomicsPage() {
  const [input, setInput] = useState(empty);
  let result: ReturnType<typeof calculateCampaignEconomics> | null = null;
  let error = '';
  try {
    const count = (value: string) => {
      if (!/^\d*$/.test(value)) throw new Error('invalid_count');
      return Number(value || '0');
    };
    result = calculateCampaignEconomics({
      spendCents: parseUsdCents(input.spend || '0'),
      attributedRevenueCents: parseUsdCents(input.revenue || '0'),
      clicks: count(input.clicks), leads: count(input.leads), customers: count(input.customers)
    });
  } catch { error = 'Enter nonnegative amounts with at most two decimals and safe whole numbers for clicks, leads and customers.'; }
  const hasInput = Object.values(input).some(value => value !== '');
  return <div className="enterprise-automation">
    <header className="page-header"><p className="eyebrow">ATLAS Growth · Simulation</p><h2>Campaign economics</h2></header>
    <p className="notice">No advertising account is connected by this calculator. Inputs are local planning assumptions, not verified campaign results. No data is saved or sent to advertising providers.</p>
    <p>Use one campaign, currency and reporting period. Distinguish leads from paying customers; attributed revenue is not profit, and advertising cost per customer excludes other acquisition expenses.</p>
    <div className="automation-inputs">
      {fields.map(([key, label, amount]) => <label key={key}><span>{label}</span><input type="number" min="0" step={amount ? '0.01' : '1'} value={input[key]} onChange={event => setInput(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
    </div>
    <button className="automation-reset" type="button" onClick={() => setInput({ ...empty })}>Clear scenario</button>
    {error ? <p role="alert">{error}</p> : <div className="automation-results" aria-live="polite" aria-label="Simulation results">
      {(Object.keys(labels) as (keyof typeof labels)[]).map(key => {
        const value = hasInput ? result?.[key] : null;
        return <article key={key}><span>{labels[key]}</span><strong data-testid={key}>{value == null ? '—' : key === 'roas' ? `${value.toFixed(2)}×` : money.format(value / 100)}</strong></article>;
      })}
    </div>}
    <p>Target CPA and Target CPC are average-cost goals, not guaranteed prices or individual bid ceilings. This calculator does not configure bidding or authorize spending.</p>
    <nav className="automation-jump" aria-label="Campaign operating cycle"><Link to="/advisory/crm">CRM</Link><Link to="/advisory/providers">Provider readiness</Link><Link to="/finance/accounting">Accounting</Link><Link to="/advisory">Advisory overview</Link></nav>
  </div>;
}
