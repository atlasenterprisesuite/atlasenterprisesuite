import { describe, expect, it, vi } from 'vitest';
import { createRequestGate } from '../../apps/web/src/modules/creator/requestGate';

describe('Productivity request lifecycle', () => {
  it('rejects concurrent starts and permits a new request after completion', () => {
    const gate = createRequestGate();
    const first = gate.start(() => {})!;
    expect(gate.start(() => {})).toBeNull();
    expect(first.finish()).toBe(true);
    expect(gate.start(() => {})).not.toBeNull();
    gate.cancel();
  });
  it('ignores a stale completion after clearing and restarting', () => {
    const gate = createRequestGate();
    const first = gate.start(() => {})!;
    gate.cancel();
    const second = gate.start(() => {})!;
    expect(first.signal.aborted).toBe(true);
    expect(first.finish()).toBe(false);
    expect(second.isCurrent()).toBe(true);
    gate.cancel();
  });
  it('times out, aborts and allows recovery', () => {
    vi.useFakeTimers();
    try {
      const gate = createRequestGate(50);
      const timeout = vi.fn();
      const first = gate.start(timeout)!;
      vi.advanceTimersByTime(50);
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(first.signal.aborted).toBe(true);
      expect(first.finish()).toBe(false);
      expect(gate.start(timeout)).not.toBeNull();
      gate.cancel();
    } finally { vi.useRealTimers(); }
  });
  it('clears timers on finish and repeated cancellation', () => {
    vi.useFakeTimers();
    try {
      const gate = createRequestGate(50);
      const timeout = vi.fn();
      gate.start(timeout)!.finish();
      gate.start(timeout);
      gate.cancel();
      gate.cancel();
      vi.advanceTimersByTime(100);
      expect(timeout).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
