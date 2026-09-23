import { useEffect, useState } from 'react';
import { getPayrollCommercialState, type PayrollCommercialState } from '../../lib/payrollApi';

export function PayrollSettingsPage() {
  const [state,setState]=useState<PayrollCommercialState|null|undefined>(undefined);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    getPayrollCommercialState().then(setState).catch((cause)=>setError(cause instanceof Error?cause.message:'Payroll settings unavailable'));
  },[]);

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header">
      <p className="payroll-kicker">SETTINGS</p><h1>Payroll settings</h1>
      <p>Commercial state and provider boundaries come from server-authoritative configuration.</p>
    </header>
    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}
    {state===undefined?<div className="payroll-notice">Loading settings…</div>:null}
    {state===null?<div className="payroll-callout"><div><strong>Billable customer organization</strong><p>Customer pricing not configured. No subscription or payment state is claimed.</p></div></div>:null}
    {state?.billing_mode==='internal_comp'?<div className="payroll-callout"><div><strong>$0 ATLAS software fee</strong><p>Authorized internal compensation mode. External provider charges remain separate and are not waived.</p></div></div>:null}
    {state?.billing_mode==='customer'?<div className="payroll-callout"><div><strong>Billable customer organization</strong><p>{state.plan_id&&state.pricing_version?'Approved plan metadata is configured.':'Customer pricing not configured.'} Provider payment status remains separate.</p></div></div>:null}
    {state?<div className="payroll-metric-grid">
      <article className="payroll-card"><span>Billing mode</span><strong>{state.billing_mode}</strong></article>
      <article className="payroll-card"><span>Billing status</span><strong>{state.billing_status}</strong></article>
      <article className="payroll-card"><span>Provider</span><strong>{state.billing_provider||'Not configured'}</strong></article>
    </div>:null}
  </section>;
}
