import type { TimeEntry } from './types';

function timestampMillis(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid timestamp.`);
  return parsed;
}

export function calculateWorkedMinutes(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
): number {
  if (!Number.isInteger(breakMinutes)) {
    throw new Error('Break minutes must be a whole number.');
  }
  if (breakMinutes < 0) {
    throw new Error('Break minutes cannot be negative.');
  }

  const clockInMs = timestampMillis(clockIn, 'Clock-in');
  const clockOutMs = timestampMillis(clockOut, 'Clock-out');

  if (clockOutMs <= clockInMs) {
    throw new Error('Clock-out must be after clock-in.');
  }

  const intervalMinutes = (clockOutMs - clockInMs) / 60_000;
  if (breakMinutes > intervalMinutes) {
    throw new Error('Break minutes cannot exceed the worked interval.');
  }

  return intervalMinutes - breakMinutes;
}

export function submitTimeEntry(entry: TimeEntry): TimeEntry {
  if (entry.status !== 'draft') {
    throw new Error('Only draft time entries can be submitted.');
  }
  if (!entry.clockIn || !entry.clockOut) {
    throw new Error('Clock-in and clock-out are required before submission.');
  }

  calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes);

  return {
    ...entry,
    status: 'submitted',
    approvedBy: null,
    approvedAt: null,
  };
}

export function approveTimeEntry(
  entry: TimeEntry,
  actorUserId: string,
  approvedAt: string,
): TimeEntry {
  if (entry.status !== 'submitted') {
    throw new Error('Only submitted time entries can be approved.');
  }

  const actor = actorUserId.trim();
  if (!actor) throw new Error('Approval actor is required.');
  timestampMillis(approvedAt, 'Approval timestamp');

  return {
    ...entry,
    status: 'approved',
    approvedBy: actor,
    approvedAt,
  };
}

export function rejectTimeEntry(entry: TimeEntry): TimeEntry {
  if (entry.status !== 'submitted') {
    throw new Error('Only submitted time entries can be rejected.');
  }

  return {
    ...entry,
    status: 'rejected',
    approvedBy: null,
    approvedAt: null,
  };
}
