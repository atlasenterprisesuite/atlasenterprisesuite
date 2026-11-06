import { useEffect, useRef, useState } from 'react';
import { analyzeSkyImage, enhanceSkyImage } from './skyLensImage.mjs';

type Mode = 'natural' | 'explore';
type Report = ReturnType<typeof analyzeSkyImage>;

export function SkyLensPanel({ file, originalSha256 }: { file: File | null; originalSha256: string }) {
  const [mode, setMode] = useState<Mode>('natural');
  const [busy, setBusy] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState('');
  const [enhancedSha256, setEnhancedSha256] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [previewSize, setPreviewSize] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setEnhancedUrl(''); setEnhancedSha256(''); setReport(null); setError(''); setPreviewSize(''); setBusy(false);
  }, [file, mode]);
  useEffect(() => () => { if (enhancedUrl) URL.revokeObjectURL(enhancedUrl); }, [enhancedUrl]);

  async function process() {
    if (!file || !originalSha256 || busy) return;
    const current = ++generation.current;
    setBusy(true); setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const factor = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * factor));
      const height = Math.max(1, Math.round(bitmap.height * factor));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas no disponible');
      try { context.drawImage(bitmap, 0, 0, width, height); }
      finally { bitmap.close(); }
      const frame = context.getImageData(0, 0, width, height);
      const analysis = analyzeSkyImage({ data: frame.data, width, height });
      const derived = enhanceSkyImage({ data: frame.data, width, height, mode });
      frame.data.set(derived); context.putImageData(frame, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob || !blob.size) throw new Error('PNG no disponible');
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const sha = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (generation.current !== current) return;
      setEnhancedUrl(URL.createObjectURL(blob));
      setEnhancedSha256(sha);
      setPreviewSize(`${width} × ${height} píxeles`);
      setReport(analysis);
    } catch {
      if (generation.current === current) setError('No se pudo procesar esta imagen en el dispositivo. Conserva el original y prueba otra fotografía.');
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }

  return <section aria-label="ATLAS Sky Lens" style={{marginTop:28,padding:20,border:'1px solid #64748b',borderRadius:16}}>
    <p style={{letterSpacing:2,fontSize:12}}>ATLAS SKY LENS / VISION COMPUTACIONAL LOCAL</p>
    <h2>Visión nocturna inspirada en el ojo</h2>
    <p>Adaptación tonal inspirada en la visión con poca luz: no es una simulación fisiológica, ni genera anillos, estrellas o datos astronómicos ausentes.</p>
    <label htmlFor="sky-mode">Modo de revelado</label>
    <select id="sky-mode" value={mode} onChange={e=>setMode(e.target.value as Mode)} style={{display:'block',padding:8,margin:'8px 0 12px'}}>
      <option value="natural">Natural: contraste moderado</option>
      <option value="explore">Explorar: sombras más visibles (puede amplificar ruido)</option>
    </select>
    <button type="button" disabled={!file || !originalSha256 || busy} onClick={()=>void process()} style={{padding:'10px 16px'}}>
      {busy?'Procesando localmente…':'Procesar fotografía original'}
    </button>
    {!file&&<p>Primero selecciona o captura una imagen en la sección anterior.</p>}
    {error&&<p role="alert">{error}</p>}
    {enhancedUrl&&<div style={{marginTop:18}}>
      <h3>Imagen procesada — vista derivada, no original</h3>
      <img alt="Fotografía procesada mediante ajuste tonal local; no incluye detalles generados" src={enhancedUrl} style={{width:'100%',maxHeight:460,objectFit:'contain',background:'#101827'}}/>
      <p>{previewSize} · Procesamiento local · Sin transmisión de la fotografía</p>
      <a href={enhancedUrl} download="atlas-sky-lens-derived.png">Descargar PNG procesado</a>
      <p style={{overflowWrap:'anywhere'}}>SHA-256 del original: <code>{originalSha256}</code></p>
      <p style={{overflowWrap:'anywhere'}}>SHA-256 del resultado: <code>{enhancedSha256}</code></p>
      {report&&<p role="status">Diagnóstico: {Math.round(report.nearBlackFraction*100)} % de píxeles casi negros; {Math.round(report.brightFraction*100)} % muy luminosos. {report.lowSignal?'Información luminosa muy escasa: no es posible recuperar detalles físicos ausentes.':'Hay información tonal aprovechable; evalúa el ruido antes de interpretar el resultado.'}</p>}
    </div>}
    <p>El original permanece separado y no se modifica. Esta vista puede reducirse a 2400 píxeles en su dimensión mayor para trabajar en móviles.</p>
  </section>;
}
