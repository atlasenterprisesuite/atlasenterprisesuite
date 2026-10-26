import { useEffect, useState } from 'react';
import { equatorialToHorizontal, validateLunarImage, verifyImageBytes } from './astronomyMath.mjs';

type Confidence='confirmed'|'probable'|'hypothesis';
const formations=[{name:'Mare Imbrium',confidence:'hypothesis'},{name:'Mare Tranquillitatis',confidence:'hypothesis'},{name:'Tycho',confidence:'hypothesis'}] as const;
export function AstronomyObservatoryPage() {
 const [file,setFile]=useState<File|null>(null);
 const [url,setUrl]=useState('');
 const [sha,setSha]=useState('');
 const [error,setError]=useState('');
 const [annotation,setAnnotation]=useState('');
 const [confidence,setConfidence]=useState<Confidence>('hypothesis');
 const [coords,setCoords]=useState({raDegrees:'',decDegrees:'',latitudeDegrees:'',longitudeDegrees:'',gmstDegrees:''});
 const [result,setResult]=useState<{azimuthDegrees:number;altitudeDegrees:number}|null>(null);
 useEffect(()=>{if(!file){setUrl('');return;} const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
 async function selectFile(next?:File) {
   setFile(null);setSha('');setError('');setAnnotation('');
   if(!next)return;
   if(!validateLunarImage(next).ok){setError('Archivo rechazado: solo JPEG, PNG o WebP hasta 20 MB.');return;}
   try {
     const bytes=new Uint8Array(await next.arrayBuffer());
     if(!verifyImageBytes({type:next.type,size:next.size,bytes})){setError('La firma del archivo no coincide con el formato declarado.');return;}
     const digest=await crypto.subtle.digest('SHA-256',bytes);
     setSha(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));
     setFile(next);
   } catch {setError('No se pudo verificar la integridad del archivo.');}
 }
 function calculate() {
   setResult(null);
   if(Object.values(coords).some(v=>!v.trim())){setError('Faltan coordenadas y efemérides verificables.');return;}
   try {setResult(equatorialToHorizontal(Object.fromEntries(Object.entries(coords).map(([k,v])=>[k,Number(v)])) as Parameters<typeof equatorialToHorizontal>[0]));setError('');}
   catch {setError('Coordenadas inválidas. Cálculo bloqueado.');}
 }
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'clamp(16px,4vw,48px)',color:'inherit'}}>
   <p>ATLAS SCIENCE / ASTRONOMY 777</p><h1>Observatorio lunar</h1>
   <p>Investigación local: los originales no se envían al servidor. Los cálculos requieren coordenadas de una efeméride identificable. No se infieren cráteres automáticamente.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:24}}>
     <section aria-label="Fotografía lunar">
       <h2>Fotografía original</h2>
       <label htmlFor="lunar-image">Seleccionar imagen JPEG, PNG o WebP</label>
       <input id="lunar-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void selectFile(e.target.files?.[0])}/>
       {url&&<img src={url} alt="Fotografía lunar original sin modificaciones" style={{width:'100%',maxHeight:460,objectFit:'contain',background:'#101827'}}/>}
       {file&&<><p>Original conservado en memoria durante esta sesión: {file.name}</p><p style={{overflowWrap:'anywhere'}}>SHA-256: <code>{sha}</code></p></>}
       <p>No hay persistencia ni sincronización habilitada. Descarga o conserva el archivo original por separado.</p>
     </section>
     <section aria-label="Anotaciones y cálculos">
       <h2>Formaciones de referencia</h2>
       <ul>{formations.map(f=><li key={f.name}>{f.name} — {f.confidence} (sin verificación de esta fotografía)</li>)}</ul>
       <label htmlFor="lunar-note">Anotación manual</label>
       <textarea id="lunar-note" value={annotation} onChange={e=>setAnnotation(e.target.value)} maxLength={1000} style={{width:'100%'}}/>
       <label htmlFor="lunar-confidence">Certeza declarada</label>
       <select id="lunar-confidence" value={confidence} onChange={e=>setConfidence(e.target.value as Confidence)}>
         <option value="hypothesis">Hipótesis</option><option value="probable">Probable</option><option value="confirmed" disabled>Confirmada (bloqueada: requiere evidencia externa)</option>
       </select>
       <p>Nota local: {annotation||'Sin anotaciones'} · {confidence}. Esta etiqueta no equivale a validación científica.</p>
       <h2>Coordenadas ecuatoriales → horizontales</h2>
       <p>Introduce ascensión recta y declinación aparentes, tiempo sidéreo de Greenwich y posición del observador, todos en grados. Sin efemérides no se calcula una posición lunar.</p>
       {Object.keys(coords).map(key=><label key={key} style={{display:'block',marginBottom:8}}>{key}
         <input type="number" step="any" value={coords[key as keyof typeof coords]} onChange={e=>setCoords(p=>({...p,[key]:e.target.value}))} style={{display:'block',width:'100%'}}/>
       </label>)}
       <button type="button" onClick={calculate}>Calcular azimut y elevación</button>
       {result&&<p role="status">Azimut: {result.azimuthDegrees.toFixed(2)}° · Elevación: {result.altitudeDegrees.toFixed(2)}°. Resultado geométrico; procedencia de entradas no verificada.</p>}
     </section>
   </div>
   {error&&<p role="alert">{error}</p>}
 </main>;
}
