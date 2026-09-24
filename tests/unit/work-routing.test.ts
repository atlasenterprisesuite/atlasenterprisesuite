import { expect, it } from 'vitest';
import { selectExecutionRoute } from '../../packages/execution/src/work-routing';

const base = {
  requestedMode: 'hybrid' as const,
  apiCapability: { available: true, authorized: true },
  browserCapability: { available: true, authorized: true },
  runtimeAvailable: true
};

it('prefers an authorized API in hybrid mode', () => {
  expect(selectExecutionRoute(base).mechanism).toBe('api');
});

it('falls back to browser when API capability is absent', () => {
  expect(selectExecutionRoute({ ...base, apiCapability: { available: false, authorized: false } }).mechanism).toBe('browser');
});

it('blocks browser-only mode when no authorized browser runtime exists', () => {
  expect(selectExecutionRoute({ ...base, requestedMode: 'browser', runtimeAvailable: false }).state).toBe('blocked');
});

it('does not invent an API capability in API-only mode', () => {
  expect(selectExecutionRoute({ ...base, requestedMode: 'api', apiCapability: { available: false, authorized: false } })).toMatchObject({
    state: 'blocked', mechanism: null
  });
});
