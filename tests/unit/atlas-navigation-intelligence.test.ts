import { describe, expect, it } from 'vitest';
import { resolveAssistantModule } from '../../apps/web/src/assistant/routeContext';
import {
  ATLAS_NAVIGATION_GRAPH,
  getAtlasNavigationInstructions,
  getAtlasNavigationNode,
  getAtlasNavigationTrail,
  searchAtlasNavigation
} from '../../apps/web/src/navigation/atlasNavigation';

describe('ATLAS navigation intelligence', () => {
  it('keeps GPS 4D discoverable through the canonical graph', () => {
    const gps = ATLAS_NAVIGATION_GRAPH.find((node) => node.id === 'gps');
    expect(gps?.to).toBe('/gps');
    expect(searchAtlasNavigation('map')[0]?.id).toBe('gps');
  });

  it('resolves accounting deep links into a usable menu trail', () => {
    const node = getAtlasNavigationNode('/finance/accounting/accounts-payable');
    expect(node?.id).toBe('payables');
    expect(getAtlasNavigationTrail('/finance/accounting/accounts-payable').map((item) => item.id)).toEqual([
      'home',
      'accounting',
      'payables'
    ]);
    expect(getAtlasNavigationInstructions('/finance/accounting/accounts-payable')).toBe(
      'Home → Accounting → Payables'
    );
  });

  it('searches English and Spanish operational aliases', () => {
    expect(searchAtlasNavigation('cuentas por cobrar')[0]?.id).toBe('receivables');
    expect(searchAtlasNavigation('proveedores')[0]?.id).toBe('payables');
    expect(searchAtlasNavigation('accesibilidad')[0]?.id).toBe('accessibility');
  });

  it('feeds canonical navigation context into the assistant for routes not hard-coded there', () => {
    expect(resolveAssistantModule('/gps')).toBe('gps');
    expect(resolveAssistantModule('/cloud')).toBe('cloud');
  });

  it('fails truthfully for unknown routes instead of inventing navigation', () => {
    expect(getAtlasNavigationNode('/does-not-exist')).toBeUndefined();
    expect(getAtlasNavigationInstructions('/does-not-exist')).toBe('');
  });
});
