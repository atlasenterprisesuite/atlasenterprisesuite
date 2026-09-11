import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateCreatorAsset, getCreatorProviderReadiness } from '../../lib/atlasSession';
import { creatorProviders, type CreatorProviderState } from './providerRegistry';
import './creator.css';

type MediaKind = 'image' | 'video' | 'music' | 'voice';
type Visibility = 'Private' | 'Organization';

const tools = [
  { kind: 'image' as MediaKind, title: 'Image Lab', description: 'Create and refine campaign imagery from a governed prompt.', route: '/studio/create?type=image' },
  { kind: 'video' as MediaKind, title: 'Video Lab', description: 'Plan clips, storyboards and motion generations with provider-aware controls.', route: '/studio/create?type=video' },
  { kind: 'music' as MediaKind, title: 'Music Lab', description: 'Turn a creative brief into a song request without claiming unconfigured generation.', route: '/studio/create?type=music' },
  { kind: 'voice' as MediaKind, title: 'Voice & Agents', description: 'Continue to the identity-gated ATLAS Voice workspace.', route: '/studio/voice' }
];

export function CreatorHome() {
  return <section className="creator-page">
    <header className="creator-hero"><div><p className="eyebrow">ATLAS Studio</p><h1>Create beyond the prompt.</h1><p>One governed workspace for imagery, video, sound and voice—connected to ATLAS Identity and organization context.</p></div><Link className="creator-primary" to="/studio/create">Start creating</Link></header>
    <div className="creator-status"><span className="pulse-dot" /><div><strong>Zero-Cost Mode</strong><small>Self-hosted engines are preferred. Metered providers are never used automatically.</small></div></div>
    <div className="creator-grid">{tools.map(tool => <Link className="creator-tool" to={tool.route} key={tool.kind}><span className={'creator-orb '+tool.kind} aria-hidden="true" /><small>{tool.kind}</small><h2>{tool.title}</h2><p>{tool.description}</p><span className="creator-link">Open workspace →</span></Link>)}</div>
    <section className="creator-section"><div className="section-heading"><div><p className="eyebrow">Inspiration</p><h2>Creative feed</h2></div><Link to="/studio/library">View library</Link></div><div className="creator-empty"><strong>No organization media yet</strong><span>Generated and uploaded assets will appear here after they are saved through an authorized storage connection.</span></div></section>
  </section>;
}

export function CreatorWorkspace() {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('type');
  const [kind, setKind] = useState<MediaKind>(initial === 'video' || initial === 'music' || initial === 'voice' ? initial : 'image');
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState('Adaptive');
  const [visibility, setVisibility] = useState<Visibility>('Private');
  const [notice, setNotice] = useState('');
  const [providerLabel, setProviderLabel] = useState('Not configured');
  const [assetUrl, setAssetUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = prompt.trim().length >= 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) {
      if (!canSubmit) setNotice('Describe the result in at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setNotice('Submitting to ATLAS Auto in Zero-Cost Mode…');
    setAssetUrl('');
    try {
      const result = await generateCreatorAsset({ kind, prompt: prompt.trim(), format, visibility });
      setProviderLabel(result.providerId || 'ATLAS Auto');
      const url = typeof result.asset?.url === 'string' ? result.asset.url : '';
      if (result.ok && result.state === 'completed' && url) {
        setAssetUrl(url);
        setNotice('Generation completed and verified by the configured self-hosted provider.');
      } else {
        setNotice(result.message || result.error || `Generation state: ${result.state}`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Generation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="creator-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Create</span></nav>
    <header className="creator-hero compact"><div><p className="eyebrow">Creator workspace</p><h1>Bring an idea to life.</h1><p>Requests remain inside the organization boundary and are never reported as generated until a provider returns a verified result.</p></div></header>
    <div className="creator-workbench">
      <form className="creator-composer" onSubmit={submit}>
        <div className="creator-tabs" role="tablist">{(['image','video','music','voice'] as MediaKind[]).map(item => <button key={item} type="button" role="tab" aria-selected={kind===item} className={kind===item?'active':''} onClick={()=>{setKind(item);setNotice('');setAssetUrl('')}}>{item}</button>)}</div>
        <label><span>Creative brief</span><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={'Describe the '+kind+' you want to create…'} rows={7} /></label>
        <div className="creator-options"><label><span>Format</span><select value={format} onChange={e=>setFormat(e.target.value)}><option>Adaptive</option><option>Square 1:1</option><option>Portrait 9:16</option><option>Landscape 16:9</option></select></label><label><span>Visibility</span><select value={visibility} onChange={e=>setVisibility(e.target.value as Visibility)}><option>Private</option><option>Organization</option></select></label></div>
        <button className="creator-primary" type="submit" disabled={!canSubmit || submitting}>{submitting ? 'Generating…' : `Generate ${kind}`}</button>
        {notice && <p className="creator-notice" role="status">{notice}</p>}
      </form>
      <aside className="creator-preview"><div className={'creator-preview-orb '+kind} />{assetUrl ? <img src={assetUrl} alt="Verified ATLAS Creator output" className="creator-output" /> : null}<h2>Preview</h2><p>{assetUrl ? 'Verified output from the configured self-hosted provider.' : 'A verified result will appear here. ATLAS does not insert fabricated output.'}</p><dl><div><dt>Provider</dt><dd>{providerLabel}</dd></div><div><dt>Mode</dt><dd>Zero cost</dd></div><div><dt>Storage</dt><dd>Persistence gate pending</dd></div><div><dt>Audit</dt><dd>Organization request context enabled</dd></div></dl></aside>
    </div>
  </section>;
}

export function CreatorLibrary() {
  const [query,setQuery]=useState('');
  const results=useMemo(()=>[].filter(()=>query),[query]);
  return <section className="creator-page"><nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Library</span></nav><header className="creator-hero compact"><div><p className="eyebrow">Projects & assets</p><h1>Creator Library</h1><p>Searchable organization media with provenance, versions and permission-aware visibility.</p></div></header><label className="creator-search"><span>Search library</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects and assets" /></label><div className="creator-empty"><strong>{results.length} assets</strong><span>No authorized assets are available in this organization.</span></div></section>;
}

function normalizeProviderState(state: string): CreatorProviderState {
  if (state === 'ready' || state === 'configuration-required' || state === 'resource-blocked' || state === 'unavailable') return state;
  return 'unavailable';
}

export function CreatorProviders() {
  const [runtimeState, setRuntimeState] = useState<CreatorProviderState>('configuration-required');
  const [runtimeReason, setRuntimeReason] = useState('Checking authenticated self-hosted runtime readiness…');

  useEffect(() => {
    let active = true;
    getCreatorProviderReadiness()
      .then(result => {
        if (!active) return;
        setRuntimeState(normalizeProviderState(result.state));
        setRuntimeReason(result.message || 'Provider readiness returned without additional detail.');
      })
      .catch(error => {
        if (!active) return;
        setRuntimeState('unavailable');
        setRuntimeReason(error instanceof Error ? error.message : 'Provider readiness could not be verified.');
      });
    return () => { active = false; };
  }, []);

  const providers = creatorProviders.map(provider => provider.id === 'flux-schnell-local' ? { ...provider, state: runtimeState, reason: runtimeReason } : provider);

  return <section className="creator-page"><nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Providers</span></nav><header className="creator-hero compact"><div><p className="eyebrow">Governance</p><h1>Provider readiness</h1><p>Capability states reflect verified configuration only. Zero-cost self-hosted engines are preferred by ATLAS Auto.</p></div></header><div className="provider-list">{providers.map(provider=><article key={provider.id}><div><h2>{provider.name}</h2><p>{provider.capabilityLabel}</p><small>{provider.billingClass.replace(/-/g, ' ')}</small>{provider.reason ? <small>{provider.reason}</small> : null}</div><span className="provider-state">{provider.state.replace(/-/g, ' ')}</span></article>)}</div><div className="creator-privacy"><strong>Visual location intelligence</strong><p>Location estimation must be explicitly initiated by an authorized user, requires consent, exposes confidence and limitations, and must never be used as silent tracking.</p></div></section>;
}
