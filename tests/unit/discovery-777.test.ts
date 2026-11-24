import { describe, expect, it } from 'vitest';
import { buildPortalDestinations, filterPortalDestinations, resolveDiscoveryRoute } from '../../apps/web/src/modules/galaxy/portalModel';
const modules = [{ id: 'sample', title: 'Educación financiera', navLabel: 'Academy', area: 'Education', route: '/sample', readiness: 'partial' as const, requiresAuth: true, description: 'Práctica de contabilidad', showInNavigation: true }];
const authorized = buildPortalDestinations({ modules, hasIdentity: true });
const blocked = buildPortalDestinations({ modules, hasIdentity: false });
describe('Discovery 777 — canonical portals', () => {
  it('matches accent-insensitive terms across fields', () => {
    expect(filterPortalDestinations(authorized, 'educacion practica', 'All')).toEqual(authorized);
  });
  it('combines queries and category; preserves empty results', () => {
    expect(filterPortalDestinations(authorized, 'academy', 'Education')).toEqual(authorized);
    expect(filterPortalDestinations(authorized, 'academy', 'Finance')).toEqual([]);
    expect(filterPortalDestinations(authorized, 'missing', 'All')).toEqual([]);
  });
  it('rejects oversized queries without falling back to full catalog', () => {
    expect(filterPortalDestinations(authorized, 'x'.repeat(151), 'All')).toEqual([]);
  });
  it('does not elevate blocked destinations', () => {
    expect(filterPortalDestinations(blocked, 'academy', 'All')[0]?.navigable).toBe(false);
    expect(resolveDiscoveryRoute(blocked, 'sample')).toBeNull();
  });
  it('resolves navigation only from current catalog, never stale data', () => {
    expect(resolveDiscoveryRoute(authorized, 'sample')).toBe('/sample');
    expect(resolveDiscoveryRoute([], 'sample')).toBeNull();
    expect(resolveDiscoveryRoute(authorized, 'missing')).toBeNull();
  });
  it('rejects ambiguous IDs and unsafe routes', () => {
    expect(resolveDiscoveryRoute([...authorized, ...authorized], 'sample')).toBeNull();
    expect(resolveDiscoveryRoute([{ ...authorized[0], route: '//example.com' }], 'sample')).toBeNull();
  });
});
