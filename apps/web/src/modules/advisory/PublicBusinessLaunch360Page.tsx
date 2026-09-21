import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS_LAUNCH_360 } from '../../../../../packages/advisory/src';
import { submitBusinessLaunch360Intake } from './publicAdvisoryApi';
import './public-advisory.css';

const phases = [
  ['01','Foundation','Business setup, operating model and launch priorities.'],
  ['02','Brand','Identity system and customer-facing brand foundation.'],
  ['03','Website','Web presence, conversion paths and core digital assets.'],
  ['04','CRM & Sales','Lead capture, pipeline structure and commercial workflow.'],
  ['05','Brand, Print & Promo','Governed physical and digital launch collateral.'],
  ['06','Marketing','Campaign preparation with provider authorization kept explicit.'],
  ['07','Launch','Coordinated go-live with evidence-based readiness.'],
  ['08','30-Day Review','Post-launch review, analytics and next-step operating plan.']
] as const;

export function PublicBusinessLaunch360Page() {
  const [fullName,setFullName] = useState('');
  const [businessName,setBusinessName] = useState('');
  const [email,setEmail] = useState('');
  const [phone,setPhone] = useState('');
  const [website,setWebsite] = useState('');
  const [businessStage,setBusinessStage] = useState('Starting a new business');
  const [goals,setGoals] = useState('');
  const [companyFax,setCompanyFax] = useState('');
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [reference,setReference] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setReference('');
    try {
      const result = await submitBusinessLaunch360Intake({
        fullName,businessName,email,phone,website,businessStage,goals,companyFax
      });
      setReference(result.reference);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit request');
    } finally {
      setSaving(false);
    }
  }

  return <main className="launch360-public">
    <header className="launch360-nav">
      <Link to="/" className="launch360-brand"><span>ATLAS</span><strong>Enterprise Suite</strong></Link>
      <a href="#request-quote" className="launch360-nav-cta">Request quote</a>
    </header>

    <section className="launch360-hero">
      <div>
        <p className="launch360-eyebrow">ATLAS Advisory Office · AW Finance Advisory Solutions</p>
        <h1>Launch your business as one connected operating system.</h1>
        <p className="launch360-lead">Business Launch 360 connects foundation, brand, web, CRM, sales, marketing, accounting and launch readiness without fabricating provider connections or financial state.</p>
        <div className="launch360-actions">
          <a href="#request-quote" className="launch360-primary">Request a quote</a>
          <a href="#system" className="launch360-secondary">See the launch system</a>
        </div>
        <p className="launch360-pricing-note">Pricing is prepared from the requested scope. No unapproved media spend, print cost or provider fee is represented as included.</p>
      </div>
      <aside className="launch360-orbit">
        <span>BUSINESS</span><strong>360</strong><small>{BUSINESS_LAUNCH_360.phases.length} governed phases</small>
      </aside>
    </section>

    <section className="launch360-metrics" aria-label="Launch system">
      <article><strong>10</strong><span>readiness dimensions</span></article>
      <article><strong>8</strong><span>launch phases</span></article>
      <article><strong>1</strong><span>connected engagement record</span></article>
      <article><strong>100%</strong><span>evidence-based completion</span></article>
    </section>

    <section className="launch360-section" id="system">
      <p className="launch360-eyebrow">Operating sequence</p>
      <h2>From idea to measurable launch.</h2>
      <div className="launch360-phase-grid">
        {phases.map(([number,title,description]) => <article key={number}>
          <span>{number}</span><h3>{title}</h3><p>{description}</p>
        </article>)}
      </div>
    </section>

    <section className="launch360-section launch360-connected">
      <div>
        <p className="launch360-eyebrow">Connected after approval</p>
        <h2>Quote → Client → Engagement → Accounts Receivable.</h2>
      </div>
      <p>Once your scope is reviewed, ATLAS can preserve the accepted quote, create the governed Advisory client and engagement, and generate the service invoice inside the existing Accounting ledger. Payment state remains separate until a real payment is recorded.</p>
    </section>

    <section className="launch360-request" id="request-quote">
      <div>
        <p className="launch360-eyebrow">Start Business Launch 360</p>
        <h2>Tell ATLAS what you are launching.</h2>
        <p>Your submission creates a real intake request for AW Finance Advisory Solutions. It does not automatically charge a card, create a payment, or mark any work complete.</p>
      </div>
      {reference ? <div className="launch360-success" role="status">
        <strong>Request received.</strong>
        <span>Reference: {reference}</span>
        <p>Your request is now available inside the governed Launch 360 workspace for review and quotation.</p>
      </div> : <form className="launch360-form" onSubmit={submit}>
        <label><span>Your name</span><input required value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" /></label>
        <label><span>Business name</span><input value={businessName} onChange={e => setBusinessName(e.target.value)} autoComplete="organization" /></label>
        <label><span>Email</span><input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
        <label><span>Phone</span><input value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
        <label><span>Website</span><input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" /></label>
        <label><span>Business stage</span><select value={businessStage} onChange={e => setBusinessStage(e.target.value)}>
          <option>Starting a new business</option>
          <option>Launching an existing business</option>
          <option>Rebranding and relaunching</option>
          <option>Expanding to a new location or market</option>
        </select></label>
        <label className="launch360-wide"><span>What do you need to launch?</span><textarea required value={goals} onChange={e => setGoals(e.target.value)} rows={5} /></label>
        <label className="launch360-honeypot" aria-hidden="true"><span>Fax</span><input tabIndex={-1} value={companyFax} onChange={e => setCompanyFax(e.target.value)} autoComplete="off" /></label>
        {error ? <p className="launch360-error" role="alert">{error}</p> : null}
        <button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Request my quote'}</button>
      </form>}
    </section>

    <footer className="launch360-footer">
      <span>ATLAS Business Launch 360</span>
      <Link to="/identity?next=%2Fadvisory%2Fbusiness-launch-360%2Fworkspace">Staff workspace</Link>
    </footer>
  </main>;
}
