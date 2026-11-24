import { describe, expect, it } from 'vitest';
import { buildStroop, countWords, scoreAnswers, buildDigits, normalizeAnswer, reactionSummary } from '../../packages/learning/cognitive-practice';

describe('cognitive practice (educational only)', () => {
  it('balances six congruent and six incongruent trials', () => {
    const trials = buildStroop(17);
    expect(trials).toHaveLength(12);
    expect(trials.filter(t => t.word === t.ink)).toHaveLength(6);
    expect(trials).toEqual(buildStroop(17));
    expect(trials).not.toEqual(buildStroop(18));
  });
  it('counts words without calling them valid category answers', () => {
    expect(countWords(' León, leon; perro\nperro ')).toEqual({ total: 4, unique: 2, repeated: 2 });
    expect(countWords(' , ')).toEqual({ total: 0, unique: 0, repeated: 0 });
  });
  it('scores only normalized exact matches and does not award blank answers', () => {
    expect(normalizeAnswer('  Astronomía  ')).toBe('astronomia');
    expect(scoreAnswers(['dos','', ' AZUL '], ['dos','lunes','azul'])).toBe(2);
  });
  it('generates forward and backward digit trials with unambiguous keys', () => {
    const digits = buildDigits(17);
    expect(digits.map(t => t.digits.length)).toEqual([3,4,5,6]);
    for (const t of digits) expect(t.answer).toBe(t.reverse ? [...t.digits].reverse().join('') : t.digits.join(''));
  });
  it('excludes incorrect and invalid timings from reaction summaries', () => {
    expect(reactionSummary([{ correct:true, ms:300 },{ correct:false, ms:10 },{ correct:true, ms:500 },{ correct:true, ms:NaN }])).toEqual({ correct:3, total:4, medianMs:400 });
    expect(reactionSummary([]).medianMs).toBeNull();
  });
});
