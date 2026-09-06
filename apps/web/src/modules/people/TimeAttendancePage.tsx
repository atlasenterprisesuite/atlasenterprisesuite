import { useMemo, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import {
  calculateWorkedMinutes,
  type TimeEntry,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { usePeopleRefresh, usePeopleTimeData } from './PeopleDataProvider';
import { usePeopleTimeWriteService } from './PeopleTimeWriteProvider';

function workedHours(entry: TimeEntry): string {
  if (!entry.clockIn || !entry.clockOut) return '—';
  try {
    return `${(calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes) / 60).toFixed(2)} h`;
  } catch {
    return 'Invalid';
  }
}

function isoFromLocal(value: string, label: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is required`);
  return parsed.toISOString();
}

export function TimeAttendancePage() {
  const identity = useAtlasContext();
  const state = usePeopleTimeData();
  const writeService = usePeopleTimeWriteService();
  const refresh = usePeopleRefresh();
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [workDate, setWorkDate] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [writeState, setWriteState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'success'; message: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const readyIdentity = identity.status === 'ready' ? identity : null;
  const canManage = readyIdentity
    ? hasPermission(readyIdentity.permissions, 'hr.write')
    : false;
  const ownEmployee = readyIdentity && state.status === 'ready'
    ? state.employees.find((employee) => employee.userId === readyIdentity.userId) ?? null
    : null;
  const canCreate = Boolean(writeService && (canManage || ownEmployee));

  const visibleEntries = useMemo(() => {
    if (state.status !== 'ready') return [];
    return state.timeEntries
      .filter((entry) => statusFilter === 'all' || entry.status === statusFilter)
      .filter((entry) => employeeFilter === 'all' || entry.employeeId === employeeFilter)
      .filter((entry) => !dateFrom || entry.workDate >= dateFrom)
      .filter((entry) => !dateTo || entry.workDate <= dateTo)
      .sort((a, b) => b.workDate.localeCompare(a.workDate));
  }, [state, statusFilter, employeeFilter, dateFrom, dateTo]);

  const employeeById = useMemo(() => {
    const map = new Map<string, string>();
    if (state.status === 'ready') {
      for (const employee of state.employees) map.set(employee.id, employee.fullName);
    }
    return map;
  }, [state]);

  if (!readyIdentity) return null;

  async function runWrite(action: () => Promise<string>, successMessage: string) {
    setWriteState({ status: 'saving' });
    try {
      await action();
      setWriteState({ status: 'success', message: successMessage });
      refresh();
    } catch (error) {
      setWriteState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Time entry write failed',
      });
    }
  }

  async function createEntry() {
    if (!writeService || state.status !== 'ready') return;
    const employeeId = canManage
      ? selectedEmployeeId || state.employees[0]?.id || ''
      : ownEmployee?.id ?? '';

    await runWrite(
      () => writeService.createTimeEntry({
        organizationId: readyIdentity.organizationId,
        employeeId,
        workDate,
        clockIn: isoFromLocal(clockIn, 'Clock-in'),
        clockOut: isoFromLocal(clockOut, 'Clock-out'),
        breakMinutes: Number(breakMinutes),
      }),
      'Time entry created',
    );
    setShowCreate(false);
  }

  function maySubmit(entry: TimeEntry): boolean {
    if (!writeService || entry.status !== 'draft') return false;
    if (canManage) return true;
    return state.status === 'ready'
      && state.employees.some((employee) => employee.id === entry.employeeId && employee.userId === readyIdentity.userId);
  }

  return (
    <main className="atlas-page atlas-module-page people-time-page">
      <p className="atlas-eyebrow">ATLAS People / Time &amp; Attendance</p>
      <h1>Time &amp; Attendance</h1>
      <p className="atlas-page__lede">
        Time records are organization-scoped. Worked hours are derived from persisted clock-in, clock-out, and break values; approvals are executed only through governed RPCs.
      </p>

      {writeState.status === 'success' && (
        <section className="atlas-status-panel" role="status">
          <strong>{writeState.message}</strong>
          <span>Refreshing authorized People records.</span>
        </section>
      )}
      {writeState.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Time entry write rejected</strong>
          <span>{writeState.message}</span>
        </section>
      )}

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading time records</strong>
          <span>Reading authorized employee and attendance data.</span>
        </section>
      )}
      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>People connection unavailable</strong>
          <span>No configured real People repository is available.</span>
        </section>
      )}
      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Time data unavailable</strong>
          <span>{state.message}</span>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <section className="atlas-status-panel" aria-label="Time filters">
            <strong>Filters</strong>
            <div className="atlas-filter-grid">
              {canManage && (
                <label>
                  Employee
                  <select
                    aria-label="Employee filter"
                    value={employeeFilter}
                    onChange={(event) => setEmployeeFilter(event.target.value)}
                  >
                    <option value="all">All employees</option>
                    {state.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Status
                <select
                  aria-label="Status filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>
                From
                <input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label>
                To
                <input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
            </div>
          </section>

          {canCreate && !showCreate && (
            <button type="button" onClick={() => setShowCreate(true)}>New time entry</button>
          )}

          {canCreate && showCreate && (
            <section className="atlas-status-panel" aria-label="New time entry form">
              <strong>New time entry</strong>
              <div className="atlas-filter-grid">
                {canManage && (
                  <label>
                    Employee
                    <select
                      aria-label="Time entry employee"
                      value={selectedEmployeeId || state.employees[0]?.id || ''}
                      onChange={(event) => setSelectedEmployeeId(event.target.value)}
                    >
                      {state.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>Work date<input aria-label="Work date" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></label>
                <label>Clock-in<input aria-label="Clock-in" type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} /></label>
                <label>Clock-out<input aria-label="Clock-out" type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} /></label>
                <label>Break minutes<input aria-label="Break minutes" type="number" min="0" step="1" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} /></label>
              </div>
              <div className="atlas-action-row">
                <button type="button" disabled={writeState.status === 'saving'} onClick={() => void createEntry()}>Save time entry</button>
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </section>
          )}

          {visibleEntries.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Time entries empty state">
              <strong>No time entries</strong>
              <span>No authorized records match the selected filters.</span>
            </section>
          ) : (
            <section className="atlas-status-panel" aria-label="Time entries">
              <strong>Time entries</strong>
              <div className="atlas-table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Employee</th><th>Worked</th><th>Status</th><th>Approval</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.workDate}</td>
                        <td>{employeeById.get(entry.employeeId) ?? 'Unknown employee'}</td>
                        <td>{workedHours(entry)}</td>
                        <td>{entry.status}</td>
                        <td>{entry.approvedAt ? `${entry.approvedAt} · ${entry.approvedBy ?? 'unknown'}` : '—'}</td>
                        <td>
                          <div className="atlas-action-row">
                            {maySubmit(entry) && (
                              <button
                                type="button"
                                aria-label={`Submit time entry ${entry.id}`}
                                disabled={writeState.status === 'saving'}
                                onClick={() => void runWrite(
                                  () => writeService!.submitTimeEntry({ organizationId: readyIdentity.organizationId, timeEntryId: entry.id }),
                                  'Time entry submitted',
                                )}
                              >Submit</button>
                            )}
                            {canManage && writeService && entry.status === 'submitted' && (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Approve time entry ${entry.id}`}
                                  disabled={writeState.status === 'saving'}
                                  onClick={() => void runWrite(
                                    () => writeService.approveTimeEntry({ organizationId: readyIdentity.organizationId, timeEntryId: entry.id }),
                                    'Time entry approved',
                                  )}
                                >Approve</button>
                                <button
                                  type="button"
                                  aria-label={`Reject time entry ${entry.id}`}
                                  disabled={writeState.status === 'saving'}
                                  onClick={() => void runWrite(
                                    () => writeService.rejectTimeEntry({ organizationId: readyIdentity.organizationId, timeEntryId: entry.id }),
                                    'Time entry rejected',
                                  )}
                                >Reject</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
