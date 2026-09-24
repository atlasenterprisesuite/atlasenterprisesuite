import { useMemo, useState } from 'react';
import {
  upsertTaxClientIntake,
  type TaxClientHouseholdMemberInput,
  type TaxClientProfileRow
} from '../../lib/taxApi';

type Draft = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  preferredName: string;
  mpcNumber: string;
  dateOfBirth: string;
  occupation: string;
  maritalStatus: TaxClientProfileRow['marital_status'];
  filingStatus: TaxClientProfileRow['filing_status'];
  residencyStatus: TaxClientProfileRow['residency_status'];
  taxpayerIdType: TaxClientProfileRow['taxpayer_id_type'];
  taxpayerIdFull: string;
  ipPinRequired: boolean;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  county: string;
  priorYearFiled: '' | 'yes' | 'no';
  priorYearFilingStatus: string;
  identityVerified: boolean;
  intakeStatus: TaxClientProfileRow['intake_status'];
  notes: string;
};

type HouseholdDraft = {
  id: string;
  relationship: TaxClientHouseholdMemberInput['relationship'];
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  taxpayerIdType: 'ssn' | 'itin' | 'atin' | 'other' | 'none';
  taxpayerIdFull: string;
  monthsLivedWithTaxpayer: string;
  fullTimeStudent: boolean;
  permanentlyDisabled: boolean;
  grossIncome: string;
  taxpayerProvidedSupportPercent: string;
  childcareExpenses: string;
  qualifyingChildCandidate: boolean;
  qualifyingRelativeCandidate: boolean;
  notes: string;
};

const initialDraft: Draft = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  preferredName: '',
  mpcNumber: '',
  dateOfBirth: '',
  occupation: '',
  maritalStatus: 'unknown',
  filingStatus: 'undetermined',
  residencyStatus: 'unknown',
  taxpayerIdType: 'ssn',
  taxpayerIdFull: '',
  ipPinRequired: false,
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  countryCode: 'US',
  county: '',
  priorYearFiled: '',
  priorYearFilingStatus: '',
  identityVerified: false,
  intakeStatus: 'draft',
  notes: ''
};

function digits(value: string) {
  return value.replace(/\D/g, '');
}

function last4(value: string) {
  const clean = digits(value);
  return clean.length >= 4 ? clean.slice(-4) : clean;
}

function asNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyHousehold(): HouseholdDraft {
  return {
    id: crypto.randomUUID(),
    relationship: 'son',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    taxpayerIdType: 'ssn',
    taxpayerIdFull: '',
    monthsLivedWithTaxpayer: '',
    fullTimeStudent: false,
    permanentlyDisabled: false,
    grossIncome: '',
    taxpayerProvidedSupportPercent: '',
    childcareExpenses: '',
    qualifyingChildCandidate: false,
    qualifyingRelativeCandidate: false,
    notes: ''
  };
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function TaxClientIntake({ onSaved }: { onSaved?: (clientId: string) => void }) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [household, setHousehold] = useState<HouseholdDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const taxpayerDigits = useMemo(() => digits(draft.taxpayerIdFull), [draft.taxpayerIdFull]);
  const taxpayerIdentifierValid =
    draft.taxpayerIdType === 'none' ||
    !taxpayerDigits.length ||
    (draft.taxpayerIdType === 'ssn' && taxpayerDigits.length === 9) ||
    (draft.taxpayerIdType !== 'ssn' && taxpayerDigits.length >= 4);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updateHousehold = <K extends keyof HouseholdDraft>(id: string, key: K, value: HouseholdDraft[K]) =>
    setHousehold((current) => current.map((member) => member.id === id ? { ...member, [key]: value } : member));

  const save = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.dateOfBirth || !taxpayerIdentifierValid) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await upsertTaxClientIntake({
        firstName: draft.firstName.trim(),
        middleName: draft.middleName.trim(),
        lastName: draft.lastName.trim(),
        suffix: draft.suffix.trim(),
        preferredName: draft.preferredName.trim(),
        mpcNumber: draft.mpcNumber.trim(),
        dateOfBirth: draft.dateOfBirth,
        occupation: draft.occupation.trim(),
        maritalStatus: draft.maritalStatus,
        filingStatus: draft.filingStatus,
        residencyStatus: draft.residencyStatus,
        taxpayerIdType: draft.taxpayerIdType,
        taxpayerIdLast4: draft.taxpayerIdFull ? last4(draft.taxpayerIdFull) : '',
        ipPinRequired: draft.ipPinRequired,
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        addressLine1: draft.addressLine1.trim(),
        addressLine2: draft.addressLine2.trim(),
        city: draft.city.trim(),
        stateRegion: draft.stateRegion.trim(),
        postalCode: draft.postalCode.trim(),
        countryCode: draft.countryCode.trim().toUpperCase() || 'US',
        county: draft.county.trim(),
        priorYearFiled: draft.priorYearFiled === '' ? null : draft.priorYearFiled === 'yes',
        priorYearFilingStatus: draft.priorYearFilingStatus,
        identityVerified: draft.identityVerified,
        intakeStatus: draft.intakeStatus,
        notes: draft.notes.trim(),
        household: household
          .filter((member) => member.firstName.trim() && member.lastName.trim())
          .map((member) => ({
            relationship: member.relationship,
            firstName: member.firstName.trim(),
            middleName: member.middleName.trim(),
            lastName: member.lastName.trim(),
            dateOfBirth: member.dateOfBirth,
            taxpayerIdType: member.taxpayerIdType,
            taxpayerIdLast4: member.taxpayerIdFull ? last4(member.taxpayerIdFull) : '',
            monthsLivedWithTaxpayer: asNumber(member.monthsLivedWithTaxpayer),
            fullTimeStudent: member.fullTimeStudent,
            permanentlyDisabled: member.permanentlyDisabled,
            grossIncome: asNumber(member.grossIncome),
            taxpayerProvidedSupportPercent: asNumber(member.taxpayerProvidedSupportPercent),
            childcareExpenses: asNumber(member.childcareExpenses),
            qualifyingChildCandidate: member.qualifyingChildCandidate,
            qualifyingRelativeCandidate: member.qualifyingRelativeCandidate,
            notes: member.notes.trim()
          }))
      });
      setMessage('Client intake saved. Tax profile is ready for return preparation.');
      setDraft(initialDraft);
      setHousehold([]);
      onSaved?.(saved.client_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save client intake.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="tax-panel tax-client-intake">
      <div className="tax-panel-heading">
        <div>
          <p className="eyebrow">New tax client</p>
          <h2>Client evaluation & intake</h2>
          <p>Identity, contact, filing status, residence and household facts used to prepare and review the return.</p>
        </div>
        <span className="tax-status review">Sensitive-data controls</span>
      </div>

      <div className="tax-intake-section">
        <div className="tax-intake-title"><strong>1. Taxpayer identity</strong><span>Required identity and filing profile.</span></div>
        <div className="tax-field-grid">
          <TextField label="First name *" value={draft.firstName} onChange={(value) => set('firstName', value)} autoComplete="given-name" />
          <TextField label="Middle name" value={draft.middleName} onChange={(value) => set('middleName', value)} autoComplete="additional-name" />
          <TextField label="Last name *" value={draft.lastName} onChange={(value) => set('lastName', value)} autoComplete="family-name" />
          <TextField label="Suffix" value={draft.suffix} onChange={(value) => set('suffix', value)} />
          <TextField label="Preferred name" value={draft.preferredName} onChange={(value) => set('preferredName', value)} />
          <TextField label="MPC number (optional)" value={draft.mpcNumber} onChange={(value) => set('mpcNumber', value)} />
          <TextField label="Date of birth *" type="date" value={draft.dateOfBirth} onChange={(value) => set('dateOfBirth', value)} />
          <TextField label="Occupation" value={draft.occupation} onChange={(value) => set('occupation', value)} />
          <label className="field">
            <span>Taxpayer ID type</span>
            <select value={draft.taxpayerIdType} onChange={(event) => set('taxpayerIdType', event.target.value as Draft['taxpayerIdType'])}>
              <option value="ssn">Social Security Number (SSN)</option>
              <option value="itin">ITIN</option>
              <option value="other">Other tax ID</option>
              <option value="none">Not yet available</option>
            </select>
          </label>
          <TextField
            label="SSN / ITIN"
            type="password"
            value={draft.taxpayerIdFull}
            onChange={(value) => set('taxpayerIdFull', value)}
            autoComplete="off"
          />
        </div>
        <div className={taxpayerIdentifierValid ? 'tax-security-note' : 'notice'}>
          <strong>Identifier protection.</strong> The full SSN/ITIN is used only in this local form state; ATLAS sends and stores only the last four digits until a verified secure-vault adapter is connected. It is never written to ordinary tables or logs.
        </div>
      </div>

      <div className="tax-intake-section">
        <div className="tax-intake-title"><strong>2. Filing profile</strong><span>Legal status and return-selection facts.</span></div>
        <div className="tax-field-grid">
          <label className="field">
            <span>Marital status</span>
            <select value={draft.maritalStatus} onChange={(event) => set('maritalStatus', event.target.value as Draft['maritalStatus'])}>
              <option value="unknown">Needs determination</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </label>
          <label className="field">
            <span>Filing status</span>
            <select value={draft.filingStatus} onChange={(event) => set('filingStatus', event.target.value as Draft['filingStatus'])}>
              <option value="undetermined">Needs determination</option>
              <option value="single">Single</option>
              <option value="married_filing_jointly">Married filing jointly</option>
              <option value="married_filing_separately">Married filing separately</option>
              <option value="head_of_household">Head of household</option>
              <option value="qualifying_surviving_spouse">Qualifying surviving spouse</option>
            </select>
          </label>
          <label className="field">
            <span>Residency / citizenship status</span>
            <select value={draft.residencyStatus} onChange={(event) => set('residencyStatus', event.target.value as Draft['residencyStatus'])}>
              <option value="unknown">Needs determination</option>
              <option value="us_citizen">U.S. citizen</option>
              <option value="resident_alien">Resident alien</option>
              <option value="nonresident_alien">Nonresident alien</option>
              <option value="dual_status">Dual-status</option>
            </select>
          </label>
          <label className="field">
            <span>Filed prior-year return?</span>
            <select value={draft.priorYearFiled} onChange={(event) => set('priorYearFiled', event.target.value as Draft['priorYearFiled'])}>
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="field">
            <span>Prior-year filing status</span>
            <select value={draft.priorYearFilingStatus} onChange={(event) => set('priorYearFilingStatus', event.target.value)}>
              <option value="">Not provided</option>
              <option value="single">Single</option>
              <option value="married_filing_jointly">Married filing jointly</option>
              <option value="married_filing_separately">Married filing separately</option>
              <option value="head_of_household">Head of household</option>
              <option value="qualifying_surviving_spouse">Qualifying surviving spouse</option>
            </select>
          </label>
          <label className="field">
            <span>Intake status</span>
            <select value={draft.intakeStatus} onChange={(event) => set('intakeStatus', event.target.value as Draft['intakeStatus'])}>
              <option value="draft">Draft</option>
              <option value="needs_information">Needs information</option>
              <option value="ready_for_return">Ready for return</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
        </div>
        <div className="tax-check-grid">
          <label><input type="checkbox" checked={draft.ipPinRequired} onChange={(event) => set('ipPinRequired', event.target.checked)} /> Taxpayer has / requires IRS IP PIN</label>
          <label><input type="checkbox" checked={draft.identityVerified} onChange={(event) => set('identityVerified', event.target.checked)} /> Identity documents reviewed</label>
        </div>
      </div>

      <div className="tax-intake-section">
        <div className="tax-intake-title"><strong>3. Contact & residence</strong><span>Current mailing and jurisdiction information.</span></div>
        <div className="tax-field-grid">
          <TextField label="Phone" type="tel" value={draft.phone} onChange={(value) => set('phone', value)} autoComplete="tel" />
          <TextField label="Email" type="email" value={draft.email} onChange={(value) => set('email', value)} autoComplete="email" />
          <TextField label="Address line 1" value={draft.addressLine1} onChange={(value) => set('addressLine1', value)} autoComplete="address-line1" />
          <TextField label="Address line 2" value={draft.addressLine2} onChange={(value) => set('addressLine2', value)} autoComplete="address-line2" />
          <TextField label="City" value={draft.city} onChange={(value) => set('city', value)} autoComplete="address-level2" />
          <TextField label="State / region" value={draft.stateRegion} onChange={(value) => set('stateRegion', value.toUpperCase())} autoComplete="address-level1" />
          <TextField label="ZIP / postal code" value={draft.postalCode} onChange={(value) => set('postalCode', value)} autoComplete="postal-code" />
          <TextField label="County" value={draft.county} onChange={(value) => set('county', value)} />
          <TextField label="Country" value={draft.countryCode} onChange={(value) => set('countryCode', value.toUpperCase())} autoComplete="country" />
        </div>
      </div>

      <div className="tax-intake-section">
        <div className="tax-intake-title">
          <div><strong>4. Spouse & dependents</strong><span>Add every household member relevant to filing-status and credit tests.</span></div>
          <button type="button" onClick={() => setHousehold((current) => [...current, emptyHousehold()])}>Add household member</button>
        </div>
        {!household.length ? <div className="empty-state"><strong>No household members added</strong><span>Add a spouse, child or other dependent candidate when applicable.</span></div> : null}
        <div className="tax-household-list">
          {household.map((member, index) => (
            <article className="tax-household-card" key={member.id}>
              <div className="tax-panel-heading">
                <strong>Household member {index + 1}</strong>
                <button type="button" onClick={() => setHousehold((current) => current.filter((item) => item.id !== member.id))}>Remove</button>
              </div>
              <div className="tax-field-grid">
                <label className="field">
                  <span>Relationship</span>
                  <select value={member.relationship} onChange={(event) => updateHousehold(member.id, 'relationship', event.target.value as HouseholdDraft['relationship'])}>
                    <option value="spouse">Spouse</option>
                    <option value="son">Son</option>
                    <option value="daughter">Daughter</option>
                    <option value="stepchild">Stepchild</option>
                    <option value="foster_child">Foster child</option>
                    <option value="sibling">Sibling</option>
                    <option value="parent">Parent</option>
                    <option value="grandchild">Grandchild</option>
                    <option value="other_relative">Other relative</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <TextField label="First name" value={member.firstName} onChange={(value) => updateHousehold(member.id, 'firstName', value)} />
                <TextField label="Middle name" value={member.middleName} onChange={(value) => updateHousehold(member.id, 'middleName', value)} />
                <TextField label="Last name" value={member.lastName} onChange={(value) => updateHousehold(member.id, 'lastName', value)} />
                <TextField label="Date of birth" type="date" value={member.dateOfBirth} onChange={(value) => updateHousehold(member.id, 'dateOfBirth', value)} />
                <label className="field">
                  <span>Taxpayer ID type</span>
                  <select value={member.taxpayerIdType} onChange={(event) => updateHousehold(member.id, 'taxpayerIdType', event.target.value as HouseholdDraft['taxpayerIdType'])}>
                    <option value="ssn">SSN</option>
                    <option value="itin">ITIN</option>
                    <option value="atin">ATIN</option>
                    <option value="other">Other</option>
                    <option value="none">Not available</option>
                  </select>
                </label>
                <TextField label="SSN / ITIN / ATIN" type="password" value={member.taxpayerIdFull} onChange={(value) => updateHousehold(member.id, 'taxpayerIdFull', value)} autoComplete="off" />
                <TextField label="Months lived with taxpayer" value={member.monthsLivedWithTaxpayer} onChange={(value) => updateHousehold(member.id, 'monthsLivedWithTaxpayer', value)} />
                <TextField label="Gross income" value={member.grossIncome} onChange={(value) => updateHousehold(member.id, 'grossIncome', value)} />
                <TextField label="Taxpayer support %" value={member.taxpayerProvidedSupportPercent} onChange={(value) => updateHousehold(member.id, 'taxpayerProvidedSupportPercent', value)} />
                <TextField label="Childcare expenses" value={member.childcareExpenses} onChange={(value) => updateHousehold(member.id, 'childcareExpenses', value)} />
              </div>
              <div className="tax-check-grid">
                <label><input type="checkbox" checked={member.fullTimeStudent} onChange={(event) => updateHousehold(member.id, 'fullTimeStudent', event.target.checked)} /> Full-time student</label>
                <label><input type="checkbox" checked={member.permanentlyDisabled} onChange={(event) => updateHousehold(member.id, 'permanentlyDisabled', event.target.checked)} /> Permanently disabled</label>
                <label><input type="checkbox" checked={member.qualifyingChildCandidate} onChange={(event) => updateHousehold(member.id, 'qualifyingChildCandidate', event.target.checked)} /> Qualifying-child candidate</label>
                <label><input type="checkbox" checked={member.qualifyingRelativeCandidate} onChange={(event) => updateHousehold(member.id, 'qualifyingRelativeCandidate', event.target.checked)} /> Qualifying-relative candidate</label>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="tax-intake-section">
        <div className="tax-intake-title"><strong>5. Preparer notes</strong><span>Open questions, documents to request and filing-status observations.</span></div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={4} value={draft.notes} onChange={(event) => set('notes', event.target.value)} />
        </label>
      </div>

      <div className="tax-pro-actions">
        <button
          type="button"
          className="primary-action"
          disabled={saving || !draft.firstName.trim() || !draft.lastName.trim() || !draft.dateOfBirth || !taxpayerIdentifierValid}
          onClick={() => void save()}
        >
          {saving ? 'Saving client…' : 'Save tax client'}
        </button>
        {message ? <span>{message}</span> : null}
      </div>
    </section>
  );
}
