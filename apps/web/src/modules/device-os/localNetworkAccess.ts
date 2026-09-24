export type AtlasLocalAddressSpace = 'local' | 'loopback';

export type AtlasLocalEndpoint = {
  id: string;
  org_id: string;
  label: string;
  origin: string;
  address_space: AtlasLocalAddressSpace;
  probe_path: string;
  enabled: boolean;
  created_at: string;
};

export type LocalNetworkProbeResult = {
  reachable: boolean;
  status: number | null;
  ok: boolean;
};

type LocalNetworkFetchInit = RequestInit & {
  targetAddressSpace?: 'local';
};

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return numbers;
}

export function classifyLocalAddressSpace(hostname: string): AtlasLocalAddressSpace | null {
  const normalized = normalizeHostname(hostname);
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1') {
    return 'loopback';
  }

  const ipv4 = parseIpv4(normalized);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 127) return 'loopback';
    if (a === 10) return 'local';
    if (a === 100 && b >= 64 && b <= 127) return 'local';
    if (a === 169 && b === 254) return 'local';
    if (a === 172 && b >= 16 && b <= 31) return 'local';
    if (a === 192 && b === 168) return 'local';
  }

  if (normalized.endsWith('.local')) return 'local';
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return 'local';
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return 'local';

  return null;
}

export function normalizeLocalEndpointOrigin(input: string): {
  origin: string;
  addressSpace: AtlasLocalAddressSpace;
} {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('invalid_local_endpoint_url');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('local_endpoint_protocol_not_allowed');
  }
  if (url.username || url.password) {
    throw new Error('local_endpoint_credentials_not_allowed');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('local_endpoint_origin_only');
  }

  const addressSpace = classifyLocalAddressSpace(url.hostname);
  if (!addressSpace) {
    throw new Error('local_endpoint_not_non_public');
  }

  return { origin: url.origin, addressSpace };
}

export function normalizeProbePath(input: string): string {
  const value = input.trim() || '/';
  if (!value.startsWith('/') || value.startsWith('//') || /\s/.test(value)) {
    throw new Error('invalid_local_probe_path');
  }
  return value;
}

export async function probeLocalNetworkEndpoint(
  endpoint: Pick<AtlasLocalEndpoint, 'origin' | 'address_space' | 'probe_path' | 'enabled'>,
  options: {
    fetchImpl?: typeof fetch;
    secureContext?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<LocalNetworkProbeResult> {
  if (!endpoint.enabled) throw new Error('local_endpoint_disabled');

  const normalized = normalizeLocalEndpointOrigin(endpoint.origin);
  if (normalized.addressSpace !== endpoint.address_space) {
    throw new Error('local_endpoint_address_space_mismatch');
  }

  const secureContext = options.secureContext
    ?? (typeof window === 'undefined' ? false : window.isSecureContext);
  if (!secureContext) throw new Error('secure_context_required');

  const probePath = normalizeProbePath(endpoint.probe_path);
  const target = new URL(probePath, normalized.origin);
  if (target.origin !== normalized.origin) throw new Error('local_probe_origin_escape');

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);

  const init: LocalNetworkFetchInit = {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal: controller.signal
  };

  // The explicit annotation is needed for local HTTP targets when the public
  // ATLAS origin knows before DNS resolution that the destination is local.
  // Loopback is not mislabeled as local; Chromium evaluates it separately.
  if (endpoint.address_space === 'local') init.targetAddressSpace = 'local';

  try {
    const response = await (options.fetchImpl ?? fetch)(target, init as RequestInit);
    return {
      reachable: true,
      status: response.status,
      ok: response.ok
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
