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
