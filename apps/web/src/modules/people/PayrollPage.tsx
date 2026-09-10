import { useMemo, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import {
  calculatePayrollLine,
  selectCompensation,
  type PayrollCalculation,
  type PayrollCalculationInput,
  type PayrollLine,
  type PayrollRun,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useCompensationRepository } from './CompensationDataProvider';
import { usePeoplePayrollData, usePeopleRefresh } from './PeopleDataProvider';
import { usePeoplePayrollWriteService } from './PeoplePayrollWriteProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type PayrollRunDraft = {
  periodStart: string;
  periodEnd: string;
  payDate: string;
};

type PayrollLineDraft = {
  employeeId: string;
  payType: 'hourly' | 'salary';
  regularHours: string;
  overtimeHours: string;
  hourlyRate: string;
  overtimeMultiplier: string;
  salaryPeriodAmount: string;
  pretaxDeductions: string;
  taxesWithheld: string;
  posttaxDeductions: string;
  compensationNote: string | null;
  compensationLoading: boolean;
};

const EMPTY_RUN_DRAFT: PayrollRunDraft = {
  periodStart: '',
  periodEnd: '',
  payDate: '',
};

function emptyLineDraft(): PayrollLineDraft {
  return {
    employeeId: '',
    payType: 'hourly',
    regularHours: '',
    overtimeHours: '',
    hourlyRate: '',
    overtimeMultiplier: '1.5',
    salaryPeriodAmount: '',
    pretaxDeductions: '',
    taxesWithheld: '',
    posttaxDeductions: '',
    compensationNote: null,
    compensationLoading: false,
  };
}

function numberOrZero(value: string, label: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative number.`);
  return parsed;
}

function requiredNumber(value: string, label: string): number {
  if (!value.trim()) throw new Error(`${label} is required.`);
  return numberOrZero(value, label);
}

function calculationInputFromDraft(draft: PayrollLineDraft): PayrollCalculationInput {
  const hourly = draft.payType === 'hourly';
  return {
    regularHours: hourly ? numberOrZero(draft.regularHours, 'Regular hours') : 0,
    overtimeHours: hourly ? numberOrZero(draft.overtimeHours, 'Overtime hours') : 0,
    hourlyRate: hourly ? requiredNumber(draft.hourlyRate, 'Hourly rate') : null,
    overtimeMultiplier: hourly ? requiredNumber(draft.overtimeMultiplier, 'Overtime multiplier') : 1.5,
    salaryPeriodAmount: hourly ? null : requiredNumber(draft.salaryPeriodAmount, 'Salary period amount'),
    pretaxDeductions: numberOrZero(draft.pretaxDeductions, 'Pretax deductions'),
    taxesWithheld: numberOrZero(draft.taxesWithheld, 'Taxes withheld'),
    posttaxDeductions: numberOrZero(draft.posttaxDeductions, 'Posttax deductions'),
  };
}

function previewDraft(draft: PayrollLineDraft): { calculation: PayrollCalculation | null; error: string | null } {
  if (!draft.employeeId) return { calculation: null, error: null };
  try {
    return { calculation: calculatePayrollLine(calculationInputFromDraft(draft)), error: null };
  } catch (error) {
    return {
      calculation: null,
      error: error instanceof Error ? error.message : 'Payroll inputs are invalid.',
    };
  }
}

function persistedOvertimeMultiplier(line: PayrollLine): number {
  if (!line.calculation || typeof line.calculation !== 'object') return 1.5;
  const value = (line.calculation as Record<string, unknown>).overtime_multiplier;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 1.5;
}

function lineDraftFromPersisted(line: PayrollLine): PayrollLineDraft {
  const payType = line.hourlyRate !== null ? 'hourly' : 'salary';
  return {
    employeeId: line.employeeId,
    payType,
    regularHours: payType === 'hourly' ? String(line.regularHours) : '0',
    overtimeHours: payType === 'hourly' ? String(line.overtimeHours) : '0',
    hourlyRate: line.hourlyRate === null ? '' : String(line.hourlyRate),
    overtimeMultiplier: String(persistedOvertimeMultiplier(line)),
    salaryPeriodAmount: line.salaryPeriodAmount === null ? '' : String(line.salaryPeriodAmount),
    pretaxDeductions: String(line.pretaxDeductions),
    taxesWithheld: String(line.taxesWithheld),
    posttaxDeductions: String(line.posttaxDeductions),
    compensationNote: 'Existing persisted payroll line loaded.',
    compensationLoading: false,
  };
}

export function PayrollPage() {
  const identity = useAtlasContext();
  const state = usePeoplePayrollData();
  const writeService = usePeoplePayrollWriteService();
  const compensationRepository = useCompensationRepository();
  const refresh = usePeopleRefresh();
  const [writeState, setWriteState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'success'; message: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [voidReasons, setVoidReasons] = useState<Record<string, string>>({});
  const [runDraft, setRunDraft] = useState<PayrollRunDraft>(EMPTY_RUN_DRAFT);
  const [lineDrafts, setLineDrafts] = useState<Record<string, PayrollLineDraft>>({});

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
    const result = new Map<string, PayrollLine[]>();
    if (state.status !== 'ready') return result;
    for (const run of state.payrollRuns) result.set(run.id, []);
    for (const line of state.payrollLines) {
      const lines = result.get(line.payrollRunId) ?? [];
      lines.push(line);
      result.set(line.payrollRunId, lines);
    }
    return result;
  }, [state]);

  if (!readyIdentity) return null;

  function updateLineDraft(runId: string, update: (current: PayrollLineDraft) => PayrollLineDraft) {
    setLineDrafts((current) => ({
      ...current,
      [runId]: update(current[runId] ?? emptyLineDraft()),
    }));
  }

  async function runWrite(action: () => Promise<string>, successMessage: string): Promise<boolean> {
    setWriteState({ status: 'saving' });
    try {
      await action();
      setWriteState({ status: 'success', message: successMessage });
      refresh();
      return true;
    } catch (error) {
      setWriteState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Payroll write failed',
      });
      return false;
    }
  }

  async function createPayrollRun() {
    if (!writeService || !canWrite) return;
    const saved = await runWrite(
      () => writeService.createPayrollRun({
        organizationId: readyIdentity.organizationId,
        periodStart: runDraft.periodStart,
        periodEnd: runDraft.periodEnd,
        payDate: runDraft.payDate,
      }),
      'Payroll run created',
    );
    if (saved) setRunDraft(EMPTY_RUN_DRAFT);
  }

  async function selectPayrollEmployee(run: PayrollRun, employeeId: string) {
    if (!employeeId) {
      setLineDrafts((current) => ({ ...current, [run.id]: emptyLineDraft() }));
      return;
    }

    const existingLine = (linesByRun.get(run.id) ?? []).find((line) => line.employeeId === employeeId);
    if (existingLine) {
      setLineDrafts((current) => ({ ...current, [run.id]: lineDraftFromPersisted(existingLine) }));
      return;
    }

    updateLineDraft(run.id, () => ({
      ...emptyLineDraft(),
      employeeId,
      compensationLoading: Boolean(compensationRepository),
      compensationNote: compensationRepository ? 'Loading compensation…' : 'No configured compensation repository; enter verified pay values.',
    }));

    if (!compensationRepository) return;

    try {
      const history = await compensationRepository.listCompensation(readyIdentity.organizationId, employeeId);
      const compensation = selectCompensation(history, run.periodEnd);

      setLineDrafts((current) => {
        const draft = current[run.id] ?? emptyLineDraft();
        if (draft.employeeId !== employeeId) return current;

        if (!compensation) {
          return {
            ...current,
            [run.id]: {
              ...draft,
              compensationLoading: false,
              compensationNote: `No compensation record is effective on ${run.periodEnd}; enter verified pay values.`,
            },
          };
        }

        if (compensation.payType === 'hourly') {
          return {
            ...current,
            [run.id]: {
              ...draft,
              payType: 'hourly',
              hourlyRate: compensation.hourlyRate === null ? '' : String(compensation.hourlyRate),
              salaryPeriodAmount: '',
              compensationLoading: false,
              compensationNote: `Rate loaded from compensation effective on ${run.periodEnd}.`,
            },
          };
        }

        return {
          ...current,
          [run.id]: {
            ...draft,
            payType: 'salary',
            regularHours: '0',
            overtimeHours: '0',
            hourlyRate: '',
            salaryPeriodAmount: '',
            compensationLoading: false,
            compensationNote: compensation.annualSalary === null
              ? `Salary compensation is effective on ${run.periodEnd}, but no annual salary value is available.`
              : `Annual salary on file: ${currency.format(compensation.annualSalary)}. Enter the verified amount for this payroll period; ATLAS does not infer payroll frequency.`,
          },
        };
      });
    } catch (error) {
      setLineDrafts((current) => {
        const draft = current[run.id] ?? emptyLineDraft();
        if (draft.employeeId !== employeeId) return current;
        return {
          ...current,
          [run.id]: {
            ...draft,
            compensationLoading: false,
            compensationNote: error instanceof Error ? error.message : 'Compensation could not be loaded.',
          },
        };
      });
    }
  }

  async function savePayrollLine(run: PayrollRun) {
    if (!writeService || !canWrite) return;
    const draft = lineDrafts[run.id] ?? emptyLineDraft();
    if (!draft.employeeId) {
      setWriteState({ status: 'error', message: 'Employee is required.' });
      return;
    }

    let calculationInput: PayrollCalculationInput;
    try {
      calculationInput = calculationInputFromDraft(draft);
      calculatePayrollLine(calculationInput);
    } catch (error) {
      setWriteState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Payroll inputs are invalid.',
      });
      return;
    }

    await runWrite(
      () => writeService.savePayrollLine({
        organizationId: readyIdentity.organizationId,
        payrollRunId: run.id,
        employeeId: draft.employeeId,
        calculationInput,
      }),
      'Payroll line saved',
    );
  }

  function lifecycleActions(run: PayrollRun, lineCount: number) {
    if (!writeService) return null;

    return (
      <div className="atlas-action-row">
        {canWrite && run.status === 'draft' && (
          <button
            type="button"
            aria-label={`Calculate payroll ${run.id}`}
            disabled={writeState.status === 'saving' || lineCount === 0}
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

  function payrollLineEditor(run: PayrollRun, lines: PayrollLine[]) {
    if (!canWrite || run.status !== 'draft') return null;
    const draft = lineDrafts[run.id] ?? emptyLineDraft();
    const preview = previewDraft(draft);

    return (
      <section className="atlas-status-panel" aria-label={`Payroll line editor ${run.id}`}>
        <strong>Payroll line</strong>
        <span>Select an employee to add or update this draft run. Persisted lines are upserted; calculated runs are read-only.</span>
        <div className="atlas-filter-grid">
          <label>
            Employee
            <select
              aria-label={`Payroll line employee ${run.id}`}
              value={draft.employeeId}
              disabled={writeState.status === 'saving'}
              onChange={(event) => void selectPayrollEmployee(run, event.target.value)}
            >
              <option value="">Select employee</option>
              {state.status === 'ready' && state.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}{employee.status === 'active' ? '' : ` (${employee.status})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pay type
            <select
              aria-label={`Pay type ${run.id}`}
              value={draft.payType}
              disabled={!draft.employeeId || writeState.status === 'saving'}
              onChange={(event) => updateLineDraft(run.id, (current) => {
                const payType = event.target.value as 'hourly' | 'salary';
                return payType === 'salary'
                  ? { ...current, payType, regularHours: '0', overtimeHours: '0', hourlyRate: '' }
                  : { ...current, payType, salaryPeriodAmount: '' };
              })}
            >
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
            </select>
          </label>
          {draft.payType === 'hourly' ? (
            <>
              <label>
                Regular hours
                <input
                  aria-label={`Regular hours ${run.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.regularHours}
                  onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, regularHours: event.target.value }))}
                />
              </label>
              <label>
                Overtime hours
                <input
                  aria-label={`Overtime hours ${run.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.overtimeHours}
                  onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, overtimeHours: event.target.value }))}
                />
              </label>
              <label>
                Hourly rate
                <input
                  aria-label={`Hourly rate ${run.id}`}
                  type="number"
                  min="0"
                  step="0.0001"
                  value={draft.hourlyRate}
                  onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, hourlyRate: event.target.value }))}
                />
              </label>
              <label>
                Overtime multiplier
                <input
                  aria-label={`Overtime multiplier ${run.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.overtimeMultiplier}
                  onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, overtimeMultiplier: event.target.value }))}
                />
              </label>
            </>
          ) : (
            <label>
              Salary period amount
              <input
                aria-label={`Salary period amount ${run.id}`}
                type="number"
                min="0"
                step="0.01"
                value={draft.salaryPeriodAmount}
                onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, salaryPeriodAmount: event.target.value }))}
              />
            </label>
          )}
          <label>
            Pretax deductions
            <input
              aria-label={`Pretax deductions ${run.id}`}
              type="number"
              min="0"
              step="0.01"
              value={draft.pretaxDeductions}
              onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, pretaxDeductions: event.target.value }))}
            />
          </label>
          <label>
            Taxes withheld
            <input
              aria-label={`Taxes withheld ${run.id}`}
              type="number"
              min="0"
              step="0.01"
              value={draft.taxesWithheld}
              onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, taxesWithheld: event.target.value }))}
            />
          </label>
          <label>
            Posttax deductions
            <input
              aria-label={`Posttax deductions ${run.id}`}
              type="number"
              min="0"
              step="0.01"
              value={draft.posttaxDeductions}
              onChange={(event) => updateLineDraft(run.id, (current) => ({ ...current, posttaxDeductions: event.target.value }))}
            />
          </label>
        </div>

        {draft.compensationLoading && <span role="status">Loading compensation…</span>}
        {draft.compensationNote && !draft.compensationLoading && <span>{draft.compensationNote}</span>}
        {preview.calculation && (
          <span>
            Preview: gross {currency.format(preview.calculation.grossPay)} · net {currency.format(preview.calculation.netPay)}
          </span>
        )}
        {preview.error && draft.employeeId && <span>{preview.error}</span>}
        {draft.employeeId && lines.some((line) => line.employeeId === draft.employeeId) && (
          <span>This employee already has a persisted line in the run; Save will update it.</span>
        )}

        <div className="atlas-action-row">
          <button
            type="button"
            aria-label={`Save payroll line ${run.id}`}
            disabled={writeState.status === 'saving' || !draft.employeeId || Boolean(preview.error) || !preview.calculation}
            onClick={() => void savePayrollLine(run)}
          >Save payroll line</button>
        </div>
      </section>
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

      {state.status === 'ready' && canWrite && (
        <section className="atlas-status-panel" aria-label="Create payroll run form">
          <strong>Create payroll run</strong>
          <span>Create the organization pay period first, then add employee payroll lines while the run is draft.</span>
          <div className="atlas-filter-grid">
            <label>
              Period start
              <input
                aria-label="Payroll period start"
                type="date"
                value={runDraft.periodStart}
                onChange={(event) => setRunDraft((current) => ({ ...current, periodStart: event.target.value }))}
              />
            </label>
            <label>
              Period end
              <input
                aria-label="Payroll period end"
                type="date"
                value={runDraft.periodEnd}
                onChange={(event) => setRunDraft((current) => ({ ...current, periodEnd: event.target.value }))}
              />
            </label>
            <label>
              Pay date
              <input
                aria-label="Payroll pay date"
                type="date"
                value={runDraft.payDate}
                onChange={(event) => setRunDraft((current) => ({ ...current, payDate: event.target.value }))}
              />
            </label>
          </div>
          <div className="atlas-action-row">
            <button
              type="button"
              aria-label="Create payroll run"
              disabled={writeState.status === 'saving' || !runDraft.periodStart || !runDraft.periodEnd || !runDraft.payDate}
              onClick={() => void createPayrollRun()}
            >Create payroll run</button>
          </div>
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

            {payrollLineEditor(run, lines)}
            {canWrite && run.status === 'draft' && lines.length === 0 && (
              <span>Add at least one payroll line before calculating this run.</span>
            )}
            {lifecycleActions(run, lines.length)}
          </section>
        );
      })}
    </main>
  );
}
