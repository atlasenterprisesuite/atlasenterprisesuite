import { useMemo, useState } from 'react';
import {
  FEDERAL_BENEFITS_2025,
  calculateOrdinaryLine16Tax2025,
  type FederalBenefitKind2025,
  type FilingStatus2025
} from '../../../../../packages/tax-forms/src';

const filingLabels: Record<FilingStatus2025, string> = {
  single: 'Single',
  'married-filing-jointly': 'Married filing jointly',
  'married-filing-separately': 'Married filing separately',
  'head-of-household': 'Head of household',
  'qualifying-surviving-spouse': 'Qualifying surviving spouse'
};

const kindLabels: Record<FederalBenefitKind2025, string> = {
  credit: 'Credits',
  deduction: 'Deductions',
  adjustment: 'Adjustments to income',
  'itemized-deduction': 'Itemized deductions',
  'tax-computation': 'Tax computation'
};

export function TaxBenefits2025() {
  const [taxableIncome, setTaxableIncome] = useState('25300');
  const [filingStatus, setFilingStatus] = useState<FilingStatus2025>('married-filing-jointly');
  const [kind, setKind] = useState<FederalBenefitKind2025 | 'all'>('all');

  const line16 = useMemo(() => {
    const value = Number(taxableIncome.replace(/,/g, ''));
    if (!Number.isFinite(value) || value < 0) return null;
    return calculateOrdinaryLine16Tax2025(value, filingStatus);
  }, [taxableIncome, filingStatus]);

  const benefits = useMemo(
    () => FEDERAL_BENEFITS_2025.filter((item) => kind === 'all' || item.kind === kind),
    [kind]
  );

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div>
            <p className="eyebrow">IRS rule pack · 2025</p>
            <h2>Tax Table, credits & deductions</h2>
            <p>Official federal benefits catalog with calculation gates, forms, phaseouts and refundability.</p>
          </div>
          <span className="tax-status ok">2025 rule pack</span>
        </div>

        <div className="tax-field-grid">
          <label className="field">
            <span>Taxable income · Form 1040 line 15</span>
            <input inputMode="decimal" value={taxableIncome} onChange={(event) => setTaxableIncome(event.target.value)} />
          </label>
          <label className="field">
            <span>Filing status</span>
            <select value={filingStatus} onChange={(event) => setFilingStatus(event.target.value as FilingStatus2025)}>
              {Object.entries(filingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Benefit category</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as FederalBenefitKind2025 | 'all')}>
              <option value="all">All federal benefits</option>
              {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className="tax-pro-summary">
          <div>
            <small>Ordinary line 16 method</small>
            <strong>{line16?.method === 'tax-table' ? '2025 Tax Table' : line16?.method === 'tax-computation-worksheet' ? 'Tax Computation Worksheet' : '—'}</strong>
            <span>{line16 ? 'Special capital-gain/dividend and other line-16 methods remain separately gated.' : 'Enter valid taxable income.'}</span>
          </div>
          <div>
            <small>Ordinary tax</small>
            <strong>{line16 ? '$' + line16.tax.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}</strong>
            <span>{line16?.exactForOrdinaryMethod ? 'Exact for the selected ordinary IRS method.' : 'Not calculated.'}</span>
          </div>
          <div>
            <small>Benefits indexed</small>
            <strong>{FEDERAL_BENEFITS_2025.length}</strong>
            <span>Credits, deductions, adjustments and itemized benefits.</span>
          </div>
          <div>
            <small>Governance</small>
            <strong>Fail closed</strong>
            <span>Worksheet/source-document benefits are never granted from maximum amount alone.</span>
          </div>
        </div>
      </section>

      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div><p className="eyebrow">Federal benefits</p><h2>2025 eligibility catalog</h2></div>
          <span className="tax-status review">{benefits.length} shown</span>
        </div>

        <div className="tax-benefit-grid">
          {benefits.map((benefit) => (
            <article className="tax-benefit-card" key={benefit.id}>
              <div className="tax-panel-heading">
                <div>
                  <small>{kindLabels[benefit.kind]} · {benefit.refundability.replaceAll('-', ' ')}</small>
                  <strong>{benefit.name}</strong>
                </div>
                <span className={benefit.support === 'automatic' ? 'tax-status ok' : 'tax-status review'}>
                  {benefit.support.replaceAll('-', ' ')}
                </span>
              </div>
              <p><strong>Form:</strong> {benefit.form}{benefit.destination ? ' → ' + benefit.destination : ''}</p>
              {benefit.maximum ? <p><strong>Maximum / rule:</strong> {benefit.maximum}</p> : null}
              {benefit.thresholds ? <p><strong>Thresholds:</strong> {benefit.thresholds}</p> : null}
              <ul>
                {benefit.eligibility.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
              <a href={benefit.officialSource} target="_blank" rel="noreferrer">IRS official source</a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
