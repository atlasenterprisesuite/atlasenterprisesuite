import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { exportDubbingSrt, validateDubbingProject, type DubbingProject } from '../../../../../packages/voice/src/dubbing-project';
const starter: DubbingProject = { id:'draft', title:'Nuevo proyecto', sourceLanguage:'es', targetLanguage:'en', consentVerified:false, segments:[] };
export function DubbingStudioPage() {
 const [project,setProject]=useState<DubbingProject>(starter);
 const [media,setMedia]=useState<string>('');
 const errors=useMemo(()=>validateDubbingProject(project),[project]);
 function addSegment(){setProject(p=>({...p,segments:[...p.segments,{id:crypto.randomUUID(),startMs:0,endMs:3000,speakerId:'speaker-1',sourceText:'',translatedText:''}]}));}
 function update(id:string,key:'sourceText'|'translatedText'|'speakerId'|'startMs'|'endMs',value:string){setProject(p=>({...p,segments:p.segments.map(s=>s.id===id?{...s,[key]:key==='startMs'||key==='endMs'?Number(value):value}:s)}));}
 function downloadSrt(){if(errors.length)return;const blob=new Blob([exportDubbingSrt(project)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='atlas-dubbing.srt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <main style={{padding:24,maxWidth:1000,margin:'auto'}}><Link to="/voice/studio">← ATLAS Voice Studio</Link><h1>ATLAS Dubbing Studio 777</h1><p>Editor de segmentos y subtítulos. Transcripción, traducción automática, síntesis y exportación de video requieren proveedores y procesamiento verificados.</p>
 <label>Nombre del proyecto <input aria-label="Nombre del proyecto" value={project.title} onChange={e=>setProject(p=>({...p,title:e.target.value}))}/></label>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0'}}><label>Idioma original <select value={project.sourceLanguage} onChange={e=>setProject(p=>({...p,sourceLanguage:e.target.value}))}><option value="es">Español</option><option value="en">English</option><option value="fr">Français</option></select></label><label>Idioma destino <select value={project.targetLanguage} onChange={e=>setProject(p=>({...p,targetLanguage:e.target.value}))}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label></div>
 <label>Vista previa local de audio/video <input type="file" accept="audio/*,video/*" onChange={e=>{if(media)URL.revokeObjectURL(media);const f=e.target.files?.[0];setMedia(f?URL.createObjectURL(f):'')}}/></label>
 {media&&<video controls src={media} style={{display:'block',maxWidth:'100%',width:500,marginTop:12}}/>}
 <h2>Línea de tiempo / hablantes</h2><button onClick={addSegment}>Añadir segmento</button>
 {project.segments.map(s=><fieldset key={s.id} style={{margin:'12px 0'}}><legend>{s.id.slice(0,8)}</legend><label>Inicio (ms) <input type="number" min="0" value={s.startMs} onChange={e=>update(s.id,'startMs',e.target.value)}/></label><label>Fin (ms) <input type="number" min="1" value={s.endMs} onChange={e=>update(s.id,'endMs',e.target.value)}/></label><label>Hablante <input value={s.speakerId} onChange={e=>update(s.id,'speakerId',e.target.value)}/></label><div><label>Original <textarea value={s.sourceText} onChange={e=>update(s.id,'sourceText',e.target.value)}/></label><label>Traducción <textarea value={s.translatedText} onChange={e=>update(s.id,'translatedText',e.target.value)}/></label></div></fieldset>)}
 <label style={{display:'block',margin:'16px 0'}}><input type="checkbox" checked={project.consentVerified} onChange={e=>setProject(p=>({...p,consentVerified:e.target.checked}))}/> Declaro que tengo autorización para utilizar las voces (esta declaración no equivale a verificación de identidad ni habilita clonación).</label>
 {errors.length>0&&<p role="alert">Validación: {errors.join(', ')}</p>}<button disabled={errors.length>0} onClick={downloadSrt}>Exportar SRT</button><p>Estado: editor local de demostración; sin persistencia en servidor, clonación de voz ni doblaje automático.</p></main>;
}
