import { useState, type FormEvent } from 'react';
import { captureSpatialPhotos, type SpatialCaptureReceipt } from './spatialCaptureApi';

export function SpatialCapturePanel({ entityId }: { entityId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [siteAuthorized, setSiteAuthorized] = useState(false);
  const [working, setWorking] = useState(false);
  const [receipts, setReceipts] = useState<SpatialCaptureReceipt[]>([]);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working) return;
    setWorking(true); setError(''); setReceipts([]);
    try {
      const result = await captureSpatialPhotos(entityId, files, consent, siteAuthorized);
      setReceipts(result); setFiles([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'capture_failed'); }
    finally { setWorking(false); }
  }
  return (
    <section aria-label="ATLAS Spatial Capture 5D">
      <h3>Captura móvil privada</h3>
      <p>Fotos del sitio autorizado. El registro de integridad es una declaración del dispositivo, no una verificación del servidor.</p>
      <form onSubmit={submit}>
        <label>Tomar o seleccionar fotografías
          <input type="file" accept="image/jpeg,image/png,image/heic,image/heif"
            multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
        </label>
        <p>{files.length} foto(s) seleccionada(s)</p>
        <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
          Tengo consentimiento para registrar estas fotografías</label>
        <label><input type="checkbox" checked={siteAuthorized} onChange={e=>setSiteAuthorized(e.target.checked)} />
          El propietario o responsable autorizó la captura de este lugar</label>
        <button type="submit" disabled={working || !files.length || !consent || !siteAuthorized}>
          {working ? 'Subiendo al espacio privado…' : 'Registrar captura'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      {receipts.length > 0 && <div role="status">
        {receipts.length} archivo(s) registrado(s) como no verificados.
        <p>Sesión: {receipts[0].sessionId}</p>
      </div>}
    </section>
  );
}
