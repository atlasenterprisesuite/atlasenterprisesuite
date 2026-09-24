import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPayrollTimeEntries, listPayrollWorkers, savePayrollTimeEntry, type PayrollTimeEntry, type PayrollWorker } from '../../lib/payrollApi';

export function TimePtoPage({ title = 'Time & PTO' }:{ title?: string } = {}) {
  const [entries,setEntries]=useState<PayrollTimeEntry[]>([]);
  const [workers,setWorkers]=useState<PayrollWorker[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [workerId,setWorkerId]=useState('');
  const [workDate,setWorkDate]=useState('');
  const [minutes,setMinutes]=useState(480);
  const [category,setCategory]=useState<PayrollTimeEntry['category']>('regular');

  async function load(){
    try {
      const [nextEntries,nextWorkers]=await Promise.all([listPayrollTimeEntries(),listPayrollWorkers()]);
      setEntries(nextEntries); setWorkers(nextWorkers);
      setWorkerId((value)=>value||nextWorkers[0]?.id||'');
      setError(null);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Unable to load time');
    }
  }

  useEffect(()=>{ void load(); },[]);

  async function submit(event:FormEvent){
    event.preventDefault();
    setError(null);
    try {
      await savePayrollTimeEntry({workerId,workDate,minutes,category,source:'manual'});
      await load();
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Unable to save time entry');
    }
  }

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header">
      <p className="payroll-kicker">PAYROLL INPUTS</p>
      <h1>{title}</h1>
      <p>Time must be approved before a payroll run can be processed.</p>
      <Link className="payroll-secondary-button" to="/payroll">Back to Payroll</Link>
    </header>

    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}

    <div className="payroll-callout">
      <div><strong>No PTO policy configured</strong><p>No balance is displayed until a real organization policy and ledger exist.</p></div>
    </div>

    {workers.length?<form className="payroll-form payroll-form-inline" onSubmit={submit}>
      <label>Worker<select value={workerId} onChange={(e)=>setWorkerId(e.target.value)}>{workers.map((worker)=><option key={worker.id} value={worker.id}>{worker.display_name}</option>)}</select></label>
      <label>Date<input type="date" value={workDate} onChange={(e)=>setWorkDate(e.target.value)} required /></label>
      <label>Category<select value={category} onChange={(e)=>setCategory(e.target.value as PayrollTimeEntry['category'])}>
        <option value="regular">Regular</option><option value="overtime">Overtime</option><option value="paid_leave">Paid leave</option><option value="unpaid_leave">Unpaid leave</option>
      </select></label>
      <label>Minutes<input type="number" min={0} max={1440} value={minutes} onChange={(e)=>setMinutes(Number(e.target.value))} /></label>
      <button className="payroll-button" type="submit">Add time entry</button>
    </form>:null}

    {!entries.length?<div className="payroll-empty-panel"><strong>No time entries</strong><p>Approved source records will appear here.</p></div>:
      <div className="payroll-table-wrap"><table className="payroll-table">
        <thead><tr><th>Date</th><th>Worker</th><th>Category</th><th>Minutes</th><th>Approval</th><th>Lock</th></tr></thead>
        <tbody>{entries.map((entry)=><tr key={entry.id}>
          <td>{entry.work_date}</td>
          <td>{workers.find((worker)=>worker.id===entry.worker_id)?.display_name||entry.worker_id}</td>
          <td>{entry.category}</td><td>{entry.minutes}</td><td>{entry.approval_status}</td>
          <td>{entry.locked_by_run_id?'Locked by payroll processing':'Open'}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
