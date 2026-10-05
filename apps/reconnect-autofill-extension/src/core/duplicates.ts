import type { WorkSearchRecord } from './types';

function normalize(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createDuplicateFingerprint(record: WorkSearchRecord): string {
  return [
    record.claimWeekStart,
    record.claimWeekEnd,
    record.contactDate,
    normalize(record.employerName),
    normalize(record.jobTitle),
    normalize(record.referenceNumber)
  ].join('|');
}
