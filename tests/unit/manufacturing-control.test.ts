import { describe, expect, it } from 'vitest';
import { MH01_P0_GATES, validateManufacturingTransition, type ManufacturingUnit } from '../../packages/manufacturing/src/control';
const makeUnit = (overrides: Partial<ManufacturingUnit> = {}): ManufacturingUnit => ({
  orgId:'org-a', serial:'MH01-0001', state:'qa', gates:{}, ...overrides
});
describe('MH-01 fail-closed production release', () => {
  it('rejects cross-organization transitions', () => {
    expect(() => validateManufacturingTransition(makeUnit(),'released','org-b')).toThrow('TENANT_ACCESS_DENIED');
  });
  it('rejects unapproved transition', () => {
    expect(() => validateManufacturingTransition(makeUnit({state:'draft'}),'released','org-a')).toThrow('INVALID_STATE_TRANSITION');
  });
  it('blocks release without all P0 evidence', () => {
    expect(() => validateManufacturingTransition(makeUnit(),'released','org-a')).toThrow('P0_GATE_BLOCKED');
  });
  it('blocks failed gates despite evidence', () => {
    const gates = Object.fromEntries(MH01_P0_GATES.map(g => [g,{passed:true,evidenceId:'e-'+g,verifiedAt:'2026-10-17T00:00:00Z'}]));
    gates.battery_safety.passed = false;
    expect(() => validateManufacturingTransition(makeUnit({gates}),'released','org-a')).toThrow('P0_GATE_BLOCKED:battery_safety');
  });
  it('allows release only with complete verified evidence', () => {
    const gates = Object.fromEntries(MH01_P0_GATES.map(g => [g,{passed:true,evidenceId:'e-'+g,verifiedAt:'2026-10-17T00:00:00Z'}]));
    expect(() => validateManufacturingTransition(makeUnit({gates}),'released','org-a')).not.toThrow();
  });
});
