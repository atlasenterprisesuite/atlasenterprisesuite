import { describe, expect, it } from 'vitest';
import { buildComputerOperationsEvidence } from '../../apps/web/src/work/computerOperationsEvidence';
import type { ComputerOperationsProbe } from '../../apps/web/src/work/computerOperations';

const observedAt = '2026-11-11T22:00:00.000Z';
const passed: ComputerOperationsProbe = {
  path: '/work', group: 'work', state: 'pass', status: 200, durationMs: 12, error: null
};

describe('browser diagnostic evidence', () => {
  it('records a timestamped snapshot without claiming production verification', () => {
    const probes = [{ ...passed }];
    const report = buildComputerOperationsEvidence(probes, 'essential', observedAt);
    probes[0].state = 'fail';
    expect(report.outcome).toBe('passed');
    expect(report.observedAt).toBe(observedAt);
    expect(report.productionVerified).toBe(false);
    expect(report.routes[0].state).toBe('pass');
    expect(report.nextAction).toContain('exact-SHA');
  });

  it.each(['idle', 'checking'] as const)('keeps %s results incomplete', (state) => {
    expect(buildComputerOperationsEvidence([{ ...passed, state }], 'essential', observedAt).outcome).toBe('incomplete');
  });

  it('never passes an empty result', () => {
    expect(buildComputerOperationsEvidence([], 'essential', observedAt).outcome).toBe('incomplete');
  });

  it.each(['fail', 'unavailable'] as const)('preserves %s as attention required', (state) => {
    const report = buildComputerOperationsEvidence([{ ...passed, state, status: null }], 'full', observedAt);
    expect(report.outcome).toBe('attention-required');
    expect(report.nextAction).toContain('Retry');
  });

  it('does not accept a pass label without HTTP 200 evidence', () => {
    expect(buildComputerOperationsEvidence([{ ...passed, status: 403 }], 'full', observedAt).outcome).toBe('attention-required');
  });

  it('does not export arbitrary error messages that might contain private data', () => {
    const report = buildComputerOperationsEvidence([{ ...passed, state: 'unavailable', error: 'secret-token' }], 'essential', observedAt);
    expect(JSON.stringify(report)).not.toContain('secret-token');
  });
});
