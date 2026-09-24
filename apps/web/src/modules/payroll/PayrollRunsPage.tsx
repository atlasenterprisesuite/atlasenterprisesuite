import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPayrollRun, listPayrollRuns, transitionPayrollRun, type PayrollRun } from '../../lib/payrollApi';

export function PayrollRunsPage({ title = 'Payroll runs' }:{ title?: string } = {}) {
  const [runs,setRuns]=useState<PayrollRun[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [periodStart,setPeriodStart]=useState('');
  const [periodEnd,setPeriodEnd]=useState('');
  const [payDate,setPayDate]=useState('');

  async function load(){
    try { setRuns(await listPayrollRuns()); setError(null); }
    catch(cause){ setError(cause instanceof Error?cause.message:'Unable to load payroll runs'); }
  }
  useEffect(()=>{ void load(); },[]);

  async function create(event:FormEvent){
    event.preventDefault(); setError(null);
    try { await createPayrollRun({periodStart,periodEnd,payDate}); await load(); }
    catch(cause){ setError(cause instanceof Error?cause.message:'Unable to create payroll run'); }
  }

  async function transition(run:PayrollRun,action:'review'|'submit'|'approve'|'process'|'cancel'|'reopen'){
    setError(null);
    try { await transitionPayrollRun(run.id,action); await load(); }
    catch(cause){ setError(cause instanceof Error?cause.message:'Payroll transition failed'); }
  }

  const money=(cents:number|null)=>cents===null?'—':'$'+(cents/100).toFixed(2);

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header">
      <p className="payroll-kicker">EXECUTION</p>
      <h1>{title}</h1>
      <p>Draft → review → approval → governed processing. Tax filing and money movement remain separate external gates.</p>
      <Link className="payroll-secondary-button" to="/payroll">Back to Payroll</Link>
    </header>

    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}

    <form className="payroll-form payroll-form-inline" onSubmit={create}>
      <label>Period start<input type="date" value={periodStart} onChange={(e)=>setPeriodStart(e.target.value)} required /></label>
      <label>Period end<input type="date" value={periodEnd} onChange={(e)=>setPeriodEnd(e.target.value)} required /></label>
      <label>Pay date<input type="date" value={payDate} onChange={(e)=>setPayDate(e.target.value)} required /></label>
      <button className="payroll-button" type="submit">Create payroll run</button>
    </form>

    {!runs.length?<div className="payroll-empty-panel"><strong>No payroll runs</strong><p>Create a draft only after workforce and time inputs are ready.</p></div>:
    <div className="payroll-run-list">{runs.map((run)=><article className="payroll-card payroll-run-card" key={run.id}>
      <div><span>{run.period_start} → {run.period_end}</span><strong>Pay {run.pay_date}</strong><small>Status: {run.status}</small></div>
      {run.blocked_reason?<div className="payroll-notice payroll-error">{run.blocked_reason==='tax_rule_unavailable'?'Validated tax rule unavailable':run.blocked_reason}</div>:null}
      {run.status==='processed'?<div className="payroll-run-totals"><span>Gross {money(run.gross_pay_cents)}</span><span>Employee tax {money(run.employee_taxes_cents)}</span><span>Net {money(run.net_pay_cents)}</span></div>:null}
      <div className="payroll-actions">
        {run.status==='draft'?<button type="button" className="payroll-secondary-button" onClick={()=>transition(run,'review')}>Review</button>:null}
        {run.status==='review'?<button type="button" className="payroll-secondary-button" onClick={()=>transition(run,'submit')}>Submit for approval</button>:null}
        {run.status==='awaiting_approval'?<button type="button" className="payroll-button" onClick={()=>transition(run,'approve')}>Approve payroll</button>:null}
        {run.status==='approved'?<button type="button" className="payroll-button" onClick={()=>transition(run,'process')}>Process payroll</button>:null}
        {(run.status==='blocked'||run.status==='failed')?<button type="button" className="payroll-secondary-button" onClick={()=>transition(run,'reopen')}>Return to review</button>:null}
      </div>
    </article>)}</div>}
  </section>;
}
