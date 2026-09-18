import { expect, it } from 'vitest';
import { canTransitionStep } from '../../packages/execution/src/state-machine';

it('allows ready -> running -> completed', () => {
  expect(canTransitionStep('ready', 'running')).toBe(true);
  expect(canTransitionStep('running', 'completed')).toBe(true);
});

it('does not allow completed steps to run again', () => {
  expect(canTransitionStep('completed', 'running')).toBe(false);
});

it('allows approval and blocker recovery', () => {
  expect(canTransitionStep('ready', 'awaiting_approval')).toBe(true);
  expect(canTransitionStep('awaiting_approval', 'ready')).toBe(true);
  expect(canTransitionStep('blocked', 'ready')).toBe(true);
});

it('does not allow pending to jump directly to completed', () => {
  expect(canTransitionStep('pending', 'completed')).toBe(false);
});
