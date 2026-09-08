import { describe, expect, it, vi } from 'vitest';
import {
  PeopleTimeWriteService,
  type ApproveTimeEntryCommand,
  type CreateTimeEntryCommand,
  type PeopleTimeWriteGateway,
  type RejectTimeEntryCommand,
  type SubmitTimeEntryCommand,
} from '../../packages/people/src';

function gatewayFixture(): PeopleTimeWriteGateway & {
  createTimeEntry: ReturnType<typeof vi.fn>;
  submitTimeEntry: ReturnType<typeof vi.fn>;
  approveTimeEntry: ReturnType<typeof vi.fn>;
  rejectTimeEntry: ReturnType<typeof vi.fn>;
} {
  return {
    createTimeEntry: vi.fn(async (_command: CreateTimeEntryCommand) => 'time-1'),
    submitTimeEntry: vi.fn(async (_command: SubmitTimeEntryCommand) => 'time-1'),
    approveTimeEntry: vi.fn(async (_command: ApproveTimeEntryCommand) => 'time-1'),
    rejectTimeEntry: vi.fn(async (_command: RejectTimeEntryCommand) => 'time-1'),
  };
}

describe('ATLAS People time write service', () => {
  it('validates and normalizes a new time entry before the gateway runs', async () => {
    const gateway = gatewayFixture();
    const service = new PeopleTimeWriteService(gateway);

    await expect(service.createTimeEntry({
      organizationId: ' org-a ',
      employeeId: ' employee-a ',
      workDate: '2026-09-06',
      clockIn: '2026-09-06T09:00:00Z',
      clockOut: '2026-09-06T17:30:00Z',
      breakMinutes: 30,
    })).resolves.toBe('time-1');

    expect(gateway.createTimeEntry).toHaveBeenCalledWith({
      organizationId: 'org-a',
      employeeId: 'employee-a',
      workDate: '2026-09-06',
      clockIn: '2026-09-06T09:00:00Z',
      clockOut: '2026-09-06T17:30:00Z',
      breakMinutes: 30,
    });
  });

  it('rejects impossible time entries before the gateway runs', async () => {
    const gateway = gatewayFixture();
    const service = new PeopleTimeWriteService(gateway);

    await expect(service.createTimeEntry({
      organizationId: 'org-a',
      employeeId: 'employee-a',
      workDate: '2026-09-06',
      clockIn: '2026-09-06T17:00:00Z',
      clockOut: '2026-09-06T09:00:00Z',
      breakMinutes: 0,
    })).rejects.toThrow('Clock-out must be after clock-in.');

    expect(gateway.createTimeEntry).not.toHaveBeenCalled();
  });

  it('requires scoped record ids for submit, approve, and reject', async () => {
    const gateway = gatewayFixture();
    const service = new PeopleTimeWriteService(gateway);

    await expect(service.submitTimeEntry({ organizationId: ' ', timeEntryId: 'time-1' }))
      .rejects.toThrow('Organization is required');
    await expect(service.approveTimeEntry({ organizationId: 'org-a', timeEntryId: ' ' }))
      .rejects.toThrow('Time entry is required');
    await expect(service.rejectTimeEntry({ organizationId: 'org-a', timeEntryId: '' }))
      .rejects.toThrow('Time entry is required');

    expect(gateway.submitTimeEntry).not.toHaveBeenCalled();
    expect(gateway.approveTimeEntry).not.toHaveBeenCalled();
    expect(gateway.rejectTimeEntry).not.toHaveBeenCalled();
  });
});
