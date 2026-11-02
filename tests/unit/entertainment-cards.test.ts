import { describe, expect, it } from 'vitest';
import { createTable, playCard, tableView } from '../../apps/web/src/modules/events/cards/engine';

describe('ATLAS High Card local practice', () => {
  it('deals 52 unique cards without mutating previous states', () => {
    const state = createTable(() => 0.5);
    expect(new Set([...state.hands.flat(), ...state.deck].map(c => c.id)).size).toBe(52);
    const before = JSON.stringify(state);
    const next = playCard(state, state.hands[0][0].id);
    expect(JSON.stringify(state)).toBe(before);
    expect(next.round).toBe(1);
    expect(next.hands.map(h => h.length)).toEqual([5, 5]);
  });
  it('rejects unavailable cards and invalid entropy', () => {
    const state = createTable(() => 0);
    expect(() => playCard(state, state.hands[1][0].id)).toThrow();
    for (const value of [NaN, -1, 1, Infinity]) expect(() => createTable(() => value)).toThrow();
  });
  it('scores rank comparisons, including ties, and ends after 26 rounds', () => {
    let state = createTable(() => 0.25);
    let expected = [0, 0];
    while (state.status === 'playing') {
      const card = state.hands[0][0];
      const bot = [...state.hands[1]].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))[0];
      if (card.rank > bot.rank) expected[0]++;
      if (bot.rank > card.rank) expected[1]++;
      state = playCard(state, card.id);
    }
    expect(state.scores).toEqual(expected);
    expect(state.round).toBe(26);
    expect(state.hands.flat()).toHaveLength(0);
    expect(state.deck).toHaveLength(0);
    expect(() => playCard(state, 'spades-2')).toThrow();
  });
  it('awards neither player a point on equal ranks', () => {
    const state = createTable(() => 0);
    const player = { id: 'clubs-14', rank: 14, suit: 'clubs' as const };
    const bot = { id: 'hearts-14', rank: 14, suit: 'hearts' as const };
    const next = playCard({ ...state, hands: [[player], [bot]], deck: [] }, player.id);
    expect(next.scores).toEqual([0, 0]);
    expect(next.status).toBe('finished');
  });
  it('does not expose bot cards or draw order through the UI projection', () => {
    const state = createTable(() => 0.5);
    const view = tableView(state);
    expect(view.opponentCount).toBe(5);
    expect(view).not.toHaveProperty('deck');
    expect(view).not.toHaveProperty('hands');
    expect(view).not.toHaveProperty('opponentHand');
  });
});
