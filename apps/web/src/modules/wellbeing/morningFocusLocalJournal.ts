import type { MorningFocusRecord } from './morningFocusModel';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The caller must provide authenticated, server-verified IDs. This is not a permission check. */
export function morningFocusJournalKey(userId: string, orgId: string): string | null {
  if (!UUID.test(userId) || !UUID.test(orgId)) return null;
  return 'atlas.morning-focus.local.v1.' + orgId.toLowerCase() + '.' + userId.toLowerCase();
}

export function readMorningFocusJournal(
  storage: Pick<Storage, 'getItem'>,
  userId: string,
  orgId: string
): MorningFocusRecord[] {
  const key = morningFocusJournalKey(userId, orgId);
  if (!key) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is MorningFocusRecord =>
      record !== null && typeof record === 'object' &&
      typeof record.day === 'string' &&
      typeof record.intention === 'string' &&
      typeof record.action === 'string' &&
      typeof record.evidence === 'string' &&
      typeof record.completed === 'boolean'
    ).slice(0, 21);
  } catch {
    return [];
  }
}

export function writeMorningFocusJournal(
  storage: Pick<Storage, 'setItem'>,
  userId: string,
  orgId: string,
  records: readonly MorningFocusRecord[]
): boolean {
  const key = morningFocusJournalKey(userId, orgId);
  if (!key) return false;
  try {
    storage.setItem(key, JSON.stringify(records.slice(0, 21)));
    return true;
  } catch {
    return false;
  }
}
