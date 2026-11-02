import { validateDestination, type LinkScope } from './owned-links';
export type Microsite = LinkScope & { slug: string; title: string; links: Array<{label: string; href: string}> };
const alias = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export function validateMicrosite(page: Microsite): Microsite {
 if (!page.organizationId?.trim() || !page.tenantId?.trim()) throw new Error('microsite_scope_denied');
 if (!alias.test(page.slug) || page.slug.length > 64) throw new Error('microsite_slug_invalid');
 if (!page.title?.trim() || page.title.length > 120 || !Array.isArray(page.links) || page.links.length > 30) throw new Error('microsite_content_invalid');
 return { ...page, links: page.links.map(link => {
  if (!link.label?.trim() || link.label.length > 120) throw new Error('microsite_content_invalid');
  return { label: link.label, href: validateDestination(link.href) };
 }) };
}
const escapeHtml = (value: string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/** Static markup fragment only: not an authenticated serving endpoint. */
export function renderMicrositeText(page: Microsite, scope: LinkScope): string {
 if (!scope.organizationId || !scope.tenantId || page.organizationId !== scope.organizationId || page.tenantId !== scope.tenantId) throw new Error('microsite_scope_denied');
 const safe = validateMicrosite(page);
 return '<section><h1>' + escapeHtml(safe.title) + '</h1><nav aria-label="Links">' + safe.links.map(link => '<a rel="noopener noreferrer" href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '</a>').join('') + '</nav></section>';
}
