import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { careMutations, loadCareWorkspace, type CareWorkspace } from './careApi';

type WorkspaceState=
  |{status:'loading'}
  |{status:'error';message:string}
  |{status:'ready';data:CareWorkspace};

function useCareWorkspace(){
  const [state,setState]=useState<WorkspaceState>({status:'loading'});
  const reload=useCallback(()=>{
    setState({status:'loading'});
    void loadCareWorkspace()
      .then((data)=>setState({status:'ready',data}))
      .catch((error)=>setState({status:'error',message:error instanceof Error?error.message:'care_unavailable'}));
  },[]);
  useEffect(reload,[reload]);
  return {state,reload};
}

function Layout({children}:{children:ReactNode}){
  return <section className="page-stack">
    <header className="page-header">
      <p className="eyebrow">ATLAS Care</p>
      <h1>Care Operations</h1>
      <p>Family and participant care coordination with eligibility, caregiver authorization, care plans, governed timecards and payroll-ready approvals.</p>
      <nav className="module-experience-actions" aria-label="ATLAS Care navigation">
        <Link to="/care">Overview</Link>
        <Link to="/care/participants">Participants</Link>
        <Link to="/care/caregivers">Caregivers</Link>
        <Link to="/care/plans">Care Plans</Link>
        <Link to="/care/timecards">Timecards</Link>
        <Link to="/care/readiness">Readiness</Link>
        <Link to="/health">Health OS</Link>
        <Link to="/people">People</Link>
        <Link to="/payroll">Payroll</Link>
      </nav>
    </header>
    {children}
  </section>;
}

function State({state,children}:{state:WorkspaceState;children:(data:CareWorkspace)=>ReactNode}){
  if(state.status==='loading') return <div className="status-card" role="status">Loading authorized Care records…</div>;
  if(state.status==='error') return <div className="status-card" role="alert"><strong>ATLAS Care data unavailable</strong><p>{state.message}</p><small>No local or simulated participant records are substituted.</small></div>;
  return <>{children(state.data)}</>;
}

function Overview(){
  const {state}=useCareWorkspace();
  return <Layout><State state={state}>{(data)=><>
    <div className="metric-grid">
      <article><strong>{data.participants.length}</strong><span>Participants</span></article>
      <article><strong>{data.caregivers.filter((x)=>x.authorization_status==='authorized'&&x.certification_status==='verified').length}</strong><span>Ready caregivers</span></article>
      <article><strong>{data.plans.filter((x)=>x.status==='active').length}</strong><span>Active care plans</span></article>
      <article><strong>{data.timeEntries.filter((x)=>x.status==='submitted').length}</strong><span>Timecards awaiting approval</span></article>
    </div>
    <div className="notice">ATLAS Care coordinates non-clinical care operations. Diagnosis, treatment and EHR data are not stored by this core. Payer and EHR connections remain fail-closed until verified.</div>
  </>}</State></Layout>;
}

function Participants(){
  const {state,reload}=useCareWorkspace();
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError('');
    const form=event.currentTarget; const fd=new FormData(form);
    try{
      await careMutations.createParticipant(
        String(fd.get('displayName')||''),
        String(fd.get('eligibilityStatus')||'pending') as 'pending'|'eligible'|'ineligible'|'review'
      );
      form.reset(); reload();
    }catch(e){setError(e instanceof Error?e.message:'care_participant_create_failed');}
  }
  return <Layout><State state={state}>{(data)=><>
    <form className="atlas-form" onSubmit={submit}>
      <h2>Add participant</h2>
      <label>Display name<input name="displayName" required /></label>
      <label>Eligibility
        <select name="eligibilityStatus" defaultValue="pending">
          <option value="pending">Pending</option><option value="eligible">Eligible</option>
          <option value="review">Review</option><option value="ineligible">Ineligible</option>
        </select>
      </label>
      <button type="submit">Create participant</button>
      {error?<p role="alert">{error}</p>:null}
    </form>
    <div className="module-experience-grid">
      {data.participants.map((p)=><article className="module-experience-card is-active" key={p.id}>
        <span className="module-experience-card-label">Participant</span><strong>{p.display_name}</strong>
        <p>Eligibility: {p.eligibility_status}</p><small>Source: {p.eligibility_source}</small>
      </article>)}
    </div>
    {data.participants.length===0?<p>No authorized participant records yet.</p>:null}
  </>}</State></Layout>;
}

function Caregivers(){
  const {state,reload}=useCareWorkspace();
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError('');
    const form=event.currentTarget; const fd=new FormData(form);
    try{
      await careMutations.createCaregiver({
        fullName:String(fd.get('fullName')||''),
        authorizationStatus:String(fd.get('authorizationStatus')||'pending') as 'pending'|'authorized'|'suspended',
        certificationStatus:String(fd.get('certificationStatus')||'pending') as 'pending'|'verified'|'expired',
        certificationExpiresOn:String(fd.get('certificationExpiresOn')||'')||undefined
      });
      form.reset(); reload();
    }catch(e){setError(e instanceof Error?e.message:'caregiver_create_failed');}
  }
  return <Layout><State state={state}>{(data)=><>
    <form className="atlas-form" onSubmit={submit}>
      <h2>Add caregiver</h2>
      <label>Full name<input name="fullName" required /></label>
      <label>Authorization<select name="authorizationStatus" defaultValue="pending"><option value="pending">Pending</option><option value="authorized">Authorized</option><option value="suspended">Suspended</option></select></label>
      <label>Certification<select name="certificationStatus" defaultValue="pending"><option value="pending">Pending</option><option value="verified">Verified</option><option value="expired">Expired</option></select></label>
      <label>Certification expires<input name="certificationExpiresOn" type="date" /></label>
      <button type="submit">Create caregiver</button>
      {error?<p role="alert">{error}</p>:null}
    </form>
    <div className="module-experience-grid">
      {data.caregivers.map((c)=><article className="module-experience-card is-active" key={c.id}>
        <span className="module-experience-card-label">Caregiver</span><strong>{c.full_name}</strong>
        <p>{c.authorization_status} · certification {c.certification_status}</p>
        <small>{c.certification_expires_on?'Expires '+c.certification_expires_on:'No certification expiry recorded'}</small>
      </article>)}
    </div>
  </>}</State></Layout>;
}

function Plans(){
  const {state,reload}=useCareWorkspace();
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError('');
    const form=event.currentTarget; const fd=new FormData(form);
    try{
      await careMutations.createPlan({
        participantId:String(fd.get('participantId')||''),
        caregiverId:String(fd.get('caregiverId')||''),
        name:String(fd.get('name')||''),
        startDate:String(fd.get('startDate')||''),
        endDate:String(fd.get('endDate')||'')||undefined,
        authorizedMinutesPerWeek:Number(fd.get('authorizedMinutesPerWeek')||0)
      });
      form.reset(); reload();
    }catch(e){setError(e instanceof Error?e.message:'care_plan_create_failed');}
  }
  return <Layout><State state={state}>{(data)=><>
    <form className="atlas-form" onSubmit={submit}>
      <h2>Create care plan</h2>
      <label>Participant<select name="participantId" required>{data.participants.map((p)=><option key={p.id} value={p.id}>{p.display_name} · {p.eligibility_status}</option>)}</select></label>
      <label>Caregiver<select name="caregiverId" required>{data.caregivers.map((c)=><option key={c.id} value={c.id}>{c.full_name} · {c.authorization_status}/{c.certification_status}</option>)}</select></label>
      <label>Plan name<input name="name" required /></label>
      <label>Start date<input name="startDate" type="date" required /></label>
      <label>End date<input name="endDate" type="date" /></label>
      <label>Authorized minutes / week<input name="authorizedMinutesPerWeek" type="number" min="1" max="10080" required /></label>
      <button type="submit">Activate care plan</button>
      {error?<p role="alert">{error}</p>:null}
    </form>
    <div className="module-experience-grid">
      {data.plans.map((p)=><article className="module-experience-card is-active" key={p.id}>
        <span className="module-experience-card-label">Care plan</span><strong>{p.name}</strong>
        <p>{data.participants.find((x)=>x.id===p.participant_id)?.display_name||'Participant'} · {data.caregivers.find((x)=>x.id===p.caregiver_id)?.full_name||'Caregiver'}</p>
        <small>{p.status} · {p.authorized_minutes_per_week} min/week</small>
      </article>)}
    </div>
  </>}</State></Layout>;
}

function iso(value:string){
  const date=new Date(value);
  if(Number.isNaN(date.valueOf())) throw new Error('invalid_datetime');
  return date.toISOString();
}

function Timecards(){
  const {state,reload}=useCareWorkspace();
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError('');
    const form=event.currentTarget; const fd=new FormData(form);
    try{
      await careMutations.createTimeEntry({
        planId:String(fd.get('planId')||''),
        workDate:String(fd.get('workDate')||''),
        startedAt:iso(String(fd.get('startedAt')||'')),
        endedAt:iso(String(fd.get('endedAt')||''))
      });
      form.reset(); reload();
    }catch(e){setError(e instanceof Error?e.message:'care_time_entry_create_failed');}
  }
  async function transition(id:string,action:'submit'|'approve'|'reject'){
    setError('');
    try{
      const reason=action==='reject'?'Rejected during care time review':undefined;
      await careMutations.transitionTimeEntry(id,action,reason); reload();
    }catch(e){setError(e instanceof Error?e.message:'care_time_transition_failed');}
  }
  return <Layout><State state={state}>{(data)=><>
    <form className="atlas-form" onSubmit={submit}>
      <h2>Record care time</h2>
      <label>Active plan<select name="planId" required>{data.plans.filter((p)=>p.status==='active').map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Work date<input name="workDate" type="date" required /></label>
      <label>Start<input name="startedAt" type="datetime-local" required /></label>
      <label>End<input name="endedAt" type="datetime-local" required /></label>
      <button type="submit">Save draft</button>
      {error?<p role="alert">{error}</p>:null}
    </form>
    <div className="module-experience-grid">
      {data.timeEntries.map((entry)=><article className="module-experience-card is-active" key={entry.id}>
        <span className="module-experience-card-label">Timecard</span>
        <strong>{data.caregivers.find((x)=>x.id===entry.caregiver_id)?.full_name||'Caregiver'}</strong>
        <p>{entry.work_date} · {entry.minutes} minutes · {entry.status}</p>
        <small>{entry.payroll_ready?'Payroll handoff ready':'Not payroll ready'}</small>
        <div className="atlas-action-row">
          {entry.status==='draft'?<button type="button" onClick={()=>void transition(entry.id,'submit')}>Submit</button>:null}
          {entry.status==='submitted'?<>
            <button type="button" onClick={()=>void transition(entry.id,'approve')}>Approve</button>
            <button type="button" onClick={()=>void transition(entry.id,'reject')}>Reject</button>
          </>:null}
        </div>
      </article>)}
    </div>
  </>}</State></Layout>;
}

function Readiness(){
  const {state}=useCareWorkspace();
  return <Layout><State state={state}>{(data)=><>
    <div className="module-experience-grid">
      {([
        ['Payer eligibility',data.readiness.capabilities.payer_eligibility],
        ['EHR exchange',data.readiness.capabilities.ehr_exchange],
        ['Payroll handoff',data.readiness.capabilities.payroll_handoff]
      ] as const).map(([label,capability])=><article className="module-experience-card is-active" key={label}>
        <span className="module-experience-card-label">Capability</span><strong>{label}</strong>
        <p>{capability.status==='ready'?'Ready':'Blocked'}</p><small>{capability.reason}</small>
      </article>)}
    </div>
    <div className="notice">Blocked external capabilities stay blocked. ATLAS Care does not simulate Medicaid/payer eligibility, EHR connectivity or clinical authorization.</div>
  </>}</State></Layout>;
}

export function CareRoutes(){
  return <Routes>
    <Route path="/care" element={<Overview/>}/>
    <Route path="/care/participants" element={<Participants/>}/>
    <Route path="/care/caregivers" element={<Caregivers/>}/>
    <Route path="/care/plans" element={<Plans/>}/>
    <Route path="/care/timecards" element={<Timecards/>}/>
    <Route path="/care/readiness" element={<Readiness/>}/>
    <Route path="*" element={<Navigate to="/care" replace/>}/>
  </Routes>;
}
