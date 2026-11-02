import { describe, expect, it } from 'vitest';
import { aggregateLinkEvents } from '../../packages/core/src/owned-link-analytics';
const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
describe('ATLAS scoped link analytics', () => {
 it('aggregates only matching tenant events without retaining visitor identifiers', () => {
  const result = aggregateLinkEvents([{ ...scope, slug: 'launch', timestamp: 100 }, { ...scope, slug: 'launch', timestamp: 101 }, { organizationId: 'org-b', tenantId: 'tenant-a', slug: 'launch', timestamp: 102 }], scope, 'launch');
  expect(result).toEqual({ slug: 'launch', clicks: 2 });
 });
 it('fails closed on absent scope', () => {
  expect(() => aggregateLinkEvents([], { organizationId: '', tenantId: 'tenant-a' }, 'launch')).toThrow('analytics_scope_denied');
 });
});
