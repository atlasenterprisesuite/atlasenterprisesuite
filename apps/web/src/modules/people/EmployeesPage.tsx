import { useEffect, useMemo, useState } from 'react';
import { hasPermission } from '../../../../../packages/core/src';
import type { EmployeeRecord, EmploymentStatus } from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { usePeopleRepository } from './PeopleDataProvider';
import { usePeopleEmployeeWriteService } from './PeopleEmployeeWriteProvider';

type EmployeesState =
  | { status: 'loading' }
  | { status: 'connection_unavailable' }
  | { status: 'ready'; employees: EmployeeRecord[] }
  | { status: 'error'; message: string };

type WriteState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = ['active', 'leave', 'terminated'];

export function EmployeesPage() {
  const identity = useAtlasContext();
  const repository = usePeopleRepository();
  const writeService = usePeopleEmployeeWriteService();
  const [state, setState] = useState<EmployeesState>({ status: 'loading' });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmploymentStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('active');
  const [writeState, setWriteState] = useState<WriteState>({ status: 'idle' });

  const readyIdentity = identity.status === 'ready' ? identity : null;
  const canWrite = Boolean(
    readyIdentity
      && writeService
      && hasPermission(readyIdentity.permissions, 'hr.write'),
  );

  useEffect(() => {
    let active = true;

    if (!readyIdentity) return () => { active = false; };
    if (!repository) {
      setState({ status: 'connection_unavailable' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    void repository.listEmployees(readyIdentity.organizationId)
      .then((employees) => {
        if (active) setState({ status: 'ready', employees });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Employee data could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [readyIdentity, repository, reloadVersion]);

  const departments = useMemo(() => {
    if (state.status !== 'ready') return [];
    return Array.from(new Set(
      state.employees
        .map((employee) => employee.department)
        .filter((value): value is string => Boolean(value)),
    )).sort((a, b) => a.localeCompare(b));
  }, [state]);

  const visibleEmployees = useMemo(() => {
    if (state.status !== 'ready') return [];
    const query = search.trim().toLocaleLowerCase();
    return state.employees
      .filter((employee) => statusFilter === 'all' || employee.status === statusFilter)
      .filter((employee) => departmentFilter === 'all' || employee.department === departmentFilter)
      .filter((employee) => {
        if (!query) return true;
        return [employee.fullName, employee.department, employee.jobTitle]
          .some((value) => value?.toLocaleLowerCase().includes(query));
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [state, search, statusFilter, departmentFilter]);

  if (!readyIdentity) return null;

  function resetForm() {
    setEditingEmployeeId(null);
    setFullName('');
    setDepartment('');
    setJobTitle('');
    setEmploymentStatus('active');
    setShowForm(false);
  }

  function beginCreate() {
    setWriteState({ status: 'idle' });
    setEditingEmployeeId(null);
    setFullName('');
    setDepartment('');
    setJobTitle('');
    setEmploymentStatus('active');
    setShowForm(true);
  }

  function beginEdit(employee: EmployeeRecord) {
    setWriteState({ status: 'idle' });
    setEditingEmployeeId(employee.id);
    setFullName(employee.fullName);
    setDepartment(employee.department ?? '');
    setJobTitle(employee.jobTitle ?? '');
    setEmploymentStatus(employee.status);
    setShowForm(true);
  }

  async function saveEmployee() {
    if (!writeService || !canWrite) return;
    setWriteState({ status: 'saving' });

    const mutation = {
      scope: {
        tenantId: readyIdentity.tenantId,
        organizationId: readyIdentity.organizationId,
      },
      fullName,
      department: department || null,
      jobTitle: jobTitle || null,
      status: employmentStatus,
    } as const;

    try {
      if (editingEmployeeId) {
        await writeService.updateEmployee({ ...mutation, employeeId: editingEmployeeId });
        setWriteState({ status: 'success', message: 'Employee updated.' });
      } else {
        await writeService.createEmployee(mutation);
        setWriteState({ status: 'success', message: 'Employee created.' });
      }
      resetForm();
      setReloadVersion((value) => value + 1);
    } catch (error) {
      setWriteState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Employee write failed.',
      });
    }
  }

  return (
    <main className="atlas-page atlas-module-page people-employees-page">
      <p className="atlas-eyebrow">ATLAS People / Employees</p>
      <h1>Employees</h1>
      <p className="atlas-page__lede">
        Organization-scoped employee records with governed HR writes, role-based access, and audit history.
      </p>

      {writeState.status === 'success' && (
        <section className="atlas-status-panel" role="status">
          <strong>{writeState.message}</strong>
          <span>Authorized employee records are being refreshed.</span>
        </section>
      )}
      {writeState.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Employee write rejected</strong>
          <span>{writeState.message}</span>
        </section>
      )}

      {(state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading employees</strong>
          <span>Reading authorized organization employee records.</span>
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
          <strong>Employee data unavailable</strong>
          <span>{state.message}</span>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <section className="atlas-status-panel" aria-label="Employee filters">
            <strong>Filters</strong>
            <div className="atlas-filter-grid">
              <label>
                Search
                <input
                  aria-label="Search employees"
                  type="search"
                  placeholder="Name, department, or job title"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label>
                Status
                <select
                  aria-label="Employee status filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | EmploymentStatus)}
                >
                  <option value="all">All statuses</option>
                  {EMPLOYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select
                  aria-label="Employee department filter"
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                >
                  <option value="all">All departments</option>
                  {departments.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {canWrite && !showForm && (
            <button type="button" onClick={beginCreate}>New employee</button>
          )}

          {canWrite && showForm && (
            <section className="atlas-status-panel" aria-label={editingEmployeeId ? 'Edit employee form' : 'New employee form'}>
              <strong>{editingEmployeeId ? 'Edit employee' : 'New employee'}</strong>
              <div className="atlas-filter-grid">
                <label>
                  Full name
                  <input aria-label="Employee full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
                <label>
                  Department
                  <input aria-label="Employee department" value={department} onChange={(event) => setDepartment(event.target.value)} />
                </label>
                <label>
                  Job title
                  <input aria-label="Employee job title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
                </label>
                <label>
                  Status
                  <select aria-label="Employee status" value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value as EmploymentStatus)}>
                    {EMPLOYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="atlas-action-row">
                <button type="button" disabled={writeState.status === 'saving'} onClick={() => void saveEmployee()}>
                  {editingEmployeeId ? 'Save changes' : 'Create employee'}
                </button>
                <button type="button" disabled={writeState.status === 'saving'} onClick={resetForm}>Cancel</button>
              </div>
            </section>
          )}

          {visibleEmployees.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Employees empty state">
              <strong>No employees</strong>
              <span>No authorized employee records match the selected filters.</span>
            </section>
          ) : (
            <section className="atlas-status-panel" aria-label="Employees table">
              <strong>Employee directory</strong>
              <div className="atlas-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th><th>Department</th><th>Job title</th><th>Status</th><th>Identity</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.fullName}</td>
                        <td>{employee.department ?? '—'}</td>
                        <td>{employee.jobTitle ?? '—'}</td>
                        <td>{employee.status}</td>
                        <td>{employee.userId ? 'Linked' : 'Not linked'}</td>
                        <td>
                          {canWrite ? (
                            <button type="button" aria-label={`Edit ${employee.fullName}`} onClick={() => beginEdit(employee)}>Edit</button>
                          ) : 'Read only'}
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
