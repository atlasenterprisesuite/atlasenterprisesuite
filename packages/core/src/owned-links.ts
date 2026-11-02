/** ATLAS-owned short-link policy. Pure, fail-closed domain logic; no public redirect is enabled here. */
export interface LinkScope { organizationId: string; tenantId: string }
export interface ShortLink extends LinkScope {
  slug: string;
  destination: string;
  expiresAt?: number;
  revoked: boolean;
}
export type NewShortLink = LinkScope & { slug: string; destination: string; expiresAt?: number };
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.test', '.invalid', '.onion', '.arpa'];
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const ALIAS = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function validateDestination(destination: string): string {
  let url: URL;
  try { url = new URL(destination); } catch { throw new Error('link_destination_denied'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !host || host === 'localhost' || host === 'metadata.google.internal' ||
      IPV4.test(host) || host.includes(':') || !host.includes('.') ||
      BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix)) ||
      /[\s\\]/.test(destination)) {
    throw new Error('link_destination_denied');
  }
  return url.toString();
}
export function createShortLink(input: NewShortLink): ShortLink {
  if (!input.organizationId?.trim() || !input.tenantId?.trim()) throw new Error('link_scope_denied');
  if (!ALIAS.test(input.slug) || input.slug.length > 64) throw new Error('link_slug_invalid');
  if (input.expiresAt !== undefined && !Number.isFinite(input.expiresAt)) throw new Error('link_expiry_invalid');
  return { organizationId: input.organizationId, tenantId: input.tenantId, slug: input.slug,
    destination: validateDestination(input.destination), expiresAt: input.expiresAt, revoked: false };
}
export function resolveShortLink(link: ShortLink, scope: LinkScope, now: number): string {
  if (!scope.organizationId || !scope.tenantId ||
      link.organizationId !== scope.organizationId || link.tenantId !== scope.tenantId)
    throw new Error('link_scope_denied');
  if (link.revoked || !Number.isFinite(now) || (link.expiresAt !== undefined && now >= link.expiresAt))
    throw new Error('link_unavailable');
  return validateDestination(link.destination);
}
