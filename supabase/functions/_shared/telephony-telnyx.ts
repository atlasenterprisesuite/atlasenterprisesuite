export type TelephonyFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type TelnyxVoiceConfig = {
  apiKey: string;
  connectionId: string;
  fromNumber: string;
  webhookUrl: string;
  publicKey: string;
};

export type TelnyxReadiness = {
  state: 'not_configured' | 'verified' | 'degraded';
  verified: boolean;
  statusCode: number | null;
  requestId: string | null;
  blocker: string | null;
};

export type TelnyxNumberSearchCriteria = {
  countryCode?: string;
  areaCode?: string;
  limit?: number;
};

export type TelnyxNumberCandidate = {
  phoneNumber: string;
  reservable: boolean;
  quickship: boolean;
  bestEffort: boolean;
  costInformation: Record<string, unknown> | null;
};

export type TelnyxNumberSearchResult =
  | { status: 'matches'; candidates: TelnyxNumberCandidate[]; requestId: string | null }
  | { status: 'no_matches'; candidates: []; requestId: string | null }
  | {
      status: 'lookup_error';
      candidates: [];
      requestId: string | null;
      blocker: string;
      statusCode: number | null;
    };

export function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function validateTelnyxPublicKey(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  try {
    return atob(normalized).length === 32;
  } catch {
    return false;
  }
}

export function validateTelnyxConfig(config: Partial<TelnyxVoiceConfig>): string | null {
  if (!config.apiKey?.trim()) return 'api_key_missing';
  if (!config.connectionId?.trim()) return 'connection_id_missing';
  if (!config.fromNumber?.trim()) return 'from_number_missing';
  if (!isE164(config.fromNumber)) return 'from_number_invalid';
  if (!config.webhookUrl?.trim()) return 'webhook_url_missing';
  try {
    const url = new URL(config.webhookUrl);
    if (url.protocol !== 'https:') return 'webhook_url_must_be_https';
  } catch {
    return 'webhook_url_invalid';
  }
  if (!config.publicKey?.trim()) return 'public_key_missing';
  if (!validateTelnyxPublicKey(config.publicKey)) return 'public_key_invalid';
  return null;
}

export async function probeTelnyxVoice(
  config: TelnyxVoiceConfig,
  fetchImpl: TelephonyFetch = fetch
): Promise<TelnyxReadiness> {
  const blocker = validateTelnyxConfig(config);
  if (blocker) {
    return { state: 'not_configured', verified: false, statusCode: null, requestId: null, blocker };
  }

  try {
    const response = await fetchImpl(
      `https://api.telnyx.com/v2/connections/${encodeURIComponent(config.connectionId)}/active_calls?page[limit]=1`,
      {
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          accept: 'application/json'
        },
        cache: 'no-store'
      }
    );
    const requestId =
      response.headers.get('x-request-id') ||
      response.headers.get('telnyx-request-id');

    if (!response.ok) {
      return {
        state: 'degraded',
        verified: false,
        statusCode: response.status,
        requestId,
        blocker:
          response.status === 401 ? 'provider_authentication_failed' :
          response.status === 403 ? 'provider_permission_denied' :
          response.status === 404 ? 'provider_connection_not_found' :
          response.status === 429 ? 'provider_rate_limited' :
          'provider_probe_failed'
      };
    }

    return {
      state: 'verified',
      verified: true,
      statusCode: response.status,
      requestId,
      blocker: null
    };
  } catch {
    return {
      state: 'degraded',
      verified: false,
      statusCode: null,
      requestId: null,
      blocker: 'provider_unreachable'
    };
  }
}

export async function searchTelnyxAvailableNumbers(
  config: TelnyxVoiceConfig,
  criteria: TelnyxNumberSearchCriteria,
  fetchImpl: TelephonyFetch = fetch
): Promise<TelnyxNumberSearchResult> {
  if (validateTelnyxConfig(config)) {
    return {
      status: 'lookup_error',
      candidates: [],
      requestId: null,
      blocker: 'provider_not_configured',
      statusCode: null
    };
  }

  const url = new URL('https://api.telnyx.com/v2/available_phone_numbers');
  if (criteria.countryCode) {
    url.searchParams.set('filter[country_code]', criteria.countryCode.toUpperCase());
  }
  if (criteria.areaCode) {
    url.searchParams.set('filter[national_destination_code]', criteria.areaCode);
  }
  if (criteria.limit) {
    url.searchParams.set('filter[limit]', String(criteria.limit));
  }

  try {
    const response = await fetchImpl(url, {
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        accept: 'application/json'
      },
      cache: 'no-store'
    });
    const requestId =
      response.headers.get('x-request-id') ||
      response.headers.get('telnyx-request-id');

    if (!response.ok) {
      return {
        status: 'lookup_error',
        candidates: [],
        requestId,
        statusCode: response.status,
        blocker:
          response.status === 401 ? 'provider_authentication_failed' :
          response.status === 403 ? 'provider_permission_denied' :
          response.status === 429 ? 'provider_rate_limited' :
          'provider_lookup_failed'
      };
    }

    const body = await response.json().catch(() => null) as { data?: unknown } | null;
    if (!body || !Array.isArray(body.data)) {
      return {
        status: 'lookup_error',
        candidates: [],
        requestId,
        blocker: 'provider_response_invalid',
        statusCode: response.status
      };
    }

    if (body.data.length === 0) {
      return { status: 'no_matches', candidates: [], requestId };
    }

    const candidates: TelnyxNumberCandidate[] = [];
    for (const item of body.data) {
      if (!item || typeof item !== 'object') {
        return {
          status: 'lookup_error',
          candidates: [],
          requestId,
          blocker: 'provider_response_invalid',
          statusCode: response.status
        };
      }

      const row = item as Record<string, unknown>;
      if (typeof row.phone_number !== 'string' || !isE164(row.phone_number)) {
        return {
          status: 'lookup_error',
          candidates: [],
          requestId,
          blocker: 'provider_response_invalid',
          statusCode: response.status
        };
      }

      candidates.push({
        phoneNumber: row.phone_number,
        reservable: row.reservable === true,
        quickship: row.quickship === true,
        bestEffort: row.best_effort === true,
        costInformation:
          row.cost_information && typeof row.cost_information === 'object' && !Array.isArray(row.cost_information)
            ? row.cost_information as Record<string, unknown>
            : null
      });
    }

    return { status: 'matches', candidates, requestId };
  } catch {
    return {
      status: 'lookup_error',
      candidates: [],
      requestId: null,
      blocker: 'provider_unreachable',
      statusCode: null
    };
  }
}
