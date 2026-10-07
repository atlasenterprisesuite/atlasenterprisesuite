import { describe, expect, it } from 'vitest';
import {
  evaluateEvidenceBundle,
  type EvidenceBundle
} from '../../packages/core/src';

function bundle(checks: EvidenceBundle['checks']): EvidenceBundle {
  return {
    version: 1,
    subject: 'provider:openai',
    environment: 'production',
    mode: 'fail-closed',
    generatedAt: '2026-10-07T05:50:00.000Z',
    checks
  };
}

describe('ATLAS Evidence Engine', () => {
  it('passes only when every blocking P0 check passes', () => {
    const result = evaluateEvidenceBundle(bundle([
      { id: 'dns', priority: 'P0', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' },
      { id: 'tls', priority: 'P0', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' },
      { id: 'voice', priority: 'P1', status: 'unverified', observedAt: '2026-10-07T05:49:00.000Z' }
    ]));

    expect(result.outcome).toBe('pass');
    expect(result.productionReady).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual(['voice']);
  });

  it('blocks when a P0 check is unverified without pretending it failed', () => {
    const result = evaluateEvidenceBundle(bundle([
      { id: 'dns', priority: 'P0', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' },
      { id: 'websocket', priority: 'P0', status: 'unverified', observedAt: '2026-10-07T05:49:00.000Z' }
    ]));

    expect(result.outcome).toBe('blocked');
    expect(result.productionReady).toBe(false);
    expect(result.blockers).toEqual(['websocket']);
    expect(result.failures).toEqual([]);
  });

  it('fails closed when a P0 check fails', () => {
    const result = evaluateEvidenceBundle(bundle([
      { id: 'dns', priority: 'P0', status: 'fail', observedAt: '2026-10-07T05:49:00.000Z' },
      { id: 'tls', priority: 'P0', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' }
    ]));

    expect(result.outcome).toBe('fail');
    expect(result.productionReady).toBe(false);
    expect(result.failures).toEqual(['dns']);
  });

  it('allows a P1 check to become blocking when explicitly required', () => {
    const result = evaluateEvidenceBundle(bundle([
      { id: 'core', priority: 'P0', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' },
      { id: 'voice', priority: 'P1', required: true, status: 'unverified', observedAt: '2026-10-07T05:49:00.000Z' }
    ]));

    expect(result.outcome).toBe('blocked');
    expect(result.blockers).toEqual(['voice']);
  });

  it('rejects malformed bundles and duplicate check identifiers', () => {
    expect(() => evaluateEvidenceBundle(bundle([
      { id: 'dns', priority: 'P0', status: 'pass', observedAt: 'bad-date' }
    ]))).toThrow('invalid_evidence_observed_at:dns');

    expect(() => evaluateEvidenceBundle(bundle([
      { id: 'dns', priority: 'P0', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' },
      { id: 'dns', priority: 'P1', status: 'pass', observedAt: '2026-10-07T05:49:00.000Z' }
    ]))).toThrow('duplicate_evidence_check:dns');
  });
});
