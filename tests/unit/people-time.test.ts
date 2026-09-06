import { describe, expect, it } from 'vitest';
import {
  approveTimeEntry,
  calculateWorkedMinutes,
  rejectTimeEntry,
  submitTimeEntry,
  type TimeEntry,
} from '../../packages/people/src';

const draftEntry: TimeEntry = {
  id: 'time-1',
  organizationId: 'org-a',
  employeeId: 'employee-a',
  workDate: '2026-09-06',
  clockIn: '2026-09-06T09:00:00Z',
  clockOut: '2026-09-06T17:30:00Z',
  breakMinutes: 30,
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  createdAt: '2026-09-06T09:00:00Z',
  updatedAt: '2026-09-06T17:30:00Z',
};

describe('ATLAS People time and attendance', () => {
  it('calculates worked minutes after break time', () => {
    expect(
      calculateWorkedMinutes('2026-09-06T09:00:00Z', '2026-09-06T17:30:00Z', 30),
    ).toBe(480);
  });

  it('rejects impossible or negative worked-time inputs', () => {
    expect(() =>
      calculateWorkedMinutes('2026-09-06T17:00:00Z', '2026-09-06T09:00:00Z', 0),
    ).toThrow('Clock-out must be after clock-in.');

    expect(() =>
      calculateWorkedMinutes('2026-09-06T09:00:00Z', '2026-09-06T10:00:00Z', 61),
    ).toThrow('Break minutes cannot exceed the worked interval.');

    expect(() =>
      calculateWorkedMinutes('2026-09-06T09:00:00Z', '2026-09-06T10:00:00Z', -1),
    ).toThrow('Break minutes cannot be negative.');
  });

  it('submits only complete draft entries', () => {
    expect(submitTimeEntry(draftEntry)).toMatchObject({ status: 'submitted' });

    expect(() => submitTimeEntry({ ...draftEntry, status: 'approved' })).toThrow(
      'Only draft time entries can be submitted.',
    );
    expect(() => submitTimeEntry({ ...draftEntry, clockOut: null })).toThrow(
      'Clock-in and clock-out are required before submission.',
    );
  });

  it('records approval evidence only from a submitted entry', () => {
    const submitted = submitTimeEntry(draftEntry);
    const approved = approveTimeEntry(submitted, 'manager-a', '2026-09-07T12:00:00Z');

    expect(approved).toMatchObject({
      status: 'approved',
      approvedBy: 'manager-a',
      approvedAt: '2026-09-07T12:00:00Z',
    });
    expect(() => approveTimeEntry(draftEntry, 'manager-a', '2026-09-07T12:00:00Z')).toThrow(
      'Only submitted time entries can be approved.',
    );
  });

  it('rejects only submitted entries and clears approval evidence', () => {
    const submitted = submitTimeEntry(draftEntry);
    const rejected = rejectTimeEntry(submitted);

    expect(rejected).toMatchObject({ status: 'rejected', approvedBy: null, approvedAt: null });
    expect(() => rejectTimeEntry(draftEntry)).toThrow(
      'Only submitted time entries can be rejected.',
    );
  });
});
