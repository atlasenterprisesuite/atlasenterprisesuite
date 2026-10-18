import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAssistantStatus,
  getAssistantUsage,
  listAssistantConversations,
  type AssistantStatusResponse,
  type AssistantUsageSummary
} from '../../assistant/client';
import {
  listCreativeEngines,
  listCreatorAssets,
  listCreatorProductions
} from '../../lib/creatorApi';
import {
  ATLAS_AI_UNIVERSE_TEMPLATES,
  buildAIUniverseCatalog,
  recommendAIUniverseEntries,
  type AIUniverseModality,
  type AIUniversePriority
} from '../../../../../packages/creator/ai_universe';
import type { CreativeEngineReadiness } from '../../../../../packages/creator/creative_engine';
import type { CreatorAsset, ProductionSummary } from '../../../../../packages/creator/types';
import './creator.css';

const MODALITIES: AIUniverseModality[] = ['text', 'image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'];
const PRIORITIES: Array<{ value: AIUniversePriority; label: string }> = [
  { value: 'cost', label: 'Cost policy' },
  { value: 'latency', label: 'Observed latency' },
  { value: 'quality', label: 'Quality proxy' }
];

type HistoryItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  date: string;
};

function fmtNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat().format(value);
}

function fmtCost(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(value);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return 'Not verified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AIUniversePage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<AssistantStatusResponse | null>(null);
  const [usage, setUsage] = useState<AssistantUsageSummary | null>(null);
  const [engines, setEngines] = useState<CreativeEngineReadiness[]>([]);
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof listAssistantConversations>>>([]);
  const [productions, setProductions] = useState<ProductionSummary[]>([]);
  const [assets, setAssets] = useState<CreatorAsset[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'partial'>('loading');
  const [loadNote, setLoadNote] = useState('');
  const [query, setQuery] = useState('');
  const [modality, setModality] = useState<AIUniverseModality>('text');
  const [priority, setPriority] = useState<AIUniversePriority>('cost');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [templateQuery, setTemplateQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setLoadNote('');

    Promise.allSettled([
      getAssistantStatus(),
      getAssistantUsage(30),
      listCreativeEngines(),
      listAssistantConversations(),
      listCreatorProductions(),
      listCreatorAssets()
    ]).then(results => {
      if (!active) return;
      const [statusResult, usageResult, enginesResult, conversationsResult, productionsResult, assetsResult] = results;

      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      else setStatus(null);

      if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
      else setUsage(null);

      if (enginesResult.status === 'fulfilled') setEngines(enginesResult.value);
      else setEngines([]);

      if (conversationsResult.status === 'fulfilled') setConversations(conversationsResult.value);
      else setConversations([]);

      if (productionsResult.status === 'fulfilled') setProductions(productionsResult.value);
      else setProductions([]);

      if (assetsResult.status === 'fulfilled') setAssets(assetsResult.value);
      else setAssets([]);

      const failures = results.filter(result => result.status === 'rejected').length;
      setLoadState(failures ? 'partial' : 'ready');
      setLoadNote(failures ? `${failures} data source(s) unavailable. ATLAS is showing only verified data that loaded successfully.` : '');
    });

    return () => { active = false; };
  }, [reloadKey]);

  const catalog = useMemo(() => buildAIUniverseCatalog({
    assistantProviders: status?.providers || [],
    creativeEngines: engines,
    zeroCostProviderIds: status?.cost_policy?.zero_cost_providers || []
  }), [status, engines]);

  const observations = usage?.providers || [];

  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog;
    return catalog.filter(entry => [
      entry.displayName,
      entry.providerId,
      entry.model || '',
      entry.connectionState,
      entry.executionClass,
      entry.costClass,
      ...entry.capabilities,
      ...entry.modalities
    ].join(' ').toLowerCase().includes(normalized));
  }, [catalog, query]);

  const recommendations = useMemo(() => recommendAIUniverseEntries(
    catalog,
    { modality, priority, allowPlanningFallback: true },
    observations
  ), [catalog, modality, priority, observations]);

  const comparison = useMemo(() => compareIds
    .map(id => catalog.find(entry => entry.id === id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)), [catalog, compareIds]);

  const templates = useMemo(() => {
    const normalized = templateQuery.trim().toLowerCase();
    if (!normalized) return ATLAS_AI_UNIVERSE_TEMPLATES;
    return ATLAS_AI_UNIVERSE_TEMPLATES.filter(template => [
      template.title,
      template.category,
      template.description,
      template.brief,
      ...template.modalities
    ].join(' ').toLowerCase().includes(normalized));
  }, [templateQuery]);

  const history = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...conversations.map(item => ({
        id: `conversation:${item.id}`,
        kind: 'AI conversation',
        title: item.title || 'Untitled conversation',
        detail: item.module || 'assistant',
        date: item.updated_at
      })),
      ...productions.map(item => ({
        id: `production:${item.id}`,
        kind: 'Creator production',
        title: item.title || 'Untitled production',
        detail: `${item.status} · ${item.aspectRatio} · ${item.resolutionPreference}`,
        date: item.updatedAt
      })),
      ...assets.map(item => ({
        id: `asset:${item.id}`,
        kind: 'Creator asset',
        title: item.providerId ? `${item.mediaType} · ${item.providerId}` : item.mediaType,
        detail: item.mimeType || 'Persisted creator asset',
        date: item.updatedAt
      }))
    ];
    return items
      .filter(item => item.date)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 12);
  }, [conversations, productions, assets]);

  const roleCanManage = ['owner', 'admin', 'platform_admin'].includes(status?.role || '');

  function toggleComparison(id: string) {
    setCompareIds(current => {
      if (current.includes(id)) return current.filter(value => value !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  return <section className="creator-page ai-universe-page">
    <nav className="creator-breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>AI Universe</span></nav>

    <header className="creator-hero ai-universe-hero">
      <div>
        <p className="eyebrow">ATLAS AI Universe</p>
        <h1>One intelligence and creation control center.</h1>
        <p>Catalog, recommend, compare, monitor and govern the AI engines ATLAS can actually verify. No provider is promoted from placeholder state.</p>
        <div className="ai-universe-hero-actions">
          <Link className="creator-primary" to="/assistant">Open AI Assistant</Link>
          <Link className="ai-universe-secondary" to="/studio/providers">Provider readiness</Link>
          <button className="ai-universe-secondary" type="button" onClick={() => setReloadKey(value => value + 1)}>Refresh verification</button>
        </div>
      </div>
    </header>

    <section className="ai-universe-launch-showcase" aria-labelledby="ai-universe-launch-visual-title">
      <figure className="ai-universe-launch-art">
        <div className="ai-universe-launch-art-frame">
          <img
            src="/atlas/ai-universe-phase2-live.webp"
            width="480"
            height="600"
            loading="eager"
            decoding="async"
            alt="ATLAS AI Universe Phase 2 release artwork illustrating the control-center concept; values shown inside the artwork are illustrative, not live telemetry."
          />
          <span className="ai-universe-art-label">Concept artwork · illustrative values</span>
        </div>
        <figcaption>Release artwork only. Live provider counts, latency, usage and cost remain the authenticated values rendered below.</figcaption>
      </figure>
      <div className="ai-universe-launch-copy">
        <p className="eyebrow">Phase 2 visual identity</p>
        <h2 id="ai-universe-launch-visual-title">The AI Universe control center, now part of the module.</h2>
        <p>This launch visual represents the ATLAS direction for catalog discovery, comparison, telemetry, history, templates and governed onboarding.</p>
        <div className="ai-universe-launch-badges" aria-label="Release capabilities">
          <span>Dynamic catalog</span>
          <span>Recommendations</span>
          <span>Comparison</span>
          <span>Telemetry</span>
          <span>Governance</span>
        </div>
        <p className="ai-universe-launch-truth"><strong>Truth boundary:</strong> numbers embedded in the artwork are illustrative design content. Runtime data shown elsewhere on this page remains authoritative.</p>
      </div>
    </section>

    {loadState === 'loading' && <div className="creator-empty" role="status"><strong>Loading AI Universe…</strong><span>Reading authenticated provider, Creator and telemetry sources.</span></div>}
    {loadState === 'partial' && <div className="creator-notice" role="status">{loadNote}</div>}

    <section className="creator-section" aria-labelledby="ai-universe-catalog-title">
      <div className="section-heading">
        <div><p className="eyebrow">Dynamic catalog</p><h2 id="ai-universe-catalog-title">Models & engines</h2></div>
        <span className="provider-state">{catalog.filter(entry => entry.verified).length} verified</span>
      </div>
      <label className="creator-search">
        <span>Search catalog</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Provider, model, modality, capability…" />
      </label>
      {filteredCatalog.length === 0 ? <div className="creator-empty"><strong>No matching verified catalog data</strong><span>ATLAS does not fabricate unavailable models.</span></div> :
        <div className="ai-universe-grid">
          {filteredCatalog.map(entry => <article className="ai-universe-card" key={entry.id}>
            <div className="ai-universe-card-heading">
              <div><small>{entry.source} · {entry.costClass}</small><h3>{entry.displayName}</h3></div>
              <span className={`provider-state ${entry.verified ? 'is-ready' : ''}`}>{entry.connectionState}</span>
            </div>
            <p>{entry.model ? `Model: ${entry.model}` : `Engine: ${entry.providerId}`}</p>
            <div className="ai-universe-chips">{entry.modalities.map(value => <span key={value}>{value}</span>)}</div>
            <dl className="ai-universe-facts">
              <div><dt>Executable</dt><dd>{entry.executionAvailable ? 'Yes' : entry.costClass === 'planning-only' ? 'Planning only' : 'No'}</dd></div>
              <div><dt>Verified</dt><dd>{entry.verified ? 'Yes' : 'No'}</dd></div>
              <div><dt>Last verified</dt><dd>{fmtDate(entry.lastVerifiedAt)}</dd></div>
            </dl>
            <button
              className="ai-universe-secondary"
              type="button"
              aria-pressed={compareIds.includes(entry.id)}
              disabled={!compareIds.includes(entry.id) && compareIds.length >= 3}
              onClick={() => toggleComparison(entry.id)}
            >{compareIds.includes(entry.id) ? 'Remove comparison' : 'Compare'}</button>
          </article>)}
        </div>}
    </section>

    <section className="creator-section" aria-labelledby="ai-universe-recommend-title">
      <div className="section-heading"><div><p className="eyebrow">Router intelligence</p><h2 id="ai-universe-recommend-title">Evidence-based recommendation</h2></div></div>
      <div className="ai-universe-toolbar">
        <label><span>Modality</span><select value={modality} onChange={event => setModality(event.target.value as AIUniverseModality)}>{MODALITIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value as AIUniversePriority)}>{PRIORITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      <p className="creator-notice">“Quality proxy” uses observed completion history plus capability fit. ATLAS does not assign subjective output-quality scores without evidence.</p>
      {recommendations.length === 0 ? <div className="creator-empty"><strong>No verified recommendation available</strong><span>Connect and verify a compatible provider or use Prompt Export where available.</span></div> :
        <div className="ai-universe-recommendations">
          {recommendations.slice(0, 3).map((item, index) => <article key={item.entry.id}>
            <span className="ai-universe-rank">#{index + 1}</span>
            <div><h3>{item.entry.displayName}</h3><p>{item.reasons.join(' · ')}</p></div>
            <dl><div><dt>Score</dt><dd>{item.score}</dd></div><div><dt>Observed requests</dt><dd>{item.observedRequests}</dd></div><div><dt>Latency</dt><dd>{item.observedAverageLatencyMs === null ? '—' : `${Math.round(item.observedAverageLatencyMs)} ms`}</dd></div></dl>
          </article>)}
        </div>}
    </section>

    <section className="creator-section" aria-labelledby="ai-universe-compare-title">
      <div className="section-heading"><div><p className="eyebrow">Comparison</p><h2 id="ai-universe-compare-title">Side-by-side providers</h2></div><span>{comparison.length}/3 selected</span></div>
      {comparison.length < 2 ? <div className="creator-empty"><strong>Select two or three catalog entries</strong><span>Comparison uses only their reported readiness, capabilities and observed telemetry.</span></div> :
        <div className="ai-universe-table-wrap"><table className="ai-universe-table"><thead><tr><th>Attribute</th>{comparison.map(entry => <th key={entry.id}>{entry.displayName}</th>)}</tr></thead><tbody>
          <tr><th>Model / engine</th>{comparison.map(entry => <td key={entry.id}>{entry.model || entry.providerId}</td>)}</tr>
          <tr><th>State</th>{comparison.map(entry => <td key={entry.id}>{entry.connectionState}</td>)}</tr>
          <tr><th>Cost class</th>{comparison.map(entry => <td key={entry.id}>{entry.costClass}</td>)}</tr>
          <tr><th>Modalities</th>{comparison.map(entry => <td key={entry.id}>{entry.modalities.join(', ')}</td>)}</tr>
          <tr><th>Capabilities</th>{comparison.map(entry => <td key={entry.id}>{entry.capabilities.join(', ') || 'Not reported'}</td>)}</tr>
          <tr><th>Observed latency</th>{comparison.map(entry => <td key={entry.id}>{usage?.providers.find(item => item.provider === entry.providerId)?.average_latency_ms ?? '—'}</td>)}</tr>
        </tbody></table></div>}
    </section>

    <section className="creator-section" aria-labelledby="ai-universe-telemetry-title">
      <div className="section-heading"><div><p className="eyebrow">Telemetry & cost</p><h2 id="ai-universe-telemetry-title">Last 30 days</h2></div><span>{usage ? `${usage.scope} scope` : 'Unavailable'}</span></div>
      {usage ? <div className="ai-universe-metrics">
        <article><strong>{fmtNumber(usage.total_requests)}</strong><span>requests</span></article>
        <article><strong>{fmtNumber(usage.completed_requests)}</strong><span>completed</span></article>
        <article><strong>{fmtNumber(usage.failed_requests)}</strong><span>failed</span></article>
        <article><strong>{usage.average_latency_ms === null ? '—' : `${fmtNumber(usage.average_latency_ms)} ms`}</strong><span>average latency</span></article>
        <article><strong>{fmtCost(usage.automatic_api_cost_usd)}</strong><span>automatic API cost</span></article>
        <article><strong>{fmtNumber(usage.tokens.total)}</strong><span>reported tokens</span></article>
      </div> : <div className="creator-empty"><strong>Telemetry unavailable</strong><span>No usage totals are inferred when the authenticated telemetry endpoint cannot be read.</span></div>}
      {usage && usage.providers.length > 0 && <div className="provider-list">{usage.providers.map(item => <article key={item.provider}><div><h3>{item.provider}</h3><p>{item.requests} requests · {item.completed} completed · {item.failed} failed</p><small>{item.average_latency_ms === null ? 'No latency observation' : `Average ${item.average_latency_ms} ms`} · {fmtCost(item.automatic_api_cost_usd)}</small></div></article>)}</div>}
    </section>

    <section className="creator-section" aria-labelledby="ai-universe-history-title">
      <div className="section-heading"><div><p className="eyebrow">Unified history</p><h2 id="ai-universe-history-title">Recent AI & Creator activity</h2></div></div>
      {history.length === 0 ? <div className="creator-empty"><strong>No history available</strong><span>Only authenticated persisted conversations, productions and assets appear here.</span></div> :
        <div className="ai-universe-history">{history.map(item => <article key={item.id}><small>{item.kind}</small><h3>{item.title}</h3><p>{item.detail}</p><time>{fmtDate(item.date)}</time></article>)}</div>}
    </section>

    <section className="creator-section" aria-labelledby="ai-universe-templates-title">
      <div className="section-heading"><div><p className="eyebrow">Trend & template gallery</p><h2 id="ai-universe-templates-title">ATLAS original patterns</h2></div></div>
      <p className="creator-notice">These are ATLAS-owned reusable creative patterns. No live social trend signal is claimed until an authorized trend source is connected.</p>
      <label className="creator-search"><span>Search templates</span><input value={templateQuery} onChange={event => setTemplateQuery(event.target.value)} placeholder="Launch, social, training, audio…" /></label>
      <div className="ai-universe-grid">{templates.map(template => <article className="ai-universe-card" key={template.id}><small>{template.category} · {template.source}</small><h3>{template.title}</h3><p>{template.description}</p><div className="ai-universe-chips">{template.modalities.map(value => <span key={value}>{value}</span>)}</div><details><summary>Template brief</summary><p>{template.brief}</p></details></article>)}</div>
    </section>

    <section className="creator-section" aria-labelledby="ai-universe-onboarding-title">
      <div className="section-heading"><div><p className="eyebrow">Provider onboarding</p><h2 id="ai-universe-onboarding-title">Server-side setup & verification</h2></div><span>{roleCanManage ? 'Admin controls available' : 'Read-only'}</span></div>
      <div className="ai-universe-onboarding">
        <article><strong>1 · Configure</strong><p>Provider credentials and model identifiers stay in approved server-side secrets/configuration. ATLAS never requests provider secrets in this browser page.</p></article>
        <article><strong>2 · Authorize</strong><p>Organization policy, allowlists, zero-cost rules and paid-call gates determine whether a configured provider may execute.</p></article>
        <article><strong>3 · Verify</strong><p>Readiness probes must succeed before the provider becomes executable. Use refresh verification after an administrator completes setup.</p></article>
      </div>
      <div className="ai-universe-policy">
        <h3>Current intelligence policy</h3>
        <dl className="ai-universe-facts">
          <div><dt>Allowed providers</dt><dd>{status?.cost_policy?.allowed_providers?.length ? status.cost_policy.allowed_providers.join(', ') : 'Server default / not reported'}</dd></div>
          <div><dt>Zero-cost providers</dt><dd>{status?.cost_policy?.zero_cost_providers?.length ? status.cost_policy.zero_cost_providers.join(', ') : 'None reported'}</dd></div>
          <div><dt>Paid single-provider calls</dt><dd>{status?.cost_policy?.allow_paid_single ? 'Allowed by policy' : 'Blocked by policy'}</dd></div>
          <div><dt>Council mode</dt><dd>{status?.cost_policy?.allow_council ? 'Allowed by policy' : 'Blocked by policy'}</dd></div>
          <div><dt>Emergency fallback daily budget</dt><dd>{status?.cost_policy?.emergency_openai_fallback?.enabled ? fmtCost(status.cost_policy.emergency_openai_fallback.daily_budget_usd ?? null) : 'Disabled'}</dd></div>
          <div><dt>Automatic API cost policy</dt><dd>{status?.cost_policy?.automatic_api_cost_usd === null || status?.cost_policy?.automatic_api_cost_usd === undefined ? 'Approval / route dependent' : fmtCost(status.cost_policy.automatic_api_cost_usd)}</dd></div>
        </dl>
      </div>
      <div className="provider-list">{catalog.map(entry => <article key={`onboarding:${entry.id}`}><div><h3>{entry.displayName}</h3><p>{entry.configured ? 'Configured' : 'Configuration required'} · {entry.verified ? 'verified' : 'not verified'} · {entry.costClass}</p><small>{entry.model || entry.providerId}</small></div><span className="provider-state">{entry.connectionState}</span></article>)}</div>
      <div className="creator-actions"><Link className="creator-primary" to="/studio/providers">Open provider readiness</Link>{roleCanManage && <Link className="ai-universe-secondary" to="/assistant">Open Assistant policy surface</Link>}</div>
    </section>

    <section className="creator-privacy">
      <strong>Governance boundary</strong>
      <p>AI Universe is an orchestration and evidence surface. It does not bypass tenant isolation, RBAC, cost approval, provider verification, asset persistence or audit controls.</p>
    </section>
  </section>;
}
