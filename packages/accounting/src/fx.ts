export type AccountingEntityRow = {
  id: string;
  org_id: string;
  code: string;
  legal_name: string;
  jurisdiction: string | null;
  functional_currency: string;
  reporting_currency: string;
  active: boolean;
};

export type AccountingEntityRecord = {
  id: string;
  organizationId: string;
  code: string;
  legalName: string;
  jurisdiction: string | null;
  functionalCurrency: string;
  reportingCurrency: string;
  active: boolean;
};

export type AccountingFxRateRow = {
  id: string;
  org_id: string;
  entity_id: string | null;
  rate_date: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  source_type: string;
  source_name: string;
  source_reference: string | null;
  evidence_state: string;
  created_by: string | null;
  created_at: string | null;
};

export type AccountingFxRateRecord = {
  id: string;
  organizationId: string;
  entityId: string | null;
  rateDate: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  sourceType: string;
  sourceName: string;
  sourceReference: string | null;
  evidenceState: string;
  createdBy: string | null;
  createdAt: string | null;
};

function currencyCode(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Currency code must use three letters');
  return normalized;
}

export function validateFxRate(baseCurrency: string, quoteCurrency: string, rate: number) {
  const base = currencyCode(baseCurrency);
  const quote = currencyCode(quoteCurrency);
  const normalizedRate = Number(rate);
  if (!Number.isFinite(normalizedRate) || normalizedRate <= 0) throw new Error('FX rate must be greater than zero');
  if (base === quote && normalizedRate !== 1) throw new Error('Same-currency rate must equal 1');
  return { baseCurrency: base, quoteCurrency: quote, rate: normalizedRate };
}

export function translateForeignAmount(amount: number, rate: number) {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount)) throw new Error('Amount must be a finite number');
  const normalizedRate = Number(rate);
  if (!Number.isFinite(normalizedRate) || normalizedRate <= 0) throw new Error('FX rate must be greater than zero');
  return Math.round((normalizedAmount * normalizedRate + Number.EPSILON) * 100) / 100;
}

export function revalueForeignBalance(input: {
  foreignAmount: number;
  carryingFunctionalAmount: number;
  closingRate: number;
}) {
  const translatedFunctionalAmount = translateForeignAmount(input.foreignAmount, input.closingRate);
  const carrying = Math.round((Number(input.carryingFunctionalAmount) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(carrying)) throw new Error('Carrying functional amount must be finite');
  return {
    translatedFunctionalAmount,
    adjustment: Math.round((translatedFunctionalAmount - carrying + Number.EPSILON) * 100) / 100,
  };
}

export function mapAccountingEntity(row: AccountingEntityRow): AccountingEntityRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    code: row.code,
    legalName: row.legal_name,
    jurisdiction: row.jurisdiction,
    functionalCurrency: row.functional_currency,
    reportingCurrency: row.reporting_currency,
    active: row.active,
  };
}

export function mapAccountingFxRate(row: AccountingFxRateRow): AccountingFxRateRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    entityId: row.entity_id,
    rateDate: row.rate_date,
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    rate: Number(row.rate),
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceReference: row.source_reference,
    evidenceState: row.evidence_state,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}