const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

const ACCESS_TOKEN_KEY = 'atlas_access_token';
const REFRESH_TOKEN_KEY = 'atlas_refresh_token';

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

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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
}

export function clearAtlasSession() {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
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
