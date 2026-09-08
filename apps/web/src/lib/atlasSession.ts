import type {
  DecisionCompassRecord,
  DecisionEvidenceRef,
  DecisionRisk,
  DecisionSignalKind,
  DecisionTruthState,
  VerificationGateItem
} from '../../../../packages/decision-compass';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

const ACCESS_TOKEN_KEY = 'atlas_access_token';
const REFRESH_TOKEN_KEY = 'atlas_refresh_token';
export const ATLAS_SESSION_EVENT = 'atlas-session-changed';

export type AtlasOrganization = {
  id: string;
  role: string;
};

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

export type DecisionCompassCreateInput = {
  signalKind: DecisionSignalKind;
  signalLabel: string;
  signalText: string;
  interpretation: string;
  targetModule: string | null;
  risk: DecisionRisk;
  proposedAction: string | null;
  verificationGate: VerificationGateItem[];
};

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function announceSessionChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ATLAS_SESSION_EVENT));
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

export async function getActiveAtlasOrganization(): Promise<AtlasOrganization> {
  const response = await authorizedFetch('/rest/v1/organization_members?select=org_id,role,status&status=eq.active&limit=1', {
    method: 'GET'
  });
  const data = await parseResponse(response);
  if (!Array.isArray(data) || !data[0]?.org_id) throw new Error('no_active_organization');
  return { id: String(data[0].org_id), role: String(data[0].role || 'member') };
}

export async function getAccountingInsight(forceRefresh = false): Promise<AccountingInsight> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedFetch('/functions/v1/atlas-accounting-insights', {
    method: 'POST',
    body: JSON.stringify({ org_id: organization.id, force_refresh: forceRefresh })
  });
  return parseResponse(response) as Promise<AccountingInsight>;
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

function normalizeDecisionEvidence(raw: any): DecisionEvidenceRef {
  return {
    id: raw?.id ? String(raw.id) : undefined,
    kind: String(raw?.source_kind || ''),
    sourceModule: String(raw?.source_module || ''),
    sourceId: String(raw?.source_id || ''),
    label: String(raw?.label || ''),
    verifiedAt: raw?.verified_at ? String(raw.verified_at) : undefined
  };
}

function normalizeDecisionRecord(raw: any): DecisionCompassRecord {
  const organizationId = String(raw?.org_id || '');
  const evidence = Array.isArray(raw?.decision_compass_evidence_refs)
    ? raw.decision_compass_evidence_refs.map(normalizeDecisionEvidence)
    : [];

  return {
    tenantId: organizationId,
    organizationId,
    id: String(raw?.id || ''),
    createdBy: String(raw?.created_by || ''),
    createdAt: String(raw?.created_at || ''),
    signalKind: String(raw?.signal_kind || 'observation') as DecisionSignalKind,
    signalLabel: String(raw?.signal_label || ''),
    signalText: String(raw?.signal_text || ''),
    interpretation: String(raw?.interpretation || ''),
    targetModule: raw?.target_module ? String(raw.target_module) : null,
    evidenceRefs: evidence,
    risk: String(raw?.risk || 'low') as DecisionRisk,
    proposedAction: raw?.proposed_action ? String(raw.proposed_action) : null,
    verificationGate: Array.isArray(raw?.verification_gate) ? raw.verification_gate : [],
    truthState: String(raw?.truth_state || 'reflection') as DecisionTruthState,
    verifiedBy: raw?.verified_by ? String(raw.verified_by) : null,
    verifiedAt: raw?.verified_at ? String(raw.verified_at) : null
  };
}

function assertRecordOrganization(record: DecisionCompassRecord, organizationId: string) {
  if (record.organizationId !== organizationId) throw new Error('decision_scope_mismatch');
  return record;
}

export async function listDecisionCompassRecords(): Promise<DecisionCompassRecord[]> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const response = await authorizedFetch(
    `/rest/v1/decision_compass_records?org_id=${orgFilter}&select=*,decision_compass_evidence_refs(*)&order=created_at.desc`,
    { method: 'GET' }
  );
  const data = await parseResponse(response);
  if (!Array.isArray(data)) throw new Error('invalid_decision_compass_response');
  return data.map(normalizeDecisionRecord).map((record) => assertRecordOrganization(record, organization.id));
}

export async function createDecisionCompassRecord(input: DecisionCompassCreateInput): Promise<DecisionCompassRecord> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedFetch('/rest/v1/decision_compass_records?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      signal_kind: input.signalKind,
      signal_label: input.signalLabel,
      signal_text: input.signalText,
      interpretation: input.interpretation,
      target_module: input.targetModule,
      risk: input.risk,
      proposed_action: input.proposedAction,
      verification_gate: input.verificationGate,
      truth_state: 'reflection'
    })
  });
  const data = await parseResponse(response);
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw?.id) throw new Error('decision_record_not_created');
  return assertRecordOrganization(normalizeDecisionRecord(raw), organization.id);
}

export async function addDecisionEvidence(
  recordId: string,
  evidence: Omit<DecisionEvidenceRef, 'id'>
): Promise<DecisionEvidenceRef> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedFetch('/rest/v1/decision_compass_evidence_refs?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      record_id: recordId,
      org_id: organization.id,
      source_module: evidence.sourceModule,
      source_kind: evidence.kind,
      source_id: evidence.sourceId,
      label: evidence.label,
      verified_at: evidence.verifiedAt || null
    })
  });
  const data = await parseResponse(response);
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw?.id) throw new Error('decision_evidence_not_created');
  return normalizeDecisionEvidence(raw);
}

export async function transitionDecisionCompassRecord(
  recordId: string,
  nextState: DecisionTruthState,
  reason: string
): Promise<DecisionCompassRecord> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedFetch('/rest/v1/rpc/decision_compass_transition', {
    method: 'POST',
    body: JSON.stringify({
      p_record_id: recordId,
      p_next_state: nextState,
      p_reason: reason
    })
  });
  const data = await parseResponse(response);
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw?.id) throw new Error('decision_transition_failed');
  return assertRecordOrganization(normalizeDecisionRecord(raw), organization.id);
}
