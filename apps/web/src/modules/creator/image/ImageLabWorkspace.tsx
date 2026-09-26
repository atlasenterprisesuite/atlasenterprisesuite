import { useEffect, useMemo, useRef, useState } from 'react';
import type { CreativeEngineReadiness } from '../../../../../../packages/creator/creative_engine';
import {
  normalizeImageEditPoint,
  validateImageEditRequest,
  type ImageEditPoint,
  type ImageEditRequest,
  type ImageEditVisibility
} from '../../../../../../packages/creator/image_edit';
import { exportCreatorPrompt, submitImageEdit } from '../../../lib/creatorApi';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Props = {
  engines: CreativeEngineReadiness[];
};

function newPointId(sequence: number) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `image-point-${sequence}`;
}

export function ImageLabWorkspace({ engines }: Props) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewDecoded, setPreviewDecoded] = useState(false);
  const [globalInstruction, setGlobalInstruction] = useState('');
  const [preserveIdentity, setPreserveIdentity] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<ImageEditRequest['aspectRatio']>('adaptive');
  const [visibility, setVisibility] = useState<ImageEditVisibility>('private');
  const [points, setPoints] = useState<ImageEditPoint[]>([]);
  const [notice, setNotice] = useState('');
  const [submissionState, setSubmissionState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [promptExport, setPromptExport] = useState<{ prompt: string; adaptationNotes: string[] } | null>(null);
  const [promptExportState, setPromptExportState] = useState<'idle' | 'running' | 'error'>('idle');
  const pointSequence = useRef(0);
  const promptExportRequestSequence = useRef(0);
  const pointEditorRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pointInstructions = useMemo(() => points
    .filter(point => point.instruction.trim())
    .map((point, index) => `Point ${index + 1} at (${point.x.toFixed(3)}, ${point.y.toFixed(3)}): ${point.instruction.trim()}`), [points]);

  const promptBrief = useMemo(() => [
    globalInstruction.trim(),
    preserveIdentity ? 'Preserve faces and identity unless explicitly targeted.' : '',
    ...pointInstructions
  ].filter(Boolean).join('\n'), [globalInstruction, preserveIdentity, pointInstructions]);

  const promptPlanKey = useMemo(() => JSON.stringify({
    source: sourceFile ? [sourceFile.name, sourceFile.size, sourceFile.type, sourceFile.lastModified] : null,
    promptBrief,
    aspectRatio,
    visibility
  }), [sourceFile, promptBrief, aspectRatio, visibility]);

  useEffect(() => {
    promptExportRequestSequence.current += 1;
    setPromptExport(null);
    setPromptExportState('idle');
  }, [promptPlanKey]);

  const executableEngine = useMemo(() => engines.find(engine =>
    engine.ready &&
    engine.mediaKinds.includes('image') &&
    engine.executionClass !== 'prompt-export-only'
  ) ?? null, [engines]);

  const promptExportReady = engines.some(engine => engine.engineId === 'prompt-export' && engine.ready && engine.mediaKinds.includes('image'));
  const safePreviewUrl = previewUrl.startsWith('blob:') ? encodeURI(previewUrl) : '';
  const hasInstruction = globalInstruction.trim().length > 0 || points.some(point => point.instruction.trim().length > 0);
  const canExportPrompt = hasInstruction && promptExportReady && promptBrief.trim().length >= 8 && promptExportState !== 'running';
  const canGenerate = Boolean(sourceFile && previewDecoded && hasInstruction && executableEngine && submissionState !== 'running');

  function selectSource(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setNotice('');
    setSubmissionState('idle');
    setPreviewDecoded(false);
    setPoints([]);

    if (!file) {
      setSourceFile(null);
      setPreviewUrl('');
      return;
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      setSourceFile(null);
      setPreviewUrl('');
      setNotice('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      setSourceFile(null);
      setPreviewUrl('');
      setNotice('Image must be larger than 0 bytes and no more than 15 MiB.');
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setSourceFile(file);
    setPreviewUrl(nextUrl);
  }

  function appendPoint(x: number, y: number) {
    pointSequence.current += 1;
    setPoints(current => [...current, {
      id: newPointId(pointSequence.current),
      x,
      y,
      instruction: ''
    }]);
  }

  function addPoint(event: React.MouseEvent<HTMLDivElement>) {
    if (!sourceFile || !previewDecoded) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const normalized = normalizeImageEditPoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height
    );
    appendPoint(normalized.x, normalized.y);
  }

  function handleCanvasKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!sourceFile || !previewDecoded || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    appendPoint(0.5, 0.5);
  }

  function updatePoint(id: string, instruction: string) {
    setPoints(current => current.map(point => point.id === id ? { ...point, instruction } : point));
  }

  function updatePointCoordinate(id: string, axis: 'x' | 'y', percentage: number) {
    const normalized = Math.min(1, Math.max(0, percentage / 100));
    setPoints(current => current.map(point => point.id === id ? { ...point, [axis]: normalized } : point));
  }

  function removePoint(id: string) {
    pointEditorRefs.current.delete(id);
    setPoints(current => current.filter(point => point.id !== id));
  }

  function focusPointEditor(id: string) {
    pointEditorRefs.current.get(id)?.focus();
  }

  function handlePreviewError() {
    setPreviewDecoded(false);
    setSourceFile(null);
    setPoints([]);
    setNotice('The selected file could not be decoded as a valid image.');
  }

  async function exportPromptPackage() {
    if (!canExportPrompt) return;
    const requestId = ++promptExportRequestSequence.current;
    setPromptExportState('running');
    setNotice('');
    try {
      const exported = await exportCreatorPrompt({
        mediaKind: 'image',
        brief: promptBrief,
        aspectRatio,
        language: 'English',
        negativeConstraints: preserveIdentity ? ['Do not alter untargeted faces or identity.'] : []
      });
      if (promptExportRequestSequence.current !== requestId) return;
      setPromptExport({ prompt: exported.prompt, adaptationNotes: exported.adaptationNotes });
      setPromptExportState('idle');
    } catch (error) {
      if (promptExportRequestSequence.current !== requestId) return;
      setPromptExportState('error');
      setNotice(error instanceof Error ? error.message : 'prompt_export_failed');
    }
  }

  async function generate() {
    if (!sourceFile) return;
    const request: ImageEditRequest = {
      globalInstruction,
      preserveIdentity,
      aspectRatio,
      visibility,
      points
    };
    const validation = validateImageEditRequest(request);
    if (!validation.ok) {
      setNotice(validation.error);
      return;
    }
    if (!executableEngine) {
      setNotice('No verified executable image engine is available. Generation remains fail-closed.');
      return;
    }

    setSubmissionState('running');
    setNotice('');
    try {
      const result = await submitImageEdit(sourceFile, request);
      const asset = result?.asset;
      const persisted = Boolean(
        asset &&
        typeof asset === 'object' &&
        typeof (asset as { id?: unknown }).id === 'string' &&
        ((asset as { id: string }).id).trim() &&
        (typeof (asset as { storagePath?: unknown }).storagePath === 'string' || typeof (asset as { storage_path?: unknown }).storage_path === 'string')
      );
      if (!persisted) throw new Error('image_asset_not_persisted');
      setSubmissionState('success');
      setNotice('Image edit submitted and persisted successfully.');
    } catch (error) {
      setSubmissionState('error');
      setNotice(error instanceof Error ? error.message : 'image_edit_failed');
    }
  }

  return <section className="creator-page image-lab-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><a href="/studio">ATLAS Studio</a><span>/</span><span>Image Lab</span></nav>
    <header className="creator-hero compact image-lab-hero">
      <div><p className="eyebrow">ATLAS Studio · Image editing</p><h1>ATLAS Image Lab</h1><p>Upload a photo, mark exact edit points, preserve identity, and submit only through verified image-generation infrastructure.</p></div>
    </header>

    <div className="image-lab-layout">
      <section className="image-lab-panel image-lab-controls">
        <label className="image-lab-upload">
          <span>Source image</span>
          <input aria-label="Source image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectSource} />
          <small>JPEG, PNG or WebP · maximum 15 MiB</small>
        </label>

        <label><span>Global instruction</span><textarea aria-label="Global instruction" value={globalInstruction} onChange={event=>setGlobalInstruction(event.target.value)} rows={5} placeholder="Example: Remove the person on the right. Keep both remaining faces unchanged." /></label>

        <label className="image-lab-check">
          <input type="checkbox" checked={preserveIdentity} onChange={event=>setPreserveIdentity(event.target.checked)} />
          <span>Preserve faces and identity</span>
        </label>

        <div className="creator-options">
          <label><span>Aspect ratio</span><select aria-label="Image aspect ratio" value={aspectRatio} onChange={event=>setAspectRatio(event.target.value as ImageEditRequest['aspectRatio'])}><option value="adaptive">Adaptive</option><option value="1:1">Square 1:1</option><option value="9:16">Portrait 9:16</option><option value="16:9">Landscape 16:9</option></select></label>
          <label><span>Visibility</span><select aria-label="Image visibility" value={visibility} onChange={event=>setVisibility(event.target.value as ImageEditVisibility)}><option value="private">Private</option><option value="organization">Organization</option></select></label>
        </div>

        <div className="image-engine-state">
          <strong>{executableEngine ? executableEngine.displayName : 'No verified executable image engine'}</strong>
          <span>{executableEngine ? 'Verified readiness · generation available' : 'Generation remains fail-closed until readiness is verified.'}</span>
        </div>

        <div className="creator-actions">
          <button className="creator-primary" type="button" onClick={generate} disabled={!canGenerate}>
            {submissionState === 'running' ? 'Generating…' : 'Generate design'}
          </button>
          <button type="button" onClick={exportPromptPackage} disabled={!canExportPrompt}>
            {promptExportState === 'running' ? 'Exporting…' : 'Export prompt package'}
          </button>
        </div>
        {promptExport && <div className="creator-export-preview"><h3>Prompt export</h3><pre>{promptExport.prompt}</pre>{promptExport.adaptationNotes.map(note => <p key={note}>{note}</p>)}</div>}
        {notice && <p className="creator-notice" role="status">{notice}</p>}
      </section>

      <section className="image-lab-stage-panel">
        {sourceFile && safePreviewUrl ? <div
          className="image-lab-canvas"
          data-testid="image-edit-canvas"
          role="button"
          tabIndex={0}
          aria-label="Image edit canvas. Press Enter to add a point at center."
          onKeyDown={handleCanvasKeyDown}
        >
          <div className="image-lab-image-frame" data-testid="image-edit-frame" onClick={addPoint}>
            <img
              src={safePreviewUrl}
              alt="Source preview"
              onLoad={()=>setPreviewDecoded(true)}
              onError={handlePreviewError}
            />
            {points.map((point, index) => <button
              key={point.id}
              type="button"
              className="image-lab-marker"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              aria-label={`Edit point ${index + 1}`}
              onClick={event=>{ event.stopPropagation(); focusPointEditor(point.id); }}
            >{index + 1}</button>)}
          </div>
        </div> : <div className="image-lab-empty">
          <strong>Upload a source photo</strong>
          <span>Then click directly on the image to place edit points.</span>
        </div>}

        {sourceFile && <div className="image-lab-file-meta"><strong>{sourceFile.name}</strong><span>{(sourceFile.size / 1024 / 1024).toFixed(2)} MiB</span></div>}
      </section>

      <aside className="image-lab-panel image-lab-points">
        <p className="eyebrow">Targeted edits</p>
        <h2>Edit points</h2>
        {points.length === 0 ? <p>Click a specific area in the photo to create a targeted instruction.</p> : points.map((point, index) => <article key={point.id}>
          <div className="image-lab-point-heading">
            <strong>Point {index + 1}</strong>
            <span>{Math.round(point.x * 100)}% × {Math.round(point.y * 100)}%</span>
          </div>
          <label><span>Instruction</span><input
            ref={element=>{ if (element) pointEditorRefs.current.set(point.id, element); else pointEditorRefs.current.delete(point.id); }}
            aria-label={`Edit point ${index + 1} instruction`}
            value={point.instruction}
            onChange={event=>updatePoint(point.id, event.target.value)}
            placeholder="What should change here?"
          /></label>
          <div className="image-lab-point-position">
            <label><span>Horizontal %</span><input aria-label={`Edit point ${index + 1} horizontal position`} type="number" min="0" max="100" step="1" value={Math.round(point.x * 100)} onChange={event=>updatePointCoordinate(point.id, 'x', Number(event.target.value))} /></label>
            <label><span>Vertical %</span><input aria-label={`Edit point ${index + 1} vertical position`} type="number" min="0" max="100" step="1" value={Math.round(point.y * 100)} onChange={event=>updatePointCoordinate(point.id, 'y', Number(event.target.value))} /></label>
          </div>
          <button type="button" className="image-lab-remove" aria-label={`Remove edit point ${index + 1}`} onClick={()=>removePoint(point.id)}>Remove point</button>
        </article>)}
      </aside>
    </div>
  </section>;
}
