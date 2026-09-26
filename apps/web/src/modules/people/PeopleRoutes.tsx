import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { getCachedAtlasShellOrganization } from '../../lib/atlasSession';
import {
  loadPeopleWorkspace,
  peopleMutations,
  type PeopleWorkspace
} from './peopleApi';
import { PeopleKnowledgePage } from './PeopleKnowledgePage';
import { parseCandidateImportCsv } from './candidateImport';

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PeopleWorkspace };

function usePeopleWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' });
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    void loadPeopleWorkspace()
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => setState({ status: 'error', message: error instanceof Error ? error.message : 'people_unavailable' }));
  }, []);
  useEffect(reload, [reload]);
  return { state, reload };
}

function Layout({ children }: { children: ReactNode }) {
  return <section className="page-stack">
    <header className="page-header">
      <p className="eyebrow">ATLAS People</p>
      <h1>People Operations</h1>
      <p>Organization-scoped workers, time, recruiting and compensation with RLS and governed RPC writes.</p>
      <nav className="module-experience-actions" aria-label="People navigation">
        <Link to="/people">Overview</Link><Link to="/people/workers">Workers</Link><Link to="/people/time">Time</Link>
        <Link to="/people/recruiting">Recruiting</Link><Link to="/people/compensation">Compensation</Link>
        <Link to="/people/knowledge">Knowledge</Link><Link to="/people/self-service">Self-Service</Link><Link to="/payroll">Payroll</Link>
      </nav>
    </header>
    {children}
  </section>;
}

function State({ state, children }: { state: WorkspaceState; children: (data: PeopleWorkspace) => ReactNode }) {
  if (state.status === 'loading') return <div className="status-card" role="status">Loading authorized People records…</div>;
  if (state.status === 'error') return <div className="status-card" role="alert"><strong>People data unavailable</strong><p>{state.message}</p><small>No local or simulated records are substituted.</small></div>;
  return <>{children(state.data)}</>;
}

function Overview() {
  const { state } = usePeopleWorkspace();
  return <Layout><State state={state}>{(data) => <div className="metric-grid">
    <article><strong>{data.workers.length}</strong><span>Workers</span></article>
    <article><strong>{data.timeEntries.filter((x) => x.status === 'submitted').length}</strong><span>Time awaiting review</span></article>
    <article><strong>{data.requisitions.filter((x) => x.status === 'open').length}</strong><span>Open requisitions</span></article>
    <article><strong>{data.applications.filter((x) => !['hired','rejected','withdrawn'].includes(x.stage)).length}</strong><span>Active candidates</span></article>
  </div>}</State></Layout>;
}

function Workers() {
  const { state, reload } = usePeopleWorkspace();
  const [error,setError]=useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const fd=new FormData(event.currentTarget);
    try {
      await peopleMutations.createWorker({
        fullName:String(fd.get('fullName')||''), email:String(fd.get('email')||''),
        department:String(fd.get('department')||''), jobTitle:String(fd.get('jobTitle')||''),
        workerType:(fd.get('workerType')==='contractor'?'contractor':'employee')
      });
      event.currentTarget.reset(); reload();
    } catch (e) { setError(e instanceof Error?e.message:'worker_create_failed'); }
  }
  return <Layout><State state={state}>{(data) => <>
    <form className="atlas-form" onSubmit={submit}><h2>Add worker</h2>
      <label>Full name<input name="fullName" required /></label><label>Email<input name="email" type="email" /></label>
      <label>Department<input name="department" /></label><label>Job title<input name="jobTitle" /></label>
      <label>Worker type<select name="workerType"><option value="employee">Employee</option><option value="contractor">Contractor</option></select></label>
      <button type="submit">Create worker</button>{error?<p role="alert">{error}</p>:null}
    </form>
    <div className="module-experience-grid">{data.workers.map((w)=><article className="module-experience-card is-active" key={w.id}><strong>{w.full_name}</strong><p>{w.job_title||'No job title'} · {w.department||'No department'}</p><small>{w.worker_type} · {w.status}</small></article>)}</div>
    {data.workers.length===0?<p>No authorized worker records yet.</p>:null}
  </>}</State></Layout>;
}

function Time() {
  const { state, reload }=usePeopleWorkspace(); const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); const fd=new FormData(event.currentTarget); setError('');
    try { await peopleMutations.createTimeEntry({workerId:String(fd.get('workerId')),workDate:String(fd.get('workDate')),clockIn:String(fd.get('clockIn')||''),clockOut:String(fd.get('clockOut')||''),breakMinutes:Number(fd.get('breakMinutes')||0)}); event.currentTarget.reset(); reload(); }
    catch(e){setError(e instanceof Error?e.message:'time_create_failed');}
  }
  return <Layout><State state={state}>{(data)=><>
    <form className="atlas-form" onSubmit={submit}><h2>Record time</h2><label>Worker<select name="workerId" required>{data.workers.map(w=><option key={w.id} value={w.id}>{w.full_name}</option>)}</select></label>
      <label>Work date<input name="workDate" type="date" required /></label><label>Clock in<input name="clockIn" type="datetime-local" /></label><label>Clock out<input name="clockOut" type="datetime-local" /></label>
      <label>Break minutes<input name="breakMinutes" type="number" min="0" defaultValue="0" /></label><button type="submit">Save draft</button>{error?<p role="alert">{error}</p>:null}
    </form>
    <div className="module-experience-grid">{data.timeEntries.map(e=><article className="module-experience-card is-active" key={e.id}><strong>{data.workers.find(w=>w.id===e.worker_id)?.full_name||'Worker'}</strong><p>{e.work_date} · {e.status}</p>
      <div className="atlas-action-row">{e.status==='draft'?<button type="button" onClick={()=>void peopleMutations.transitionTime(e.id,'submit').then(reload)}>Submit</button>:null}
      {e.status==='submitted'?<><button type="button" onClick={()=>void peopleMutations.transitionTime(e.id,'approve').then(reload)}>Approve</button><button type="button" onClick={()=>void peopleMutations.transitionTime(e.id,'reject').then(reload)}>Reject</button></>:null}</div>
    </article>)}</div>
  </>}</State></Layout>;
}

function Recruiting() {
  const { state,reload }=usePeopleWorkspace(); const [error,setError]=useState(''); const [importSummary,setImportSummary]=useState('');
  async function addRequisition(event:FormEvent<HTMLFormElement>){event.preventDefault();const fd=new FormData(event.currentTarget);setError('');try{await peopleMutations.createRequisition({title:String(fd.get('title')),department:String(fd.get('department')||'')});event.currentTarget.reset();reload();}catch(e){setError(e instanceof Error?e.message:'requisition_failed');}}
  async function addCandidate(event:FormEvent<HTMLFormElement>){event.preventDefault();const fd=new FormData(event.currentTarget);setError('');try{await peopleMutations.createCandidate({fullName:String(fd.get('fullName')),email:String(fd.get('email')||''),phone:String(fd.get('phone')||'')});event.currentTarget.reset();reload();}catch(e){setError(e instanceof Error?e.message:'candidate_failed');}}
  async function addApplication(event:FormEvent<HTMLFormElement>){event.preventDefault();const fd=new FormData(event.currentTarget);setError('');try{await peopleMutations.createApplication(String(fd.get('requisitionId')),String(fd.get('candidateId')));reload();}catch(e){setError(e instanceof Error?e.message:'application_failed');}}
  async function importCandidates(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError(''); setImportSummary('');
    const fd=new FormData(event.currentTarget); const file=fd.get('candidateCsv');
    if(!(file instanceof File)||file.size===0){setError('candidate_import_file_required');return;}
    try{
      const parsed=parseCandidateImportCsv(await file.text());
      for(const candidate of parsed.candidates){await peopleMutations.createCandidate(candidate);}
      setImportSummary(`Imported ${parsed.candidates.length} candidate(s).${parsed.unsupportedHeaders.length?` Ignored unsupported columns: ${parsed.unsupportedHeaders.join(', ')}.`:''}`);
      event.currentTarget.reset(); reload();
    }catch(e){setError(e instanceof Error?e.message:'candidate_import_failed');}
  }
  return <Layout><State state={state}>{(data)=><>
    <div className="module-experience-grid">
      <form className="atlas-form" onSubmit={addRequisition}><h2>Open requisition</h2><label>Title<input name="title" required /></label><label>Department<input name="department" /></label><button type="submit">Open requisition</button></form>
      <form className="atlas-form" onSubmit={addCandidate}><h2>Add candidate</h2><label>Full name<input name="fullName" required /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" /></label><button type="submit">Add candidate</button></form>
      <form className="atlas-form" onSubmit={addApplication}><h2>Create application</h2><label>Requisition<select name="requisitionId" required>{data.requisitions.filter(r=>r.status==='open').map(r=><option value={r.id} key={r.id}>{r.title}</option>)}</select></label><label>Candidate<select name="candidateId" required>{data.candidates.map(c=><option value={c.id} key={c.id}>{c.full_name}</option>)}</select></label><button type="submit">Create application</button></form>
      <form className="atlas-form" onSubmit={importCandidates}><h2>Import candidates</h2><label>CSV file<input name="candidateCsv" type="file" accept=".csv,text/csv" required /></label><small>Supported fields: name/full_name, email, phone. Unsupported RecruitPro columns are reported and not silently persisted.</small><button type="submit">Import CSV</button></form>
    </div>{error?<p role="alert">{error}</p>:null}{importSummary?<p role="status">{importSummary}</p>:null}
    <div className="module-experience-grid">{data.applications.map(a=><article className="module-experience-card is-active" key={a.id}><strong>{data.candidates.find(c=>c.id===a.candidate_id)?.full_name||'Candidate'}</strong><p>{data.requisitions.find(r=>r.id===a.requisition_id)?.title||'Requisition'} · {a.stage}</p>
      {!['hired','rejected','withdrawn'].includes(a.stage)?<button type="button" onClick={()=>{const next={applied:'screening',screening:'interview',assessment:'interview',interview:'offer',offer:'hired'}[a.stage]||'screening';void peopleMutations.transitionApplication(a.id,next).then(reload)}}>Advance</button>:null}
    </article>)}</div>
  </>}</State></Layout>;
}

function Compensation() {
  const { state,reload }=usePeopleWorkspace(); const [error,setError]=useState('');
  const current=useMemo(()=>state.status==='ready'?new Map(state.data.compensation.filter(c=>!c.effective_to).map(c=>[c.worker_id,c])):new Map(),[state]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const fd=new FormData(event.currentTarget);const payType=fd.get('payType')==='salary'?'salary':'hourly';setError('');try{await peopleMutations.setCompensation({workerId:String(fd.get('workerId')),payType,hourlyRate:payType==='hourly'?Number(fd.get('amount')):undefined,annualSalary:payType==='salary'?Number(fd.get('amount')):undefined,effectiveFrom:String(fd.get('effectiveFrom'))});reload();}catch(e){setError(e instanceof Error?e.message:'compensation_failed');}}
  return <Layout><State state={state}>{(data)=><><form className="atlas-form" onSubmit={submit}><h2>Set compensation</h2><label>Worker<select name="workerId">{data.workers.map(w=><option value={w.id} key={w.id}>{w.full_name}</option>)}</select></label><label>Pay type<select name="payType"><option value="hourly">Hourly</option><option value="salary">Salary</option></select></label><label>Rate / salary<input name="amount" type="number" min="0" step="0.01" required /></label><label>Effective date<input name="effectiveFrom" type="date" required /></label><button type="submit">Save compensation</button>{error?<p role="alert">{error}</p>:null}</form>
    <div className="module-experience-grid">{data.workers.map(w=>{const c=current.get(w.id);return <article className="module-experience-card is-active" key={w.id}><strong>{w.full_name}</strong><p>{c?c.pay_type==='hourly'?`$${Number(c.hourly_rate||0).toFixed(2)} / hour`:`$${Number(c.annual_salary||0).toFixed(2)} / year`:'No active compensation record'}</p></article>})}</div>
  </>}</State></Layout>;
}

function SelfService() {
  const { state }=usePeopleWorkspace();
  const cached=getCachedAtlasShellOrganization();
  return <Layout><State state={state}>{(data)=><>
    <div className="status-card"><strong>Employee Self-Service</strong><p>RLS limits this view to records linked to the authenticated user unless the role has broader People permissions.</p><small>{cached?.name||'Authenticated organization'}</small></div>
    <div className="module-experience-grid">{data.workers.map(w=><article className="module-experience-card is-active" key={w.id}><strong>{w.full_name}</strong><p>{w.job_title||'No job title'} · {w.status}</p></article>)}</div>
  </>}</State></Layout>;
}

export function PeopleRoutes() {
  return <Routes>
    <Route path="/people" element={<Overview />} />
    <Route path="/people/workers" element={<Workers />} />
    <Route path="/people/time" element={<Time />} />
    <Route path="/people/recruiting" element={<Recruiting />} />
    <Route path="/people/compensation" element={<Compensation />} />
    <Route path="/people/knowledge" element={<PeopleKnowledgePage />} />
    <Route path="/people/self-service" element={<SelfService />} />
    <Route path="*" element={<Navigate to="/people" replace />} />
  </Routes>;
}
