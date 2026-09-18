import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import {
  GALAXY_NODE_DEFINITIONS,
  buildGalaxyNodes
} from '../../apps/web/src/modules/galaxy/galaxyModel';

describe('ATLAS Galaxy model', () => {
  it('maps canonical module readiness to truthful visual states', () => {
    const nodes = buildGalaxyNodes({ modules: ATLAS_MODULES, hasIdentity: true });
    expect(nodes.find((node) => node.id === 'finance')?.status).toBe('active');
    expect(nodes.find((node) => node.id === 'crm')?.status).toBe('available');
    expect(nodes.find((node) => node.id === 'payroll')?.status).toBe('warning');
  });

  it('preserves canonical routes and leaves inventory non-navigable', () => {
    const nodes = buildGalaxyNodes({ modules: ATLAS_MODULES, hasIdentity: true });
    expect(nodes.find((node) => node.id === 'crm')?.route).toBe('/crm');
    expect(nodes.find((node) => node.id === 'accounting')?.route).toBe('/finance/accounting');
    expect(nodes.find((node) => node.id === 'inventory')?.route).toBeNull();
    expect(nodes.find((node) => node.id === 'inventory')?.status).toBe('unverified');
  });

  it('blocks authenticated destinations when identity is absent', () => {
    const nodes = buildGalaxyNodes({ modules: ATLAS_MODULES, hasIdentity: false });
    expect(nodes.find((node) => node.id === 'crm')?.status).toBe('blocked');
    expect(nodes.find((node) => node.id === 'payroll')?.status).toBe('blocked');
  });

  it('contains no fabricated production telemetry in spatial definitions', () => {
    const serialized = JSON.stringify(GALAXY_NODE_DEFINITIONS);
    for (const forbidden of ['99.99%', '$42.8M', '1,420', '256-bit', 'approvalCount']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('does not ship fabricated live-looking Galaxy telemetry', () => {
    const files = [
      'apps/web/src/modules/galaxy/galaxyModel.ts',
      'apps/web/src/modules/galaxy/AtlasGalaxyMap.tsx',
      'apps/web/src/modules/galaxy/AtlasGalaxyPage.tsx'
    ];
    const source = files
      .filter((file) => {
        try { readFileSync(file, 'utf8'); return true; } catch { return false; }
      })
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    for (const forbidden of ['99.99% uptime', '$42.8M Liq.', '1,420 Active', 'Secured 256-bit', 'SPACE MAPPING PROTOCOL v2.6 ACTIVE']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
