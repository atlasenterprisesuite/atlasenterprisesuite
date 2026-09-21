
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  map1098ToReturn,
  map1095AToReturn,
  mapSSA1099ToReturn,
  map1099BToReturn,
  type TaxMappingResult
} from '../../../../../packages/tax-forms/src';
import { importTaxSourceMapping } from '../../lib/taxApi';

type Draft = Record<string, string | boolean>;

const money = (value: string | boolean | undefined) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

function mappingPayload(result: TaxMappingResult): Array<Record<string, unknown>> {
  return result.mappings.map((mapping) => ({ ...mapping }));
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function MappingPanel({ result }: { result: TaxMappingResult }) {
  return (
    <section className="tax-panel">
      <div className="tax-panel-heading">
        <div><p className="eyebrow">Live mapping</p><h2>ATLAS destination graph</h2></div>
        <span className={result.revisionStatus === 'final-destination' ? 'tax-status ok' : 'tax-status review'}>
          {result.revisionStatus === 'final-destination' ? 'Final destination map' : 'Destination review gate'}
        </span>
      </div>
      {result.mappings.length === 0 ? (
        <div className="empty-state"><strong>Enter source values</strong><span>ATLAS will show the linked worksheets, Forms/Schedules and review gates.</span></div>
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

export function DepthTaxIntake() {
  const [params] = useSearchParams();
  const returnId = params.get('returnId') || '';
  const [kind, setKind] = useState<'1098' | '1095-A' | 'SSA-1099' | '1099-B'>('1098');
  const [draft, setDraft] = useState<Draft>({
    taxYear: '2026',
    corrected: false,
    sharedPolicy: false,
    altMarriage: false,
    basisReported: true,
    term: 'short'
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const set = (key: string, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const taxYear = Number(draft.taxYear) || 2026;

  const result = useMemo(() => {
    if (kind === '1098') {
      return map1098ToReturn({
        taxYear,
        box1MortgageInterest: money(draft.box1),
        box2OutstandingPrincipal: money(draft.box2),
        box4RefundOfOverpaidInterest: money(draft.box4),
        box6PointsPaidOnPurchase: money(draft.box6),
        acquisitionDebtLimitReview: Boolean(draft.debtLimit),
        sharedBorrowerReview: Boolean(draft.sharedBorrower)
      });
    }

    if (kind === '1095-A') {
      const months = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const key = String(month).padStart(2, '0');
        return {
          month,
          enrollmentPremium: money(draft['m' + key + 'a']),
          slcspPremium: money(draft['m' + key + 'b']),
          advancePremiumTaxCredit: money(draft['m' + key + 'c'])
        };
      }).filter((month) => month.enrollmentPremium !== undefined || month.slcspPremium !== undefined || month.advancePremiumTaxCredit !== undefined);

      return map1095AToReturn({
        taxYear,
        corrected: Boolean(draft.corrected),
        sharedPolicyAllocation: Boolean(draft.sharedPolicy),
        alternativeMarriageCalculation: Boolean(draft.altMarriage),
        months
      });
    }

    if (kind === 'SSA-1099') {
      return mapSSA1099ToReturn({
        taxYear,
        box3BenefitsPaid: money(draft.box3),
        box4BenefitsRepaid: money(draft.box4),
        box5NetBenefits: money(draft.box5),
        box6FederalWithholding: money(draft.box6),
        lumpSumPriorYearPayment: Boolean(draft.lumpSum),
        marriedFilingSeparatelyLivedWithSpouse: Boolean(draft.mfsLivedWithSpouse)
      });
    }

    return map1099BToReturn({
      taxYear,
      transactions: String(draft.transactionId || '').trim() ? [{
        transactionId: String(draft.transactionId),
        description: String(draft.description || ''),
        dateAcquired: String(draft.dateAcquired || ''),
        dateSold: String(draft.dateSold || ''),
        proceeds: money(draft.proceeds),
        basis: money(draft.basis),
        basisReportedToIRS: Boolean(draft.basisReported),
        term: String(draft.term || 'unknown') as 'short' | 'long' | 'unknown',
        washSaleLossDisallowed: money(draft.washSale),
        otherAdjustment: money(draft.otherAdjustment),
        adjustmentCode: String(draft.adjustmentCode || '')
      }] : []
    });
  }, [draft, kind, taxYear]);

  const persist = async () => {
    if (!returnId || !result.mappings.length) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const saved = await importTaxSourceMapping({
        returnId,
        documentType: result.sourceDocument,
        taxYear,
        mappings: mappingPayload(result),
        metadata: {
          reviewFlags: result.reviewFlags,
          revisionStatus: result.revisionStatus,
          sourceEngine: 'tax-depth-source-engines-v1'
        }
      });
      setSaveMessage('Saved ' + saved.mapping_count + ' mappings to Tax Fact Ledger.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save tax source mapping.');
    } finally {
      setSaving(false);
    }
  };

  const changeKind = (next: typeof kind) => {
    setKind(next);
    setDraft({
      taxYear: draft.taxYear,
      corrected: false,
      sharedPolicy: false,
      altMarriage: false,
      basisReported: true,
      term: 'short'
    });
    setSaveMessage('');
  };

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div>
            <p className="eyebrow">Tax depth intake</p>
            <h2>Mortgage, Marketplace, Social Security & Brokerage</h2>
          </div>
          <label className="field tax-year">
            <span>Tax year</span>
            <select value={String(draft.taxYear)} onChange={(event) => set('taxYear', event.target.value)}>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </label>
        </div>

        <div className="tax-field-grid">
          <label className="field">
            <span>Document</span>
            <select value={kind} onChange={(event) => changeKind(event.target.value as typeof kind)}>
              <option value="1098">Form 1098 · Mortgage Interest</option>
              <option value="1095-A">Form 1095-A · Marketplace</option>
              <option value="SSA-1099">SSA-1099 · Social Security</option>
              <option value="1099-B">1099-B / Brokerage transaction</option>
            </select>
          </label>
        </div>

        {kind === '1098' ? (
          <>
            <div className="tax-field-grid">
              <MoneyField label="Box 1 · Mortgage interest received" value={String(draft.box1 || '')} onChange={(value) => set('box1', value)} />
              <MoneyField label="Box 2 · Outstanding mortgage principal" value={String(draft.box2 || '')} onChange={(value) => set('box2', value)} />
              <MoneyField label="Box 4 · Refund of overpaid interest" value={String(draft.box4 || '')} onChange={(value) => set('box4', value)} />
              <MoneyField label="Box 6 · Points paid on purchase" value={String(draft.box6 || '')} onChange={(value) => set('box6', value)} />
            </div>
            <div className="tax-check-grid">
              <label><input type="checkbox" checked={Boolean(draft.debtLimit)} onChange={(event) => set('debtLimit', event.target.checked)} /> Acquisition-debt limitation review</label>
              <label><input type="checkbox" checked={Boolean(draft.sharedBorrower)} onChange={(event) => set('sharedBorrower', event.target.checked)} /> Shared borrower / allocation review</label>
            </div>
          </>
        ) : null}

        {kind === '1095-A' ? (
          <>
            <div className="tax-check-grid">
              <label><input type="checkbox" checked={Boolean(draft.corrected)} onChange={(event) => set('corrected', event.target.checked)} /> Corrected statement</label>
              <label><input type="checkbox" checked={Boolean(draft.sharedPolicy)} onChange={(event) => set('sharedPolicy', event.target.checked)} /> Shared policy allocation</label>
              <label><input type="checkbox" checked={Boolean(draft.altMarriage)} onChange={(event) => set('altMarriage', event.target.checked)} /> Alternative marriage calculation</label>
            </div>
            <div className="tax-marketplace-grid">
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, '0');
                return (
                  <article key={month}>
                    <strong>Month {month}</strong>
                    <MoneyField label="Column A · Enrollment premium" value={String(draft['m' + month + 'a'] || '')} onChange={(value) => set('m' + month + 'a', value)} />
                    <MoneyField label="Column B · SLCSP premium" value={String(draft['m' + month + 'b'] || '')} onChange={(value) => set('m' + month + 'b', value)} />
                    <MoneyField label="Column C · APTC" value={String(draft['m' + month + 'c'] || '')} onChange={(value) => set('m' + month + 'c', value)} />
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {kind === 'SSA-1099' ? (
          <>
            <div className="tax-field-grid">
              <MoneyField label="Box 3 · Benefits paid" value={String(draft.box3 || '')} onChange={(value) => set('box3', value)} />
              <MoneyField label="Box 4 · Benefits repaid" value={String(draft.box4 || '')} onChange={(value) => set('box4', value)} />
              <MoneyField label="Box 5 · Net benefits" value={String(draft.box5 || '')} onChange={(value) => set('box5', value)} />
              <MoneyField label="Box 6 · Federal withholding" value={String(draft.box6 || '')} onChange={(value) => set('box6', value)} />
            </div>
            <div className="tax-check-grid">
              <label><input type="checkbox" checked={Boolean(draft.lumpSum)} onChange={(event) => set('lumpSum', event.target.checked)} /> Includes prior-year lump-sum benefits</label>
              <label><input type="checkbox" checked={Boolean(draft.mfsLivedWithSpouse)} onChange={(event) => set('mfsLivedWithSpouse', event.target.checked)} /> MFS and lived with spouse</label>
            </div>
          </>
        ) : null}

        {kind === '1099-B' ? (
          <>
            <div className="tax-field-grid">
              <Field label="Transaction ID" value={String(draft.transactionId || '')} onChange={(value) => set('transactionId', value)} />
              <Field label="Description / security" value={String(draft.description || '')} onChange={(value) => set('description', value)} />
              <Field label="Date acquired" value={String(draft.dateAcquired || '')} onChange={(value) => set('dateAcquired', value)} />
              <Field label="Date sold" value={String(draft.dateSold || '')} onChange={(value) => set('dateSold', value)} />
              <MoneyField label="Proceeds" value={String(draft.proceeds || '')} onChange={(value) => set('proceeds', value)} />
              <MoneyField label="Cost / other basis" value={String(draft.basis || '')} onChange={(value) => set('basis', value)} />
              <MoneyField label="Wash-sale loss disallowed" value={String(draft.washSale || '')} onChange={(value) => set('washSale', value)} />
              <MoneyField label="Other adjustment" value={String(draft.otherAdjustment || '')} onChange={(value) => set('otherAdjustment', value)} />
              <Field label="Adjustment code" value={String(draft.adjustmentCode || '')} onChange={(value) => set('adjustmentCode', value.toUpperCase())} />
              <label className="field">
                <span>Holding period</span>
                <select value={String(draft.term || 'short')} onChange={(event) => set('term', event.target.value)}>
                  <option value="short">Short-term</option>
                  <option value="long">Long-term</option>
                  <option value="unknown">Needs review</option>
                </select>
              </label>
            </div>
            <div className="tax-check-grid">
              <label><input type="checkbox" checked={Boolean(draft.basisReported)} onChange={(event) => set('basisReported', event.target.checked)} /> Basis reported to IRS</label>
            </div>
          </>
        ) : null}

        {returnId ? (
          <div className="tax-pro-actions">
            <button type="button" className="primary-action" disabled={saving || !result.mappings.length} onClick={() => void persist()}>
              {saving ? 'Saving…' : 'Save to return ledger'}
            </button>
            {saveMessage ? <span>{saveMessage}</span> : null}
          </div>
        ) : (
          <div className="notice">Preview mode. Open this intake from a persisted return to write the source document into the Tax Fact Ledger.</div>
        )}
      </section>

      <MappingPanel result={result} />
    </div>
  );
}
