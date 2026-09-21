import { describe, expect, it } from 'vitest';
import {
  COMPUTER_OPERATIONS_CONTRACT,
  browserProductionProbeSupported,
  buildComputerOperationsRoutes,
  buildEssentialComputerOperationsRoutes,
  idleComputerOperationsProbes
} from '../../apps/web/src/work/computerOperations';

describe('ATLAS Computer Operations contract', () => {
  it('uses the canonical fail-closed production origin', () => {
    expect(COMPUTER_OPERATIONS_CONTRACT.production_origin).toBe('https://www.atlasenterprisesuite.com');
    expect(COMPUTER_OPERATIONS_CONTRACT.default_mode).toBe('fail-closed');
    expect(COMPUTER_OPERATIONS_CONTRACT.version).toBeGreaterThanOrEqual(14);
  });

  it('derives browser operations routes from the canonical production contract without duplicates', () => {
    const routes = buildComputerOperationsRoutes();
    expect(new Set(routes.map((route) => route.path)).size).toBe(routes.length);
    expect(routes).toContainEqual({ path: '/work/computer-operations', group: 'work' });

    for (const path of COMPUTER_OPERATIONS_CONTRACT.critical_network_routes) {
      expect(routes).toContainEqual({ path, group: 'network' });
    }
  });

  it('keeps the automatic essential probe narrowly scoped to home, Work and critical Network routes', () => {
    const routes = buildEssentialComputerOperationsRoutes();
    expect(routes.map((route) => route.path)).toEqual([
      '/',
      '/work',
      ...COMPUTER_OPERATIONS_CONTRACT.critical_network_routes
    ]);
  });

  it('does not pretend a development origin can run canonical same-origin production probes', () => {
    expect(browserProductionProbeSupported('https://www.atlasenterprisesuite.com')).toBe(true);
    expect(browserProductionProbeSupported('http://localhost:5173')).toBe(false);
    expect(browserProductionProbeSupported('https://example.com')).toBe(false);
  });

  it('starts route evidence as not checked rather than fabricated green', () => {
    const probes = idleComputerOperationsProbes(buildEssentialComputerOperationsRoutes());
    expect(probes.every((probe) => probe.state === 'idle')).toBe(true);
    expect(probes.every((probe) => probe.status === null && probe.durationMs === null)).toBe(true);
  });
});
