import { resolve4, resolve6 } from 'node:dns/promises';
import { resolvePublicDns } from './network-policy';

/**
 * Node-only DNS preflight for an isolated executor.
 * Real A and AAAA lookups occur when invoked. This does NOT authorize
 * Playwright egress: a separate TLS socket-bound, IP-pinned transport and
 * redirect-by-redirect verification must be certified first.
 */
export function resolvePublicDnsNode(rawUrl: string, allowedDomains: readonly string[]) {
  return resolvePublicDns(rawUrl, allowedDomains, { resolve4, resolve6 });
}
