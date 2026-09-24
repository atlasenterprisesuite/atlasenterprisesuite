import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  approveAtlasMemory,
  createAtlasMemoryDraft,
  getAtlasLibraryStats,
  getAtlasMemoryStats,
  listAtlasLibraryAssets,
  listAtlasMemory,
  type AtlasLibraryAsset,
  type AtlasLibraryStats,
  type AtlasMemoryKind,
  type AtlasMemoryRecord,
  type AtlasMemorySource,
  type AtlasMemoryStats
} from './memoryApi';

const KINDS: AtlasMemoryKind[] = ['decision','requirement','workflow','configuration','evidence','note'];
const PAGE_SIZE = 50;

function splitList(value: string) {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))].slice(0, 40);
}

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

function aborted(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError');
}

function LibraryRegistryPanel({ moduleScope = '' }: { moduleScope?: string }) {
  const [assets, setAssets] = useState<AtlasLibraryAsset[] | null>(null);
  const [stats, setStats] = useState<AtlasLibraryStats | null>(null);
  const [moduleFilter, setModuleFilter] = useState(moduleScope);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query);
  const effectiveModule = moduleScope || moduleFilter;

  useEffect(() => {
    const controller = new AbortController();
    void getAtlasLibraryStats(moduleScope || undefined, controller.signal)
      .then(response => setStats(response.stats))
      .catch(caught => {
        if (!aborted(caught)) setError(caught instanceof Error ? caught.message : 'library_stats_unavailable');
      });
    return () => controller.abort();
  }, [moduleScope]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setAssets(null);
    void listAtlasLibraryAssets({
      q: debouncedQuery,
      module: effectiveModule,
      limit: PAGE_SIZE,
      offset: 0,
      signal: controller.signal
    }).then(response => {
      setAssets(response.assets);
      setTotal(response.total);
      setHasMore(response.has_more);
    }).catch(caught => {
      if (!aborted(caught)) setError(caught instanceof Error ? caught.message : 'library_unavailable');
    });
    return () => controller.abort();
  }, [debouncedQuery, effectiveModule]);

  const loadMore = useCallback(async () => {
    if (!assets || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await listAtlasLibraryAssets({
        q: debouncedQuery,
        module: effectiveModule,
        limit: PAGE_SIZE,
        offset: assets.length
      });
      setAssets(current => [...(current || []), ...response.assets]);
      setTotal(response.total);
      setHasMore(response.has_more);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'library_unavailable');
    } finally {
      setLoadingMore(false);
    }
  }, [assets, debouncedQuery, effectiveModule, hasMore, loadingMore]);

  const moduleOptions = useMemo(() => Object.keys(stats?.by_module || {}).sort(), [stats]);

  return <section className="page-stack" aria-labelledby="atlas-library-heading">
    <div className="workspace-card">
      <div>
        <p className="eyebrow">ATLAS Library Registry</p>
        <h2 id="atlas-library-heading">Module-routed source assets</h2>
        <p className="muted">Files imported from authorized library sources are indexed once, classified into owning ATLAS modules, and kept provenance-linked. Restricted records remain limited to authorized owner/admin roles.</p>
      </div>
      <div className="metric-grid" aria-label="ATLAS Library status" aria-live="polite">
        <article><span>Visible assets</span><strong>{stats?.total_assets ?? '—'}</strong><small>Role-scoped durable registry</small></article>
        <article><span>Analyzed</span><strong>{stats?.by_status?.analyzed ?? 0}</strong><small>Content-enriched records</small></article>
        <article><span>Needs review</span><strong>{stats?.by_status?.needs_review ?? 0}</strong><small>Ambiguous routing/content</small></article>
        <article><span>Restricted visible</span><strong>{stats?.restricted_assets ?? 0}</strong><small>Shown only when your role may see them</small></article>
      </div>
      <div className="toolbar">
        <label className="field wide-field"><span>Search library</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search filenames, paths, modules or tags" /></label>
        {moduleScope ? (
          <label className="field"><span>Module scope</span><input value={moduleScope} readOnly aria-readonly="true" /></label>
        ) : (
          <label className="field"><span>Module</span><select value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}><option value="">All modules</option>{moduleOptions.map(moduleId => <option key={moduleId} value={moduleId}>{moduleId}</option>)}</select></label>
        )}
      </div>
    </div>
    {error ? <div className="work-error" role="alert">{error}</div> : null}
    {assets === null && !error ? <p aria-busy="true" role="status">Loading ATLAS Library…</p> : null}
    {assets?.length === 0 ? <div className="empty-state"><strong>No library assets match this view.</strong><span>Change the search or module filter.</span></div> : null}
    {assets?.length ? <>
      <p className="muted" role="status" aria-live="polite">Showing {assets.length.toLocaleString()} of {total.toLocaleString()} matching assets.</p>
      <div className="module-grid" aria-label="ATLAS Library assets">
        {assets.map(asset => <article className="module-card enabled" key={asset.id}>
          <span>{asset.primary_module_id} · {asset.analysis_status}</span>
          <strong>{asset.name}</strong>
          <p>{asset.summary || asset.library_path || 'Indexed source asset'}</p>
          <small className="muted">Modules: {asset.module_ids.join(', ')} · {asset.classification_basis} · {asset.sensitivity}</small>
          <small className="muted">{asset.mime_type || 'unknown type'}{asset.size_bytes != null ? ` · ${asset.size_bytes.toLocaleString()} bytes` : ''}</small>
        </article>)}
      </div>
      {hasMore ? <div className="work-actions"><button className="execution-action" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more assets'}</button></div> : null}
    </> : null}
  </section>;
}

export function KnowledgeAtlasPage({
  moduleScope = '',
  eyebrow = 'Knowledge Atlas',
  heading = 'ATLAS Memory',
  description = 'Persistent organizational knowledge shared across ATLAS. Imported conversations remain drafts until an authorized owner or administrator approves them. Personal conversations are not ingested automatically.'
}: {
  moduleScope?: string;
  eyebrow?: string;
  heading?: string;
  description?: string;
} = {}) {
  const [records, setRecords] = useState<AtlasMemoryRecord[] | null>(null);
  const [memoryStats, setMemoryStats] = useState<AtlasMemoryStats | null>(null);
  const [memoryTotal, setMemoryTotal] = useState(0);
  const [memoryHasMore, setMemoryHasMore] = useState(false);
  const [loadingMoreMemory, setLoadingMoreMemory] = useState(false);
  const [role, setRole] = useState('member');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AtlasMemoryKind>('decision');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [modules, setModules] = useState(moduleScope);
  const [tags, setTags] = useState('');
  const [sourceType, setSourceType] = useState<AtlasMemorySource>('user_entry');
  const [sourceRef, setSourceRef] = useState('');
  const [sensitivity, setSensitivity] = useState<'organization' | 'restricted'>('organization');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canApprove = ['owner','admin','platform_admin'].includes(role);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setRecords(null);
    void Promise.all([
      listAtlasMemory({
        q: debouncedQuery,
        kind: kindFilter,
        status: statusFilter,
        module: moduleScope,
        limit: PAGE_SIZE,
        offset: 0,
        signal: controller.signal
      }),
      getAtlasMemoryStats(moduleScope || undefined, controller.signal)
    ]).then(([response, statsResponse]) => {
      setRecords(response.records);
      setMemoryTotal(response.total);
      setMemoryHasMore(response.has_more);
      setMemoryStats(statsResponse.stats);
      setRole(response.role);
    }).catch(caught => {
      if (!aborted(caught)) setError(caught instanceof Error ? caught.message : 'memory_unavailable');
    });
    return () => controller.abort();
  }, [debouncedQuery, kindFilter, moduleScope, refreshVersion, statusFilter]);

  const loadMoreMemory = useCallback(async () => {
    if (!records || !memoryHasMore || loadingMoreMemory) return;
    setLoadingMoreMemory(true);
    setError(null);
    try {
      const response = await listAtlasMemory({
        q: debouncedQuery,
        kind: kindFilter,
        status: statusFilter,
        module: moduleScope,
        limit: PAGE_SIZE,
        offset: records.length
      });
      setRecords(current => [...(current || []), ...response.records]);
      setMemoryTotal(response.total);
      setMemoryHasMore(response.has_more);
      setRole(response.role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'memory_unavailable');
    } finally {
      setLoadingMoreMemory(false);
    }
  }, [debouncedQuery, kindFilter, loadingMoreMemory, memoryHasMore, moduleScope, records, statusFilter]);

  const refresh = () => setRefreshVersion(value => value + 1);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await createAtlasMemoryDraft({
        kind,
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim(),
        sourceType,
        sourceRef: sourceRef.trim() || undefined,
        moduleIds: [...new Set([...(moduleScope ? [moduleScope] : []), ...splitList(modules)])],
        tags: splitList(tags),
        sensitivity
      });
      setTitle('');
      setSummary('');
      setContent('');
      setModules(moduleScope);
      setTags('');
      setSourceRef('');
      setSourceType('user_entry');
      setSensitivity('organization');
      setSuccess('Memory saved as draft. It will not become approved ATLAS knowledge until explicitly approved.');
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'memory_save_failed');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    if (!canApprove || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await approveAtlasMemory(id);
      setSuccess('Memory approved and available as governed ATLAS organizational knowledge.');
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'memory_approval_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-stack" aria-labelledby="knowledge-atlas-heading">
      <header className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="knowledge-atlas-heading">{heading}</h1>
        <p>{description}</p>
      </header>

      <div className="metric-grid" aria-label="ATLAS Memory status" aria-live="polite">
        <article><span>Approved</span><strong>{memoryStats?.approved ?? '—'}</strong><small>Approved organizational knowledge</small></article>
        <article><span>Drafts</span><strong>{memoryStats?.draft ?? '—'}</strong><small>Awaiting explicit approval</small></article>
        <article><span>Superseded</span><strong>{memoryStats?.superseded ?? '—'}</strong><small>Retained for provenance</small></article>
        <article><span>Role</span><strong>{role}</strong><small>{canApprove ? 'Approval enabled' : 'Read and draft access'}</small></article>
      </div>

      <LibraryRegistryPanel moduleScope={moduleScope} />

      <section className="workspace-card" aria-label="Filter ATLAS Memory">
        <div className="toolbar">
          <label className="field wide-field">
            <span>Search memory</span>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search decisions, workflows, modules or tags" />
          </label>
          <label className="field">
            <span>Kind</span>
            <select value={kindFilter} onChange={event => setKindFilter(event.target.value)}>
              <option value="">All kinds</option>
              {KINDS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="">All states</option>
              <option value="approved">Approved</option>
              <option value="draft">Draft</option>
              <option value="superseded">Superseded</option>
            </select>
          </label>
        </div>
      </section>

      <form className="workspace-card page-stack" onSubmit={event => void save(event)} aria-label="Add governed knowledge">
        <div>
          <p className="eyebrow">Add knowledge</p>
          <h2>New governed memory</h2>
          <p className="muted">Save only product decisions, requirements, workflows, configuration or evidence that belongs to this organization.</p>
        </div>
        <div className="work-config-grid">
          <label><span>Title</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={240} required /></label>
          <label><span>Kind</span><select value={kind} onChange={event => setKind(event.target.value as AtlasMemoryKind)}>{KINDS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Source</span>
            <select value={sourceType} onChange={event => setSourceType(event.target.value as AtlasMemorySource)}>
              <option value="user_entry">User entry</option>
              <option value="chat_import">Chat import</option>
              <option value="document">Document</option>
              <option value="atlas">ATLAS internal</option>
            </select>
          </label>
          <label><span>Sensitivity</span><select value={sensitivity} onChange={event => setSensitivity(event.target.value as 'organization' | 'restricted')}><option value="organization">Organization</option><option value="restricted">Restricted</option></select></label>
          <label><span>Modules</span><input value={moduleScope || modules} onChange={event => setModules(event.target.value)} placeholder="accounting, inventory, finance" readOnly={Boolean(moduleScope)} aria-readonly={Boolean(moduleScope)} /></label>
          <label><span>Tags</span><input value={tags} onChange={event => setTags(event.target.value)} placeholder="3-way-match, AP, COGS" /></label>
          <label><span>Source reference</span><input value={sourceRef} onChange={event => setSourceRef(event.target.value)} placeholder={sourceType === 'chat_import' ? 'Required conversation/reference ID' : 'Optional URL or record reference'} required={sourceType === 'chat_import'} /></label>
        </div>
        <label className="field"><span>Summary</span><textarea value={summary} onChange={event => setSummary(event.target.value)} rows={3} maxLength={4000} /></label>
        <label className="field"><span>Knowledge content</span><textarea value={content} onChange={event => setContent(event.target.value)} rows={7} required /></label>
        <div className="work-actions"><button className="execution-action" type="submit" disabled={busy || !title.trim() || !content.trim()}>{busy ? 'Saving…' : 'Save draft'}</button></div>
      </form>

      {error ? <div className="work-error" role="alert">{error}</div> : null}
      {success ? <p className="notice strong" role="status">{success}</p> : null}
      {records === null && !error ? <p aria-busy="true" role="status">Loading ATLAS Memory…</p> : null}
      {records?.length === 0 ? <div className="empty-state"><strong>No organizational memory matches this view.</strong><span>Create a draft or change the filters. ATLAS will not invent historical records.</span></div> : null}
      {records?.length ? <>
        <p className="muted" role="status" aria-live="polite">Showing {records.length.toLocaleString()} of {memoryTotal.toLocaleString()} matching records.</p>
        <div className="module-grid" aria-label="ATLAS Memory records">
          {records.map(record => (
            <article className="module-card enabled" key={record.id}>
              <span>{record.kind} · {record.status}</span>
              <strong>{record.title}</strong>
              <p>{record.summary || String(record.content_json?.text || '').slice(0, 220)}</p>
              <small className="muted">Source: {record.source_type}{record.source_ref ? ` · ${record.source_ref}` : ''}</small>
              <small className="muted">Modules: {record.module_ids.length ? record.module_ids.join(', ') : 'Cross-module'} · v{record.version}</small>
              {record.status === 'draft' && canApprove ? (
                <button className="execution-action" type="button" disabled={busy} onClick={() => void approve(record.id)}>Approve memory</button>
              ) : null}
            </article>
          ))}
        </div>
        {memoryHasMore ? <div className="work-actions"><button className="execution-action" type="button" onClick={() => void loadMoreMemory()} disabled={loadingMoreMemory}>{loadingMoreMemory ? 'Loading…' : 'Load more memory'}</button></div> : null}
      </> : null}

      <div className="notice strong">
        Approval means “authorized organizational knowledge,” not external factual verification. Evidence-backed claims must still retain their source and module-specific validation gates.
      </div>
    </section>
  );
}
