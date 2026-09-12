import {
  mapAccountingEntity,
  mapAccountingFxRate,
  type AccountingEntityRecord,
  type AccountingEntityRow,
  type AccountingFxRateRecord,
  type AccountingFxRateRow,
} from '../../../../packages/accounting/src';
import { getActiveAtlasOrganization, getAtlasAccessToken, type AtlasOrganization } from './atlasSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export type AccountingFxWorkspace = {
  source: 'supabase_rls_live';
  organization: AtlasOrganization;
  entities: AccountingEntityRecord[];
  rates: AccountingFxRateRecord[];
  loadedAt: string;
};

function requireEnvironment() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new Error('supabase_environment_not_configured');
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'invalid_response' };
  }
  if (!response.ok) {
    const payload = data as { message?: string; error_description?: string; error?: string };
    throw new Error(payload.message || payload.error_description || payload.error || `Request failed (${response.status})`);
  }
  return data;
}

async function authenticatedFxFetch(path: string, init: RequestInit = {}) {
  requireEnvironment();
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');

  const request = (accessToken: string) => fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let response = await request(token);
  if (response.status === 401) {
    await getActiveAtlasOrganization();
    token = getAtlasAccessToken();
    if (!token) throw new Error('session_expired');
    response = await request(token);
  }
  return response;
}

async function rpc<T>(functionName: 'create_manual_accounting_fx_rate' | 'create_multicurrency_journal_entry', args: Record<string, unknown>) {
  const response = await authenticatedFxFetch(`/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
  return parseResponse(response) as Promise<T>;
}

export async function getAccountingFxWorkspace(): Promise<AccountingFxWorkspace> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const entitySelect = encodeURIComponent('id,org_id,code,legal_name,jurisdiction,functional_currency,reporting_currency,active');
  const rateSelect = encodeURIComponent('id,org_id,entity_id,rate_date,base_currency,quote_currency,rate,source_type,source_name,source_reference,evidence_state,created_by,created_at');

  const [entityResponse, rateResponse] = await Promise.all([
    authenticatedFxFetch(`/rest/v1/accounting_entities?org_id=${orgFilter}&select=${entitySelect}&order=code.asc`, { method: 'GET' }),
    authenticatedFxFetch(`/rest/v1/accounting_fx_rates?org_id=${orgFilter}&select=${rateSelect}&order=rate_date.desc,created_at.desc`, { method: 'GET' }),
  ]);
  const rawEntities = await parseResponse(entityResponse);
  const rawRates = await parseResponse(rateResponse);
  if (!Array.isArray(rawEntities) || !Array.isArray(rawRates)) throw new Error('Accounting FX query returned an invalid payload');

  return {
    source: 'supabase_rls_live',
    organization,
    entities: (rawEntities as AccountingEntityRow[]).map(mapAccountingEntity),
    rates: (rawRates as AccountingFxRateRow[]).map(mapAccountingFxRate),
    loadedAt: new Date().toISOString(),
  };
}

export async function createManualAccountingFxRate(input: {
  organizationId: string;
  entityId: string | null;
  rateDate: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  sourceReference: string | null;
}) {
  return rpc<string>('create_manual_accounting_fx_rate', {
    organization_uuid: input.organizationId,
    entity_uuid: input.entityId,
    rate_on: input.rateDate,
    base_currency_value: input.baseCurrency,
    quote_currency_value: input.quoteCurrency,
    rate_value: input.rate,
    source_reference_value: input.sourceReference,
  });
}

export async function createMulticurrencyJournalEntry(input: {
  organizationId: string;
  entityId: string;
  entryNumber: string;
  entryDate: string | null;
  memo: string | null;
  transactionCurrency: string;
  fxRateId: string | null;
  debitAccountId: string;
  creditAccountId: string;
  transactionAmount: number;
}) {
  return rpc<string>('create_multicurrency_journal_entry', {
    organization_uuid: input.organizationId,
    entity_uuid: input.entityId,
    entry_code: input.entryNumber,
    entry_on: input.entryDate,
    entry_memo: input.memo,
    transaction_currency_value: input.transactionCurrency,
    fx_rate_uuid: input.fxRateId,
    debit_account_uuid: input.debitAccountId,
    credit_account_uuid: input.creditAccountId,
    transaction_amount: input.transactionAmount,
  });
}