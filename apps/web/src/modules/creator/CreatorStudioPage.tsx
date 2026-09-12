import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './creator.css';

type MediaKind = 'image' | 'video' | 'music' | 'voice' | 'social';
type ProviderState = 'ready' | 'configuration-required' | 'unavailable';

const tools = [
  { kind: 'image' as MediaKind, title: 'Image Lab', description: 'Create and refine campaign imagery from a governed prompt.', route: '/studio/create?type=image' },
  { kind: 'video' as MediaKind, title: 'Video Lab', description: 'Plan clips, storyboards and motion generations with provider-aware controls.', route: '/studio/create?type=video' },
  { kind: 'music' as MediaKind, title: 'Music Lab', description: 'Turn a creative brief into a song request without claiming unconfigured generation.', route: '/studio/create?type=music' },
  { kind: 'voice' as MediaKind, title: 'Voice & Agents', description: 'Continue to the identity-gated ATLAS Voice workspace.', route: '/studio/voice' },
  { kind: 'social' as MediaKind, title: 'Social Copilot', description: 'Analyze real social metrics, draft engagement and prepare provider-gated publishing.', route: '/studio/social' }
];

const providers: { name: string; capability: string; state: ProviderState }[] = [
  { name: 'OpenAI', capability: 'Images and multimodal intelligence', state: 'configuration-required' },
  { name: 'Google AI', capability: 'Multimodal models', state: 'configuration-required' },
  { name: 'Suno', capability: 'Music generation', state: 'configuration-required' },
  { name: 'Visual location provider', capability: 'Location estimation with consent', state: 'configuration-required' }
];

export function CreatorHome() {
  return <section className="creator-page">
    <header className="creator-hero"><div><p className="eyebrow">ATLAS Studio</p><h1>Create beyond the prompt.</h1><p>One governed workspace for imagery, video, sound, voice and social intelligence—connected to ATLAS Identity and organization context.</p></div><Link className="creator-primary" to="/studio/create">Start creating</Link></header>
    <div className="creator-status"><span className="pulse-dot" /><div><strong>Workspace ready</strong><small>External generation and social providers require authorized configuration.</small></div></div>
    <div className="creator-grid">{tools.map(tool => <Link className="creator-tool" to={tool.route} key={tool.kind}><span className={'creator-orb '+tool.kind} aria-hidden="true" /><small>{tool.kind}</small><h2>{tool.title}</h2><p>{tool.description}</p><span className="creator-link">Open workspace →</span></Link>)}</div>
    <section className="creator-section"><div className="section-heading"><div><p className="eyebrow">Inspiration</p><h2>Creative feed</h2></div><Link to="/studio/library">View library</Link></div><div className="creator-empty"><strong>No organization media yet</strong><span>Generated and uploaded assets will appear here after they are saved through an authorized storage connection.</span></div></section>
  </section>;
}

export function CreatorWorkspace() {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('type');
  const [kind, setKind] = useState<Exclude<MediaKind, 'social'>>(initial === 'video' || initial === 'music' || initial === 'voice' ? initial : 'image');
  const [prompt, setPrompt] = useState('');
  const [notice, setNotice] = useState('');
  const canSubmit = prompt.trim().length >= 8;
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
        <div className="creator-tabs" role="tablist">{(['image','video','music','voice'] as const).map(item => <button key={item} type="button" role="tab" aria-selected={kind===item} className={kind===item?'active':''} onClick={()=>{setKind(item);setNotice('')}}>{item}</button>)}</div>
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
  const [query,setQuery]=useState('');
  const results=useMemo(()=>[].filter(()=>query),[query]);
  return <section className="creator-page"><nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Library</span></nav><header className="creator-hero compact"><div><p className="eyebrow">Projects & assets</p><h1>Creator Library</h1><p>Searchable organization media with provenance, versions and permission-aware visibility.</p></div></header><label className="creator-search"><span>Search library</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects and assets" /></label><div className="creator-empty"><strong>{results.length} assets</strong><span>No authorized assets are available in this organization.</span></div></section>;
}

export function CreatorProviders() {
  return <section className="creator-page"><nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Providers</span></nav><header className="creator-hero compact"><div><p className="eyebrow">Governance</p><h1>Provider readiness</h1><p>Capability states reflect verified configuration only.</p></div></header><div className="provider-list">{providers.map(provider=><article key={provider.name}><div><h2>{provider.name}</h2><p>{provider.capability}</p></div><span className="provider-state">{provider.state.replace('-', ' ')}</span></article>)}</div><div className="creator-privacy"><strong>Visual location intelligence</strong><p>Location estimation must be explicitly initiated by an authorized user, requires consent, exposes confidence and limitations, and must never be used as silent tracking.</p></div></section>;
}
