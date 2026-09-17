import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CreatorAsset, ProductionSummary, ProviderReadiness } from '../../../../../packages/creator/types';
import { listCreatorAssets, listCreatorProductions, listCreatorProviders } from '../../lib/creatorApi';
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
  const canSubmit = prompt.trim().length >= 8;
  if (kind === 'video') return <DirectorWorkspace />;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) { setNotice('Describe the result in at least 8 characters.'); return; }
    setNotice('Generation is not submitted: configure and authorize a compatible provider first.');
  }
  return <section className="creator-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Create</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Creator workspace</p><h1>Bring an idea to life.</h1><p>Requests remain inside the organization boundary and are never reported as generated until a provider returns a verified result.</p></div></header>
    <div className="creator-workbench">
      <form className="creator-composer" onSubmit={submit}>
        <div className="creator-tabs" role="tablist">{(['image','video','music','voice'] as MediaKind[]).map(item => <button key={item} type="button" role="tab" aria-selected={kind===item} className={kind===item?'active':''} onClick={()=>{setKind(item);setNotice('')}}>{item}</button>)}</div>
        <label><span>Creative brief</span><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={'Describe the '+kind+' you want to create…'} rows={7} /></label>
        <div className="creator-options"><label><span>Format</span><select><option>Adaptive</option><option>Square 1:1</option><option>Portrait 9:16</option><option>Landscape 16:9</option></select></label><label><span>Visibility</span><select><option>Private</option><option>Organization</option></select></label></div>
        <button className="creator-primary" type="submit" disabled={!canSubmit}>Generate {kind}</button>
        {notice && <p className="creator-notice" role="status">{notice}</p>}
      </form>
      <aside className="creator-preview"><div className={'creator-preview-orb '+kind} /><h2>Preview</h2><p>A verified result will appear here. ATLAS does not insert fabricated output.</p><dl><div><dt>Provider</dt><dd>Not configured</dd></div><div><dt>Storage</dt><dd>Supabase connection required</dd></div><div><dt>Audit</dt><dd>Enabled on submission</dd></div></dl></aside>
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
  const [providerRows, setProviderRows] = useState<ProviderReadiness[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listCreatorProviders()
      .then(value => {
        if (!active) return;
        setProviderRows(value);
        setState('ready');
      })
      .catch(value => {
        if (!active) return;
        setProviderRows([]);
        setState('error');
        setError(value instanceof Error ? value.message : 'providers_failed');
      });
    return () => { active = false; };
  }, []);

  return <section className="creator-page">
    <nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Providers</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Governance</p><h1>Provider readiness</h1><p>Capability states reflect verified server configuration only.</p></div></header>
    {state === 'loading' && <div className="creator-empty" role="status"><strong>Loading provider readiness…</strong><span>Waiting for the authenticated ATLAS Creator service.</span></div>}
    {state === 'error' && <div className="creator-empty" role="status"><strong>Provider readiness unavailable</strong><span>{error}</span></div>}
    {state === 'ready' && providerRows.length === 0 && <div className="creator-empty"><strong>No video providers configured</strong><span>ATLAS will not infer readiness from browser plugins or placeholder provider names.</span></div>}
    {state === 'ready' && providerRows.length > 0 && <div className="provider-list">{providerRows.map(provider => <article key={provider.providerId}><div><h2>{provider.displayName}</h2><p>{provider.capability ? `${provider.capability.modes.join(', ') || 'No modes reported'} · ${provider.capability.resolutions.join(', ') || 'No resolutions reported'}` : 'Capability contract unavailable until verified configuration.'}</p><small>Last verified: {provider.lastVerifiedAt ? new Date(provider.lastVerifiedAt).toLocaleString() : 'Never verified'}</small></div><span className="provider-state">{provider.connectionState}</span></article>)}</div>}
    <div className="creator-privacy"><strong>Visual location intelligence</strong><p>Location estimation must be explicitly initiated by an authorized user, requires consent, exposes confidence and limitations, and must never be used as silent tracking.</p></div>
  </section>;
}
