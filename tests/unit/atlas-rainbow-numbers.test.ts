import { describe, expect, it } from 'vitest';
import { ATLAS_SYMBOLIC_NUMBERS, ATLAS_NUMEROLOGY_NOTICE, getAtlasSymbolicPrompt } from '../../apps/web/src/atlas-rainbow-numbers';

describe('ATLAS Rainbow number catalog', () => {
  it('contains ten unique, accessible labels and actionable prompts', () => {
    expect(ATLAS_SYMBOLIC_NUMBERS).toHaveLength(10);
    expect(new Set(ATLAS_SYMBOLIC_NUMBERS.map((item) => item.code)).size).toBe(10);
    for (const entry of ATLAS_SYMBOLIC_NUMBERS) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.action.trim().length).toBeGreaterThan(0);
      expect(getAtlasSymbolicPrompt(entry.code)).toEqual(entry);
    }
  });
  it('does not invent interpretations for unknown numbers', () => {
    expect(getAtlasSymbolicPrompt('000')).toBeNull();
    expect(getAtlasSymbolicPrompt('')).toBeNull();
  });
  it('discloses that symbolic numbers are not predictive', () => {
    expect(ATLAS_NUMEROLOGY_NOTICE).toMatch(/No predicen/);
  });
});
