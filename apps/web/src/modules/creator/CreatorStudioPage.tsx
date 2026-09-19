import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CreatorAsset, ProductionSummary } from '../../../../../packages/creator/types';
import type { CreativeEngineReadiness, CreativeMediaKind } from '../../../../../packages/creator/creative_engine';
import { buildCreativePlan, type CreativePlan } from '../../../../../packages/creator/creative_plan';
import { compileSpecializedPrompt, type PromptExportPackage } from '../../../../../packages/creator/prompt_engine';
import { exportCreatorPrompt, listCreativeEngines, listCreatorAssets, listCreatorProductions, saveCreativePlan } from '../../lib/creatorApi';
import { CreatorExperiencePage } from '../experience/CreatorExperiencePage';
import { DirectorWorkspace } from './director/DirectorWorkspace';
import './creator.css';

const CREATIVE_MEDIA_KINDS: CreativeMediaKind[] = ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'];

function initialMediaKind(value: string | null): CreativeMediaKind {
  return CREATIVE_MEDIA_KINDS.includes(value as CreativeMediaKind) ? value as CreativeMediaKind : 'image';
}

function newCreativePlanId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return '00000000-0000-4000-8000-000000000001';
}

export const studioEntryPoints = [
  { title: 'Writing Desk', route: '/studio/write' },
  { title: 'Content Intelligence', route: '/studio/content' },
  { title: 'Social Command Center', route: '/studio/social' },
  { title: 'Web Launch Lab', route: '/studio/web-launch' },
  { title: 'Image Lab', route: '/studio/create?type=image' },
  { title: 'ATLAS Director', route: '/studio/create?type=video' },
  { title: 'Music Lab', route: '/studio/create?type=music' },
  { title: 'Voice & Agents', route: '/studio/voice' },
  { title: 'Smart Teleprompter', route: '/studio/teleprompter' },
  { title: 'Creator Library', route: '/studio/library' },
  { title: 'Provider readiness', route: '/studio/providers' }
] as const;

export function CreatorHome() {
  return <CreatorExperiencePage />;
}

export function CreatorWorkspace() {
  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState<CreativeMediaKind>(() => initialMediaKind(searchParams.get('type')));
  const [selectedKinds, setSelectedKinds] = useState<CreativeMediaKind[]>(() => [initialMediaKind(searchParams.get('type'))]);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [destination, setDestination] = useState('');
  const [audience, setAudience] = useState('');
  const [aspectRatio, setAspectRatio] = useState('adaptive');
  const [language, setLanguage] = useState('English');
  const [negativeConstraints, setNegativeConstraints] = useState('');
  const [accessibility, setAccessibility] = useState({
    captions: false,
    transcript: false,
    altText: true,
    audioDescription: false
  });
  const [notice, setNotice] = useState('');
  const [engines, setEngines] = useState<CreativeEngineReadiness[]>([]);
  const [creativePlan, setCreativePlan] = useState<CreativePlan | null>(null);
  const [persistedVersion, setPersistedVersion] = useState(0);
  const [planState, setPlanState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [promptPackage, setPromptPackage] = useState<PromptExportPackage | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const canSubmit = prompt.trim().length >= 8;

  useEffect(() => {
    let active = true;
    listCreativeEngines()
      .then(value => { if (active) setEngines(value); })
      .catch(() => { if (active) setEngines([]); });
    return () => { active = false; };
  }, []);

  if (kind === 'video') return <DirectorWorkspace />;

  const executable = engines.some(engine =>
    engine.ready &&
    engine.mediaKinds.includes(kind) &&
    engine.executionClass !== 'prompt-export-only'
  );
  const promptExportReady = engines.some(engine =>
    engine.engineId === 'prompt-export' &&
    engine.ready &&
    engine.mediaKinds.includes(kind)
  );
  const specializedPrompt = creativePlan?.mediaKinds.includes(kind)
    ? compileSpecializedPrompt(creativePlan, kind)
    : null;

  function changeKind(next: CreativeMediaKind) {
    setKind(next);
    setSelectedKinds(current => current.includes(next) ? current : [...current, next]);
    setNotice('');
    setPromptPackage(null);
  }

  function toggleDeliverable(mediaKind: CreativeMediaKind) {
    setSelectedKinds(current => {
      if (current.includes(mediaKind)) {
        if (current.length === 1 || mediaKind === kind) return current;
        return current.filter(value => value !== mediaKind);
      }
      return [...current, mediaKind];
    });
  }

  function createPlan() {
    if (!canSubmit) {
      setNotice('Describe the result in at least 8 characters.');
      return;
    }
    const now = new Date().toISOString();
    try {
      const plan = buildCreativePlan({
        title: title || `${kind.toUpperCase()} Creative Plan`,
        brief: prompt,
        mediaKinds: selectedKinds,
        destinations: destination ? [destination] : [],
        audience,
        aspectRatio,
        language,
        accessibility,
        negativeConstraints: negativeConstraints
          .split('\n')
          .map(value => value.trim())
          .filter(Boolean)
      }, engines, {
        id: creativePlan?.id || newCreativePlanId(),
        organizationId: creativePlan?.organizationId || '',
        createdByUserId: creativePlan?.createdByUserId || '',
        now,
        version: persistedVersion || 1,
        createdAt: creativePlan?.createdAt
      });
      setCreativePlan(plan);
      setPlanState('idle');
      setPromptPackage(null);
      setNotice('Creative plan ready · no media generated.');
    } catch (error) {
      setPlanState('error');
      setNotice(error instanceof Error ? error.message : 'creative_plan_failed');
    }
  }

  async function persistPlan() {
    if (!creativePlan) return;
    setPlanState('saving');
    setNotice('');
    try {
      const saved = await saveCreativePlan(creativePlan, persistedVersion);
      setCreativePlan(saved);
      setPersistedVersion(saved.version);
      setPlanState('saved');
      setNotice(`Plan saved · version ${saved.version}`);
    } catch (error) {
      setPlanState('error');
      setNotice(error instanceof Error ? error.message : 'creative_plan_save_failed');
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setNotice('Describe the result in at least 8 characters.');
      return;
    }
    if (!executable) {
      setNotice('Generation is not submitted: no verified executable engine is ready for this media type.');
      return;
    }
    setNotice('A verified engine is available, but Phase 2 remains a planning workflow until its generation adapter is explicitly invoked.');
  }

  async function exportPrompt() {
    if (!canSubmit || !promptExportReady) return;
    setExportState('running');
    setNotice('');
    try {
      const exported = await exportCreatorPrompt({
        mediaKind: kind,
        brief: specializedPrompt?.prompt || prompt,
        aspectRatio,
        destination: destination || undefined,
        language,
        negativeConstraints: negativeConstraints
          .split('\n')
          .map(value => value.trim())
          .filter(Boolean)
      });
      setPromptPackage(exported);
      setExportState('success');
    } catch (error) {
      setExportState('error');
      setNotice(error instanceof Error ? error.message : 'prompt_export_failed');
    }
  }

  return <section className="creator-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Create</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Unified Creator composer</p><h1>Plan once. Create everywhere.</h1><p>ATLAS turns one authorized brief into a provider-neutral CreativePlan, specialized prompts and zero-cost-first execution choices without fabricating output.</p></div></header>
    <div className="creator-tabs" role="tablist" aria-label="Creative media modes">
      {CREATIVE_MEDIA_KINDS.map(item => <button key={item} type="button" role="tab" aria-selected={kind===item} className={kind===item?'active':''} onClick={()=>changeKind(item)}>{item}</button>)}
    </div>
    <div className="creator-workbench creator-unified-workbench">
      <aside className="creator-outline" aria-label="Creative plan deliverables">
        <p className="eyebrow">Deliverables</p>
        <h2>Media plan</h2>
        <p>Select outputs generated from the same source brief. Video continues in ATLAS Director.</p>
        <div className="creator-deliverables">
          {CREATIVE_MEDIA_KINDS.map(item => <label key={item}>
            <input type="checkbox" checked={selectedKinds.includes(item)} onChange={()=>toggleDeliverable(item)} disabled={item===kind} />
            <span>{item}</span>
          </label>)}
        </div>
        <div className="creator-engine-summary">
          <strong>Zero-cost-first</strong>
          <span>{engines.filter(engine => engine.ready).length} ready engine{engines.filter(engine => engine.ready).length === 1 ? '' : 's'}</span>
        </div>
      </aside>
      <form className="creator-composer" onSubmit={submit}>
        <label><span>Plan title</span><input aria-label="Plan title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Campaign or production name" /></label>
        <label><span>Creative brief</span><textarea aria-label="Creative brief" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={'Describe the '+kind+' you want to create…'} rows={7} /></label>
        <div className="creator-options">
          <label><span>Audience</span><input aria-label="Audience" value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Who is this for?" /></label>
          <label><span>Destination</span><input aria-label="Destination" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Web, Instagram, product UI…" /></label>
          <label><span>Aspect ratio</span><select aria-label="Aspect ratio" value={aspectRatio} onChange={e=>setAspectRatio(e.target.value)}><option value="adaptive">Adaptive</option><option value="1:1">Square 1:1</option><option value="9:16">Portrait 9:16</option><option value="16:9">Landscape 16:9</option></select></label>
          <label><span>Language</span><select aria-label="Language" value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Spanish</option></select></label>
        </div>
        <fieldset className="creator-accessibility">
          <legend>Accessibility</legend>
          <label><input type="checkbox" checked={accessibility.captions} onChange={e=>setAccessibility(value=>({...value,captions:e.target.checked}))} /><span>Require captions</span></label>
          <label><input type="checkbox" checked={accessibility.transcript} onChange={e=>setAccessibility(value=>({...value,transcript:e.target.checked}))} /><span>Require transcript</span></label>
          <label><input type="checkbox" checked={accessibility.altText} onChange={e=>setAccessibility(value=>({...value,altText:e.target.checked}))} /><span>Require alt text</span></label>
          <label><input type="checkbox" checked={accessibility.audioDescription} onChange={e=>setAccessibility(value=>({...value,audioDescription:e.target.checked}))} /><span>Require audio description</span></label>
        </fieldset>
        <label><span>Negative constraints</span><textarea aria-label="Negative constraints" value={negativeConstraints} onChange={e=>setNegativeConstraints(e.target.value)} placeholder="One constraint per line" rows={3} /></label>
        <div className="creator-actions">
          <button className="creator-primary" type="button" onClick={createPlan} disabled={!canSubmit}>Create plan</button>
          <button type="button" onClick={persistPlan} disabled={!creativePlan || planState==='saving'}>{planState==='saving'?'Saving…':'Save plan'}</button>
          <button type="submit" disabled={!canSubmit || !executable}>Generate {kind}</button>
          <button type="button" onClick={exportPrompt} disabled={!canSubmit || !promptExportReady || exportState==='running'}>{exportState==='running'?'Exporting…':'Export prompt package'}</button>
        </div>
        {notice && <p className="creator-notice" role="status">{notice}</p>}
      </form>
      <aside className="creator-preview">
        <div className={'creator-preview-orb '+kind} />
        {creativePlan ? <>
          <h2>Creative plan</h2>
          <p>{creativePlan.normalizedObjective}</p>
          <div className="creator-plan-deliverables">{creativePlan.deliverables.map(item => <span key={item.id}>{item.title}</span>)}</div>
          {specializedPrompt && <><h3>{kind.toUpperCase()} prompt</h3><pre>{specializedPrompt.prompt}</pre><p>Engine: {specializedPrompt.providerOrEngineId === 'prompt-export' ? 'Prompt Export' : specializedPrompt.providerOrEngineId}</p></>}
        </> : <>
          <h2>Preview</h2>
          <p>Create a plan to inspect deliverables and the specialized prompt. ATLAS does not insert fabricated output.</p>
        </>}
        {promptPackage && <div className="creator-export-preview"><h3>Prompt export</h3><pre>{promptPackage.prompt}</pre>{promptPackage.adaptationNotes.map(note => <p key={note}>{note}</p>)}</div>}
        <dl>
          <div><dt>Engine</dt><dd>{executable ? 'Verified executable ready' : 'No executable engine verified'}</dd></div>
          <div><dt>Prompt Export</dt><dd>{promptExportReady ? 'Ready · planning only' : 'Unavailable'}</dd></div>
          <div><dt>Plan version</dt><dd>{persistedVersion || 'Not saved'}</dd></div>
          <div><dt>Audit</dt><dd>Enabled</dd></div>
        </dl>
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

