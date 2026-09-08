import { useEffect, useMemo, useState } from 'react';
import {
  calculateWorkedMinutes,
  selectCompensation,
  type CompensationRecord,
  type DeductionRecord,
  type EmployeeRecord,
  type PayrollLine,
  type TimeEntry,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useCompensationRepository } from './CompensationDataProvider';
import { usePeopleRepository } from './PeopleDataProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type SelfServiceState =
  | { status: 'loading' }
  | { status: 'connection_unavailable' }
  | { status: 'employee_missing' }
  | {
      status: 'ready';
      employee: EmployeeRecord;
      timeEntries: TimeEntry[];
      payrollLines: PayrollLine[];
      compensation: CompensationRecord[];
      deductions: DeductionRecord[];
    }
  | { status: 'error'; message: string };

function workedHours(entry: TimeEntry): string {
  if (!entry.clockIn || !entry.clockOut) return '—';
  try {
    return `${(calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes) / 60).toFixed(2)} h`;
  } catch {
    return 'Invalid';
  }
}

function localDateOnly(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function SelfServicePage() {
  const identity = useAtlasContext();
  const peopleRepository = usePeopleRepository();
  const compensationRepository = useCompensationRepository();
  const [state, setState] = useState<SelfServiceState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    if (identity.status !== 'ready') return () => { active = false; };
    if (!peopleRepository || !compensationRepository) {
      setState({ status: 'connection_unavailable' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    void peopleRepository.listEmployees(identity.organizationId)
      .then(async (employees) => {
        if (!active) return;
        const employee = employees.find((item) => item.userId === identity.userId) ?? null;
        if (!employee) {
          setState({ status: 'employee_missing' });
          return;
        }

        const [timeEntries, payrollLines, compensation, deductions] = await Promise.all([
          peopleRepository.listTimeEntries(identity.organizationId, employee.id),
          peopleRepository.listPayrollLines(identity.organizationId),
          compensationRepository.listCompensation(identity.organizationId, employee.id),
          compensationRepository.listDeductions(identity.organizationId, employee.id),
        ]);

        if (!active) return;
        setState({
          status: 'ready',
          employee,
          timeEntries: timeEntries.filter((item) => item.employeeId === employee.id),
          payrollLines: payrollLines.filter((item) => item.employeeId === employee.id),
          compensation: compensation.filter((item) => item.employeeId === employee.id),
          deductions: deductions.filter((item) => item.employeeId === employee.id),
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Employee self-service data could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [identity, peopleRepository, compensationRepository]);

  const currentCompensation = useMemo(() => {
    if (state.status !== 'ready') return null;
    return selectCompensation(state.compensation, localDateOnly());
  }, [state]);

  if (identity.status !== 'ready') return null;

  return (
    <main className="atlas-page atlas-module-page people-self-service-page">
      <p className="atlas-eyebrow">ATLAS People / Self-Service</p>
      <h1>Employee Self-Service</h1>
      <p className="atlas-page__lede">
        This view is read-only and is resolved from the employee record linked to the authenticated ATLAS identity. Database RLS remains the primary access boundary.
      </p>

      {state.status === 'loading' && (
        <section className="atlas-status-panel" role="status"><strong>Loading your People records</strong><span>Resolving the employee linked to this identity.</span></section>
      )}
      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status"><strong>Self-service connection unavailable</strong><span>People or Compensation repositories are not configured.</span></section>
      )}
      {state.status === 'employee_missing' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status"><strong>Employee record required</strong><span>No employee record is linked to this authenticated user in the current organization.</span></section>
      )}
      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Self-service data unavailable</strong><span>{state.message}</span></section>
      )}

      {state.status === 'ready' && (
        <>
          <section className="atlas-status-panel" aria-label="Employee profile">
            <strong>{state.employee.fullName}</strong>
            <span>{state.employee.jobTitle ?? 'Job title not configured'}{state.employee.department ? ` · ${state.employee.department}` : ''}</span>
            <span>Status: {state.employee.status}</span>
          </section>

          <section className="atlas-status-panel" aria-label="Employee compensation">
            <strong>Compensation</strong>
            {!currentCompensation ? (
              <span>No effective compensation record is available for today.</span>
            ) : currentCompensation.payType === 'hourly' ? (
              <span>{currency.format(currentCompensation.hourlyRate ?? 0)} / hour</span>
            ) : (
              <span>{currency.format(currentCompensation.annualSalary ?? 0)} / year</span>
            )}
          </section>

          <section className="atlas-status-panel" aria-label="Employee deductions">
            <strong>Benefits &amp; deductions</strong>
            {state.deductions.filter((item) => item.active).length === 0 ? (
              <span>No active deductions are recorded.</span>
            ) : state.deductions.filter((item) => item.active).map((item) => (
              <span key={item.id}>{item.label} · {item.treatment} · {item.calculationType === 'fixed' ? currency.format(item.amount) : `${(item.amount * 100).toFixed(2)}%`}</span>
            ))}
            <span>Benefits provider enrollment: Not configured</span>
          </section>

          <section className="atlas-status-panel" aria-label="Employee payroll statements">
            <strong>Payroll statements</strong>
            {state.payrollLines.length === 0 ? (
              <span>No payroll lines are available to this employee.</span>
            ) : state.payrollLines.map((line) => (
              <span key={line.id}>Gross {currency.format(line.grossPay)} · Net {currency.format(line.netPay)}</span>
            ))}
          </section>

          <section className="atlas-status-panel" aria-label="Employee time entries">
            <strong>Time &amp; attendance</strong>
            {state.timeEntries.length === 0 ? (
              <span>No time entries are available to this employee.</span>
            ) : state.timeEntries.map((entry) => (
              <span key={entry.id}>{entry.workDate} · {workedHours(entry)} · {entry.status}</span>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
