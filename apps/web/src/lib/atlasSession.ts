const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

const ACCESS_TOKEN_KEY = 'atlas_access_token';
const REFRESH_TOKEN_KEY = 'atlas_refresh_token';
export const ATLAS_SESSION_EVENT = 'atlas-session-changed';

export type AtlasOrganization = {
  id: string;
  role: string;
};

export type AtlasShellOrganization = AtlasOrganization & {
  name: string;
  legalName: string | null;
  active: boolean;
};

export type AtlasMfaFactor = {
  id: string;
  status: string;
  factorType: string;
  friendlyName: string | null;
};

export type AtlasMfaState = {
  currentLevel: 'aal1' | 'aal2';
  verifiedTotpFactors: AtlasMfaFactor[];
};

export type AtlasTotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
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

function readAtlasAal(accessToken: string): 'aal1' | 'aal2' {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return 'aal1';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const claims = JSON.parse(globalThis.atob(padded));
    return claims?.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

function normalizeMfaFactors(data: any): AtlasMfaFactor[] {
  const raw = Array.isArray(data?.totp)
    ? data.totp
    : Array.isArray(data?.all)
      ? data.all.filter((factor: any) => (factor?.factor_type || factor?.type) === 'totp')
      : [];

  return raw.map((factor: any) => ({
    id: String(factor?.id || ''),
    status: String(factor?.status || ''),
    factorType: String(factor?.factor_type || factor?.type || 'totp'),
    friendlyName: factor?.friendly_name ? String(factor.friendly_name) : null
  })).filter((factor: AtlasMfaFactor) => Boolean(factor.id));
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

export async function authorizedAtlasFetch(path: string, init: RequestInit = {}) {
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

export async function getAtlasMfaState(): Promise<AtlasMfaState> {
  const accessToken = getAtlasAccessToken();
  if (!accessToken) throw new Error('authentication_required');

  const response = await authorizedAtlasFetch('/auth/v1/factors', { method: 'GET' });
  const data = await parseResponse(response);
  const verifiedTotpFactors = normalizeMfaFactors(data).filter((factor) => factor.status === 'verified');

  return {
    currentLevel: readAtlasAal(getAtlasAccessToken() || accessToken),
    verifiedTotpFactors
  };
}

export async function enrollAtlasTotp(): Promise<AtlasTotpEnrollment> {
  const response = await authorizedAtlasFetch('/auth/v1/factors', {
    method: 'POST',
    body: JSON.stringify({
      factor_type: 'totp',
      friendly_name: 'ATLAS Authenticator'
    })
  });
  const data = await parseResponse(response);
  const factorId = String(data?.id || '');
  const qrCode = String(data?.totp?.qr_code || '');
  const secret = String(data?.totp?.secret || '');
  if (!factorId || !qrCode || !secret) throw new Error('mfa_enrollment_incomplete');
  return { factorId, qrCode, secret };
}

export async function verifyAtlasMfa(factorId: string, code: string): Promise<void> {
  if (!factorId) throw new Error('mfa_factor_required');
  if (!/^\d{6}$/.test(code)) throw new Error('mfa_code_invalid');

  const factorPath = `/auth/v1/factors/${encodeURIComponent(factorId)}`;
  const challengeResponse = await authorizedAtlasFetch(`${factorPath}/challenge`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  const challenge = await parseResponse(challengeResponse);
  const challengeId = String(challenge?.id || '');
  if (!challengeId) throw new Error('mfa_challenge_incomplete');

  const verifyResponse = await authorizedAtlasFetch(`${factorPath}/verify`, {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, code })
  });
  const session = await parseResponse(verifyResponse);
  persistSession(session);

  if (readAtlasAal(getAtlasAccessToken()) !== 'aal2') {
    const refreshed = await refreshAtlasSession();
    if (!refreshed || readAtlasAal(refreshed) !== 'aal2') throw new Error('mfa_aal2_not_established');
  }
}

export async function getActiveAtlasOrganization(): Promise<AtlasOrganization> {
  const response = await authorizedAtlasFetch('/rest/v1/organization_members?select=org_id,role,status,organizations!organization_members_org_id_fkey(id,name,legal_name,active)&status=eq.active&limit=1', {
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

  return { id: String(data[0].org_id), role: String(data[0].role || 'member') };
}

export async function getAccountingInsight(forceRefresh = false): Promise<AccountingInsight> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-accounting-insights', {
    method: 'POST',
    body: JSON.stringify({ org_id: organization.id, force_refresh: forceRefresh })
  });
  return parseResponse(response) as Promise<AccountingInsight>;
}

export async function getLivePayablesLedger(): Promise<LivePayablesLedger> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const [billsResponse, vendorsResponse] = await Promise.all([
    authorizedAtlasFetch(`/rest/v1/accounting_bills?org_id=${orgFilter}&select=id,org_id,vendor_id,bill_number,bill_date,due_date,amount,balance_due,approval_state,match_state,status,created_at,updated_at&order=bill_date.desc,bill_number.asc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/vendors?org_id=${orgFilter}&select=id,name,email,phone,status&order=name.asc`, { method: 'GET' })
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
