import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Server-side DNS preflight only. It is NOT a capability to connect:
 * the socket-bound egress implementation remains disabled below.
 * Check every A and AAAA answer, including mixed public/private sets.
 */
export interface PublicDnsResolver {
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
}

function isPublicDnsAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family === 6) {
    // Conservative global-unicast-only subset. Deny mapped, tunneled,
    // documentation, local, multicast, transition and reserved prefixes.
    const [firstRaw, secondRaw] = address.toLowerCase().split(':');
    const first = Number.parseInt(firstRaw, 16);
    const second = Number.parseInt(secondRaw || '0', 16);
    return first > 0x2000 && first < 0x3ffe &&
      first !== 0x2002 &&
      !(first === 0x2001 && (second < 0x0200 || second === 0x0db8));
  }
  return false;
}

async function readDnsFamily(lookup: () => Promise<string[]>): Promise<string[]> {
  try {
    const answers = await lookup();
    if (!Array.isArray(answers)) throw new Error('invalid_dns_response');
    return answers;
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
    throw new Error('network_dns_lookup_failed');
  }
}

/**
 * Resolves the actual DNS A and AAAA records by default. Injectable resolver
 * permits deterministic, network-free tests. Never use this result to call
 * Playwright route.continue(): a later DNS lookup can return a different IP.
 */
export async function resolvePublicDns(
  rawUrl: string,
  allowedDomains: readonly string[],
  resolver: PublicDnsResolver = { resolve4, resolve6 },
): Promise<{ hostname: string; addresses: string[] }> {
  const url = approvedUrl(rawUrl, allowedDomains);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const [ipv4, ipv6] = await Promise.all([
    readDnsFamily(() => resolver.resolve4(hostname)),
    readDnsFamily(() => resolver.resolve6(hostname)),
  ]);
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length) throw new Error('network_dns_empty');
  if (addresses.length > 16) throw new Error('network_dns_answer_limit');
  if (!addresses.every(address => typeof address === 'string' && isPublicDnsAddress(address))) {
    throw new Error('network_dns_address_denied');
  }
  return { hostname, addresses };
}

export function approvedUrl(raw: string, allowedDomains: readonly string[]): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('network_url_invalid'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !host ||
      /^[0-9.]+$/.test(host) || host.includes(':') || host === 'localhost' ||
      ['.localhost','.local','.internal','.test','.invalid','.onion','.arpa'].some(suffix => host.endsWith(suffix)) ||
      host === 'metadata.google.internal' || !allowedDomains.some(d => d.toLowerCase() === host)) {
    throw new Error('network_destination_denied');
  }
  return url;
}
/** A trusted DNS-aware egress decision is mandatory for production transport.
 * The browser route handler alone cannot validate the socket's resolved IP. */
export interface EgressDecision {
  authorize(url: URL): Promise<boolean>;
}
export interface NetworkRoute {
  request(): { url(): string; method(): string };
  abort(): Promise<void>;
  continue(): Promise<void>;
}
export interface RouteContext {
  route(pattern: string, handler: (route: NetworkRoute) => Promise<void>): Promise<unknown>;
}
/** Defense in depth; requires an external DNS-aware egress firewall for SSRF certification. */
export async function installNetworkGuard(context: RouteContext, allowedDomains: readonly string[], egress?: EgressDecision): Promise<void> {
  await context.route('**/*', async route => {
    try {
      const destination = approvedUrl(route.request().url(), allowedDomains);
      if (route.request().method() !== 'GET') throw new Error('network_method_denied');
      if (!egress || !(await egress.authorize(destination))) throw new Error('network_egress_unverified');
      // A URL-level allow decision cannot pin the browser socket to the DNS-checked IP.
      // Playwright route.continue() may resolve a different address (DNS rebinding).
      // Until a socket-bound transport is certified, abort even approved GET requests.
      throw new Error('network_socket_binding_unverified');
    } catch { await route.abort(); }
  });
}
