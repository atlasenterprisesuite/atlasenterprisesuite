import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPayrollWorkers, savePayrollWorker, type PayrollWorker } from '../../lib/payrollApi';

export function PeoplePage() {
  const [workers,setWorkers]=useState<PayrollWorker[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [adding,setAdding]=useState(false);
  const [displayName,setDisplayName]=useState('');
  const [email,setEmail]=useState('');
  const [classification,setClassification]=useState<'employee'|'contractor'>('employee');

  async function load(){
    setLoading(true);
    try { setWorkers(await listPayrollWorkers()); setError(null); }
    catch(cause){ setError(cause instanceof Error?cause.message:'Unable to load workers'); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{ void load(); },[]);

  async function submit(event:FormEvent){
    event.preventDefault();
    setError(null);
    try {
      await savePayrollWorker({displayName,email,workerType:classification});
      setDisplayName(''); setEmail(''); setAdding(false);
      await load();
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Unable to save worker');
    }
  }

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header payroll-heading-row">
      <div>
        <p className="payroll-kicker">WORKFORCE</p>
        <h1>People</h1>
        <p>Organization-scoped employees and contractors used by Payroll.</p>
        <Link className="payroll-secondary-button" to="/payroll">Back to Payroll</Link>
      </div>
      <button className="payroll-button" type="button" onClick={()=>setAdding((value)=>!value)}>Add worker</button>
    </header>

    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}

    {adding?<form className="payroll-form" onSubmit={submit}>
      <label>Worker name<input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} required /></label>
      <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></label>
      <label>Worker classification
        <select value={classification} onChange={(e)=>setClassification(e.target.value as 'employee'|'contractor')}>
          <option value="employee">Employee</option>
          <option value="contractor">Contractor</option>
        </select>
      </label>
      <button className="payroll-button" type="submit">Save worker</button>
    </form>:null}

    {loading?<div className="payroll-notice" role="status">Loading workers…</div>:null}
    {!loading&&workers.length===0?<div className="payroll-empty-panel"><strong>No workers yet</strong><p>Add an employee or contractor before preparing payroll.</p></div>:null}

    {workers.length?<div className="payroll-table-wrap">
      <table className="payroll-table">
        <thead><tr><th>Name</th><th>Classification</th><th>Status</th><th>Email</th></tr></thead>
        <tbody>{workers.map((worker)=><tr key={worker.id}>
          <td>{worker.display_name}</td><td>{worker.worker_type}</td><td>{worker.employment_status}</td><td>{worker.email||'—'}</td>
        </tr>)}</tbody>
      </table>
    </div>:null}
  </section>;
}
