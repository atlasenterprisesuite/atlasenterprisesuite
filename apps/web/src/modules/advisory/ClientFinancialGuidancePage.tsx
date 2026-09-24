import { useMemo, useState } from 'react';
import {
  analyzeFinancialGuidance,
  type FinancialDataConfidence,
  type FinancialDebt
} from '../../../../../packages/advisory/src';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function numberValue(value: string) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : 0;
}

function blankDebt(index: number): FinancialDebt {
  return {
    id: `debt-${index}-${Date.now()}`,
    name: '',
    balance: 0,
    aprPercent: null,
    minimumPayment: null,
    cureAmount: null,
    dueDate: null,
    overdue: false,
    collectionRiskDate: null,
    securedEssential: false
  };
}

export function ClientFinancialGuidancePage() {
  const [clientLabel, setClientLabel] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataConfidence, setDataConfidence] = useState<FinancialDataConfidence>('confirmed');
  const [availableCash, setAvailableCash] = useState('');
  const [confirmedIncome30d, setConfirmedIncome30d] = useState('');
  const [essentialExpenses30d, setEssentialExpenses30d] = useState('');
  const [recurringObligations30d, setRecurringObligations30d] = useState('');
  const [debts, setDebts] = useState<FinancialDebt[]>([blankDebt(0)]);

  const input = useMemo(() => ({
    asOf,
    clientLabel: clientLabel.trim() || undefined,
    dataConfidence,
    availableCash: numberValue(availableCash),
    confirmedIncome30d: numberValue(confirmedIncome30d),
    essentialExpenses30d: numberValue(essentialExpenses30d),
    recurringObligations30d: numberValue(recurringObligations30d),
    debts
  }), [asOf, clientLabel, dataConfidence, availableCash, confirmedIncome30d, essentialExpenses30d, recurringObligations30d, debts]);

  const result = useMemo(() => analyzeFinancialGuidance(input), [input]);
  const hasData = input.availableCash > 0 || input.confirmedIncome30d > 0 || input.essentialExpenses30d > 0 ||
    input.recurringObligations30d > 0 || debts.some((debt) => debt.balance > 0);

  function patchDebt(id: string, patch: Partial<FinancialDebt>) {
    setDebts((current) => current.map((debt) => debt.id === id ? { ...debt, ...patch } : debt));
  }

  return (
    <section className="advisory-shell">
      <header className="page-header">
        <p className="eyebrow">ATLAS Financial Guidance</p>
        <h1>Client Financial Action Plan</h1>
        <p>Explainable 30-day planning for liquidity, debt urgency and payment sequencing. ATLAS uses only values recorded in this workspace and does not fabricate missing financial data.</p>
      </header>

      <div className="notice strong" role="note">
        Planning support only. Confirm creditor amounts and deadlines before payment. Tax, legal, investment and insolvency decisions require the appropriate qualified professional.
      </div>

      <div className="advisory-grid">
        <div className="feature-card advisory-form">
          <p className="eyebrow">Client snapshot</p>
          <h2>Resources and protected needs</h2>
          <label className="field"><span>Client / household label</span><input value={clientLabel} onChange={(event) => setClientLabel(event.target.value)} placeholder="Optional" /></label>
          <label className="field"><span>As of</span><input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label>
          <label className="field"><span>Data status</span><select value={dataConfidence} onChange={(event) => setDataConfidence(event.target.value as FinancialDataConfidence)}><option value="confirmed">Confirmed</option><option value="estimated">Estimated</option><option value="incomplete">Incomplete</option></select></label>
          <label className="field"><span>Available cash now</span><input inputMode="decimal" value={availableCash} onChange={(event) => setAvailableCash(event.target.value)} placeholder="0.00" /></label>
          <label className="field"><span>Confirmed income expected in next 30 days</span><input inputMode="decimal" value={confirmedIncome30d} onChange={(event) => setConfirmedIncome30d(event.target.value)} placeholder="0.00" /></label>
          <label className="field"><span>Essential expenses for next 30 days</span><input inputMode="decimal" value={essentialExpenses30d} onChange={(event) => setEssentialExpenses30d(event.target.value)} placeholder="Housing, food, work transport" /></label>
          <label className="field"><span>Other recurring obligations for next 30 days</span><input inputMode="decimal" value={recurringObligations30d} onChange={(event) => setRecurringObligations30d(event.target.value)} placeholder="Utilities, subscriptions, insurance" /></label>
        </div>

        <div className="feature-card">
          <p className="eyebrow">Debt register</p>
          <h2>Record obligations without guessing</h2>
          <div className="advisory-list">
            {debts.map((debt, index) => <article key={debt.id}>
              <div className="card-heading"><strong>Debt {index + 1}</strong>{debts.length > 1 ? <button type="button" onClick={() => setDebts((current) => current.filter((item) => item.id !== debt.id))}>Remove</button> : null}</div>
              <label className="field"><span>Name</span><input value={debt.name} onChange={(event) => patchDebt(debt.id, { name: event.target.value })} placeholder="Creditor / obligation" /></label>
              <label className="field"><span>Balance</span><input inputMode="decimal" value={debt.balance || ''} onChange={(event) => patchDebt(debt.id, { balance: numberValue(event.target.value) })} /></label>
              <label className="field"><span>APR %</span><input inputMode="decimal" value={debt.aprPercent ?? ''} onChange={(event) => patchDebt(debt.id, { aprPercent: event.target.value === '' ? null : numberValue(event.target.value) })} /></label>
              <label className="field"><span>Minimum payment</span><input inputMode="decimal" value={debt.minimumPayment ?? ''} onChange={(event) => patchDebt(debt.id, { minimumPayment: event.target.value === '' ? null : numberValue(event.target.value) })} /></label>
              <label className="field"><span>Amount required to cure / avoid escalation</span><input inputMode="decimal" value={debt.cureAmount ?? ''} onChange={(event) => patchDebt(debt.id, { cureAmount: event.target.value === '' ? null : numberValue(event.target.value) })} /></label>
              <label className="field"><span>Due date</span><input type="date" value={debt.dueDate ?? ''} onChange={(event) => patchDebt(debt.id, { dueDate: event.target.value || null })} /></label>
              <label className="field"><span>Collection-risk date</span><input type="date" value={debt.collectionRiskDate ?? ''} onChange={(event) => patchDebt(debt.id, { collectionRiskDate: event.target.value || null })} /></label>
              <label className="field"><span><input type="checkbox" checked={Boolean(debt.overdue)} onChange={(event) => patchDebt(debt.id, { overdue: event.target.checked })} /> Overdue</span></label>
              <label className="field"><span><input type="checkbox" checked={Boolean(debt.securedEssential)} onChange={(event) => patchDebt(debt.id, { securedEssential: event.target.checked })} /> Secured / essential to housing or work</span></label>
            </article>)}
          </div>
          <button type="button" onClick={() => setDebts((current) => [...current, blankDebt(current.length)])}>Add debt</button>
        </div>
      </div>

      {!hasData ? (
        <div className="empty-state" role="status">
          <strong>No financial plan generated yet</strong>
          <span>Enter real client values. ATLAS will not seed example balances or pretend a financial provider is connected.</span>
        </div>
      ) : (
        <div className="page-stack">
          <div className="stat-grid" aria-label="Financial guidance summary">
            <article><strong>{currency.format(result.resources30d)}</strong><span>30-day recorded resources</span></article>
            <article><strong>{currency.format(result.protectedNeeds30d)}</strong><span>protected needs + 7-day reserve target</span></article>
            <article><strong>{currency.format(result.allocatableCash)}</strong><span>cash available for planned debt actions</span></article>
            <article><strong>{currency.format(result.liquidityGap)}</strong><span>gap versus essentials, recurring bills and minimums</span></article>
          </div>

          {result.liquidityGap > 0 ? <div className="notice strong">To close the recorded 30-day liquidity gap evenly, additional confirmed net resources would need to average about <strong>{currency.format(result.dailyIncomeTargetToCloseGap)}</strong> per day.</div> : null}

          <div className="advisory-grid">
            <div className="feature-card">
              <p className="eyebrow">Priority queue</p><h2>What requires attention first</h2>
              {result.priorities.length === 0 ? <div className="empty-state"><strong>No debt balances recorded</strong><span>Debt-specific prioritization remains empty.</span></div> :
                <div className="advisory-list">{result.priorities.map((priority, index) => <article key={priority.debtId}><div className="card-heading"><strong>{index + 1}. {priority.name}</strong><span className={`status-chip ${priority.urgency === 'critical' ? 'warning' : 'neutral'}`}>{priority.urgency}</span></div><p>{priority.reasons.join(' · ')}</p><small>{priority.planningTarget > 0 ? `Recorded cure/minimum target: ${currency.format(priority.planningTarget)}` : 'Confirm cure or minimum amount before assigning a payment target.'}</small></article>)}</div>}
            </div>

            <div className="feature-card">
              <p className="eyebrow">30-day allocation</p><h2>Suggested planning targets</h2>
              {result.suggestedPayments.length === 0 ? <div className="empty-state"><strong>No debt allocation available</strong><span>Recorded resources are protected for essentials/reserve, or cure/minimum amounts are missing.</span></div> :
                <div className="advisory-list">{result.suggestedPayments.map((payment) => <article key={payment.debtId}><strong>{payment.name}</strong><span>{currency.format(payment.amount)}</span><small>{payment.rationale}</small></article>)}</div>}
              <p className="muted">ATLAS protects essential expenses and a seven-day operating reserve target before suggesting debt acceleration.</p>
            </div>
          </div>

          {result.warnings.length ? <div className="notice" role="alert"><strong>Data checks before acting</strong><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}

          <details className="feature-card">
            <summary>Why ATLAS produced this plan</summary>
            <ul>{result.methodology.map((item) => <li key={item}>{item}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
