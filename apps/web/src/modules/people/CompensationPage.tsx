import { useEffect, useMemo, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import type {
  CompensationRecord,
  DeductionRecord,
  EmployeeRecord,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useCompensationRepository } from './CompensationDataProvider';
import { usePeopleCompensationWriteService } from './PeopleCompensationWriteProvider';
import { usePeopleRepository } from './PeopleDataProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type CompensationPageState =
  | { status: 'loading' }
  | { status: 'connection_unavailable' }
  | { status: 'ready'; employees: EmployeeRecord[]; compensation: CompensationRecord[]; deductions: DeductionRecord[] }
  | { status: 'error'; message: string };

export function CompensationPage() {
  const identity = useAtlasContext();
  const peopleRepository = usePeopleRepository();
  const compensationRepository = useCompensationRepository();
  const writeService = usePeopleCompensationWriteService();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [state, setState] = useState<CompensationPageState>({ status: 'loading' });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');
  const [hourlyRate, setHourlyRate] = useState('');
  const [annualSalary, setAnnualSalary] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [deductionCode, setDeductionCode] = useState('');
  const [deductionLabel, setDeductionLabel] = useState('');
  const [deductionTreatment, setDeductionTreatment] = useState<'pretax' | 'posttax'>('pretax');
  const [deductionType, setDeductionType] = useState<'fixed' | 'percent'>('fixed');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [writeState, setWriteState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'success'; message: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const readyIdentity = identity.status === 'ready' ? identity : null;
  const canWrite = Boolean(
    readyIdentity
      && writeService
      && hasPermission(readyIdentity.permissions, 'payroll.write'),
  );

  useEffect(() => {
    let active = true;
    if (!readyIdentity) return () => { active = false; };
    if (!peopleRepository || !compensationRepository) {
      setState({ status: 'connection_unavailable' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    void Promise.all([
      peopleRepository.listEmployees(readyIdentity.organizationId),
      compensationRepository.listCompensation(readyIdentity.organizationId),
      compensationRepository.listDeductions(readyIdentity.organizationId),
    ])
      .then(([employees, compensation, deductions]) => {
        if (!active) return;
        setState({ status: 'ready', employees, compensation, deductions });
        setSelectedEmployeeId((current) => current || employees[0]?.id || '');
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Compensation data could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [readyIdentity, peopleRepository, compensationRepository, refreshVersion]);

  const selectedEmployee = useMemo(() => {
    if (state.status !== 'ready') return null;
    return state.employees.find((employee) => employee.id === selectedEmployeeId) ?? state.employees[0] ?? null;
  }, [state, selectedEmployeeId]);

  const selectedCompensation = useMemo(() => {
    if (state.status !== 'ready' || !selectedEmployee) return [];
    return state.compensation
      .filter((item) => item.employeeId === selectedEmployee.id)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }, [state, selectedEmployee]);

  const selectedDeductions = useMemo(() => {
    if (state.status !== 'ready' || !selectedEmployee) return [];
    return state.deductions
      .filter((item) => item.employeeId === selectedEmployee.id)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [state, selectedEmployee]);

  if (!readyIdentity) return null;

  async function runWrite(action: () => Promise<string>, message: string) {
    setWriteState({ status: 'saving' });
    try {
      await action();
      setWriteState({ status: 'success', message });
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setWriteState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Compensation write failed',
      });
    }
  }

  function saveCompensation() {
    if (!writeService || !selectedEmployee) return;
    void runWrite(
      () => writeService.createCompensation({
        organizationId: readyIdentity.organizationId,
        employeeId: selectedEmployee.id,
        payType,
        hourlyRate: payType === 'hourly' ? Number(hourlyRate) : null,
        annualSalary: payType === 'salary' ? Number(annualSalary) : null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      }),
      'Compensation saved',
    );
  }

  function saveDeduction() {
    if (!writeService || !selectedEmployee) return;
    void runWrite(
      () => writeService.setDeduction({
        organizationId: readyIdentity.organizationId,
        employeeId: selectedEmployee.id,
        code: deductionCode,
        label: deductionLabel,
        treatment: deductionTreatment,
        calculationType: deductionType,
        amount: Number(deductionAmount),
        active: true,
      }),
      'Deduction saved',
    );
  }

  return (
    <main className="atlas-page atlas-module-page people-compensation-page">
      <p className="atlas-eyebrow">ATLAS People / Compensation</p>
      <h1>Compensation &amp; Benefits</h1>
      <p className="atlas-page__lede">
        Effective-dated compensation and payroll deductions are organization-scoped. Changes require payroll.write and are persisted only through audited RPCs.
      </p>

      {writeState.status === 'success' && (
        <section className="atlas-status-panel" role="status"><strong>{writeState.message}</strong><span>Refreshing authorized compensation records.</span></section>
      )}
      {writeState.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Compensation write rejected</strong><span>{writeState.message}</span></section>
      )}

      {state.status === 'loading' && (
        <section className="atlas-status-panel" role="status"><strong>Loading compensation</strong><span>Reading authorized employees, compensation history and deductions.</span></section>
      )}
      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status"><strong>Compensation connection unavailable</strong><span>People or Compensation repository is not configured.</span></section>
      )}
      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert"><strong>Compensation data unavailable</strong><span>{state.message}</span></section>
      )}

      {state.status === 'ready' && state.employees.length === 0 && (
        <section className="atlas-status-panel"><strong>No employees</strong><span>No authorized employee records are available for this organization.</span></section>
      )}

      {state.status === 'ready' && selectedEmployee && (
        <>
          <section className="atlas-status-panel" aria-label="Compensation employee selector">
            <strong>Employee</strong>
            <label>
              Selected employee
              <select
                aria-label="Compensation employee"
                value={selectedEmployee.id}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              >
                {state.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="atlas-status-panel" aria-label="Compensation history">
            <strong>{selectedEmployee.fullName}</strong>
            {selectedCompensation.length === 0 ? (
              <span>No compensation history is recorded.</span>
            ) : selectedCompensation.map((item) => (
              <span key={item.id}>
                {item.payType === 'hourly'
                  ? `${currency.format(item.hourlyRate ?? 0)} / hour`
                  : `${currency.format(item.annualSalary ?? 0)} / year`}
                {' · '}{item.effectiveFrom}{item.effectiveTo ? ` to ${item.effectiveTo}` : ' onward'}
              </span>
            ))}
          </section>

          <section className="atlas-status-panel" aria-label="Employee deductions">
            <strong>Deductions</strong>
            {selectedDeductions.length === 0 ? (
              <span>No deductions are recorded.</span>
            ) : selectedDeductions.map((item) => (
              <span key={item.id}>
                {item.label} · {item.treatment} · {item.calculationType === 'fixed'
                  ? currency.format(item.amount)
                  : `${(item.amount * 100).toFixed(2)}%`} · {item.active ? 'Active' : 'Inactive'}
              </span>
            ))}
            <span>Benefits provider enrollment: Not configured</span>
          </section>

          {canWrite && (
            <>
              <section className="atlas-status-panel" aria-label="Add compensation">
                <strong>Add compensation</strong>
                <div className="atlas-filter-grid">
                  <label>
                    Pay type
                    <select aria-label="Pay type" value={payType} onChange={(event) => setPayType(event.target.value as 'hourly' | 'salary')}>
                      <option value="hourly">Hourly</option>
                      <option value="salary">Salary</option>
                    </select>
                  </label>
                  {payType === 'hourly' ? (
                    <label>Hourly rate<input aria-label="Hourly rate" inputMode="decimal" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} /></label>
                  ) : (
                    <label>Annual salary<input aria-label="Annual salary" inputMode="decimal" value={annualSalary} onChange={(event) => setAnnualSalary(event.target.value)} /></label>
                  )}
                  <label>Effective start<input aria-label="Effective start" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
                  <label>Effective end<input aria-label="Effective end" type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></label>
                </div>
                <div className="atlas-action-row">
                  <button type="button" aria-label="Save compensation" disabled={writeState.status === 'saving'} onClick={saveCompensation}>Save compensation</button>
                </div>
              </section>

              <section className="atlas-status-panel" aria-label="Set deduction">
                <strong>Set deduction</strong>
                <div className="atlas-filter-grid">
                  <label>Code<input aria-label="Deduction code" value={deductionCode} onChange={(event) => setDeductionCode(event.target.value)} /></label>
                  <label>Label<input aria-label="Deduction label" value={deductionLabel} onChange={(event) => setDeductionLabel(event.target.value)} /></label>
                  <label>
                    Treatment
                    <select aria-label="Deduction treatment" value={deductionTreatment} onChange={(event) => setDeductionTreatment(event.target.value as 'pretax' | 'posttax')}>
                      <option value="pretax">Pre-tax</option>
                      <option value="posttax">Post-tax</option>
                    </select>
                  </label>
                  <label>
                    Calculation
                    <select aria-label="Deduction calculation" value={deductionType} onChange={(event) => setDeductionType(event.target.value as 'fixed' | 'percent')}>
                      <option value="fixed">Fixed</option>
                      <option value="percent">Percent (0–1)</option>
                    </select>
                  </label>
                  <label>Amount<input aria-label="Deduction amount" inputMode="decimal" value={deductionAmount} onChange={(event) => setDeductionAmount(event.target.value)} /></label>
                </div>
                <div className="atlas-action-row">
                  <button type="button" aria-label="Save deduction" disabled={writeState.status === 'saving'} onClick={saveDeduction}>Save deduction</button>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
