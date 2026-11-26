import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { exportCreatorSpatialPreview, type SpatialPreviewResponse } from '../../lib/creatorApi';

/**
 * ATLAS Spatial Forge first bounded surface. This is NOT image-to-3D or
 * unconstrained prompt-to-mesh, and does not save an asset or invoke an AI model.
 */
export function SpatialForgeWorkspace() {
  const [primitive, setPrimitive] = useState<'cube' | 'pyramid' | 'cylinder' | 'sphere'>('cube');
  const [state, setState] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [result, setResult] = useState<SpatialPreviewResponse | null>(null);
  const [error, setError] = useState('');

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (state === 'working') return;
    setResult(null);
    setError('');
    setState('working');
    try {
      const response = await exportCreatorSpatialPreview(primitive);
      if (response.provenance !== 'atlas-procedural-preview' || response.mime_type !== 'model/obj' ||
          response.persisted !== false || response.billable !== false) {
        throw new Error('spatial_preview_provenance_invalid');
      }
      setResult(response);
      setState('ready');
    } catch (cause) {
      setState('error');
      setError(cause instanceof Error ? cause.message : 'spatial_preview_unavailable');
    }
  }

  function downloadObj() {
    if (!result || state !== 'ready') return;
    const url = URL.createObjectURL(new Blob([result.obj_content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.file_name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoke after the browser has begun consuming the object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return <section className="creator-page" aria-labelledby="spatial-forge-title">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb">
      <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Spatial Forge</span>
    </nav>
    <header className="creator-hero compact">
      <div>
        <p className="eyebrow">ATLAS Spatial Forge 777 · original native preview</p>
        <h1 id="spatial-forge-title">3D procedural workshop</h1>
        <p>Generate a real OBJ mesh of a basic shape. Image-to-3D, AI prompt-to-3D,
          materials and animation are not available in this preview.</p>
      </div>
    </header>
    <div className="creator-workbench">
      <form className="creator-composer" onSubmit={generate}>
        <label htmlFor="spatial-primitive"><span>3D shape</span></label>
        <select id="spatial-primitive" value={primitive}
          onChange={event => {setPrimitive(event.target.value as typeof primitive);setResult(null);setState('idle');setError('');}}>
          <option value="cube">Cube / Cubo</option>
          <option value="pyramid">Pyramid / Pirámide</option>
          <option value="cylinder">Cylinder / Cilindro</option>
          <option value="sphere">Sphere / Esfera</option>
        </select>
        <p>Only native procedural geometry. This does not send files or generate paid AI output.</p>
        <div className="creator-actions">
          <button className="creator-primary" type="submit" disabled={state === 'working'}>
            {state === 'working' ? 'Creating OBJ…' : 'Create OBJ preview'}
          </button>
        </div>
        <div role="status" aria-live="polite">
          {state === 'working' && 'Generating the procedural mesh…'}
          {state === 'error' && ('Preview unavailable: ' + error)}
          {state === 'ready' && result &&
            ('OBJ ready: ' + result.vertex_count + ' vertices, ' + result.triangle_count + ' triangles. Not saved to Creator Library.')}
        </div>
        {state === 'ready' && result &&
          <button type="button" onClick={downloadObj}>Download {result.file_name}</button>}
      </form>
    </div>
    <div className="creator-privacy">
      <strong>Verified scope</strong>
      <p>Uses your authenticated ATLAS Creator context and records an audit entry.
        The file is temporary and untextured; no provider inference, cloud storage, or billing is claimed.</p>
    </div>
  </section>;
}
