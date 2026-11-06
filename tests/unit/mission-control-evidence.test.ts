import { describe, expect, it } from 'vitest';
import { missionSnapshot } from '../../apps/web/src/execution/MissionControlPage';

describe('Mission Control evidence boundaries', () => {
  it('preserves exact commit SHAs and canonical PR references', () => {
    expect(missionSnapshot.items.length).toBeGreaterThan(0);
    for (const item of missionSnapshot.items) {
      expect(item.sha).toMatch(/^[a-f0-9]{40}$/);
      expect(item.pr).toBeGreaterThan(0);
    }
  });

  it('does not advertise merge, deploy, or production approval from workflow success', () => {
    expect(missionSnapshot.items.every(item => item.gate !== 'BLOCKED')).toBe(true);
    expect(missionSnapshot.items.some(item => item.gate === 'NOT_VERIFIED')).toBe(true);
    expect(missionSnapshot.provenance).toMatch(/not a live feed/i);
  });
});
