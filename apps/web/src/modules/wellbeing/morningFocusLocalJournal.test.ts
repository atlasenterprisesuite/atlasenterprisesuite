import { describe, expect, it } from 'vitest';
import { morningFocusJournalKey, readMorningFocusJournal, writeMorningFocusJournal } from './morningFocusLocalJournal';

const userA = '123e4567-e89b-42d3-a456-426614174000';
const userB = '123e4567-e89b-42d3-a456-426614174001';
const orgA = '123e4567-e89b-42d3-a456-426614174002';
const orgB = '123e4567-e89b-42d3-a456-426614174003';

describe('Morning Focus device-local journal', () => {
  it('rejects missing or malformed identity', () => {
    expect(morningFocusJournalKey('', orgA)).toBeNull();
    expect(morningFocusJournalKey(userA, '')).toBeNull();
    expect(morningFocusJournalKey('../x', orgA)).toBeNull();
  });

  it('partitions records by user and organization on one device', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); }
    };
    const records = [{ day: '2026-11-02', intention: 'Terminar Atlas', action: 'Review CI', evidence: '', completed: false }];
    expect(writeMorningFocusJournal(storage, userA, orgA, records)).toBe(true);
    expect(readMorningFocusJournal(storage, userA, orgA)).toEqual(records);
    expect(readMorningFocusJournal(storage, userB, orgA)).toEqual([]);
    expect(readMorningFocusJournal(storage, userA, orgB)).toEqual([]);
    expect(readMorningFocusJournal(storage, '', orgA)).toEqual([]);
  });

  it('fails closed on malformed stored data', () => {
    const storage = { getItem: () => '{bad json' };
    expect(readMorningFocusJournal(storage, userA, orgA)).toEqual([]);
  });
});
