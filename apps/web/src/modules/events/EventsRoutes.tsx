import React, { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import {
  createEvent, createEventTalent, createEventVenue, createProductionTask, createSettlementDraft,
  listEvents, listEventSettlements, listEventTalent, listEventVenues, listProductionTasks,
  type AtlasEvent, type EventProductionTask, type EventSettlement, type EventTalent, type EventVenue
} from '../../lib/eventsApi';

const nav=[
  ['/events','Events'],
  ['/events/new','New event'],
  ['/events/venues','Venues'],
  ['/events/talent','Talent'],
  ['/events/production','Production'],
  ['/events/settlement','Settlement']
] as const;

function EventsLayout({children}:{children:React.ReactNode}) {
  return <section className="page-stack">
    <header className="page-header">
      <p className="eyebrow">ATLAS Events & Entertainment</p>
      <h1>Live entertainment operating system</h1>
      <p>Artist → Promoter → Venue → Production → Ticket → Fan → Payment → Settlement, governed by ATLAS identity, tenant scope and audit boundaries.</p>
    </header>
    <div className="notice strong">External ticketing, payments and artist-booking providers remain fail-closed until explicitly authorized and verified.</div>
    <nav className="inline-actions" aria-label="Events operations">{nav.map(([to,label])=><Link key={to} className="button secondary" to={to}>{label}</Link>)}</nav>
    {children}
  </section>;
}

function ErrorNotice({value}:{value:string|null}) {
  return value?<div className="notice error" role="alert">{value}</div>:null;
}

function EventsHome() {
  const [events,setEvents]=useState<AtlasEvent[]>([]);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{listEvents().then(setEvents).catch((e)=>setError(e instanceof Error?e.message:'Events unavailable'));},[]);
  return <EventsLayout>
    {!events.length&&!error?<div className="notice"><strong>No events yet.</strong> Create the first governed event record; ATLAS will not imply ticket sales or provider issuance.</div>:null}
    <ErrorNotice value={error}/>
    <div className="module-grid">{events.map((event)=><article className="module-card enabled" key={event.id}>
      <span>{event.lifecycle_status}</span><strong>{event.name}</strong>
      <p>{new Date(event.starts_at).toLocaleString()}</p>
      <small>{event.capacity===null?'Capacity not configured':'Capacity '+event.capacity}</small>
    </article>)}</div>
    <div className="module-grid compact">
      <Link className="module-card enabled" to="/hospitality"><span>Shared capability</span><strong>Hospitality & event spaces</strong><p>Reuse properties, spaces and access-provider boundaries.</p></Link>
      <Link className="module-card enabled" to="/studio"><span>Shared capability</span><strong>Creator Studio</strong><p>Reuse approved media assets and campaign production workflows.</p></Link>
      <Link className="module-card enabled" to="/finance"><span>Shared capability</span><strong>Finance</strong><p>Keep accounting and settlement postings in the canonical financial system.</p></Link>
    </div>
  </EventsLayout>;
}

function NewEventPage() {
  const [name,setName]=useState('');
  const [startsAt,setStartsAt]=useState('');
  const [endsAt,setEndsAt]=useState('');
  const [capacity,setCapacity]=useState('');
  const [saved,setSaved]=useState<AtlasEvent|null>(null);
  const [error,setError]=useState<string|null>(null);
  async function submit(event:FormEvent){
    event.preventDefault();setError(null);
    try{
      const result=await createEvent({name,startsAt:new Date(startsAt).toISOString(),endsAt:endsAt?new Date(endsAt).toISOString():undefined,capacity:capacity?Number(capacity):undefined});
      setSaved(result);
    }catch(e){setError(e instanceof Error?e.message:'Unable to create event');}
  }
  return <EventsLayout>
    <h2>Create event</h2><ErrorNotice value={error}/>
    {saved?<div className="notice strong" role="status">Event saved: {saved.name}</div>:null}
    <form className="settings-card" onSubmit={submit}>
      <label>Event name<input value={name} onChange={(e)=>setName(e.target.value)} required /></label>
      <label>Starts<input type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)} required /></label>
      <label>Ends<input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)} /></label>
      <label>Capacity<input type="number" min="0" value={capacity} onChange={(e)=>setCapacity(e.target.value)} /></label>
      <button className="button" type="submit">Save event</button>
    </form>
  </EventsLayout>;
}

function VenuesPage(){
  const [items,setItems]=useState<EventVenue[]>([]);
  const [name,setName]=useState('');const [capacity,setCapacity]=useState('');
  const [error,setError]=useState<string|null>(null);
  const load=()=>listEventVenues().then(setItems).catch((e)=>setError(e instanceof Error?e.message:'Venues unavailable'));
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent){e.preventDefault();try{await createEventVenue({name,capacity:capacity?Number(capacity):undefined});setName('');setCapacity('');await load();}catch(c){setError(c instanceof Error?c.message:'Venue save failed');}}
  return <EventsLayout><h2>Venues</h2><ErrorNotice value={error}/>
    <form className="settings-card" onSubmit={submit}><label>Venue name<input value={name} onChange={(e)=>setName(e.target.value)} required /></label><label>Capacity<input type="number" min="0" value={capacity} onChange={(e)=>setCapacity(e.target.value)}/></label><button className="button" type="submit">Add venue</button></form>
    <div className="module-grid">{items.map((item)=><article className="module-card enabled" key={item.id}><span>Venue</span><strong>{item.name}</strong><p>{item.capacity===null?'Capacity not configured':'Capacity '+item.capacity}</p></article>)}</div>
  </EventsLayout>;
}

function TalentPage(){
  const [items,setItems]=useState<EventTalent[]>([]);const [name,setName]=useState('');const [error,setError]=useState<string|null>(null);
  const load=()=>listEventTalent().then(setItems).catch((e)=>setError(e instanceof Error?e.message:'Talent unavailable'));
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent){e.preventDefault();try{await createEventTalent(name);setName('');await load();}catch(c){setError(c instanceof Error?c.message:'Talent save failed');}}
  return <EventsLayout><h2>Talent</h2><ErrorNotice value={error}/>
    <div className="notice">New talent records start as <strong>planned</strong>. ATLAS does not mark a booking contracted without contract evidence.</div>
    <form className="settings-card" onSubmit={submit}><label>Talent or artist<input value={name} onChange={(e)=>setName(e.target.value)} required /></label><button className="button" type="submit">Add talent</button></form>
    <div className="module-grid">{items.map((item)=><article className="module-card enabled" key={item.id}><span>{item.booking_status}</span><strong>{item.display_name}</strong><p>{item.contract_evidence_reference?'Contract evidence on file':'No contract evidence recorded'}</p></article>)}</div>
  </EventsLayout>;
}

function ProductionPage(){
  const [events,setEvents]=useState<AtlasEvent[]>([]);const [tasks,setTasks]=useState<EventProductionTask[]>([]);
  const [eventId,setEventId]=useState('');const [title,setTitle]=useState('');const [workstream,setWorkstream]=useState('general');const [error,setError]=useState<string|null>(null);
  async function load(){try{const [e,t]=await Promise.all([listEvents(),listProductionTasks()]);setEvents(e);setTasks(t);setEventId((v)=>v||e[0]?.id||'');}catch(c){setError(c instanceof Error?c.message:'Production unavailable');}}
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent){e.preventDefault();try{await createProductionTask({eventId,title,workstream});setTitle('');await load();}catch(c){setError(c instanceof Error?c.message:'Task save failed');}}
  return <EventsLayout><h2>Production</h2><ErrorNotice value={error}/>
    {events.length?<form className="settings-card" onSubmit={submit}><label>Event<select value={eventId} onChange={(e)=>setEventId(e.target.value)}>{events.map((e)=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Task<input value={title} onChange={(e)=>setTitle(e.target.value)} required /></label><label>Workstream<input value={workstream} onChange={(e)=>setWorkstream(e.target.value)} /></label><button className="button" type="submit">Add task</button></form>:<div className="notice">Create an event before production tasks.</div>}
    <div className="module-grid">{tasks.map((task)=><article className="module-card enabled" key={task.id}><span>{task.status}</span><strong>{task.title}</strong><p>{task.workstream}</p></article>)}</div>
  </EventsLayout>;
}

function SettlementPage(){
  const [events,setEvents]=useState<AtlasEvent[]>([]);const [items,setItems]=useState<EventSettlement[]>([]);
  const [eventId,setEventId]=useState('');const [counterparty,setCounterparty]=useState('');const [gross,setGross]=useState('');const [deductions,setDeductions]=useState('0');const [error,setError]=useState<string|null>(null);
  async function load(){try{const [e,s]=await Promise.all([listEvents(),listEventSettlements()]);setEvents(e);setItems(s);setEventId((v)=>v||e[0]?.id||'');}catch(c){setError(c instanceof Error?c.message:'Settlement unavailable');}}
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent){e.preventDefault();try{await createSettlementDraft({eventId,counterpartyType:'other',counterpartyReference:counterparty,grossAmountCents:Math.round(Number(gross)*100),deductionsCents:Math.round(Number(deductions||0)*100)});setCounterparty('');setGross('');await load();}catch(c){setError(c instanceof Error?c.message:'Settlement save failed');}}
  return <EventsLayout><h2>Finance & settlement</h2><ErrorNotice value={error}/>
    <div className="notice strong">Creating a settlement does not mark it paid. Payment status requires authenticated payment evidence and canonical Accounting reconciliation.</div>
    {events.length?<form className="settings-card" onSubmit={submit}><label>Event<select value={eventId} onChange={(e)=>setEventId(e.target.value)}>{events.map((e)=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Counterparty<input value={counterparty} onChange={(e)=>setCounterparty(e.target.value)} required /></label><label>Gross amount<input type="number" min="0" step="0.01" value={gross} onChange={(e)=>setGross(e.target.value)} required /></label><label>Deductions<input type="number" min="0" step="0.01" value={deductions} onChange={(e)=>setDeductions(e.target.value)} /></label><button className="button" type="submit">Create settlement draft</button></form>:null}
    <div className="module-grid">{items.map((item)=><article className="module-card enabled" key={item.id}><span>{item.status}</span><strong>{item.counterparty_reference}</strong><p>{'Net $'+(item.net_amount_cents/100).toFixed(2)}</p><small>{item.payment_evidence_reference?'Payment evidence present':'No payment evidence'}</small></article>)}</div>
  </EventsLayout>;
}

export function EventsRoutes() {
  return <AtlasShell><RequireAtlasIdentity><Routes>
    <Route path="/events" element={<EventsHome />} />
    <Route path="/events/new" element={<NewEventPage />} />
    <Route path="/events/venues" element={<VenuesPage />} />
    <Route path="/events/talent" element={<TalentPage />} />
    <Route path="/events/production" element={<ProductionPage />} />
    <Route path="/events/settlement" element={<SettlementPage />} />
    <Route path="/events/*" element={<Navigate to="/events" replace />} />
  </Routes></RequireAtlasIdentity></AtlasShell>;
}
