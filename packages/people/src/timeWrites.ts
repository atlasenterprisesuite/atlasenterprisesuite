import { calculateWorkedMinutes } from './time';

export type CreateTimeEntryCommand = {
  organizationId: string;
  employeeId: string;
  workDate: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
};

export type SubmitTimeEntryCommand = {
  organizationId: string;
  timeEntryId: string;
};

export type ApproveTimeEntryCommand = SubmitTimeEntryCommand;
export type RejectTimeEntryCommand = SubmitTimeEntryCommand;

export interface PeopleTimeWriteGateway {
  createTimeEntry(command: CreateTimeEntryCommand): Promise<string>;
  submitTimeEntry(command: SubmitTimeEntryCommand): Promise<string>;
  approveTimeEntry(command: ApproveTimeEntryCommand): Promise<string>;
  rejectTimeEntry(command: RejectTimeEntryCommand): Promise<string>;
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function requireDateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error('Work date must be YYYY-MM-DD');
  }
  return value;
}

function requireTimestamp(value: string, label: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp`);
  return value;
}

function requireBreakMinutes(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Break minutes must be a non-negative whole number');
  }
  return value;
}

export class PeopleTimeWriteService {
  constructor(private readonly gateway: PeopleTimeWriteGateway) {}

  async createTimeEntry(command: CreateTimeEntryCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const employeeId = requireText(command.employeeId, 'Employee is required');
    const workDate = requireDateOnly(command.workDate);
    const clockIn = requireTimestamp(command.clockIn, 'Clock-in');
    const clockOut = requireTimestamp(command.clockOut, 'Clock-out');
    const breakMinutes = requireBreakMinutes(command.breakMinutes);

    calculateWorkedMinutes(clockIn, clockOut, breakMinutes);

    return this.gateway.createTimeEntry({
      organizationId,
      employeeId,
      workDate,
      clockIn,
      clockOut,
      breakMinutes,
    });
  }

  async submitTimeEntry(command: SubmitTimeEntryCommand): Promise<string> {
    return this.gateway.submitTimeEntry({
      organizationId: requireText(command.organizationId, 'Organization is required'),
      timeEntryId: requireText(command.timeEntryId, 'Time entry is required'),
    });
  }

  async approveTimeEntry(command: ApproveTimeEntryCommand): Promise<string> {
    return this.gateway.approveTimeEntry({
      organizationId: requireText(command.organizationId, 'Organization is required'),
      timeEntryId: requireText(command.timeEntryId, 'Time entry is required'),
    });
  }

  async rejectTimeEntry(command: RejectTimeEntryCommand): Promise<string> {
    return this.gateway.rejectTimeEntry({
      organizationId: requireText(command.organizationId, 'Organization is required'),
      timeEntryId: requireText(command.timeEntryId, 'Time entry is required'),
    });
  }
}
