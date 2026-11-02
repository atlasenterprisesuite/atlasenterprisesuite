export type MorningFocusRecord = {
  day: string;
  intention: string;
  action: string;
  evidence: string;
  completed: boolean;
};

export function isMorningFocusComplete(record: MorningFocusRecord): boolean {
  return record.completed && record.action.trim().length > 0 && record.evidence.trim().length > 0;
}
