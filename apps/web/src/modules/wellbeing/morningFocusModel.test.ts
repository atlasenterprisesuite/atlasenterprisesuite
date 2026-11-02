import { describe, expect, it } from 'vitest';
import { isMorningFocusComplete, type MorningFocusRecord } from './morningFocusModel';

const base: MorningFocusRecord = {
  day: '2026-11-02',
  intention: 'Terminar Atlas',
  action: 'Review CI',
  evidence: 'Verified check run',
  completed: true
};

describe('Morning Focus completion evidence', () => {
  it('requires explicit completion and evidence', () => {
    expect(isMorningFocusComplete(base)).toBe(true);
    expect(isMorningFocusComplete({ ...base, completed: false })).toBe(false);
    expect(isMorningFocusComplete({ ...base, evidence: '   ' })).toBe(false);
    expect(isMorningFocusComplete({ ...base, action: '' })).toBe(false);
  });
});
