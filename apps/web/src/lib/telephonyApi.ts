import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type TelephonyReadiness = {
  ok: boolean;
  service: 'atlas-communication-telephony';
  version: number;
  organization_id: string;
  role: string;
  provider: string | null;
  state: 'not_configured' | 'verified' | 'degraded';
  verified: boolean;
  statusCode?: number | null;
  requestId?: string | null;
  blocker: string | null;
  credentials: {
    provider: boolean;
    api_key: boolean;
    connection_id: boolean;
    from_number: boolean;
    webhook_url: boolean;
    public_key: boolean;
  };
  provider_secret_values_returned: false;
  checked_at: string;
};

export type TelephonyCallAccepted = {
  ok: true;
  call_session_id: string;
  state: 'dialing';
  provider: string;
  provider_request_id: string | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    const error = Object.assign(
      new Error(String(data?.error || `request_failed_${response.status}`)),
      { status: response.status, data }
    );
    throw error;
  }
  return data as T;
}

// Use the canonical, source-controlled handler by default. The production
// Cloudflare build explicitly selects the already deployed, JWT-protected slot.
// Unknown values fail closed rather than constructing arbitrary function paths.
const TELEPHONY_FUNCTION_SLUG =
  import.meta.env.VITE_ATLAS_TELEPHONY_FUNCTION_SLUG || 'atlas-communication-telephony';

function telephonyEndpoint(operation: 'readiness' | 'call'): string {
  if (
    TELEPHONY_FUNCTION_SLUG !== 'atlas-communication-telephony' &&
    TELEPHONY_FUNCTION_SLUG !== 'atlas-cloudflare-seed-build-once'
  ) {
    throw new Error('telephony_endpoint_not_allowed');
  }
  return `/functions/v1/${TELEPHONY_FUNCTION_SLUG}?api=${operation}`;
}

async function telephonyFetch(path: string, init: RequestInit = {}) {
  const organization = await getActiveAtlasOrganization();
  return authorizedAtlasFetch(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'x-atlas-org-id': organization.id
    }
  });
}

export async function getTelephonyReadiness(): Promise<TelephonyReadiness> {
  return parseResponse<TelephonyReadiness>(
    await telephonyFetch(telephonyEndpoint('readiness'), {
      method: 'GET'
    })
  );
}

export async function startTelephonyCall(input: {
  to: string;
  purpose: string;
  consentReference: string;
}): Promise<TelephonyCallAccepted> {
  return parseResponse<TelephonyCallAccepted>(
    await telephonyFetch(telephonyEndpoint('call'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: input.to,
        purpose: input.purpose,
        consent_reference: input.consentReference
      })
    })
  );
}
