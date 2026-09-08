import { describe, expect, it } from 'vitest';
import {
  canTransitionReleaseStatus,
  unmetDependencies,
} from '../../packages/release-control/src';

describe('ATLAS release lifecycle', () => {
  it('allows only adjacent forward lifecycle transitions', () => {
    expect(canTransitionReleaseStatus('developing', 'integrated')).toBe(true);
    expect(canTransitionReleaseStatus('integrated', 'test_pending')).toBe(true);
    expect(canTransitionReleaseStatus('test_pending', 'verified')).toBe(true);
    expect(canTransitionReleaseStatus('verified', 'release_ready')).toBe(true);
    expect(canTransitionReleaseStatus('release_ready', 'queued')).toBe(true);
    expect(canTransitionReleaseStatus('queued', 'activating')).toBe(true);
    expect(canTransitionReleaseStatus('activating', 'live')).toBe(true);
    expect(canTransitionReleaseStatus('live', 'prod_verified')).toBe(true);

    expect(canTransitionReleaseStatus('test_pending', 'release_ready')).toBe(false);
    expect(canTransitionReleaseStatus('integrated', 'verified')).toBe(false);
    expect(canTransitionReleaseStatus('live', 'verified')).toBe(false);
    expect(canTransitionReleaseStatus('prod_verified', 'live')).toBe(false);
  });

  it('requires dependencies to be production verified before activation', () => {
    const statuses = new Map([
      ['core', 'prod_verified' as const],
      ['identity', 'live' as const],
      ['rbac', 'prod_verified' as const],
    ]);

    expect(unmetDependencies(['core', 'identity', 'rbac'], statuses)).toEqual(['identity']);
  });

  it('allows dependencies included in the same activation transaction', () => {
    const statuses = new Map([
      ['core', 'prod_verified' as const],
      ['identity', 'queued' as const],
    ]);

    expect(
      unmetDependencies(['core', 'identity'], statuses, new Set(['identity'])),
    ).toEqual([]);
  });
});
