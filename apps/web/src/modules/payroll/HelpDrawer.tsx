import { useEffect, useState } from 'react';
import { listPayrollHelp } from '../../lib/payrollApi';

export function HelpDrawer({route='/payroll/setup/tax'}:{route?:string}) {
  const [items,setItems]=useState<any[]>([]);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    listPayrollHelp(route).then(setItems).catch((cause)=>setError(cause instanceof Error?cause.message:'Help unavailable'));
  },[route]);

  return <section className="payroll-page payroll-operational-page">
    <header className="payroll-section-header">
      <p className="payroll-kicker">GOVERNED HELP</p><h1>Payroll help</h1>
      <p>Reference content retains source and review metadata.</p>
    </header>
    {error?<div className="payroll-notice payroll-error" role="alert">{error}</div>:null}
    {!items.length&&!error?<div className="payroll-empty-panel"><strong>No help record for this route</strong></div>:null}
    {items.map((item)=><article className="payroll-card" key={item.content_id}>
      <strong>{item.title}</strong><p>{item.body}</p>
      {item.source_url?<a href={item.source_url} target="_blank" rel="noreferrer">Official source</a>:null}
      <small>Last verified: {item.last_verified_date||'Not recorded'} · Owner: {item.owner||'Not recorded'}</small>
    </article>)}
  </section>;
}
