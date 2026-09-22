import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  approveAtlasMemory,
  createAtlasMemoryDraft,
  listAtlasMemory,
  type AtlasMemoryKind,
  type AtlasMemoryRecord,
  type AtlasMemorySource
} from './memoryApi';

const KINDS: AtlasMemoryKind[] = ['decision','requirement','workflow','configuration','evidence','note'];

function splitList(value: string) {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))].slice(0, 40);
}

export function KnowledgeAtlasPage() {
  const [records, setRecords] = useState<AtlasMemoryRecord[] | null>(null);
  const [role, setRole] = useState('member');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AtlasMemoryKind>('decision');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [modules, setModules] = useState('');
  const [tags, setTags] = useState('');
  const [sourceType, setSourceType] = useState<AtlasMemorySource>('user_entry');
  const [sourceRef, setSourceRef] = useState('');
  const [sensitivity, setSensitivity] = useState<'organization' | 'restricted'>('organization');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canApprove = ['owner','admin','platform_admin'].includes(role);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await listAtlasMemory({ q: query, kind: kindFilter, status: statusFilter });
      setRecords(response.records);
      setRole(response.role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'memory_unavailable');
    }
  }, [kindFilter, query, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    approved: records?.filter(item => item.status === 'approved').length || 0,
    draft: records?.filter(item => item.status === 'draft').length || 0,
    superseded: records?.filter(item => item.status === 'superseded').length || 0
  }), [records]);

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
        moduleIds: splitList(modules),
        tags: splitList(tags),
        sensitivity
      });
      setTitle('');
      setSummary('');
      setContent('');
      setModules('');
      setTags('');
      setSourceRef('');
      setSourceType('user_entry');
      setSensitivity('organization');
      setSuccess('Memory saved as draft. It will not become approved ATLAS knowledge until explicitly approved.');
      await load();
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
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'memory_approval_failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">Knowledge Atlas</p>
        <h1>ATLAS Memory</h1>
        <p>
          Persistent organizational knowledge shared across ATLAS. Imported conversations remain drafts until an authorized
          owner or administrator approves them. Personal conversations are not ingested automatically.
        </p>
      </header>

      <div className="metric-grid" aria-label="ATLAS Memory status">
        <article><span>Approved</span><strong>{counts.approved}</strong><small>Governed organizational truth</small></article>
        <article><span>Drafts</span><strong>{counts.draft}</strong><small>Awaiting explicit approval</small></article>
        <article><span>Superseded</span><strong>{counts.superseded}</strong><small>Retained for provenance</small></article>
        <article><span>Role</span><strong>{role}</strong><small>{canApprove ? 'Approval enabled' : 'Read and draft access'}</small></article>
      </div>

      <section className="workspace-card">
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

      <form className="workspace-card page-stack" onSubmit={event => void save(event)}>
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
          <label><span>Modules</span><input value={modules} onChange={event => setModules(event.target.value)} placeholder="accounting, inventory, finance" /></label>
          <label><span>Tags</span><input value={tags} onChange={event => setTags(event.target.value)} placeholder="3-way-match, AP, COGS" /></label>
          <label><span>Source reference</span><input value={sourceRef} onChange={event => setSourceRef(event.target.value)} placeholder={sourceType === 'chat_import' ? 'Required conversation/reference ID' : 'Optional URL or record reference'} required={sourceType === 'chat_import'} /></label>
        </div>
        <label className="field"><span>Summary</span><textarea value={summary} onChange={event => setSummary(event.target.value)} rows={3} maxLength={4000} /></label>
        <label className="field"><span>Knowledge content</span><textarea value={content} onChange={event => setContent(event.target.value)} rows={7} required /></label>
        <div className="work-actions"><button className="execution-action" type="submit" disabled={busy || !title.trim() || !content.trim()}>{busy ? 'Saving…' : 'Save draft'}</button></div>
      </form>

      {error ? <div className="work-error" role="alert">{error}</div> : null}
      {success ? <p className="notice strong" role="status">{success}</p> : null}
      {records === null && !error ? <p aria-busy="true">Loading ATLAS Memory…</p> : null}
      {records?.length === 0 ? <div className="empty-state"><strong>No organizational memory matches this view.</strong><span>Create a draft or change the filters. ATLAS will not invent historical records.</span></div> : null}
      {records?.length ? (
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
      ) : null}

      <div className="notice strong">
        Approval means “authorized organizational knowledge,” not external factual verification. Evidence-backed claims must still retain their source and module-specific validation gates.
      </div>
    </section>
  );
}
