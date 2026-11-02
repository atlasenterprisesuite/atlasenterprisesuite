import { resolveShortLink, type LinkScope, type ShortLink, validateDestination } from './owned-links';

/** Returns a URL suitable for QR encoding; does not render a QR image or publish a redirect. */
export function buildQrPayload(link: ShortLink, scope: LinkScope, origin: string, now: number): string {
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error('qr_origin_denied'); }
  try {
    validateDestination(origin);
    if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error('qr_origin_denied');
    }
  } catch { throw new Error('qr_origin_denied'); }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(link.slug) || link.slug.length > 64) {
    throw new Error('link_slug_invalid');
  }
  resolveShortLink(link, scope, now);
  return new URL('/' + encodeURIComponent(link.slug), parsed.origin).toString();
}
