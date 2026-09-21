
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { TAX_FORM_CATALOG, mapW2ToReturn, type W2Document } from '../../../../../packages/tax-forms/src';
import { InformationReturnWorkspace, PartnershipK1Workspace } from './AdditionalTaxIntake';
import { ProfessionalReturnWorkspace } from './ProfessionalReturnWorkspace';
import { TaxControlCenter } from './TaxControlCenter';
import './tax.css';

const nav = [
  { to: '/tax', label: 'Tax Home', end: true },
  { to: '/tax/control', label: 'Control Center', end: false },
  { to: '/tax/prepare', label: 'Prepare Return', end: false },
  { to: '/tax/documents/w2', label: 'W-2 Intake', end: false },
  { to: '/tax/documents/1099', label: '1099 Intake', end: false },
  { to: '/tax/documents/k1', label: 'K-1 Intake', end: false },
  { to: '/tax/forms', label: 'Forms & Schedules', end: false },
  { to: '/tax/personal', label: 'Personal Returns', end: false },
  { to: '/tax/business', label: 'Business Returns', end: false },
  { to: '/tax/review', label: 'Review Queue', end: false }
] as const;

type W2Draft = Record<string, string | boolean>;

const initialW2: W2Draft = {
  taxYear: '2026',
  box1Wages: '',
  box2FederalWithholding: '',
  box3SocialSecurityWages: '',
  box4SocialSecurityTax: '',
  box5MedicareWages: '',
  box6MedicareTax: '',
  box7SocialSecurityTips: '',
  box8AllocatedTips: '',
  box10DependentCareBenefits: '',
  box11NonqualifiedPlans: '',
  box12Code: '',
  box12Amount: '',
  box13StatutoryEmployee: false,
  box13RetirementPlan: false,
  box13ThirdPartySickPay: false,
  box14Other: '',
  box14TreasuryTippedOccupationCodes: '',
  box15State: '',
  box15EmployerStateId: '',
  box16StateWages: '',
  box17StateIncomeTax: '',
  box18LocalWages: '',
  box19LocalIncomeTax: '',
  box20LocalityName: ''
};

function parseMoney(value: string) {
  if (value.trim() === '') return undefined;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildW2(draft: W2Draft): W2Document {
  return {
    taxYear: Number(draft.taxYear) || 2026,
    box1Wages: parseMoney(String(draft.box1Wages)),
    box2FederalWithholding: parseMoney(String(draft.box2FederalWithholding)),
    box3SocialSecurityWages: parseMoney(String(draft.box3SocialSecurityWages)),
    box4SocialSecurityTax: parseMoney(String(draft.box4SocialSecurityTax)),
    box5MedicareWages: parseMoney(String(draft.box5MedicareWages)),
    box6MedicareTax: parseMoney(String(draft.box6MedicareTax)),
    box7SocialSecurityTips: parseMoney(String(draft.box7SocialSecurityTips)),
    box8AllocatedTips: parseMoney(String(draft.box8AllocatedTips)),
    box10DependentCareBenefits: parseMoney(String(draft.box10DependentCareBenefits)),
    box11NonqualifiedPlans: parseMoney(String(draft.box11NonqualifiedPlans)),
    box12: String(draft.box12Code).trim()
      ? [{ code: String(draft.box12Code), amount: parseMoney(String(draft.box12Amount)) }]
      : [],
    box13StatutoryEmployee: Boolean(draft.box13StatutoryEmployee),
    box13RetirementPlan: Boolean(draft.box13RetirementPlan),
    box13ThirdPartySickPay: Boolean(draft.box13ThirdPartySickPay),
    box14Other: String(draft.box14Other),
    box14TreasuryTippedOccupationCodes: String(draft.box14TreasuryTippedOccupationCodes),
    box15State: String(draft.box15State),
    box15EmployerStateId: String(draft.box15EmployerStateId),
    box16StateWages: parseMoney(String(draft.box16StateWages)),
    box17StateIncomeTax: parseMoney(String(draft.box17StateIncomeTax)),
    box18LocalWages: parseMoney(String(draft.box18LocalWages)),
    box19LocalIncomeTax: parseMoney(String(draft.box19LocalIncomeTax)),
    box20LocalityName: String(draft.box20LocalityName)
  };
}

function TaxLayout({ children }: { children: ReactNode }) {
  return (
    <section className="tax-shell">
      <header className="tax-header">
        <div>
          <p className="eyebrow">ATLAS Tax</p>
          <h1>Forms & Schedules Engine</h1>
          <p>Source-document intake, versioned return mapping and governed review.</p>
        </div>
        <span className="tax-gate">Filing rails gated</span>
      </header>
      <nav className="tax-nav" aria-label="ATLAS Tax workspace">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
        ))}
      </nav>
      {children}
    </section>
  );
}

function TaxHome() {
  return (
    <div className="page-stack">
      <div className="notice">
        ATLAS can prepare deterministic mappings and review paths. External e-file submission remains unavailable until the filing adapter, authorization and production verification are approved.
      </div>
      <div className="module-grid">
        <Link className="module-card enabled" to="/tax/control"><span>Firm operations</span><strong>Tax Control Center</strong><p>Persistent client return queue, statuses, review/signature gates, rejects and filing readiness.</p></Link>
        <Link className="module-card enabled" to="/tax/prepare"><span>Professional workflow</span><strong>Prepare a Return</strong><p>Guided preparation from engagement and interview through review, signature, e-file readiness and closeout.</p></Link>
        <Link className="module-card enabled" to="/tax/documents/w2"><span>Source documents</span><strong>Enter a W-2</strong><p>Populate W-2 boxes and see federal, state and local destinations update immediately.</p></Link>
        <Link className="module-card enabled" to="/tax/documents/1099"><span>Information returns</span><strong>Enter a 1099</strong><p>Map 1099-INT, 1099-DIV and 1099-NEC into the connected return graph with classification gates.</p></Link>
        <Link className="module-card enabled" to="/tax/documents/k1"><span>Pass-through</span><strong>Enter a K-1</strong><p>Route partnership income, rental, portfolio, capital gain and self-employment items with limitation review.</p></Link>
        <Link className="module-card enabled" to="/tax/forms"><span>Return graph</span><strong>Forms & Schedules</strong><p>Browse personal and business forms as one connected tax graph.</p></Link>
        <Link className="module-card enabled" to="/tax/personal"><span>1040 family</span><strong>Personal Returns</strong><p>1040, schedules, credits, self-employment, investments and international attachments.</p></Link>
        <Link className="module-card enabled" to="/tax/business"><span>Entity returns</span><strong>Business Returns</strong><p>1065, 1120, 1120-S, 1041, 990, payroll and information-return families.</p></Link>
      </div>
    </div>
  );
}

function MoneyField({
  field,
  label,
  draft,
  setDraft
}: {
  field: string;
  label: string;
  draft: W2Draft;
  setDraft: Dispatch<SetStateAction<W2Draft>>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={String(draft[field] ?? '')}
        onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
      />
    </label>
  );
}

function W2Workspace() {
  const [draft, setDraft] = useState<W2Draft>(initialW2);
  const document = useMemo(() => buildW2(draft), [draft]);
  const result = useMemo(() => mapW2ToReturn(document), [document]);

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div><p className="eyebrow">Source document</p><h2>Form W-2 intake</h2></div>
          <label className="field tax-year">
            <span>Tax year</span>
            <select value={String(draft.taxYear)} onChange={(event) => setDraft((current) => ({ ...current, taxYear: event.target.value }))}>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </label>
        </div>

        <div className="tax-field-grid">
          <MoneyField field="box1Wages" label="Box 1 · Wages, tips, other compensation" draft={draft} setDraft={setDraft} />
          <MoneyField field="box2FederalWithholding" label="Box 2 · Federal income tax withheld" draft={draft} setDraft={setDraft} />
          <MoneyField field="box3SocialSecurityWages" label="Box 3 · Social Security wages" draft={draft} setDraft={setDraft} />
          <MoneyField field="box4SocialSecurityTax" label="Box 4 · Social Security tax withheld" draft={draft} setDraft={setDraft} />
          <MoneyField field="box5MedicareWages" label="Box 5 · Medicare wages and tips" draft={draft} setDraft={setDraft} />
          <MoneyField field="box6MedicareTax" label="Box 6 · Medicare tax withheld" draft={draft} setDraft={setDraft} />
          <MoneyField field="box7SocialSecurityTips" label="Box 7 · Social Security tips" draft={draft} setDraft={setDraft} />
          <MoneyField field="box8AllocatedTips" label="Box 8 · Allocated tips" draft={draft} setDraft={setDraft} />
          <MoneyField field="box10DependentCareBenefits" label="Box 10 · Dependent care benefits" draft={draft} setDraft={setDraft} />
          <MoneyField field="box11NonqualifiedPlans" label="Box 11 · Nonqualified plans" draft={draft} setDraft={setDraft} />

          <label className="field">
            <span>Box 12 · Code</span>
            <input value={String(draft.box12Code)} onChange={(event) => setDraft((current) => ({ ...current, box12Code: event.target.value.toUpperCase() }))} />
          </label>
          <MoneyField field="box12Amount" label="Box 12 · Amount" draft={draft} setDraft={setDraft} />

          <label className="field">
            <span>Box 14a · Other</span>
            <input value={String(draft.box14Other)} onChange={(event) => setDraft((current) => ({ ...current, box14Other: event.target.value }))} />
          </label>
          <label className="field">
            <span>Box 14b · Treasury tipped occupation code(s)</span>
            <input value={String(draft.box14TreasuryTippedOccupationCodes)} onChange={(event) => setDraft((current) => ({ ...current, box14TreasuryTippedOccupationCodes: event.target.value }))} />
          </label>
          <label className="field">
            <span>Box 15 · State</span>
            <input maxLength={2} value={String(draft.box15State)} onChange={(event) => setDraft((current) => ({ ...current, box15State: event.target.value.toUpperCase() }))} />
          </label>
          <label className="field">
            <span>Box 15 · Employer state ID</span>
            <input value={String(draft.box15EmployerStateId)} onChange={(event) => setDraft((current) => ({ ...current, box15EmployerStateId: event.target.value }))} />
          </label>
          <MoneyField field="box16StateWages" label="Box 16 · State wages" draft={draft} setDraft={setDraft} />
          <MoneyField field="box17StateIncomeTax" label="Box 17 · State income tax" draft={draft} setDraft={setDraft} />
          <MoneyField field="box18LocalWages" label="Box 18 · Local wages" draft={draft} setDraft={setDraft} />
          <MoneyField field="box19LocalIncomeTax" label="Box 19 · Local income tax" draft={draft} setDraft={setDraft} />
          <label className="field">
            <span>Box 20 · Locality</span>
            <input value={String(draft.box20LocalityName)} onChange={(event) => setDraft((current) => ({ ...current, box20LocalityName: event.target.value }))} />
          </label>
        </div>

        <div className="tax-check-grid">
          {[
            ['box13StatutoryEmployee', 'Box 13 · Statutory employee'],
            ['box13RetirementPlan', 'Box 13 · Retirement plan'],
            ['box13ThirdPartySickPay', 'Box 13 · Third-party sick pay']
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(draft[key])}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
              /> {label}
            </label>
          ))}
        </div>
      </section>

      <section className="tax-panel">
        <div className="tax-panel-heading">
          <div><p className="eyebrow">Live mapping</p><h2>ATLAS destination graph</h2></div>
          <span className={result.revisionStatus === 'final-destination' ? 'tax-status ok' : 'tax-status review'}>
            {result.revisionStatus === 'final-destination' ? 'Final destination map' : '2026 destination review gate'}
          </span>
        </div>

        {result.mappings.length === 0 ? (
          <div className="empty-state"><strong>Enter a W-2 value</strong><span>ATLAS will show the target form, line or rules engine immediately.</span></div>
        ) : (
          <div className="tax-map-list">
            {result.mappings.map((mapping, index) => (
              <article className="tax-map-row" key={mapping.source + '-' + mapping.destinationField + '-' + index}>
                <div>
                  <small>{mapping.source}</small>
                  <strong>{mapping.amount !== undefined ? '$' + mapping.amount.toLocaleString() : String(mapping.value)}</strong>
                </div>
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
    </div>
  );
}

function FormsCatalog({ audience }: { audience?: 'personal' | 'business' }) {
  const items = TAX_FORM_CATALOG.filter((item) => !audience || item.audience === audience || item.audience === 'both');
  const title = audience === 'personal' ? 'Personal returns' : audience === 'business' ? 'Business returns' : 'Forms & Schedules catalog';

  return (
    <div className="page-stack">
      <section className="tax-panel">
        <p className="eyebrow">{audience ? audience + ' tax' : 'Tax graph'}</p>
        <h2>{title}</h2>
        <div className="tax-catalog">
          {items.map((item) => (
            <article key={item.id}>
              <small>{item.category}</small>
              <strong>{item.title}</strong>
              <p>{item.purpose}</p>
              {item.parent ? <span>Parent: {item.parent}</span> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReviewQueue() {
  return (
    <div className="page-stack">
      <div className="notice">
        <strong>Governed review queue.</strong> Unsupported Box 12 codes, employer-specific Box 14 values, jurisdiction-specific lines and draft-year destination revisions stay blocked from filing until their rule pack is approved.
      </div>
    </div>
  );
}

export function TaxRoutes() {
  return (
    <RequireAtlasIdentity>
      <TaxLayout>
        <Routes>
          <Route index element={<TaxHome />} />
          <Route path="control" element={<TaxControlCenter />} />
          <Route path="prepare" element={<ProfessionalReturnWorkspace />} />
          <Route path="documents/w2" element={<W2Workspace />} />
          <Route path="documents/1099" element={<InformationReturnWorkspace />} />
          <Route path="documents/k1" element={<PartnershipK1Workspace />} />
          <Route path="forms" element={<FormsCatalog />} />
          <Route path="personal" element={<FormsCatalog audience="personal" />} />
          <Route path="business" element={<FormsCatalog audience="business" />} />
          <Route path="review" element={<ReviewQueue />} />
        </Routes>
      </TaxLayout>
    </RequireAtlasIdentity>
  );
}
