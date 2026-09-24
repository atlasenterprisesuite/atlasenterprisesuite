import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildStructuredDraft,
  createContentWorkspaceState,
  createDirectorHandoff,
  createPublisherHandoff,
  generateAudienceInsights,
  generateContentIdeas,
  generateHookVariants,
  repurposeDraft,
  reviewDraft,
  type ContentPlatform,
  type ContentWorkspaceState,
  type RepurposedVariant
} from '../../../../../../packages/creator/content_intelligence';
import {
  getContentWorkspace,
  listContentWorkspaces,
  saveContentWorkspace,
  type ContentWorkspaceRecord
} from '../../../lib/creatorApi';
import './content-intelligence.css';

const STAGES = ['Creator Profile', 'Audience', 'Ideas', 'Hooks', 'Content Builder', 'Repurpose', 'Review'] as const;
type Stage = (typeof STAGES)[number];

const PLATFORM_OPTIONS: Array<{ id: ContentPlatform; label: string }> = [
  { id: 'instagram', label: 'Instagram / Reels' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube / Shorts' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' }
];

function newWorkspace() {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;
  return createContentWorkspaceState(id);
}

function stripPersistenceFields(record: ContentWorkspaceRecord): ContentWorkspaceState {
  const { organizationId: _organizationId, createdByUserId: _createdByUserId, ...state } = record;
  return state;
}

export function ContentIntelligencePage() {
  const [activeStage, setActiveStage] = useState<Stage>('Creator Profile');
  const [workspace, setWorkspace] = useState<ContentWorkspaceState>(() => newWorkspace());
  const [savedWorkspaces, setSavedWorkspaces] = useState<ContentWorkspaceRecord[]>([]);
  const [workspaceState, setWorkspaceState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listContentWorkspaces()
      .then(rows => {
        if (!active) return;
        setSavedWorkspaces(rows);
        setWorkspaceState('ready');
      })
      .catch(error => {
        if (!active) return;
        setWorkspaceState('error');
        setNotice(error instanceof Error ? error.message : 'content_workspaces_unavailable');
      });
    return () => { active = false; };
  }, []);

  const selectedIdea = useMemo(
    () => workspace.ideas.find(item => item.id === workspace.selectedIdeaId) || null,
    [workspace.ideas, workspace.selectedIdeaId]
  );
  const selectedHook = useMemo(
    () => workspace.hooks.find(item => item.id === workspace.selectedHookId) || null,
    [workspace.hooks, workspace.selectedHookId]
  );
  const selectedVariant = useMemo(
    () => workspace.variants.find(item => item.id === selectedVariantId) || workspace.variants[0] || null,
    [workspace.variants, selectedVariantId]
  );

  function patch(next: Partial<ContentWorkspaceState>) {
    setWorkspace(current => ({ ...current, ...next }));
  }

  function updateProfile<K extends keyof ContentWorkspaceState['profile']>(key: K, value: ContentWorkspaceState['profile'][K]) {
    setWorkspace(current => ({
      ...current,
      profile: { ...current.profile, [key]: value },
      audience: null,
      ideas: [],
      hooks: [],
      selectedIdeaId: null,
      selectedHookId: null,
      draft: null,
      variants: [],
      review: null
    }));
  }

  function togglePlatform(platform: ContentPlatform) {
    const exists = workspace.profile.platforms.includes(platform);
    updateProfile('platforms', exists
      ? workspace.profile.platforms.filter(item => item !== platform)
      : [...workspace.profile.platforms, platform]);
  }

  function createAudience() {
    const audience = generateAudienceInsights(workspace.profile, workspace.audienceSeed);
    patch({ audience, ideas: [], hooks: [], selectedIdeaId: null, selectedHookId: null, draft: null, variants: [], review: null });
    setActiveStage('Audience');
    setNotice('Audience intelligence derived from the context you supplied.');
  }

  function createIdeas() {
    if (!workspace.audience) return;
    const ideas = generateContentIdeas(workspace.profile, workspace.audience);
    patch({ ideas, selectedIdeaId: ideas[0]?.id || null, hooks: [], selectedHookId: null, draft: null, variants: [], review: null });
    setActiveStage('Ideas');
    setNotice(`${ideas.length} ranked ideas created locally from this workspace.`);
  }

  function createHooks() {
    if (!selectedIdea) return;
    const hooks = generateHookVariants(selectedIdea, workspace.profile);
    patch({ hooks, selectedHookId: hooks[0]?.id || null, draft: null, variants: [], review: null });
    setActiveStage('Hooks');
    setNotice('Five hook variants created for the selected idea.');
  }

  function createDraft() {
    if (!selectedIdea || !selectedHook) return;
    const draft = buildStructuredDraft(selectedIdea, selectedHook, workspace.profile);
    patch({
      title: selectedIdea.title,
      draft,
      variants: [],
      review: null
    });
    setActiveStage('Content Builder');
    setNotice('Structured draft created without calling an external provider.');
  }

  function createVariants() {
    if (!workspace.draft) return;
    const variants = repurposeDraft(workspace.draft);
    patch({ variants });
    setSelectedVariantId(variants[0]?.id || null);
    setActiveStage('Repurpose');
    setNotice('Platform variants created from the current draft.');
  }

  function createReview() {
    if (!workspace.draft) return;
    patch({ review: reviewDraft(workspace.draft) });
    setActiveStage('Review');
    setNotice('Quality review completed against deterministic ATLAS criteria.');
  }

  async function loadWorkspace(id: string) {
    if (!id) {
      setWorkspace(newWorkspace());
      setSelectedVariantId(null);
      setActiveStage('Creator Profile');
      setNotice('New local workspace started.');
      return;
    }
    setWorkspaceState('loading');
    setNotice('Loading content workspace…');
    try {
      const loaded = await getContentWorkspace(id);
      setWorkspace(stripPersistenceFields(loaded));
      setSelectedVariantId(loaded.variants[0]?.id || null);
      setWorkspaceState('ready');
      setNotice('Content workspace loaded.');
    } catch (error) {
      setWorkspaceState('error');
      setNotice(error instanceof Error ? error.message : 'content_workspace_load_failed');
    }
  }

  async function saveWorkspace() {
    if (saving) return;
    setSaving(true);
    setNotice('Saving content workspace…');
    try {
      const saved = await saveContentWorkspace(workspace, workspace.version);
      const state = stripPersistenceFields(saved);
      setWorkspace(state);
      setSavedWorkspaces(current => {
        const next = current.filter(item => item.id !== saved.id);
        return [saved, ...next];
      });
      setWorkspaceState('ready');
      setNotice(`Workspace saved as version ${saved.version}.`);
    } catch (error) {
      const value = error as Error & { status?: number };
      setWorkspaceState('error');
      setNotice(value.status === 409 ? 'version_conflict' : value.message || 'content_workspace_save_failed');
    } finally {
      setSaving(false);
    }
  }

  const canGenerateIdeas = Boolean(workspace.audience);
  const canGenerateHooks = Boolean(selectedIdea);
  const canBuildDraft = Boolean(selectedIdea && selectedHook);
  const canRepurpose = Boolean(workspace.draft);
  const canReview = Boolean(workspace.draft);

  return <section className="creator-page content-intelligence-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb">
      <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Content Intelligence</span>
    </nav>

    <header className="content-intelligence-header">
      <div>
        <p className="eyebrow">ATLAS Studio · Content Intelligence</p>
        <h1>Turn one idea into a governed content system.</h1>
        <p>Build audience context, ideas, hooks, structured content and channel variants before handing approved work to production or publishing.</p>
      </div>
      <div className="content-intelligence-header-actions">
        <label>
          <span>Saved workspace</span>
          <select value={savedWorkspaces.some(item => item.id === workspace.id) ? workspace.id : ''} onChange={event => loadWorkspace(event.target.value)}>
            <option value="">New workspace</option>
            {savedWorkspaces.map(item => <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>)}
          </select>
        </label>
        <button className="creator-primary" type="button" disabled={saving} onClick={saveWorkspace}>{saving ? 'Saving…' : 'Save workspace'}</button>
      </div>
    </header>

    <div className={`content-workspace-status ${workspaceState}`} role="status">
      <strong>{workspaceState === 'loading' ? 'Reading organization workspace…' : workspaceState === 'error' ? 'Workspace connection needs attention' : 'Workspace ready'}</strong>
      <span>{notice || 'All generated text in this workspace is deterministic local transformation until a verified AI/provider action is explicitly invoked elsewhere.'}</span>
    </div>

    <div className="content-stage-tabs" role="tablist" aria-label="Content Intelligence stages">
      {STAGES.map((stage, index) => <button
        type="button"
        role="tab"
        aria-selected={activeStage === stage}
        className={activeStage === stage ? 'active' : ''}
        onClick={() => setActiveStage(stage)}
        key={stage}
      ><span>{String(index + 1).padStart(2, '0')}</span>{stage}</button>)}
    </div>

    <div className="content-intelligence-shell">
      <main className="content-stage-panel">
        {activeStage === 'Creator Profile' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Foundation</p><h2>Creator Profile</h2></div><span>Defines the context reused by every downstream stage.</span></div>
          <div className="content-form-grid">
            <label><span>Niche / expertise</span><input value={workspace.profile.niche} onChange={event => updateProfile('niche', event.target.value)} placeholder="e.g. Small-business finance" /></label>
            <label><span>Primary objective</span><input value={workspace.profile.objective} onChange={event => updateProfile('objective', event.target.value)} placeholder="What result should the content create?" /></label>
            <label><span>Audience</span><input value={workspace.profile.audience} onChange={event => updateProfile('audience', event.target.value)} placeholder="Who should this help?" /></label>
            <label><span>Language</span><input value={workspace.profile.language} onChange={event => updateProfile('language', event.target.value)} /></label>
            <label className="span-2"><span>Tone / brand voice</span><textarea rows={3} value={workspace.profile.tone} onChange={event => updateProfile('tone', event.target.value)} placeholder="Clear, practical, warm, authoritative…" /></label>
          </div>
          <fieldset className="content-platform-picker"><legend>Priority platforms</legend>{PLATFORM_OPTIONS.map(platform => <label key={platform.id}><input type="checkbox" checked={workspace.profile.platforms.includes(platform.id)} onChange={() => togglePlatform(platform.id)} /><span>{platform.label}</span></label>)}</fieldset>
          <label className="content-wide-field"><span>Audience context / observations</span><textarea rows={5} value={workspace.audienceSeed} onChange={event => patch({ audienceSeed: event.target.value })} placeholder="What do you already know about their problems, questions, motivations or objections?" /></label>
          <button className="creator-primary" type="button" onClick={createAudience}>Analyze audience context</button>
        </section>}

        {activeStage === 'Audience' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Understanding</p><h2>Audience</h2></div><button className="creator-secondary" type="button" onClick={createAudience}>Refresh from profile</button></div>
          {!workspace.audience ? <div className="creator-empty"><strong>No audience analysis yet</strong><span>Complete Creator Profile and analyze the context first.</span></div> : <>
            <p className="content-summary">{workspace.audience.summary}</p>
            <div className="audience-grid">
              {([
                ['Problems', workspace.audience.problems],
                ['Questions', workspace.audience.questions],
                ['Motivations', workspace.audience.motivations],
                ['Fears', workspace.audience.fears],
                ['Interests', workspace.audience.interests]
              ] as const).map(([title, items]) => <article key={title}><h3>{title}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></article>)}
            </div>
            <button className="creator-primary" type="button" disabled={!canGenerateIdeas} onClick={createIdeas}>Generate ranked ideas</button>
          </>}
        </section>}

        {activeStage === 'Ideas' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Opportunity</p><h2>Ideas</h2></div><button className="creator-secondary" type="button" disabled={!canGenerateIdeas} onClick={createIdeas}>Regenerate</button></div>
          {workspace.ideas.length === 0 ? <div className="creator-empty"><strong>No ideas generated</strong><span>Audience intelligence is required before ATLAS can rank content opportunities.</span></div> : <div className="idea-grid">{workspace.ideas.map(idea => <button type="button" key={idea.id} className={workspace.selectedIdeaId === idea.id ? 'idea-card selected' : 'idea-card'} onClick={() => patch({ selectedIdeaId: idea.id, hooks: [], selectedHookId: null, draft: null, variants: [], review: null })}><span className="idea-score">{idea.score}</span><small>{idea.format}</small><strong>{idea.title}</strong><p>{idea.angle}</p><span>{idea.audienceNeed}</span></button>)}</div>}
          <button className="creator-primary" type="button" disabled={!canGenerateHooks} onClick={createHooks}>Create hooks for selected idea</button>
        </section>}

        {activeStage === 'Hooks' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Attention</p><h2>Hooks</h2></div><button className="creator-secondary" type="button" disabled={!canGenerateHooks} onClick={createHooks}>Regenerate hooks</button></div>
          {workspace.hooks.length === 0 ? <div className="creator-empty"><strong>No hooks yet</strong><span>Select an idea and create its hook variants.</span></div> : <div className="hook-list">{workspace.hooks.map(hook => <button type="button" key={hook.id} onClick={() => patch({ selectedHookId: hook.id, draft: null, variants: [], review: null })} className={workspace.selectedHookId === hook.id ? 'selected' : ''}><span>{hook.style}</span><strong>{hook.text}</strong></button>)}</div>}
          <button className="creator-primary" type="button" disabled={!canBuildDraft} onClick={createDraft}>Build structured content</button>
        </section>}

        {activeStage === 'Content Builder' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Structure</p><h2>Content Builder</h2></div><button className="creator-secondary" type="button" disabled={!canBuildDraft} onClick={createDraft}>Rebuild</button></div>
          {!workspace.draft ? <div className="creator-empty"><strong>No structured draft</strong><span>Select an idea and hook, then build the content.</span></div> : <article className="draft-card"><h3>{workspace.draft.title}</h3><div><span>Introduction</span><p>{workspace.draft.introduction}</p></div><div><span>Body</span><ol>{workspace.draft.bodyPoints.map(point => <li key={point}>{point}</li>)}</ol></div><div><span>CTA</span><p>{workspace.draft.cta}</p></div><details><summary>Narration / script</summary><pre>{workspace.draft.narration}</pre></details></article>}
          <div className="content-inline-actions"><button className="creator-primary" type="button" disabled={!canRepurpose} onClick={createVariants}>Repurpose by platform</button><button className="creator-secondary" type="button" disabled={!canReview} onClick={createReview}>Run quality review</button></div>
        </section>}

        {activeStage === 'Repurpose' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Distribution</p><h2>Repurpose</h2></div><button className="creator-secondary" type="button" disabled={!canRepurpose} onClick={createVariants}>Refresh variants</button></div>
          {workspace.variants.length === 0 ? <div className="creator-empty"><strong>No platform variants</strong><span>Build a structured draft before repurposing it.</span></div> : <div className="variant-list">{workspace.variants.map(variant => <button type="button" key={variant.id} onClick={() => setSelectedVariantId(variant.id)} className={selectedVariant?.id === variant.id ? 'selected' : ''}><span>{variant.platform}</span><strong>{variant.format}</strong><p>{variant.content}</p></button>)}</div>}
        </section>}

        {activeStage === 'Review' && <section>
          <div className="content-section-heading"><div><p className="eyebrow">Quality</p><h2>Review</h2></div><button className="creator-secondary" type="button" disabled={!canReview} onClick={createReview}>Run review</button></div>
          {!workspace.review ? <div className="creator-empty"><strong>No quality review yet</strong><span>Build a draft and run the deterministic ATLAS review.</span></div> : <><div className="review-score"><strong>{workspace.review.overallScore}</strong><span>Overall content score</span></div><div className="review-grid">{Object.entries(workspace.review.criteria).map(([criterion, score]) => <article key={criterion}><span>{criterion.replace(/([A-Z])/g, ' $1')}</span><strong>{score}</strong></article>)}</div><ul className="review-recommendations">{workspace.review.recommendations.map(item => <li key={item}>{item}</li>)}</ul></>}
        </section>}
      </main>

      <aside className="content-context-panel" aria-label="Content Intelligence context">
        <div><span>Workspace</span><strong>{workspace.title}</strong><small>Version {workspace.version}</small></div>
        <div><span>Pipeline state</span><strong>{workspace.draft ? 'Draft ready' : workspace.ideas.length ? 'Ideation' : workspace.audience ? 'Audience ready' : 'Profile'}</strong><small>{workspace.variants.length} channel variant{workspace.variants.length === 1 ? '' : 's'}</small></div>
        <div><span>Execution boundary</span><strong>Local deterministic</strong><small>No paid provider call is made here.</small></div>
        {workspace.draft && <Link className="content-handoff-action" to="/studio/create?type=video" state={createDirectorHandoff(workspace.draft)}>Open in Director <span>→</span></Link>}
        {selectedVariant && <Link className="content-handoff-action" to="/business/growth/social-publisher" state={createPublisherHandoff(selectedVariant as RepurposedVariant)}>Open in Social Publisher <span>→</span></Link>}
        <p>Director and Publisher keep their existing permission, media, connection and approval gates. A handoff never authorizes rendering or publication.</p>
      </aside>
    </div>
  </section>;
}
