import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPayrollOverview, type PayrollOverview } from '../../lib/payrollApi';

export function PayrollHome() {
  const [overview,setOverview]=useState<PayrollOverview|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    getPayrollOverview()
      .then((value)=>{if(active){setOverview(value);setError(null);}})
      .catch((cause)=>{if(active)setError(cause instanceof Error?cause.message:'Payroll unavailable');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header">
      <p className="payroll-kicker">ATLAS PAYROLL</p>
      <h1>Payroll</h1>
      <p>Organization-scoped people, time, payroll runs and accounting handoff.</p>
    </header>

    {loading?<div className="payroll-notice" role="status">Loading payroll state…</div>:null}
    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}

    {!loading&&!error&&overview&&!overview.setupComplete?
      <div className="payroll-callout">
        <div>
          <strong>Set up payroll</strong>
          <p>Add the legal employer and pay schedule before payroll can be processed.</p>
        </div>
        <Link className="payroll-button" to="/payroll/setup/company">Start setup</Link>
      </div>:null}

    {overview?<div className="payroll-metric-grid" aria-label="Payroll organization state">
      <article className="payroll-card"><span>Workers</span><strong>{overview.workerCount===null?'Unavailable':overview.workerCount}</strong><small>Active records</small></article>
      <article className="payroll-card"><span>Next pay date</span><strong>{overview.nextPayrollDate||'Not scheduled'}</strong><small>Source-backed schedule</small></article>
      <article className="payroll-card"><span>Current run</span><strong>{overview.currentRunStatus||'No run'}</strong><small>Governed lifecycle</small></article>
      <article className="payroll-card"><span>Tax setup</span><strong>{overview.taxConfigurationStatus}</strong><small>Filing/remittance not implied</small></article>
      <article className="payroll-card"><span>Bank readiness</span><strong>{overview.disbursementStatus}</strong><small>No connection claim without verification</small></article>
      <article className="payroll-card"><span>Pending approvals</span><strong>{overview.pendingApprovals===null?'Unavailable':overview.pendingApprovals}</strong><small>Time entries</small></article>
    </div>:null}

    <div className="payroll-action-grid">
      <Link className="payroll-action-card" to="/payroll/people"><strong>People</strong><span>Employees and contractors</span></Link>
      <Link className="payroll-action-card" to="/payroll/time"><strong>Time & PTO</strong><span>Approved payroll inputs</span></Link>
      <Link className="payroll-action-card" to="/payroll/runs"><strong>Payroll runs</strong><span>Review, approve and process</span></Link>
      <Link className="payroll-action-card" to="/payroll/settings"><strong>Settings</strong><span>Commercial and provider readiness</span></Link>
    </div>
  </section>;
}
