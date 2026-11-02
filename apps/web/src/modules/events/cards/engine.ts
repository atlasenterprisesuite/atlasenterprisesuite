export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Card = Readonly<{ id: string; suit: Suit; rank: number }>;
export type Table = Readonly<{
  hands: readonly [readonly Card[], readonly Card[]];
  deck: readonly Card[];
  scores: readonly [number, number];
  round: number;
  status: 'playing' | 'finished';
  last: readonly [Card, Card] | null;
}>;

/** Local practice only. This state must never become a multiplayer payload. */
export function createTable(random: () => number = Math.random): Table {
  const deck: Card[] = (['clubs', 'diamonds', 'hearts', 'spades'] as const).flatMap(suit =>
    Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 2}`, suit, rank: i + 2 })));
  for (let i = deck.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid shuffle entropy');
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { hands: [deck.slice(0, 5), deck.slice(5, 10)], deck: deck.slice(10), scores: [0, 0], round: 0, status: 'playing', last: null };
}

export function playCard(state: Table, id: string): Table {
  if (state.status !== 'playing') throw new Error('This game has ended');
  const chosen = state.hands[0].find(card => card.id === id);
  if (!chosen) throw new Error('Choose a card from your hand');
  // The bot chooses only from its own hand, independently of the player choice.
  const bot = [...state.hands[1]].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))[0];
  if (!bot) throw new Error('Opponent has no cards');
  const playerHand = state.hands[0].filter(card => card.id !== id);
  const botHand = state.hands[1].filter(card => card.id !== bot.id);
  const deck = [...state.deck];
  if (deck.length >= 2) { playerHand.push(deck.shift()!); botHand.push(deck.shift()!); }
  return {
    hands: [playerHand, botHand], deck,
    scores: [state.scores[0] + Number(chosen.rank > bot.rank), state.scores[1] + Number(bot.rank > chosen.rank)],
    round: state.round + 1, status: playerHand.length === 0 ? 'finished' : 'playing', last: [chosen, bot]
  };
}

export function tableView(state: Table) {
  return { hand: state.hands[0], opponentCount: state.hands[1].length, remaining: state.deck.length,
    scores: state.scores, round: state.round, status: state.status, last: state.last };
}
