import { describe, expect, it } from 'vitest';
import { ORACLE_CARDS, drawCards, spreadForReadingType } from '../../packages/oracle/src';

describe('oracle domain', () => {
  it('ships only the seven verified cards', () => {
    expect(ORACLE_CARDS.map((card) => card.title)).toEqual([
      'CONFÍA',
      'ESCUCHA',
      'ACEPTA',
      'LUZ INTERIOR',
      'INTUICIÓN',
      'GUÍA DIVINA',
      'PAZ DEL ALMA'
    ]);
  });

  it('uses the defined seven-position full spread', () => {
    expect(spreadForReadingType('full').map((position) => position.key)).toEqual([
      'general',
      'love',
      'money',
      'work',
      'challenge',
      'advice',
      'closing'
    ]);
  });

  it('returns the same card order for the same seed', () => {
    const first = drawCards(ORACLE_CARDS, 3, 'reading-123');
    const second = drawCards(ORACLE_CARDS, 3, 'reading-123');
    expect(second.map((card) => card.id)).toEqual(first.map((card) => card.id));
  });

  it('never selects the same card twice in a reading', () => {
    const drawn = drawCards(ORACLE_CARDS, ORACLE_CARDS.length, 'reading-unique');
    expect(new Set(drawn.map((card) => card.id)).size).toBe(drawn.length);
  });
});
