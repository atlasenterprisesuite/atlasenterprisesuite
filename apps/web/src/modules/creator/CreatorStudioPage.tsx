import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CreatorAsset, ProductionSummary } from '../../../../../packages/creator/types';
import type { CreativeEngineReadiness } from '../../../../../packages/creator/creative_engine';
import type { PromptExportPackage } from '../../../../../packages/creator/prompt_engine';
import { exportCreatorPrompt, listCreativeEngines, listCreatorAssets, listCreatorProductions } from '../../lib/creatorApi';
import { CreatorExperiencePage } from '../experience/CreatorExperiencePage';
import { DirectorWorkspace } from './director/DirectorWorkspace';
import './creator.css';

type MediaKind = 'image' | 'video' | 'music' | 'voice';

export const studioEntryPoints = [
  { title: 'Content Intelligence', route: '/studio/content' },
  { title: 'Image Lab', route: '/studio/create?type=image' },
  { title: 'ATLAS Director', route: '/studio/create?type=video' },
  { title: 'Music Lab', route: '/studio/create?type=music' },
  { title: 'Voice & Agents', route: '/studio/voice' },
  { title: 'Creator Library', route: '/studio/library' },
  { title: 'Provider readiness', route: '/studio/providers' }
] as const;

export function CreatorHome() {
  return <CreatorExperiencePage />;
}

export function CreatorWorkspace() {
  const [searchParams] = useSearchParams();
  const initial = searchParams.get('type');
  const [kind, setKind] = useState<MediaKind>(initial === 'video' || initial === 'music' || initial === 'voice' ? initial : 'image');
  const [prompt, setPrompt] = useState('');
  const [notice, setNotice] = useState('');
  const [engines, setEngines] = useState<CreativeEngineReadiness[]>([]);
  const [promptPackage, setPromptPackage] = useState<PromptExportPackage | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const canSubmit = prompt.trim().length >= 8;

  useEffect(() => {
    let active = true;
    listCreativeEngines().then(value => { if (active) setEngines(value); }).catch(() => { if (active) setEngines([]); });
    return () => { active = false; };
  }, []);

  if (kind === 'video') return <DirectorWorkspace />;

  const executable = engines.some(engine =>
    engine.ready &&
    engine.mediaKinds.includes(kind) &&
    engine.executionClass !== 'prompt-export-only'
  );
  const promptExportReady = engines.some(engine => engine.engineId === 'prompt-export' && engine.ready && engine.mediaKinds.includes(kind));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) { setNotice('Describe the result in at least 8 characters.'); return; }
    if (!executable) setNotice('Generation is not submitted: no verified executable engine is ready for this media type.');
  }

  async function exportPrompt() {
    if (!canSubmit || !promptExportReady) return;
    setExportState('running');
    setNotice('');
    try {
      const exported = await exportCreatorPrompt({ mediaKind: kind, brief: prompt, language: 'English' });
      setPromptPackage(exported);
      setExportState('success');
    } catch (error) {
      setExportState('error');
      setNotice(error instanceof Error ? error.message : 'prompt_export_failed');
    }
  }

  return <section className="creator-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Create</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Creator workspace</p><h1>Bring an idea to life.</h1><p>Requests remain inside the organization boundary and are never reported as generated until an engine returns a verified result.</p></div></header>
    <div className="creator-workbench">
      <form className="creator-composer" onSubmit={submit}>
        <div className="creator-tabs" role="tablist">{(['image','video','music','voice'] as MediaKind[]).map(item => <button key={item} type="button" role="tab" aria-selected={kind===item} className={kind===item?'active':''} onClick={()=>{setKind(item);setNotice('');setPromptPackage(null)}}>{item}</button>)}</div>
        <label><span>Creative brief</span><textarea aria-label="Creative brief" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={'Describe the '+kind+' you want to create…'} rows={7} /></label>
        <div className="creator-options"><label><span>Format</span><select><option>Adaptive</option><option>Square 1:1</option><option>Portrait 9:16</option><option>Landscape 16:9</option></select></label><label><span>Visibility</span><select><option>Private</option><option>Organization</option></select></label></div>
        <button className="creator-primary" type="submit" disabled={!canSubmit || !executable}>Generate {kind}</button>
        <button type="button" onClick={exportPrompt} disabled={!canSubmit || !promptExportReady || exportState === 'running'}>{exportState === 'running' ? 'Exporting…' : 'Export prompt package'}</button>
        {notice && <p className="creator-notice" role="status">{notice}</p>}
      </form>
      <aside className="creator-preview">
        <div className={'creator-preview-orb '+kind} /><h2>Preview</h2>
        {promptPackage ? <><pre>{promptPackage.prompt}</pre>{promptPackage.adaptationNotes.map(note => <p key={note}>{note}</p>)}</> : <p>A verified result will appear here. ATLAS does not insert fabricated output.</p>}
        <dl><div><dt>Engine</dt><dd>{executable ? 'Verified engine available' : 'No executable engine verified'}</dd></div><div><dt>Prompt Export</dt><dd>{promptExportReady ? 'Ready · planning only' : 'Unavailable'}</dd></div><div><dt>Audit</dt><dd>Enabled</dd></div></dl>
      </aside>
    </div>
  </section>;
}

export function CreatorLibrary() {
  const [query, setQuery] = useState('');
  const [productions, setProductions] = useState<ProductionSummary[]>([]);
  const [assets, setAssets] = useState<CreatorAsset[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listCreatorProductions(), listCreatorAssets()])
      .then(([productionRows, assetRows]) => {
        if (!active) return;
        setProductions(productionRows);
        setAssets(assetRows);
        setState('ready');
      })
      .catch(value => {
        if (!active) return;
        setProductions([]);
        setAssets([]);
        setState('error');
        setError(value instanceof Error ? value.message : 'library_failed');
      });
    return () => { active = false; };
  }, []);

  const normalized = query.trim().toLowerCase();
  const filteredProductions = useMemo(() => productions.filter(production => !normalized || [production.title, production.brief, production.status].some(value => String(value).toLowerCase().includes(normalized))), [productions, normalized]);
  const filteredAssets = useMemo(() => assets.filter(asset => !normalized || [asset.providerId, asset.mediaType, asset.mimeType, asset.storagePath, JSON.stringify(asset.provenance)].some(value => String(value || '').toLowerCase().includes(normalized))), [assets, normalized]);

  return <section className="creator-page">
    <nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Library</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Projects & assets</p><h1>Creator Library</h1><p>Searchable organization media with provenance, versions and permission-aware visibility.</p></div></header>
    <label className="creator-search"><span>Search library</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects and assets" /></label>
    {state === 'loading' && <div className="creator-empty" role="status"><strong>Loading Creator Library…</strong><span>Reading authorized organization productions and assets.</span></div>}
    {state === 'error' && <div className="creator-empty" role="status"><strong>Library unavailable</strong><span>{error}</span></div>}
    {state === 'ready' && filteredProductions.length === 0 && filteredAssets.length === 0 && <div className="creator-empty"><strong>0 results</strong><span>No authorized Creator productions or assets match this organization/search.</span></div>}
    {state === 'ready' && (filteredProductions.length > 0 || filteredAssets.length > 0) && <div className="creator-library-grid">
      {filteredProductions.map(production => <article className="creator-library-card" key={`production-${production.id}`}>
        <p className="eyebrow">Production · {production.status}</p><h2>{production.title || 'Untitled production'}</h2><p>{production.brief || 'No creative brief saved.'}</p>
        <dl><div><dt>Version</dt><dd>{production.version}</dd></div><div><dt>Updated</dt><dd>{production.updatedAt || 'Unknown'}</dd></div><div><dt>Output</dt><dd>{production.durationSeconds}s · {production.aspectRatio} · {production.resolutionPreference}</dd></div></dl>
      </article>)}
      {filteredAssets.map(asset => <article className="creator-library-card" key={`asset-${asset.id}`}>
        <p className="eyebrow">Asset · {asset.mediaType}</p><h2>{asset.providerId || 'Provider not recorded'}</h2><p>{asset.mimeType || 'Media type not reported'}</p>
        <dl><div><dt>Production</dt><dd>{asset.productionId}</dd></div><div><dt>Updated</dt><dd>{asset.updatedAt || 'Unknown'}</dd></div><div><dt>Provenance</dt><dd><code>{JSON.stringify(asset.provenance)}</code></dd></div></dl>
      </article>)}
    </div>}
  </section>;
}

export function CreatorProviders() {
  const [engineRows, setEngineRows] = useState<CreativeEngineReadiness[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listCreativeEngines()
      .then(value => { if (!active) return; setEngineRows(value); setState('ready'); })
      .catch(value => { if (!active) return; setEngineRows([]); setState('error'); setError(value instanceof Error ? value.message : 'engines_failed'); });
    return () => { active = false; };
  }, []);

  return <section className="creator-page">
    <nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Providers</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Governance</p><h1>Creative engine readiness</h1><p>Capability states reflect verified configuration only. Prompt Export is planning-only and does not claim generated media.</p></div></header>
    {state === 'loading' && <div className="creator-empty" role="status"><strong>Loading creative engines…</strong><span>Waiting for authenticated ATLAS Creator services.</span></div>}
    {state === 'error' && <div className="creator-empty" role="status"><strong>Creative engine readiness unavailable</strong><span>{error}</span></div>}
    {state === 'ready' && engineRows.length === 0 && <div className="creator-empty"><strong>No creative engines available</strong><span>ATLAS will not infer readiness from placeholders.</span></div>}
    {state === 'ready' && engineRows.length > 0 && <div className="provider-list">{engineRows.map(engine => <article key={engine.engineId}><div><h2>{engine.displayName}</h2><p>{engine.executionClass}</p><small>{engine.engineId === 'prompt-export' ? 'Planning only · no media generation' : `Last verified: ${engine.lastVerifiedAt ? new Date(engine.lastVerifiedAt).toLocaleString() : 'Never verified'}`}</small></div><span className="provider-state">{engine.connectionState}</span></article>)}</div>}
    <div className="creator-privacy"><strong>Truthful readiness</strong><p>Local, self-hosted and external engines are shown ready only after their real readiness checks succeed.</p></div>
  </section>;
}

