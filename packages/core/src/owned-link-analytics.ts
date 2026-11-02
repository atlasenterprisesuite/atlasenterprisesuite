import type { LinkScope } from './owned-links';
export type LinkClickEvent = LinkScope & { slug: string; timestamp: number };
/** Aggregate-only projection. Authorization and persistent collection are deliberately out of scope. */
export function aggregateLinkEvents(events: readonly LinkClickEvent[], scope: LinkScope, slug: string): { slug: string; clicks: number } {
 if (!scope.organizationId?.trim() || !scope.tenantId?.trim() || !slug) throw new Error('analytics_scope_denied');
 return { slug, clicks: events.filter(e => e.organizationId === scope.organizationId && e.tenantId === scope.tenantId && e.slug === slug && Number.isFinite(e.timestamp)).length };
}
