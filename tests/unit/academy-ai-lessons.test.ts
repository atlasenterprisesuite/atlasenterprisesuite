import { describe, expect, it } from 'vitest';
import { aiCurriculum } from '../../packages/learning/aiCurriculum';
import { getAiLessons } from '../../packages/learning/aiLessons';

describe('AI Academy original lesson catalog', () => {
  it('covers every existing module in both languages', () => {
    for (const m of aiCurriculum) {
      for (const locale of ['en', 'es']) {
        const lessons = getAiLessons(m.id, m.version, locale);
        expect(lessons.length).toBeGreaterThanOrEqual(2);
        expect(new Set(lessons.map(l => l.id)).size).toBe(lessons.length);
        for (const l of lessons) {
          expect(l.title.trim()).not.toBe('');
          expect(l.explanation.trim()).not.toBe('');
          expect(l.exercise.trim()).not.toBe('');
        }
      }
    }
  });
  it('rejects unknown modules, versions and locales', () => {
    expect(() => getAiLessons('unknown', '1.0.0', 'en')).toThrow();
    expect(() => getAiLessons('foundation', '0.0.0', 'en')).toThrow();
    expect(() => getAiLessons('foundation', '1.0.0', 'xx')).toThrow();
  });
  it('preserves lesson identifiers across languages', () => {
    expect(getAiLessons('foundation','1.0.0','en').map(l=>l.id))
      .toEqual(getAiLessons('foundation','1.0.0','es').map(l=>l.id));
  });
});
