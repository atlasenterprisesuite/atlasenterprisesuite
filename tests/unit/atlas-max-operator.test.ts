import { describe, expect, it } from 'vitest';
import { transitionOperator } from '../../apps/web/src/execution/atlas-max/operator';
describe('ATLAS MAX operator', () => {
  it('requires runtime evidence to run', () => expect(transitionOperator('ready','start',{})).toBe('ready'));
  it('requires completion evidence to complete', () => expect(transitionOperator('running','complete',{})).toBe('running'));
  it('preserves failed state', () => expect(transitionOperator('running','fail',{ checkpointRef:'cp' })).toBe('failed'));
});