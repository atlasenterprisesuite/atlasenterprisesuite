import { describe, expect, it } from 'vitest';
import { isWithinNightWindow } from '../../apps/atlas-orchestrator/src/workers/nightWindow';

const window = { timeZone: 'America/New_York', startHour: 23, endHour: 7 };

describe('ATLAS night window', () => {
  it('accepts late-evening and overnight hours in New York', () => {
    expect(isWithinNightWindow(new Date('2026-09-16T03:30:00.000Z'), window)).toBe(true); // 23:30 previous day EDT
    expect(isWithinNightWindow(new Date('2026-09-16T09:30:00.000Z'), window)).toBe(true); // 05:30 EDT
  });

  it('rejects daytime hours', () => {
    expect(isWithinNightWindow(new Date('2026-09-16T16:00:00.000Z'), window)).toBe(false); // 12:00 EDT
  });
});
