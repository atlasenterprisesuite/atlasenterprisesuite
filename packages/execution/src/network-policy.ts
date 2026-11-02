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
export interface NetworkRoute {
  request(): { url(): string; method(): string };
  abort(): Promise<void>;
  continue(): Promise<void>;
}
export interface RouteContext {
  route(pattern: string, handler: (route: NetworkRoute) => Promise<void>): Promise<unknown>;
}
/** Defense in depth; requires an external DNS-aware egress firewall for SSRF certification. */
export async function installNetworkGuard(context: RouteContext, allowedDomains: readonly string[]): Promise<void> {
  await context.route('**/*', async route => {
    try {
      approvedUrl(route.request().url(), allowedDomains);
      if (route.request().method() !== 'GET') throw new Error('network_method_denied');
      await route.continue();
    } catch { await route.abort(); }
  });
}
