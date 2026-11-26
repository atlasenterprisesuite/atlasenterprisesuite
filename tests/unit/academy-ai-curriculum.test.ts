import { describe, it, expect } from 'vitest';
import { aiCurriculum, validateAiCurriculum } from '../../packages/learning/aiCurriculum';

describe('AI Academy curriculum V1', () => {
  it('provides twelve bilingual modules in three levels', () => {
    expect(aiCurriculum).toHaveLength(12);
    expect(new Set(aiCurriculum.map(m => m.level)).size).toBe(3);
    expect(() => validateAiCurriculum(aiCurriculum)).not.toThrow();
  });
  it('rejects duplicate identifiers', () => {
    expect(() => validateAiCurriculum([...aiCurriculum, aiCurriculum[0]])).toThrow();
  });
  it('rejects unknown prerequisites', () => {
    expect(() => validateAiCurriculum([{ ...aiCurriculum[0], prerequisites: ['unknown'] }, ...aiCurriculum.slice(1)])).toThrow();
  });
  it('rejects cyclic prerequisites', () => {
    expect(() => validateAiCurriculum([{ ...aiCurriculum[0], prerequisites: [aiCurriculum[1].id] }, ...aiCurriculum.slice(1)])).toThrow();
  });
  it('rejects empty translations', () => {
    expect(() => validateAiCurriculum([{ ...aiCurriculum[0], title: { en: 'AI', es: ' ' } }, ...aiCurriculum.slice(1)])).toThrow();
  });
  it('rejects malformed input and empty catalogs', () => {
    expect(() => validateAiCurriculum(null)).toThrow();
    expect(() => validateAiCurriculum([])).toThrow();
  });
});
