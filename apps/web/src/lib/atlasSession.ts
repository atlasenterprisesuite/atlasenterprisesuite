import {
  mapAccountingBudget,
  mapBudgetLine,
  mapForecastSnapshot,
  type AccountingBudgetRecord,
  type AccountingBudgetRow,
  type AccountingTable,
  type BudgetLineRecord,
  type BudgetLineRow,
  type ForecastSnapshotRecord,
  type ForecastSnapshotRow,
} from '../../../../packages/accounting/src';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

const ACCESS_TOKEN_KEY = 'atlas_access_token';
const REFRESH_TOKEN_KEY = 'atlas_refresh_token';
export const ATLAS_SESSION_EVENT = 'atlas-session-changed';

const ACCOUNTING_REST_TABLES = new Set<AccountingTable>([
  'chart_of_accounts',
  'journal_entries',
  'journal_lines',
  'customers',
  'vendors',
  'invoices',
  'payments',
  'accounting_bills',
  'accounting_bank_accounts',
  'accounting_transactions',
  'accounting_reconciliation_sessions',
  'accounting_reconciliation_items',
  'accounting_fixed_assets',
  'accounting_periods',
  'accounting_close_tasks',
  'organization_settings',
  'audit_logs'
]);

export type AtlasAccountingRpcName =
  | 'create_balanced_journal_entry'
  | 'reverse_posted_journal_entry'
  | 'create_chart_account'
  | 'update_chart_account'
  | 'record_invoice_payment'
  | 'set_accounting_bill_approval_state'
  | 'start_accounting_reconciliation'
  | 'resolve_accounting_reconciliation_item'
  | 'close_accounting_reconciliation'
  | 'create_accounting_fixed_asset'
  | 'close_accounting_period'
  | 'set_accounting_settings'
  | 'create_accounting_budget'
  | 'add_accounting_budget_line'
  | 'set_accounting_budget_status';

const ACCOUNTING_RPC_NAMES = new Set<AtlasAccountingRpcName>([
  'create_balanced_journal_entry',
  'reverse_posted_journal_entry',
  'create_chart_account',
  'update_chart_account',
  'record_invoice_payment',
  'set_accounting_bill_approval_state',
  'start_accounting_reconciliation',
  'resolve_accounting_reconciliation_item',
  'close_accounting_reconciliation',
  'create_accounting_fixed_asset',
  'close_accounting_period',
  'set_accounting_settings',
  'create_accounting_budget',
  'add_accounting_budget_line',
  'set_accounting_budget_status'
]);

export type AtlasOrganization = {
  id: string;
  role: string;
};

export type AtlasShellOrganization = AtlasOrganization & {
  name: string;
  legalName: string | null;
  active: boolean;
};

let cachedAtlasShellOrganization: AtlasShellOrganization | null = null;

export type AccountingInsight = {
  ok: boolean;
  cached: boolean;
  model: string;
  response_id: string | null;
  generated_at: string;
  snapshot: {
    source: string;
    bill_count: number;
    open_balance: number;
    chart_account_count: number;
    counts: Record<string, number | null>;
  };
  analysis: string;
  execution: {
    payments: boolean;
    journal_entries: boolean;
    mutations: boolean;
  };
};

export type LivePayableVendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

export type LivePayableBill = {
  id: string;
  org_id: string;
  vendor_id: string | null;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  amount: number;
  balance_due: number;
  approval_state: string;
  match_state: string;
  status: string;
  created_at: string;
  updated_at: string;
  vendor: LivePayableVendor | null;
};

export type LivePayablesLedger = {
  source: 'supabase_rls_live';
  organization: AtlasOrganization;
  bills: LivePayableBill[];
  loaded_at: string;
};

export type AccountingBudgetLedger = {
  source: 'supabase_rls_live';
  organization: AtlasOrganization;
  budgets: AccountingBudgetRecord[];
  lines: BudgetLineRecord[];
  loaded_at: string;
};

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function announceSessionChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ATLAS_SESSION_EVENT));
}

function setCachedAtlasShellOrganization(next: AtlasShellOrganization | null) {
  const current = cachedAtlasShellOrganization;
  const unchanged = current?.id === next?.id
    && current?.name === next?.name
    && current?.legalName === next?.legalName
    && current?.active === next?.active
    && current?.role === next?.role;
  if (unchanged) return;
  cachedAtlasShellOrganization = next;
  announceSessionChange();
}

export function getCachedAtlasShellOrganization() {
  return cachedAtlasShellOrganization;
}

export function getAtlasAccessToken() {
  return storageAvailable() ? window.localStorage.getItem(ACCESS_TOKEN_KEY) || '' : '';
}

function getAtlasRefreshToken() {
  return storageAvailable() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) || '' : '';
}

function persistSession(data: { access_token?: string; refresh_token?: string }) {
  if (!storageAvailable() || !data.access_token) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  announceSessionChange();
}

export function clearAtlasSession() {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  cachedAtlasShellOrganization = null;
  announceSessionChange();
}

function baseHeaders(token?: string) {
  return {
    apikey: PUBLISHABLE_KEY,
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'invalid_response' };
  }
  if (!response.ok) throw new Error(data?.message || data?.error_description || data?.error || `Request failed (${response.status})`);
  return data;
}

export async function signInAtlas(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ email, password })
  });
  const data = await parseResponse(response);
  persistSession(data);
  return data;
}

async function refreshAtlasSession() {
  const refreshToken = getAtlasRefreshToken();
  if (!refreshToken) return '';
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  if (!response.ok) {
    clearAtlasSession();
    return '';
  }
  const data = await response.json();
  persistSession(data);
  return data?.access_token || '';
}

async function authorizedFetch(path: string, init: RequestInit = {}) {
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');

  const request = (accessToken: string) => fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...baseHeaders(accessToken),
      ...(init.headers || {})
    }
  });

  let response = await request(token);
  if (response.status === 401) {
    token = await refreshAtlasSession();
    if (!token) throw new Error('session_expired');
    response = await request(token);
  }
  return response;
}

export async function atlasRestSelect<T>(
  table: AccountingTable,
  columns: string,
  organizationId: string,
): Promise<T[]> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error('organizationId is required');
  if (!ACCOUNTING_REST_TABLES.has(table)) throw new Error('accounting_table_not_allowed');

  const orgFilter = encodeURIComponent(`eq.${orgId}`);
  const select = encodeURIComponent(columns);
  const response = await authorizedFetch(`/rest/v1/${table}?org_id=${orgFilter}&select=${select}`, {
    method: 'GET'
  });
  const data = await parseResponse(response);
  if (!Array.isArray(data)) throw new Error(`Accounting query returned an invalid payload for ${table}`);
  return data as T[];
}

export async function atlasAccountingRpc<T>(
  functionName: AtlasAccountingRpcName,
  args: Record<string, unknown>,
): Promise<T> {
  if (!ACCOUNTING_RPC_NAMES.has(functionName)) throw new Error('accounting_rpc_not_allowed');
  const response = await authorizedFetch(`/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(args)
  });
  return parseResponse(response) as Promise<T>;
}

export async function getActiveAtlasOrganization(): Promise<AtlasOrganization> {
  const response = await authorizedFetch('/rest/v1/organization_members?select=org_id,role,status,organizations!organization_members_org_id_fkey(id,name,legal_name,active)&status=eq.active&limit=1', {
    method: 'GET'
  });
  const data = await parseResponse(response);
  if (!Array.isArray(data) || !data[0]?.org_id) throw new Error('no_active_organization');

  const membership = data[0];
  const relatedOrganization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  if (relatedOrganization?.id) {
    setCachedAtlasShellOrganization({
      id: String(membership.org_id),
      name: String(relatedOrganization.name || relatedOrganization.legal_name || 'ATLAS Organization'),
      legalName: relatedOrganization.legal_name ? String(relatedOrganization.legal_name) : null,
      active: Boolean(relatedOrganization.active),
      role: String(membership.role || 'member')
    });
  }

  return { id: String(membership.org_id), role: String(membership.role || 'member') };
}

export async function getAccountingInsight(forceRefresh = false): Promise<AccountingInsight> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedFetch('/functions/v1/atlas-accounting-insights', {
    method: 'POST',
    body: JSON.stringify({ org_id: organization.id, force_refresh: forceRefresh })
  });
  return parseResponse(response) as Promise<AccountingInsight>;
}

export async function getAccountingForecastSnapshots(): Promise<ForecastSnapshotRecord[]> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const select = encodeURIComponent('id,org_id,entity_id,as_of_date,horizon_weeks,scenario,forecast,assumptions,created_by,created_at');
  const response = await authorizedFetch(`/rest/v1/accounting_forecast_snapshots?org_id=${orgFilter}&select=${select}&order=as_of_date.desc,created_at.desc`, {
    method: 'GET'
  });
  const data = await parseResponse(response);
  if (!Array.isArray(data)) throw new Error('Accounting forecast query returned an invalid payload');
  return (data as ForecastSnapshotRow[]).map(mapForecastSnapshot);
}

export async function getAccountingBudgets(): Promise<AccountingBudgetLedger> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const budgetSelect = encodeURIComponent('id,org_id,entity_id,name,fiscal_year,version,scenario,status,base_currency,created_by,approved_by,approved_at,created_at,updated_at');
  const lineSelect = encodeURIComponent('id,org_id,budget_id,account_id,period_start,period_end,amount,dimension,note');
  const [budgetResponse, lineResponse] = await Promise.all([
    authorizedFetch(`/rest/v1/accounting_budgets?org_id=${orgFilter}&select=${budgetSelect}&order=fiscal_year.desc,version.desc,created_at.desc`, { method: 'GET' }),
    authorizedFetch(`/rest/v1/accounting_budget_lines?org_id=${orgFilter}&select=${lineSelect}&order=period_start.asc,account_id.asc`, { method: 'GET' })
  ]);
  const rawBudgets = await parseResponse(budgetResponse);
  const rawLines = await parseResponse(lineResponse);
  if (!Array.isArray(rawBudgets) || !Array.isArray(rawLines)) throw new Error('Accounting budget query returned an invalid payload');
  return {
    source: 'supabase_rls_live',
    organization,
    budgets: (rawBudgets as AccountingBudgetRow[]).map(mapAccountingBudget),
    lines: (rawLines as BudgetLineRow[]).map(mapBudgetLine),
    loaded_at: new Date().toISOString(),
  };
}

export async function createAccountingBudget(input: {
  organizationId: string;
  entityId: string | null;
  name: string;
  fiscalYear: number;
  version: number;
  scenario: string;
  baseCurrency: string;
}) {
  return atlasAccountingRpc<string>('create_accounting_budget', {
    organization_uuid: input.organizationId,
    entity_uuid: input.entityId,
    budget_name: input.name,
    fiscal_year_value: input.fiscalYear,
    version_value: input.version,
    scenario_value: input.scenario,
    base_currency_value: input.baseCurrency,
  });
}

export async function addAccountingBudgetLine(input: {
  organizationId: string;
  budgetId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  dimension: Record<string, unknown>;
  note: string | null;
}) {
  return atlasAccountingRpc<string>('add_accounting_budget_line', {
    organization_uuid: input.organizationId,
    budget_uuid: input.budgetId,
    account_uuid: input.accountId,
    period_start_date: input.periodStart,
    period_end_date: input.periodEnd,
    budget_amount: input.amount,
    dimension_value: input.dimension,
    note_value: input.note,
  });
}

export async function setAccountingBudgetStatus(organizationId: string, budgetId: string, status: 'draft' | 'approved' | 'locked' | 'archived') {
  return atlasAccountingRpc<string>('set_accounting_budget_status', {
    organization_uuid: organizationId,
    budget_uuid: budgetId,
    status_value: status,
  });
}

export async function getLivePayablesLedger(): Promise<LivePayablesLedger> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const [billsResponse, vendorsResponse] = await Promise.all([
    authorizedFetch(`/rest/v1/accounting_bills?org_id=${orgFilter}&select=id,org_id,vendor_id,bill_number,bill_date,due_date,amount,balance_due,approval_state,match_state,status,created_at,updated_at&order=bill_date.desc,bill_number.asc`, { method: 'GET' }),
    authorizedFetch(`/rest/v1/vendors?org_id=${orgFilter}&select=id,name,email,phone,status&order=name.asc`, { method: 'GET' })
  ]);

  const rawBills = await parseResponse(billsResponse) as any[];
  const rawVendors = await parseResponse(vendorsResponse) as any[];
  const vendorMap = new Map<string, LivePayableVendor>();
  for (const vendor of rawVendors) {
    const normalizedVendor: LivePayableVendor = {
      id: String(vendor.id),
      name: String(vendor.name || 'Unnamed vendor'),
      email: vendor.email ? String(vendor.email) : null,
      phone: vendor.phone ? String(vendor.phone) : null,
      status: String(vendor.status || 'unknown')
    };
    vendorMap.set(normalizedVendor.id, normalizedVendor);
  }

  const bills: LivePayableBill[] = rawBills.map((bill) => ({
    id: String(bill.id),
    org_id: String(bill.org_id),
    vendor_id: bill.vendor_id ? String(bill.vendor_id) : null,
    bill_number: String(bill.bill_number || ''),
    bill_date: String(bill.bill_date || ''),
    due_date: bill.due_date ? String(bill.due_date) : null,
    amount: Number(bill.amount || 0),
    balance_due: Number(bill.balance_due || 0),
    approval_state: String(bill.approval_state || 'unknown'),
    match_state: String(bill.match_state || 'unknown'),
    status: String(bill.status || 'unknown'),
    created_at: String(bill.created_at || ''),
    updated_at: String(bill.updated_at || ''),
    vendor: bill.vendor_id ? vendorMap.get(String(bill.vendor_id)) || null : null
  }));

  return {
    source: 'supabase_rls_live',
    organization,
    bills,
    loaded_at: new Date().toISOString()
  };
}
