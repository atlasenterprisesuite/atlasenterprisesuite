import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { loadPayrollWorkspace, payrollMutations, type PayrollWorkspace } from './payrollApi';
import './payroll.css';

type State={status:'loading'}|{status:'error';message:string}|{status:'ready';data:PayrollWorkspace};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

function usePayroll(){
  const [state,setState]=useState<State>({status:'loading'});
  const reload=useCallback(()=>{setState({status:'loading'});void loadPayrollWorkspace().then(data=>setState({status:'ready',data})).catch(e=>setState({status:'error',message:e instanceof Error?e.message:'payroll_unavailable'}));},[]);
  useEffect(reload,[reload]); return {state,reload};
}
function Frame({children}:{children:React.ReactNode}){
 return <section className="payroll-page page-stack"><header className="payroll-section-header"><p className="payroll-kicker">ATLAS PAYROLL</p><h1>Payroll</h1><p>Governed payroll preparation and approval. Tax filing, remittance and direct deposit remain external-gated.</p>
 <nav className="module-experience-actions"><Link to="/payroll">Overview</Link><Link to="/payroll/people">People</Link><Link to="/payroll/time-earnings">Time & Earnings</Link><Link to="/payroll/pay-runs">Pay Runs</Link></nav></header>{children}</section>;
}
function View({state,children}:{state:State;children:(d:PayrollWorkspace)=>React.ReactNode}){
 if(state.status==='loading')return <div className="payroll-section-empty" role="status">Loading authorized payroll records…</div>;
 if(state.status==='error')return <div className="payroll-section-empty" role="alert"><strong>Payroll unavailable</strong><p>{state.message}</p><small>No simulated payroll data is substituted.</small></div>;
 return <>{children(state.data)}</>;
}
function Overview(){
 const {state}=usePayroll();
 return <Frame><View state={state}>{d=>{const active=d.runs.find(r=>!['locked','void'].includes(r.status));const total=d.lines.filter(l=>active&&l.run_id===active.id).reduce((n,l)=>n+l.net_pay,0);return <>
  <div className="metric-grid"><article><span>Workers</span><strong>{d.workers.filter(w=>w.status==='active').length}</strong></article><article><span>Pay runs</span><strong>{d.runs.length}</strong></article><article><span>Current net</span><strong>{money.format(total)}</strong></article><article><span>Execution</span><strong>Gated</strong><small>No money movement</small></article></div>
  <div className="module-experience-grid"><article className="module-experience-card is-active"><strong>Tax determination & filing</strong><p>Not configured. Withholding entered in the core is governed input, not an ATLAS tax determination.</p></article><article className="module-experience-card is-active"><strong>Direct deposit</strong><p>Not configured. No bank transfer is represented as paid without an authorized payment rail.</p></article></div>
 </>}}</View></Frame>;
}
function People(){
 const {state}=usePayroll();
 return <Frame><View state={state}>{d=><div className="module-experience-grid">{d.workers.map(w=><article className="module-experience-card is-active" key={w.id}><strong>{w.full_name}</strong><p>{w.job_title||'No job title'} · {w.worker_type}</p><small>{w.status}</small></article>)}</div>}</View></Frame>;
}
function TimeEarnings(){
 const {state}=usePayroll();
 return <Frame><View state={state}>{d=><><div className="status-card"><strong>Approved time is a payroll input</strong><p>ATLAS does not infer overtime law or tax treatment from time records. Those remain governed payroll inputs.</p></div><div className="module-experience-grid">{d.timeEntries.map(t=><article className="module-experience-card is-active" key={t.id}><strong>{d.workers.find(w=>w.id===t.worker_id)?.full_name||'Worker'}</strong><p>{t.work_date} · {t.status}</p></article>)}</div></>}</View></Frame>;
}
function PayRuns(){
 const {state,reload}=usePayroll(); const [error,setError]=useState('');
 const [selectedRun,setSelectedRun]=useState(''); const activeRun=useMemo(()=>state.status==='ready'?(state.data.runs.find(r=>r.id===selectedRun)||state.data.runs[0]):undefined,[state,selectedRun]);
 async function createRun(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setError('');try{await payrollMutations.createRun({scheduleId:String(f.get('scheduleId')||''),periodStart:String(f.get('periodStart')),periodEnd:String(f.get('periodEnd')),payDate:String(f.get('payDate'))});e.currentTarget.reset();reload();}catch(x){setError(x instanceof Error?x.message:'run_create_failed');}}
 async function addLine(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!activeRun)return;const f=new FormData(e.currentTarget);const mode=String(f.get('mode'));setError('');try{await payrollMutations.upsertLine({runId:activeRun.id,workerId:String(f.get('workerId')),regularHours:Number(f.get('regularHours')||0),overtimeHours:Number(f.get('overtimeHours')||0),hourlyRate:mode==='hourly'?Number(f.get('rate')||0):undefined,salaryPeriodAmount:mode==='salary'?Number(f.get('rate')||0):undefined,pretaxDeductions:Number(f.get('pretax')||0),taxesWithheld:Number(f.get('tax')||0),posttaxDeductions:Number(f.get('posttax')||0)});reload();}catch(x){setError(x instanceof Error?x.message:'line_save_failed');}}
 return <Frame><View state={state}>{d=><>
  <form className="atlas-form" onSubmit={createRun}><h2>Create pay run</h2><label>Schedule<select name="scheduleId"><option value="">No schedule</option>{d.schedules.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Period start<input name="periodStart" type="date" required/></label><label>Period end<input name="periodEnd" type="date" required/></label><label>Pay date<input name="payDate" type="date" required/></label><button>Create run</button></form>
  {d.runs.length?<><label>Selected run<select value={activeRun?.id||''} onChange={e=>setSelectedRun(e.target.value)}>{d.runs.map(r=><option value={r.id} key={r.id}>{r.period_start}–{r.period_end} · {r.status}</option>)}</select></label>
  {activeRun&&['draft','calculated'].includes(activeRun.status)?<form className="atlas-form" onSubmit={addLine}><h2>Add / update worker line</h2><label>Worker<select name="workerId">{d.workers.filter(w=>w.status==='active').map(w=><option value={w.id} key={w.id}>{w.full_name}</option>)}</select></label><label>Mode<select name="mode"><option value="hourly">Hourly</option><option value="salary">Salary period</option></select></label><label>Rate / salary-period amount<input name="rate" type="number" step="0.01" min="0" required/></label><label>Regular hours<input name="regularHours" type="number" step="0.01" min="0" defaultValue="0"/></label><label>Overtime hours<input name="overtimeHours" type="number" step="0.01" min="0" defaultValue="0"/></label><label>Pre-tax deductions<input name="pretax" type="number" step="0.01" min="0" defaultValue="0"/></label><label>Taxes withheld (governed input)<input name="tax" type="number" step="0.01" min="0" defaultValue="0"/></label><label>Post-tax deductions<input name="posttax" type="number" step="0.01" min="0" defaultValue="0"/></label><button>Save line</button></form>:null}
  <div className="module-experience-grid">{d.lines.filter(l=>l.run_id===activeRun?.id).map(l=><article className="module-experience-card is-active" key={l.id}><strong>{d.workers.find(w=>w.id===l.worker_id)?.full_name||'Worker'}</strong><p>Gross {money.format(l.gross_pay)} · Net {money.format(l.net_pay)}</p><small>Taxes {money.format(l.taxes_withheld)} · provider execution false</small></article>)}</div>
  {activeRun?<div className="atlas-action-row">{activeRun.status==='draft'?<button onClick={()=>void payrollMutations.transitionRun(activeRun.id,'calculate').then(reload)}>Calculate</button>:null}{activeRun.status==='calculated'?<button onClick={()=>void payrollMutations.transitionRun(activeRun.id,'approve').then(reload)}>Approve</button>:null}{activeRun.status==='approved'?<button onClick={()=>void payrollMutations.transitionRun(activeRun.id,'lock').then(reload)}>Lock</button>:null}</div>:null}</>:<p>No pay runs yet.</p>}
  {error?<p role="alert">{error}</p>:null}
 </>}</View></Frame>;
}
export function PayrollRoutes(){
 return <RequireAtlasIdentity><Routes><Route index element={<Overview/>}/><Route path="overview" element={<Navigate to="/payroll" replace/>}/><Route path="people" element={<People/>}/><Route path="time-earnings" element={<TimeEarnings/>}/><Route path="pay-runs" element={<PayRuns/>}/></Routes></RequireAtlasIdentity>;
}
