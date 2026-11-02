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
