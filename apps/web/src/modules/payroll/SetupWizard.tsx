import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { savePayrollSetupSection } from '../../lib/payrollApi';

const steps=['company','admins','tax','bank','pay_schedule','workers','benefits','review'] as const;
type Step=(typeof steps)[number];

const labels:Record<Step,string>={
  company:'Company',admins:'Admins',tax:'Federal tax',bank:'Bank',pay_schedule:'Pay schedule',
  workers:'Workers',benefits:'Benefits',review:'Review'
};

export function SetupWizard() {
  const params=useParams();
  const step=(steps.includes(params.step as Step)?params.step:'company') as Step;
  const [legalName,setLegalName]=useState('');
  const [ein,setEin]=useState('');
  const [accountLabel,setAccountLabel]=useState('Payroll account');
  const [accountLast4,setAccountLast4]=useState('');
  const [cadence,setCadence]=useState('biweekly');
  const [nextPayDate,setNextPayDate]=useState('');
  const [error,setError]=useState<string|null>(null);
  const [saved,setSaved]=useState(false);
  const next=useMemo(()=>steps[Math.min(steps.indexOf(step)+1,steps.length-1)], [step]);

  async function submit(event:FormEvent) {
    event.preventDefault(); setError(null); setSaved(false);
    try {
      if(step==='company') await savePayrollSetupSection('company',{legalName});
      else if(step==='tax') {
        if(!/^\d{2}-\d{7}$/.test(ein)) throw new Error('Enter a Federal EIN in 12-3456789 format');
        await savePayrollSetupSection('tax',{ein});
      } else if(step==='bank') {
        if(accountLast4&&!/^\d{4}$/.test(accountLast4)) throw new Error('Enter only the last four account digits');
        await savePayrollSetupSection('bank',{accountLabel,accountLast4:accountLast4||null});
      } else if(step==='pay_schedule') {
        if(!nextPayDate) throw new Error('Choose the next pay date');
        await savePayrollSetupSection('pay_schedule',{cadence,nextPayDate});
      }
      setSaved(true);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Unable to save payroll setup');
    }
  }

  const passive=step==='admins'||step==='workers'||step==='benefits'||step==='review';

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header">
      <p className="payroll-kicker">PAYROLL SETUP</p>
      <h1>{labels[step]}</h1>
      <p>Saved only to the authenticated ATLAS organization. Provider verification remains separate.</p>
    </header>

    <nav className="payroll-step-nav" aria-label="Payroll setup">
      {steps.map((item)=><Link key={item} className={item===step?'active':''} to={'/payroll/setup/'+item}>{labels[item]}</Link>)}
    </nav>

    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}
    {saved?<div className="payroll-notice payroll-success" role="status">Saved successfully.</div>:null}

    {passive?<div className="payroll-callout">
      <div><strong>{labels[step]} uses the canonical workforce controls.</strong>
      <p>{step==='workers'?'Manage worker records in People.':step==='review'?'Review the configured sections; ATLAS will not claim external filing, payment or bank readiness without provider evidence.':'This section remains governed by organization permissions and verified data.'}</p></div>
      {step==='workers'?<Link className="payroll-button" to="/payroll/people">Open People</Link>:null}
    </div>:
    <form className="payroll-form" onSubmit={submit}>
      {step==='company'?<>
        <label>Legal employer name<input value={legalName} onChange={(e)=>setLegalName(e.target.value)} required /></label>
        <p className="payroll-field-help">Creates the organization-scoped legal employer record.</p>
      </>:null}
      {step==='tax'?<>
        <label>Federal EIN<input value={ein} onChange={(e)=>setEin(e.target.value)} placeholder="12-3456789" aria-invalid={Boolean(error)} /></label>
        <p className="payroll-field-help">Format validation only. ATLAS does not claim IRS verification from this entry.</p>
      </>:null}
      {step==='bank'?<>
        <div className="payroll-notice">Bank connection not configured</div>
        <label>Account label<input value={accountLabel} onChange={(e)=>setAccountLabel(e.target.value)} /></label>
        <label>Last four digits<input inputMode="numeric" maxLength={4} value={accountLast4} onChange={(e)=>setAccountLast4(e.target.value.replace(/\D/g,''))} /></label>
        <p className="payroll-field-help">ATLAS stores masked reference metadata only. This does not enable direct deposit.</p>
      </>:null}
      {step==='pay_schedule'?<>
        <label>Cadence<select value={cadence} onChange={(e)=>setCadence(e.target.value)}>
          <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option>
          <option value="semimonthly">Semimonthly</option><option value="monthly">Monthly</option>
        </select></label>
        <label>Next pay date<input type="date" value={nextPayDate} onChange={(e)=>setNextPayDate(e.target.value)} /></label>
      </>:null}
      <div className="payroll-actions">
        <button className="payroll-button" type="submit">Save and continue</button>
        {saved&&next!==step?<Link className="payroll-secondary-button" to={'/payroll/setup/'+next}>Next: {labels[next]}</Link>:null}
      </div>
    </form>}
  </section>;
}
