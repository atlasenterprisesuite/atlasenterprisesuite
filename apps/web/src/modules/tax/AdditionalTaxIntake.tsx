
import { useMemo, useState } from 'react';
import {
  map1099DIVToReturn,
  map1099INTToReturn,
  map1099NECToReturn,
  mapPartnershipK1ToReturn,
  type NecIncomeClassification,
  type TaxMappingResult
} from '../../../../../packages/tax-forms/src';

type Draft = Record<string, string | boolean>;

const money = (value: string | boolean | undefined) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

function MappingPanel({ result }: { result: TaxMappingResult }) {
  return (
    <section className="tax-panel">
      <div className="tax-panel-heading">
        <div><p className="eyebrow">Live mapping</p><h2>ATLAS destination graph</h2></div>
        <span className={result.revisionStatus === 'final-destination' ? 'tax-status ok' : 'tax-status review'}>
          {result.revisionStatus === 'final-destination' ? 'Final destination map' : '2026 destination review gate'}
        </span>
      </div>
      {result.mappings.length === 0 ? (
        <div className="empty-state"><strong>Enter source-document values</strong><span>ATLAS will resolve the linked forms, schedules and review gates.</span></div>
      ) : (
        <div className="tax-map-list">
          {result.mappings.map((mapping, index) => (
            <article className="tax-map-row" key={mapping.source + mapping.destinationField + index}>
              <div><small>{mapping.source}</small><strong>{mapping.amount !== undefined ? '$' + mapping.amount.toLocaleString() : String(mapping.value)}</strong></div>
              <span aria-hidden="true">→</span>
              <div>
                <small>{mapping.jurisdiction} · {mapping.treatment}</small>
                <strong>{mapping.destinationForm}{mapping.destinationLine ? ' · line ' + mapping.destinationLine : ''}</strong>
                <p>{mapping.reason}</p>
              </div>
              {mapping.reviewRequired ? <span className="tax-review-chip">Review</span> : <span className="tax-ok-chip">Mapped</span>}
            </article>
          ))}
        </div>
      )}
      {result.reviewFlags.length ? <div className="notice"><strong>Review queue:</strong> {result.reviewFlags.join(' ')}</div> : null}
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function InformationReturnWorkspace() {
  const [kind, setKind] = useState<'1099-INT' | '1099-DIV' | '1099-NEC'>('1099-INT');
  const [draft, setDraft] = useState<Draft>({ taxYear: '2026', classification: 'unknown' });

  const set = (key: string, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const taxYear = Number(draft.taxYear) || 2026;

  const result = useMemo(() => {
    if (kind === '1099-INT') {
      return map1099INTToReturn({
        taxYear,
        box1InterestIncome: money(draft.box1),
        box2EarlyWithdrawalPenalty: money(draft.box2),
        box3USTreasuryInterest: money(draft.box3),
        box4FederalWithholding: money(draft.box4),
        box6ForeignTaxPaid: money(draft.box6),
        box8TaxExemptInterest: money(draft.box8),
        box11BondPremium: money(draft.box11),
        stateTaxWithheld: money(draft.stateTax),
        stateIncome: money(draft.stateIncome)
      });
    }
    if (kind === '1099-DIV') {
      return map1099DIVToReturn({
        taxYear,
        box1aOrdinaryDividends: money(draft.box1a),
        box1bQualifiedDividends: money(draft.box1b),
        box2aCapitalGainDistributions: money(draft.box2a),
        box4FederalWithholding: money(draft.box4),
        box5Section199ADividends: money(draft.box5),
        box7ForeignTaxPaid: money(draft.box7),
        box11ExemptInterestDividends: money(draft.box11),
        stateTaxWithheld: money(draft.stateTax),
        stateIncome: money(draft.stateIncome)
      });
    }
    return map1099NECToReturn({
      taxYear,
      box1NonemployeeCompensation: money(draft.box1),
      box3GoldenParachute: money(draft.box3),
      box4FederalWithholding: money(draft.box4),
      classification: String(draft.classification ?? 'unknown') as NecIncomeClassification,
      stateTaxWithheld: money(draft.stateTax),
      stateIncome: money(draft.stateIncome)
    });
  }, [draft, kind, taxYear]);

  const fields = kind === '1099-INT'
    ? [
        ['box1', 'Box 1 · Interest income'],
        ['box2', 'Box 2 · Early withdrawal penalty'],
        ['box3', 'Box 3 · U.S. Treasury interest'],
        ['box4', 'Box 4 · Federal withholding'],
        ['box6', 'Box 6 · Foreign tax paid'],
        ['box8', 'Box 8 · Tax-exempt interest'],
        ['box11', 'Box 11 · Bond premium']
      ]
    : kind === '1099-DIV'
      ? [
          ['box1a', 'Box 1a · Ordinary dividends'],
          ['box1b', 'Box 1b · Qualified dividends'],
          ['box2a', 'Box 2a · Capital gain distributions'],
          ['box4', 'Box 4 · Federal withholding'],
          ['box5', 'Box 5 · Section 199A dividends'],
          ['box7', 'Box 7 · Foreign tax paid'],
          ['box11', 'Box 11 · Exempt-interest dividends']
        ]
      : [
          ['box1', 'Box 1 · Nonemployee compensation'],
          ['box3', 'Box 3 · Excess golden parachute'],
          ['box4', 'Box 4 · Federal withholding']
        ];

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div><p className="eyebrow">Information return</p><h2>1099 Intake</h2></div>
          <label className="field tax-year"><span>Tax year</span><select value={String(draft.taxYear)} onChange={(event) => set('taxYear', event.target.value)}><option value="2025">2025</option><option value="2026">2026</option></select></label>
        </div>
        <div className="tax-field-grid">
          <label className="field"><span>1099 type</span><select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setDraft({ taxYear: draft.taxYear, classification: 'unknown' }); }}><option value="1099-INT">1099-INT</option><option value="1099-DIV">1099-DIV</option><option value="1099-NEC">1099-NEC</option></select></label>
          {kind === '1099-NEC' ? (
            <label className="field"><span>Income classification</span><select value={String(draft.classification ?? 'unknown')} onChange={(event) => set('classification', event.target.value)}><option value="unknown">Needs classification</option><option value="self-employment">Self-employment</option><option value="farm">Farm</option><option value="not-self-employment">Not self-employment / sporadic</option><option value="employee-dispute">Employee classification dispute</option></select></label>
          ) : null}
          {fields.map(([key, label]) => <Input key={key} label={label} value={String(draft[key] ?? '')} onChange={(value) => set(key, value)} />)}
          <Input label="State tax withheld" value={String(draft.stateTax ?? '')} onChange={(value) => set('stateTax', value)} />
          <Input label="State income" value={String(draft.stateIncome ?? '')} onChange={(value) => set('stateIncome', value)} />
        </div>
      </section>
      <MappingPanel result={result} />
    </div>
  );
}

export function PartnershipK1Workspace() {
  const [draft, setDraft] = useState<Draft>({ taxYear: '2026', hasK3: false, isPTP: false });
  const set = (key: string, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));

  const result = useMemo(() => mapPartnershipK1ToReturn({
    taxYear: Number(draft.taxYear) || 2026,
    box1OrdinaryBusinessIncome: money(draft.box1),
    box2RentalRealEstateIncome: money(draft.box2),
    box3OtherRentalIncome: money(draft.box3),
    box4aGuaranteedPaymentsServices: money(draft.box4a),
    box4bGuaranteedPaymentsCapital: money(draft.box4b),
    box5InterestIncome: money(draft.box5),
    box6aOrdinaryDividends: money(draft.box6a),
    box6bQualifiedDividends: money(draft.box6b),
    box7Royalties: money(draft.box7),
    box8ShortTermCapitalGain: money(draft.box8),
    box9aLongTermCapitalGain: money(draft.box9a),
    box10Section1231: money(draft.box10),
    box14aSelfEmploymentEarnings: money(draft.box14a),
    hasK3: Boolean(draft.hasK3),
    isPubliclyTradedPartnership: Boolean(draft.isPTP)
  }), [draft]);

  const fields = [
    ['box1', 'Box 1 · Ordinary business income (loss)'],
    ['box2', 'Box 2 · Rental real estate income (loss)'],
    ['box3', 'Box 3 · Other rental income (loss)'],
    ['box4a', 'Box 4a · Guaranteed payments for services'],
    ['box4b', 'Box 4b · Guaranteed payments for capital'],
    ['box5', 'Box 5 · Interest income'],
    ['box6a', 'Box 6a · Ordinary dividends'],
    ['box6b', 'Box 6b · Qualified dividends'],
    ['box7', 'Box 7 · Royalties'],
    ['box8', 'Box 8 · Short-term capital gain (loss)'],
    ['box9a', 'Box 9a · Long-term capital gain (loss)'],
    ['box10', 'Box 10 · Section 1231 gain (loss)'],
    ['box14a', 'Box 14 code A · Self-employment earnings']
  ];

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div><p className="eyebrow">Pass-through source</p><h2>Schedule K-1 (Form 1065)</h2></div>
          <label className="field tax-year"><span>Tax year</span><select value={String(draft.taxYear)} onChange={(event) => set('taxYear', event.target.value)}><option value="2025">2025</option><option value="2026">2026</option></select></label>
        </div>
        <div className="tax-field-grid">
          {fields.map(([key, label]) => <Input key={key} label={label} value={String(draft[key] ?? '')} onChange={(value) => set(key, value)} />)}
        </div>
        <div className="tax-check-grid">
          <label><input type="checkbox" checked={Boolean(draft.hasK3)} onChange={(event) => set('hasK3', event.target.checked)} /> Schedule K-3 attached</label>
          <label><input type="checkbox" checked={Boolean(draft.isPTP)} onChange={(event) => set('isPTP', event.target.checked)} /> Publicly traded partnership (PTP)</label>
        </div>
      </section>
      <MappingPanel result={result} />
    </div>
  );
}
