import { resolve4, resolve6 } from 'node:dns/promises';
import { resolvePublicDns } from './network-policy.ts';

/**
 * Node-only DNS preflight. Real A/AAAA DNS lookups happen when called.
 * This does not authorize browser egress. A TLS socket-bound, IP-pinned
 * transport and per-redirect verification remain required for certification.
 */
export function resolvePublicDnsNode(rawUrl, allowedDomains) {
  return resolvePublicDns(rawUrl, allowedDomains, { resolve4, resolve6 });
}
