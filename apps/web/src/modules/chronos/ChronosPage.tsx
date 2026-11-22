import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { modules, searchTopics, progress, evidence, tasks, timeline, resolveChronosRoute } from './catalog';
import './chronos.css';
const base='/chronos';
const sections=[['','Inicio'],['explore','Exploración'],['research','Investigación'],['evidence','Evidencias'],['timeline','Cronología'],['review','777 Review']];
const images=[
 ['Geografía','03','https://images-assets.nasa.gov/image/PIA03388/PIA03388~medium.jpg'],
 ['Historia','06',''],['Planetario','08','https://images-assets.nasa.gov/image/PIA21345/PIA21345~medium.jpg'],['Laboratorio','02',''],['Evidencias','10','']
];
export function ChronosPage(){
 const location=useLocation();
 const route=resolveChronosRoute(location.pathname) ?? 'not-found';
 const [query,setQuery]=useState('');
 const [failed,setFailed]=useState<Record<string,boolean>>({});
 const selected=searchTopics(route.replace('research/','')).find(t=>t.id===route.replace('research/',''));
 const p=progress(), completed=tasks.filter(t=>t.done).length;
 const active=route==='research'||route.startsWith('research/')?'research':route;
 const results=query.trim()?searchTopics(query):[];
 return <div className="chronos-os">
 <a className="chronos-skip" href="#chronos-content">Saltar al contenido</a><aside className="chronos-sidebar"><Link to={base} className="chronos-brand"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32" fill="none" stroke="currentColor"/><path d="M12 66 40 8 68 66 40 30Z" fill="currentColor"/><ellipse cx="40" cy="46" rx="39" ry="10" transform="rotate(-15 40 46)" stroke="currentColor" fill="none"/></svg><span>ATLAS<br/><small>CHRONOS OS</small></span></Link><nav aria-label="CHRONOS">{sections.map(([path,label])=><Link key={path} aria-current={active===path?'page':undefined} to={base+(path?'/'+path:'')}>{label}</Link>)}</nav><Link to="/">Volver a ATLAS</Link></aside>
 <main className="chronos-main" id="chronos-content" tabIndex={-1}><header className="chronos-top"><div><small>UNIVERSAL RESEARCH CENTER</small><h1>ATLAS CHRONOS OS</h1></div><label>Buscar expedientes<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre o ID científico"/></label></header>
 {query.trim()&&<section className="chronos-panel" aria-label="Resultados de búsqueda"><h2>Resultados</h2><p role="status">{results.length?results.length+' expedientes encontrados':'No se encontraron expedientes.'}</p>{results.length?results.map(t=><Link key={t.id} to={base+'/research/'+t.id} onClick={()=>setQuery('')}>{t.id} · {t.title}</Link>):null}</section>}
 {route===''?<><section className="chronos-hero"><small>OBSERVATORIO UNIVERSAL</small><h2>Una historia. Todo el universo.</h2><p>Explora la evolución del universo, la Tierra y la humanidad.</p><div className="chronos-metrics"><span><strong>{p.total}</strong> Objetivos</span><span><strong>{modules.length}</strong> Módulos</span><span><strong>{p.certified}</strong> Certificados</span></div></section><div className="chronos-tiles">{images.map(([name,id,img])=><Link key={id} to={base+'/explore#'+id}>{img&&!failed[img]&&<img src={img} alt="" loading="lazy" onError={()=>setFailed(f=>({...f,[img]:true}))}/>}<strong>{name}</strong></Link>)}</div><section className="chronos-panel"><small>INVESTIGACIÓN ACTIVA</small><h2>01.001 · Origen del universo</h2><p>Big Bang y radiación cósmica. Revisión documental preliminar.</p><progress aria-label="Tareas documentales" value={completed} max={tasks.length}/><p>{completed}/{tasks.length} tareas preliminares; 0 certificaciones.</p><Link to={base+'/research/01.001'}>Reanudar investigación →</Link></section></>:null}
 {route==='explore'&&<section className="chronos-panel"><h2>Explorador científico</h2>{modules.map(m=><details key={m.id} id={m.id} open={location.hash==='#'+m.id||undefined}><summary>{m.id} · {m.name} — 0/{m.topics.length} certificados</summary>{m.topics.map(t=><Link key={t.id} to={base+'/research/'+t.id}>{t.id} · {t.title}</Link>)}</details>)}</section>}
 {active==='research'&&<section className="chronos-panel"><h2>{selected?selected.id+' · '+selected.title:'Investigaciones'}</h2>{selected?.id==='01.001'?<><p>Próximo paso: recuperar y reproducir datos instrumentales. Las fuentes están registradas, no auditadas integralmente.</p>{tasks.map(t=><p key={t.title}>{t.done?'Documentado preliminarmente':'Pendiente'} · {t.title}</p>)}<Link to={base+'/evidence'}>Consultar fuentes</Link></>:selected?<p>Expediente pendiente de investigación. No hay resultados certificados.</p>:<Link to={base+'/research/01.001'}>Abrir 01.001</Link>}</section>}
 {route==='evidence'&&<section className="chronos-panel"><h2>Registro de fuentes</h2><p>Referencias iniciales; verificación individual pendiente.</p>{evidence.map(e=><article key={e.url}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title} ↗</a><p>{e.detail}</p></article>)}</section>}
 {route==='timeline'&&<section className="chronos-panel"><h2>Cronología universal</h2><p>Fechas aproximadas, no a escala; Ma = millones de años. Las edades desde el Big Bang y las fechas civiles se identifican por separado.</p>{timeline.map(([date,event])=><article key={date}><strong>{date}</strong><p>{event}</p></article>)}</section>}
 {route==='review'&&<section className="chronos-panel"><h2>777 Review</h2><p>0/{p.total} objetivos certificados. No hay certificación de producción.</p>{tasks.map(t=><p key={t.title}>{t.done?'Preliminar':'Pendiente'} · {t.title}</p>)}</section>}
 {!['','explore','evidence','timeline','review','research'].includes(active)&&<section className="chronos-panel"><h2>Ruta no encontrada</h2><Link to={base}>Regresar a inicio</Link></section>}
 <footer>ATLAS CHRONOS OS · Registro inicial de solo lectura · Sin sincronización de servidor</footer></main></div>;
}
