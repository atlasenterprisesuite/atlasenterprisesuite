import type { OracleCard, OracleReadingType, OracleSpreadPosition } from './types';

const DAILY_SPREAD: readonly OracleSpreadPosition[] = [
  { key: 'energy', label: 'Energy of the day' },
  { key: 'notice', label: 'What to notice' },
  { key: 'direction', label: 'Direction' }
];

const FOCUSED_SPREAD: readonly OracleSpreadPosition[] = [
  { key: 'energy', label: 'Current energy' },
  { key: 'challenge', label: 'What to examine' },
  { key: 'guidance', label: 'Reflective guidance' }
];

const FULL_SPREAD: readonly OracleSpreadPosition[] = [
  { key: 'general', label: 'General energy' },
  { key: 'love', label: 'Love' },
  { key: 'money', label: 'Money' },
  { key: 'work', label: 'Work' },
  { key: 'challenge', label: 'Challenge' },
  { key: 'advice', label: 'Advice' },
  { key: 'closing', label: 'Closing message' }
];

export function spreadForReadingType(type: OracleReadingType): readonly OracleSpreadPosition[] {
  if (type === 'full') return FULL_SPREAD;
  if (type === 'daily') return DAILY_SPREAD;
  return FOCUSED_SPREAD;
}

function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextRandom(state: number) {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function drawCards<T extends OracleCard>(cards: readonly T[], count: number, seed: string): T[] {
  if (!Number.isInteger(count) || count < 0) throw new Error('invalid_draw_count');
  if (count > cards.length) throw new Error('oracle_deck_insufficient');

  const pool = [...cards];
  const drawn: T[] = [];
  let state = hashSeed(seed || 'atlas-oracle');

  for (let index = 0; index < count; index += 1) {
    state = nextRandom(state);
    const pick = state % pool.length;
    drawn.push(pool.splice(pick, 1)[0]);
  }

  return drawn;
}
