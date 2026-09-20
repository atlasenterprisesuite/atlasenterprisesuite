import { describe, expect, it } from 'vitest';
import { assertProductionData, evaluateProductionDataGate, type ProductionDataGateInput } from '../../apps/web/src/lib/productionDataGate';

const ready: ProductionDataGateInput = {
  identity: true,
  activeTenant: true,
  authorized: true,
  sourceConnected: true,
  connectionVerified: true,
  tenantIsolated: true,
  fresh: true
};

describe('production data gate', () => {
  it('fails closed at every required boundary', () => {
    const cases: Array<[keyof ProductionDataGateInput, string]> = [
      ['identity', 'identity-required'],
      ['activeTenant', 'tenant-required'],
      ['authorized', 'permission-required'],
      ['sourceConnected', 'source-required'],
      ['connectionVerified', 'verification-required'],
      ['tenantIsolated', 'tenant-isolation-required'],
      ['fresh', 'stale']
    ];

    for (const [key, expected] of cases) {
      const result = evaluateProductionDataGate({ ...ready, [key]: false });
      expect(result.production).toBe(false);
      expect(result.state).toBe(expected);
      expect(() => assertProductionData(result)).toThrow(`production_data_gate_failed:${expected}`);
    }
  });

  it('allows production only after all gates pass', () => {
    const result = evaluateProductionDataGate(ready);
    expect(result).toEqual({ state: 'production', production: true, label: 'LIVE / PRODUCTION' });
    expect(() => assertProductionData(result)).not.toThrow();
  });
});
