import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { modules, searchTopics, progress, evidence, tasks, timeline, resolveChronosRoute, filterEvidence, type ChronosEvidenceKind } from './catalog';
import { ATLAS_SESSION_EVENT } from '../../lib/atlasSession';
import { ATLAS_ACCESSIBILITY_PROFILE_EVENT, loadAccessibilityProfile, loadAccessibilityProfileRemote, resolveAccessibilityUserId, saveAccessibilityProfile, syncAccessibilityProfileRemote } from '../../services/accessibilityProfile';
import type { AccessibilityProfile } from '../../types/accessibility';
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
 const [moduleFilter,setModuleFilter]=useState('all');
 const [evidenceKind,setEvidenceKind]=useState<ChronosEvidenceKind|'all'>('all');
 const [evidenceQuery,setEvidenceQuery]=useState('');
 const [accessibilityProfile,setAccessibilityProfile]=useState<AccessibilityProfile>(()=>loadAccessibilityProfile(resolveAccessibilityUserId()));
 useEffect(()=>{
  const refresh=()=>setAccessibilityProfile(loadAccessibilityProfile(resolveAccessibilityUserId()));
  window.addEventListener(ATLAS_SESSION_EVENT,refresh);
  return ()=>window.removeEventListener(ATLAS_SESSION_EVENT,refresh);
 },[]);
 useEffect(()=>{
  const refresh=(event:Event)=>{
   const updated=(event as CustomEvent<AccessibilityProfile>).detail;
   if(updated?.userId===accessibilityProfile.userId)setAccessibilityProfile(updated);
  };
  window.addEventListener(ATLAS_ACCESSIBILITY_PROFILE_EVENT,refresh);
  return ()=>window.removeEventListener(ATLAS_ACCESSIBILITY_PROFILE_EVENT,refresh);
 },[accessibilityProfile.userId]);
 useEffect(()=>{
  let cancelled=false;
  void loadAccessibilityProfileRemote(accessibilityProfile.userId)
   .then(remote=>{if(!cancelled&&remote)setAccessibilityProfile(saveAccessibilityProfile(remote));})
   .catch(()=>undefined);
  return ()=>{cancelled=true;};
 },[accessibilityProfile.userId]);
 const changeAccessibility=(updates:Partial<AccessibilityProfile>)=>{
  const updated=saveAccessibilityProfile({...accessibilityProfile,...updates});
  setAccessibilityProfile(updated);
  void syncAccessibilityProfileRemote(updated);
 };

 const selected=searchTopics(route.replace('research/','')).find(t=>t.id===route.replace('research/',''));
 const p=progress(), completed=tasks.filter(t=>t.done).length;
 const active=route==='research'||route.startsWith('research/')?'research':route;
 const results=query.trim()?searchTopics(query):[];
 const visibleModules=moduleFilter==='all'?modules:modules.filter(m=>m.id===moduleFilter);
 const visibleTopics=visibleModules.reduce((count,m)=>count+m.topics.length,0);
 const visibleEvidence=filterEvidence(evidenceKind,evidenceQuery);
 const shellClass=['chronos-os',accessibilityProfile.highContrast?'accessibility-high-contrast':'',accessibilityProfile.motionReduced?'accessibility-reduced-motion':''].filter(Boolean).join(' ');
 return <div className={shellClass} lang="es" style={{fontSize:`${accessibilityProfile.textSizeScale*100}%`}} data-screen-reader-optimized={accessibilityProfile.screenReaderOptimized?'true':'false'} data-braille-preferred={accessibilityProfile.brailleMode?'true':'false'}>
 <a className="chronos-skip" href="#chronos-content">Saltar al contenido</a><aside className="chronos-sidebar"><Link to={base} className="chronos-brand"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32" fill="none" stroke="currentColor"/><path d="M12 66 40 8 68 66 40 30Z" fill="currentColor"/><ellipse cx="40" cy="46" rx="39" ry="10" transform="rotate(-15 40 46)" stroke="currentColor" fill="none"/></svg><span>ATLAS<br/><small>CHRONOS OS</small></span></Link><nav aria-label="CHRONOS">{sections.map(([path,label])=><Link key={path} aria-current={active===path?'page':undefined} to={base+(path?'/'+path:'')}>{label}</Link>)}</nav><section className="chronos-accessibility" aria-label="Preferencias de accesibilidad">
 <button type="button" aria-pressed={accessibilityProfile.highContrast} onClick={()=>changeAccessibility({highContrast:!accessibilityProfile.highContrast})}>Alto contraste</button>
 <button type="button" onClick={()=>changeAccessibility({textSizeScale:Math.min(2,Number((accessibilityProfile.textSizeScale+0.25).toFixed(2)))})}>Aumentar tamaño del texto</button>
 <button type="button" onClick={()=>changeAccessibility({textSizeScale:Math.max(0.75,Number((accessibilityProfile.textSizeScale-0.25).toFixed(2)))})}>Disminuir tamaño del texto</button>
 <Link to="/settings/accessibility/communication">Más preferencias de accesibilidad</Link>
 </section><Link to="/">Volver a ATLAS</Link></aside>
 <main className="chronos-main" id="chronos-content" tabIndex={-1}><header className="chronos-top"><div><small>UNIVERSAL RESEARCH CENTER</small><h1>ATLAS CHRONOS OS</h1></div><label>Buscar expedientes<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre o ID científico"/></label></header>
 {query.trim()&&<section className="chronos-panel" aria-label="Resultados de búsqueda"><h2>Resultados</h2><p role="status">{results.length?results.length+' expedientes encontrados':'No se encontraron expedientes.'}</p>{results.length?results.map(t=><Link key={t.id} to={base+'/research/'+t.id} onClick={()=>setQuery('')}>{t.id} · {t.title}</Link>):null}</section>}
 {route===''?<><section className="chronos-hero"><small>OBSERVATORIO UNIVERSAL</small><h2>Una historia. Todo el universo.</h2><p>Explora la evolución del universo, la Tierra y la humanidad.</p><a className="chronos-image-credit" href="https://science.nasa.gov/resource/the-blue-marble/" target="_blank" rel="noopener noreferrer">Referencia visual: NASA · Apolo 17 · 1972</a><div className="chronos-metrics"><span><strong>{p.total}</strong> Objetivos</span><span><strong>{modules.length}</strong> Módulos</span><span><strong>{evidence.length}</strong> Fuentes iniciales</span><span><strong>{p.certified}</strong> Certificados</span></div><p className="chronos-hero-note">Archivo de investigación abierto · Fuentes registradas, no auditadas ni certificadas.</p></section><div className="chronos-tiles">{images.map(([name,id,img])=><Link key={id} to={base+'/explore#'+id}>{img&&!failed[img]&&<img src={img} alt="" loading="lazy" onError={()=>setFailed(f=>({...f,[img]:true}))}/>}{(!img||failed[img])&&<span className="chronos-image-placeholder" aria-hidden="true">◇</span>}<strong>{name}</strong></Link>)}</div><div className="chronos-dashboard"><section className="chronos-panel chronos-active"><small>INVESTIGACIÓN ACTIVA</small><h2>01.001 · Origen del universo</h2><p>Big Bang y radiación cósmica. Revisión documental preliminar.</p><div className="chronos-source-strip">{evidence.slice(0,3).map(e=><a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer">{e.title}<small>Fuente registrada</small></a>)}</div><progress aria-label="Tareas documentales" value={completed} max={tasks.length}/><p>{completed}/{tasks.length} tareas preliminares; 0 certificaciones.</p><Link to={base+'/research/01.001'}>Reanudar investigación →</Link></section><section className="chronos-panel chronos-progress"><h2>Progreso de investigación</h2><div className="chronos-ring" style={{background:`conic-gradient(#dfbf83 ${completed/tasks.length*100}%, #30445a 0)`}} aria-hidden="true"><span>{completed/tasks.length*100}%</span></div><p>{completed} de {tasks.length} tareas documentales iniciales</p><p><strong>{p.certified}/{p.total}</strong> objetivos certificados</p><Link to={base+'/review'}>Abrir auditoría 777</Link></section></div><section className="chronos-panel chronos-time"><h2>Cronología universal</h2><ol>{timeline.map(([date,event])=><li key={date}><strong>{event}</strong><small>{date}</small></li>)}</ol><Link to={base+'/timeline'}>Abrir cronología completa</Link></section></>:null}
 {route==='explore'&&<section className="chronos-panel chronos-explore">
  <div className="chronos-section-heading"><div><small>CATÁLOGO CIENTÍFICO</small><h2>Explorador científico</h2><p>Diez áreas de conocimiento, 75 expedientes de investigación. Los registros aún no son certificaciones.</p></div>
   <label className="chronos-filter-label">Filtrar módulos
    <select value={moduleFilter} onChange={event=>setModuleFilter(event.target.value)}>
     <option value="all">Todos los módulos</option>
     {modules.map(m=><option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}
    </select>
   </label>
  </div>
  <p className="chronos-result-count" role="status">{visibleModules.length} {visibleModules.length===1?'módulo':'módulos'} · {visibleTopics} expedientes disponibles</p>
  <div className="chronos-module-grid">{visibleModules.map(m=><details className="chronos-module-card" key={m.id} id={m.id} open={location.hash==='#'+m.id||undefined}>
   <summary><span className="chronos-module-index">{m.id}</span><span><strong>{m.name}</strong><small>{m.topics.length} expedientes · 0 certificados</small></span></summary>
   <div className="chronos-module-topics">{m.topics.map(t=><Link key={t.id} to={base+'/research/'+t.id}>{t.id} · {t.title}</Link>)}</div>
  </details>)}</div>
 </section>}
 {active==='research'&&<section className="chronos-panel"><h2>{selected?selected.id+' · '+selected.title:'Investigaciones'}</h2>{selected?.id==='01.001'?<><p>Próximo paso: recuperar y reproducir datos instrumentales. Las fuentes están registradas, no auditadas integralmente.</p><ol className="chronos-task-list">{tasks.map(t=><li key={t.title}><span aria-hidden="true">{t.done?'✓':'○'}</span><span>{t.title}<small>{t.done?'Documentado preliminarmente':'Pendiente de evidencia y revisión'}</small></span></li>)}</ol><div className="chronos-research-evidence"><h3>Fuentes documentales asociadas</h3><p>{evidence.length} referencias externas catalogadas como E02, sin auditoría individual.</p><Link to={base+'/evidence'}>Consultar fuentes</Link></div></>:selected?<p>Expediente pendiente de investigación. No hay resultados certificados.</p>:<Link to={base+'/research/01.001'}>Abrir 01.001</Link>}</section>}
 {route==='evidence'&&<section className="chronos-panel chronos-evidence">
  <div className="chronos-section-heading"><div><small>PROCEDENCIA Y AUDITORÍA</small><h2>Registro de fuentes</h2>
   <p>Referencias documentales E02 vinculadas al expediente 01.001. Están catalogadas, pero su contenido y los datos originales todavía requieren auditoría científica.</p></div>
   <Link to={base+'/research/01.001'}>Volver al expediente 01.001</Link>
  </div>
  <div className="chronos-evidence-controls" aria-label="Filtros de fuentes">
   <div className="chronos-filter-group" role="group" aria-label="Tipo de fuente">
    {([['all','Todas'],['archive','Archivos científicos'],['publication','Publicaciones']] as const).map(([value,label])=>
     <button type="button" key={value} aria-pressed={evidenceKind===value} onClick={()=>setEvidenceKind(value)}>{label}</button>)}
   </div>
   <label className="chronos-filter-label">Buscar fuentes
    <input type="search" value={evidenceQuery} onChange={event=>setEvidenceQuery(event.target.value)} placeholder="Título, organismo o referencia"/>
   </label>
  </div>
  <p className="chronos-result-count" role="status">{visibleEvidence.length} {visibleEvidence.length===1?'fuente registrada':'fuentes registradas'} · 0 auditadas</p>
  {visibleEvidence.length?<div className="chronos-evidence-grid">{visibleEvidence.map(source=>
   <article className="chronos-evidence-card" key={source.id} id={source.id}>
    <div className="chronos-evidence-meta"><span>{source.kind==='archive'?'Archivo científico':'Publicación académica'}</span><code>{source.id}</code></div>
    <h3><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></h3>
    <p>{source.detail}</p>
    <dl><div><dt>Institución / revista</dt><dd>{source.institution}</dd></div><div><dt>Expediente</dt><dd>{source.topicId}</dd></div><div><dt>Clase documental</dt><dd>{source.classification}</dd></div></dl>
    <p className="chronos-review-pending">Revisión ATLAS pendiente</p>
   </article>)}</div>:<p className="chronos-empty">No hay fuentes que coincidan con estos filtros. Puedes cambiar el tipo o la búsqueda.</p>}
 </section>}
 {route==='timeline'&&<section className="chronos-panel"><h2>Cronología universal</h2><p>Fechas aproximadas, no a escala; Ma = millones de años. Las edades desde el Big Bang y las fechas civiles se identifican por separado.</p>{timeline.map(([date,event])=><article key={date}><strong>{date}</strong><p>{event}</p></article>)}</section>}
 {route==='review'&&<section className="chronos-panel"><h2>777 Review</h2><p>0/{p.total} objetivos certificados. No hay certificación de producción.</p>{tasks.map(t=><p key={t.title}>{t.done?'Preliminar':'Pendiente'} · {t.title}</p>)}</section>}
 {!['','explore','evidence','timeline','review','research'].includes(active)&&<section className="chronos-panel"><h2>Ruta no encontrada</h2><Link to={base}>Regresar a inicio</Link></section>}
 <footer>ATLAS CHRONOS OS · Registro inicial de solo lectura · Sin sincronización de servidor</footer></main></div>;
}
