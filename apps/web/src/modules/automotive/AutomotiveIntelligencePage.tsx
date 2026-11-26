import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { buildVehicleDossier, vehicleCatalog, type VehicleDossier } from './automotiveCatalog';
import './automotiveIntelligence.css';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;

export function AutomotiveIntelligencePage() {
 const [photo,setPhoto]=useState<File|null>(null);
 const [preview,setPreview]=useState<string|null>(null);
 const [candidate,setCandidate]=useState('');
 const [error,setError]=useState('');
 const [dossier,setDossier]=useState<VehicleDossier|null>(null);

 // Browser-local preview: no image leaves this device; clean up object URLs on replacement/unmount.
 useEffect(() => () => {if (preview) URL.revokeObjectURL(preview);},[preview]);

 const onPhoto=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0]??null;
  setError('');
  setDossier(null);
  if(!file){setPhoto(null);setPreview(null);return;}
  if(!imageTypes.has(file.type) || file.size > maxBytes || file.size===0){
   setPhoto(null);setPreview(null);
   event.currentTarget.value='';
   setError('Se aceptan únicamente imágenes JPG, PNG o WebP de hasta 5 MB.');
   return;
  }
  setPhoto(file);
  setPreview(URL.createObjectURL(file));
 };

 const generate=()=>{
  if(!candidate){setError('Selecciona un modelo para generar la ficha técnica.');setDossier(null);return;}
  const next=buildVehicleDossier(candidate,photo?.name);
  if(!next){setError('Modelo no registrado: generación bloqueada.');setDossier(null);return;}
  setError('');setDossier(next);
 };

 const exportDossier=()=>{
  if(!dossier)return;
  const data=new Blob([JSON.stringify(dossier,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(data);
  const link=document.createElement('a');
  link.href=url;link.download='atlas-automotive-ficha.json';
  document.body.appendChild(link);link.click();link.remove();
  URL.revokeObjectURL(url);
 };

 return <div className="page-stack automotive-intelligence" lang="es">
  <header className="automotive-hero">
   <p className="eyebrow">ATLAS Enterprise Suite · Automotive Intelligence 777</p>
   <h1>ATLAS Automotive Intelligence</h1>
   <p>De una fotografía a un expediente técnico con procedencia, sin confundir una comparación manual con reconocimiento visual automático.</p>
   <div className="automotive-hero-actions">
    <a href="#vehicle-workspace">Abrir estudio de vehículo</a>
    <Link to="/finance/accounting/reports/automotive-sales">Automotive Sales · Finanzas</Link>
   </div>
  </header>

  <section className="automotive-notice" role="status">
   <strong>Estado de capacidad:</strong> comparación técnica asistida. La detección automática por IA, el VIN individual y los precios de inventario en tiempo real no están conectados ni verificados. Las fotos no se cargan a servidores.
  </section>

  <section id="vehicle-workspace" className="automotive-workspace" aria-labelledby="automotive-workspace-title">
   <div className="automotive-panel">
    <div className="automotive-panel-heading"><span>01 / ENTRADA PRIVADA</span><h2 id="automotive-workspace-title">Fotografía de referencia</h2></div>
    <label className="automotive-upload" htmlFor="automotive-photo">
     <span>Fotografía del vehículo</span>
     <input id="automotive-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto}/>
     <small>JPG, PNG o WebP · máximo 5 MB · vista previa solo en este navegador</small>
    </label>
    <div className="automotive-preview">
      {preview?<img src={preview} alt="Vista previa de la fotografía seleccionada"/>:<div className="automotive-preview-empty"><span aria-hidden="true">◇</span><p>Selecciona una fotografía para visualizarla aquí.</p></div>}
    </div>
    {photo&&<p className="automotive-filename">Archivo local seleccionado: <strong>{photo.name}</strong></p>}
    <div className="automotive-privacy">Privacidad: el archivo permanece en memoria local y se descarta al cerrar o recargar la página.</div>
   </div>

   <div className="automotive-panel">
    <div className="automotive-panel-heading"><span>02 / CONTRASTE DOCUMENTAL</span><h2>Modelo de referencia</h2></div>
    <label className="automotive-model-label" htmlFor="automotive-model">Modelo para comparar
     <select id="automotive-model" value={candidate} onChange={event=>{setCandidate(event.target.value);setError('');setDossier(null);}}>
      <option value="">Seleccionar modelo…</option>
      {vehicleCatalog.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.manufacturer} {vehicle.model}</option>)}
     </select>
    </label>
    <p>Seleccionar un modelo no significa que la fotografía haya sido reconocida por una IA. La comprobación visual sigue siendo humana.</p>
    <button type="button" className="automotive-primary" onClick={generate}>Generar ficha técnica</button>
    {error&&<p className="automotive-error" role="alert">{error}</p>}
    <div className="automotive-boundary"><strong>Identidad de la unidad</strong><p>Sin VIN contrastado. No se asigna un porcentaje de confianza automático.</p></div>
   </div>
  </section>

  {dossier&&<section className="automotive-dossier" aria-labelledby="automotive-dossier-title">
   <div className="automotive-dossier-head">
    <div><span>03 / VEHICLE REGISTRY</span><h2 id="automotive-dossier-title">Ficha técnica con procedencia</h2><p><strong>{dossier.vehicle.manufacturer} {dossier.vehicle.model}</strong> · referencia de modelo, no identificación de una unidad.</p></div>
    <button type="button" onClick={exportDossier}>Exportar ficha JSON</button>
   </div>
   <div className="automotive-dossier-status">
    <p>Modelo seleccionado manualmente</p><p>Identificación visual automática: no ejecutada</p><p>Identidad individual: VIN sin verificar</p>
   </div>
   <dl className="automotive-spec-grid">
    <div><dt>Potencia</dt><dd>{dossier.vehicle.powerPs} PS / {dossier.vehicle.powerBhp} bhp</dd></div>
    <div><dt>0–100 km/h</dt><dd>{dossier.vehicle.accelerationZeroToHundredSeconds.toFixed(1)} s</dd></div>
    <div><dt>Velocidad máxima (dato del fabricante)</dt><dd>{dossier.vehicle.topSpeedKmh} km/h</dd></div>
    <div><dt>Motorización</dt><dd>{dossier.vehicle.engine}</dd></div>
   </dl>
   <p>Precio actual: sin verificación</p>
   <p>Fuente de especificaciones: <a href={dossier.source.url} target="_blank" rel="noopener noreferrer">Ficha oficial de McLaren — {dossier.vehicle.model}</a>. Revisada documentalmente el {dossier.source.reviewedOn}.</p>
  </section>}

  <section className="automotive-reference" aria-labelledby="automotive-reference-title">
   <div className="automotive-panel-heading"><span>CATÁLOGO VERIFICABLE</span><h2 id="automotive-reference-title">Comparación de generaciones</h2></div>
   <p>Especificaciones de modelos McLaren. No representan precios de venta ni existencia de unidades en McLaren Orlando.</p>
   <p className="automotive-unverified-price">Precio actual: sin verificación</p>
   <div className="automotive-comparison">
    {vehicleCatalog.map(v=><article key={v.id} className="automotive-reference-card">
     <span>McLaren · Spider</span><h3>{v.model}</h3>
     <dl><div><dt>Potencia</dt><dd>{v.powerPs} PS / {v.powerBhp} bhp</dd></div>
      <div><dt>0–100 km/h</dt><dd>{v.accelerationZeroToHundredSeconds.toFixed(1)} s</dd></div>
      <div><dt>Velocidad máxima</dt><dd>{v.topSpeedKmh} km/h</dd></div>
     </dl>
     <a href={v.specSourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ficha oficial de McLaren — ${v.model}`}>Ficha oficial de McLaren · Ver fuente</a>
    </article>)}
   </div>
  </section>
  <footer className="automotive-footer">ATLAS 777 REVIEW · Lectura documental y foto local · Integración de visión automática: NO-GO hasta autorización y pruebas.</footer>
 </div>;
}
