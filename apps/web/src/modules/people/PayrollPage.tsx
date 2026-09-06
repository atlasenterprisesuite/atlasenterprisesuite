import { useMemo, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import type { PayrollRun } from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { usePeoplePayrollData, usePeopleRefresh } from './PeopleDataProvider';
import { usePeoplePayrollWriteService } from './PeoplePayrollWriteProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function PayrollPage() {
  const identity = useAtlasContext();
  const state = usePeoplePayrollData();
  const writeService = usePeoplePayrollWriteService();
  const refresh = usePeopleRefresh();
  const [writeState, setWriteState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'success'; message: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [voidReasons, setVoidReasons] = useState<Record<string, string>>({});

  const readyIdentity = identity.status === 'ready' ? identity : null;
  const canWrite = Boolean(readyIdentity && writeService && hasPermission(readyIdentity.permissions, 'payroll.write'));
  const canApprove = Boolean(readyIdentity && writeService && hasPermission(readyIdentity.permissions, 'payroll.approve'));

  const employeeById = useMemo(() => {
    const map = new Map<string, string>();
    if (state.status === 'ready') {
      for (const employee of state.employees) map.set(employee.id, employee.fullName);
    }
    return map;
  }, [state]);

  const linesByRun = useMemo(() => {
    const map = new Map<string, typeof state extends { status: 'ready'; payrollLines: infer T } ? T : never>();
    if (state.status !== 'ready') return new Map<string, typeof state.payrollLines>();
    const result = new Map<string, typeof state.payrollLines>();
    for (const run of state.payrollRuns) result.set(run.id, []);
    for (const line of state.payrollLines) {
      const lines = result.get(line.payrollRunId) ?? [];
      lines.push(line);
      result.set(line.payrollRunId, lines);
    }
    return result;
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
        message: error instanceof Error ? error.message : 'Payroll write failed',
      });
    }
  }

  function lifecycleActions(run: PayrollRun) {
    if (!writeService) return null;

    return (
      <div className="atlas-action-row">
        {canWrite && run.status === 'draft' && (
          <button
            type="button"
            aria-label={`Calculate payroll ${run.id}`}
            disabled={writeState.status === 'saving'}
            onClick={() => void runWrite(
              () => writeService.calculatePayrollRun({ organizationId: readyIdentity.organizationId, payrollRunId: run.id }),
              'Payroll calculated',
            )}
          >Calculate</button>
        )}
        {canApprove && run.status === 'calculated' && (
          <button
            type="button"
            aria-label={`Approve payroll ${run.id}`}
            disabled={writeState.status === 'saving'}
            onClick={() => void runWrite(
              () => writeService.approvePayrollRun({ organizationId: readyIdentity.organizationId, payrollRunId: run.id }),
              'Payroll approved',
            )}
          >Approve</button>
        )}
        {canApprove && run.status === 'approved' && (
          <button
            type="button"
            aria-label={`Lock payroll ${run.id}`}
            disabled={writeState.status === 'saving'}
            onClick={() => void runWrite(
              () => writeService.lockPayrollRun({ organizationId: readyIdentity.organizationId, payrollRunId: run.id }),
              'Payroll locked',
            )}
          >Lock</button>
        )}
        {canApprove && !['locked', 'void'].includes(run.status) && (
          <>
            <input
              aria-label={`Void reason ${run.id}`}
              placeholder="Void reason"
              value={voidReasons[run.id] ?? ''}
              onChange={(event) => setVoidReasons((current) => ({ ...current, [run.id]: event.target.value }))}
            />
            <button
              type="button"
              aria-label={`Void payroll ${run.id}`}
              disabled={writeState.status === 'saving' || !(voidReasons[run.id] ?? '').trim()}
              onClick={() => void runWrite(
                () => writeService.voidPayrollRun({
                  organizationId: readyIdentity.organizationId,
                  payrollRunId: run.id,
                  reason: voidReasons[run.id] ?? '',
                }),
                'Payroll voided',
              )}
            >Void</button>
          </>
        )}
      </div>
    );
  }

  return (
    <main className="atlas-page atlas-module-page people-payroll-page">
      <p className="atlas-eyebrow">ATLAS People / Payroll</p>
      <h1>Payroll</h1>
      <p className="atlas-page__lede">
        Payroll totals are read from governed organization records. ATLAS does not represent tax filing or payment execution as active without authorized provider evidence.
      </p>

      <section className="atlas-status-panel" aria-label="Payroll provider readiness">
        <strong>Provider readiness</strong>
        <span>Tax filing: Not configured</span>
        <span>Payment rail: Not configured</span>
      </section>

      {writeState.status === 'success' && (
        <section className="atlas-status-panel" role="status">
          <strong>{writeState.message}</strong>
          <span>Refreshing authorized payroll records.</span>
        </section>
      )}
      {writeState.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Payroll write rejected</strong>
          <span>{writeState.message}</span>
        </section>
      )}

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading payroll</strong>
          <span>Reading authorized payroll runs and lines.</span>
        </section>
      )}
      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Payroll connection unavailable</strong>
          <span>No configured real People repository is available.</span>
        </section>
      )}
      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Payroll data unavailable</strong>
          <span>{state.message}</span>
        </section>
      )}

      {state.status === 'ready' && state.payrollRuns.length === 0 && (
        <section className="atlas-status-panel" aria-label="Payroll empty state">
          <strong>No payroll runs</strong>
          <span>No authorized payroll runs exist for this organization.</span>
        </section>
      )}

      {state.status === 'ready' && state.payrollRuns.map((run) => {
        const lines = linesByRun.get(run.id) ?? [];
        return (
          <section className="atlas-status-panel" key={run.id} aria-label={`Payroll run ${run.id}`}>
            <strong>{run.periodStart} to {run.periodEnd}</strong>
            <span>Pay date: {run.payDate} · Status: {run.status}</span>
            {run.approvedAt && <span>Approved: {run.approvedAt}</span>}
            {run.voidReason && <span>Void reason: {run.voidReason}</span>}

            {lines.length === 0 ? (
              <span>No payroll lines are persisted for this run.</span>
            ) : (
              <div className="atlas-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th><th>Regular</th><th>OT</th><th>Gross</th><th>Pre-tax</th><th>Taxes</th><th>Post-tax</th><th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td>{employeeById.get(line.employeeId) ?? 'Unknown employee'}</td>
                        <td>{line.regularHours}</td>
                        <td>{line.overtimeHours}</td>
                        <td>{currency.format(line.grossPay)}</td>
                        <td>{currency.format(line.pretaxDeductions)}</td>
                        <td>{currency.format(line.taxesWithheld)}</td>
                        <td>{currency.format(line.posttaxDeductions)}</td>
                        <td>{currency.format(line.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lifecycleActions(run)}
          </section>
        );
      })}
    </main>
  );
}
