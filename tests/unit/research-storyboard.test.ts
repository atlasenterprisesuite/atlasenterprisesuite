import { describe, expect, it } from 'vitest';
import { buildResearchStoryboard } from '../../packages/creator/research-storyboard.ts';

const source = { id: 's1', url: 'https://example.org/report', title: 'Synthetic test fixture', sha256: 'a'.repeat(64), rights: 'test fixture' };
const scene = { id: 'a', title: 'Test scene', narration: 'Synthetic example.', classification: 'hypothesis' as const, sourceIds: ['s1'] };
describe('research storyboard contract', () => {
  it.each(['science','history','finance','geography'] as const)('supports %s without a paid provider', domain => {
    const result = buildResearchStoryboard({ domain, sources: [source], scenes: [scene] });
    expect(result.provider).toBe('atlas-native');
    expect(result.scenes[0].sources).toEqual([source]);
    expect(result.scenes[0].classification).toBe('hypothesis');
    expect(result.verification).toBe('unverified');
  });
  it('rejects unknown source references', () => {
    expect(() => buildResearchStoryboard({ domain: 'science', sources: [], scenes: [scene] })).toThrow();
  });
  it('rejects malformed digest and missing rights', () => {
    for (const bad of [{...source, sha256: 'invalid'}, {...source, rights: ''}]) {
      expect(() => buildResearchStoryboard({ domain: 'science', sources: [bad], scenes: [scene] })).toThrow();
    }
  });
  it('rejects duplicate scene and source identifiers', () => {
    expect(() => buildResearchStoryboard({ domain: 'history', sources: [source, source], scenes: [scene] })).toThrow();
    expect(() => buildResearchStoryboard({ domain: 'history', sources: [source], scenes: [scene, scene] })).toThrow();
  });
});
